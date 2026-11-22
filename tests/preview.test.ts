import { afterEach, describe, expect, test } from "bun:test";
import { Bridge } from "../src/bridge.ts";
import { PreviewHub } from "../src/preview.ts";
import { type HttpServerHandle, startHttpServer } from "../src/server.ts";

const FAKE_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("PreviewHub & HTTP endpoints", () => {
  const handles: HttpServerHandle[] = [];
  const sockets: WebSocket[] = [];

  afterEach(() => {
    for (const ws of sockets) {
      try {
        ws.close();
      } catch {
        // ignore
      }
    }
    sockets.length = 0;
    for (const h of handles) {
      h.stop();
    }
    handles.length = 0;
  });

  test("GET / serves preview HTML and GET /preview.png tracks frame state", async () => {
    const bridge = new Bridge();
    const preview = new PreviewHub();
    const handle = startHttpServer({ port: 0, bridge, preview });
    handles.push(handle);

    const htmlRes = await fetch(`http://127.0.0.1:${handle.port}/`);
    expect(htmlRes.status).toBe(200);
    expect(htmlRes.headers.get("content-type")).toContain("text/html");
    const htmlText = await htmlRes.text();
    expect(htmlText).toContain("Aseprite MCP Preview");

    const missingPng = await fetch(`http://127.0.0.1:${handle.port}/preview.png`);
    expect(missingPng.status).toBe(404);

    preview.publishFrame({
      png: FAKE_PNG,
      width: 64,
      height: 64,
      mode: "live",
      tool: "draw_rect",
      ts: 123456,
    });

    const pngRes = await fetch(`http://127.0.0.1:${handle.port}/preview.png`);
    expect(pngRes.status).toBe(200);
    expect(pngRes.headers.get("content-type")).toBe("image/png");
    const body = new Uint8Array(await pngRes.arrayBuffer());
    expect(Array.from(body)).toEqual(Array.from(FAKE_PNG));
  });

  test("WebSocket /preview receives initial state and live broadcasts", async () => {
    const bridge = new Bridge();
    const preview = new PreviewHub();
    const handle = startHttpServer({ port: 0, bridge, preview });
    handles.push(handle);

    preview.publishStatus({ activeBackend: "live", connected: true });

    const received: Array<Record<string, unknown>> = [];
    const ws = new WebSocket(`ws://127.0.0.1:${handle.port}/preview`);
    sockets.push(ws);
    ws.addEventListener("message", (event) => {
      received.push(JSON.parse(String(event.data)) as Record<string, unknown>);
    });

    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", (e) => reject(e));
    });

    await Bun.sleep(30);
    expect(received.some((m) => m.type === "status" && m.activeBackend === "live")).toBe(true);

    preview.publishFrame({
      png: FAKE_PNG,
      width: 128,
      height: 128,
      spriteWidth: 16,
      spriteHeight: 16,
      mode: "headless",
      tool: "draw_ellipse",
      ts: 999999,
    });

    await Bun.sleep(30);
    const frameMsg = received.find((m) => m.type === "frame");
    expect(frameMsg).toBeDefined();
    expect(frameMsg?.tool).toBe("draw_ellipse");
    expect(frameMsg?.mode).toBe("headless");
    expect(frameMsg?.png).toBe(Buffer.from(FAKE_PNG).toString("base64"));
  });
});
