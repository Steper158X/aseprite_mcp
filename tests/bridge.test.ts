import { afterEach, describe, expect, test } from "bun:test";
import { Bridge } from "../src/bridge.ts";

function connectFakeClient(
  url: string,
  onRequest?: (req: { id: string; method: string; params: Record<string, unknown> }, ws: WebSocket) => void,
): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => {
      ws.send(
        JSON.stringify({
          type: "hello",
          plugin: "0.1.0",
          aseprite: "1.3.18.6",
          apiVersion: 28,
        }),
      );
      resolve(ws);
    });
    ws.addEventListener("message", (event) => {
      if (!onRequest) return;
      const msg = JSON.parse(String(event.data)) as {
        id: string;
        method: string;
        params: Record<string, unknown>;
      };
      onRequest(msg, ws);
    });
    ws.addEventListener("error", (err) => reject(err));
  });
}

describe("Bridge", () => {
  const bridges: Bridge[] = [];
  const sockets: WebSocket[] = [];

  afterEach(() => {
    for (const s of sockets) {
      try {
        s.close();
      } catch {
        // ignore
      }
    }
    sockets.length = 0;
    for (const b of bridges) {
      b.stop();
    }
    bridges.length = 0;
  });

  test("call resolves with result and stores hello info", async () => {
    const bridge = new Bridge();
    bridges.push(bridge);
    bridge.start(0);
    expect(bridge.port).toBeGreaterThan(0);

    const ws = await connectFakeClient(`ws://127.0.0.1:${bridge.port}/aseprite`, (req, sock) => {
      sock.send(
        JSON.stringify({
          id: req.id,
          ok: true,
          result: { echoMethod: req.method, params: req.params },
        }),
      );
    });
    sockets.push(ws);

    await Bun.sleep(20);
    expect(bridge.isConnected).toBe(true);
    expect(bridge.info).toEqual({
      type: "hello",
      plugin: "0.1.0",
      aseprite: "1.3.18.6",
      apiVersion: 28,
    });

    const result = await bridge.call("ping", { n: 42 });
    expect(result).toEqual({ echoMethod: "ping", params: { n: 42 } });
  });

  test("error response from plugin rejects call", async () => {
    const bridge = new Bridge();
    bridges.push(bridge);
    bridge.start(0);

    const ws = await connectFakeClient(`ws://127.0.0.1:${bridge.port}/aseprite`, (req, sock) => {
      sock.send(JSON.stringify({ id: req.id, ok: false, error: "No active sprite" }));
    });
    sockets.push(ws);

    await expect(bridge.call("get_sprite_info")).rejects.toThrow("No active sprite");
  });

  test("timeout rejects pending request", async () => {
    const bridge = new Bridge();
    bridges.push(bridge);
    bridge.start(0);

    const ws = await connectFakeClient(`ws://127.0.0.1:${bridge.port}/aseprite`);
    sockets.push(ws);

    await expect(bridge.call("slow_method", {}, 40)).rejects.toThrow(/timed out/i);
  });

  test("disconnect rejects all pending requests", async () => {
    const bridge = new Bridge();
    bridges.push(bridge);
    bridge.start(0);

    const ws = await connectFakeClient(`ws://127.0.0.1:${bridge.port}/aseprite`);
    sockets.push(ws);

    const pendingCall = bridge
      .call("hang", {}, 5000)
      .then(() => null, (err: unknown) => err as Error);
    await Bun.sleep(15);
    ws.close();

    const err = await pendingCall;
    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toMatch(/disconnected/i);
    await Bun.sleep(20);
    expect(bridge.isConnected).toBe(false);
    expect(bridge.info).toBeNull();
  });

  test("new client replaces old client cleanly", async () => {
    const bridge = new Bridge();
    bridges.push(bridge);
    bridge.start(0);

    let firstClosed = false;
    const ws1 = await connectFakeClient(`ws://127.0.0.1:${bridge.port}/aseprite`);
    sockets.push(ws1);
    ws1.addEventListener("close", () => {
      firstClosed = true;
    });

    const pendingOnOld = bridge
      .call("old_req", {}, 5000)
      .then(() => null, (err: unknown) => err as Error);
    await Bun.sleep(15);

    const ws2 = await connectFakeClient(`ws://127.0.0.1:${bridge.port}/aseprite`, (req, sock) => {
      sock.send(JSON.stringify({ id: req.id, ok: true, result: { from: "second" } }));
    });
    sockets.push(ws2);

    const err = await pendingOnOld;
    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toMatch(/replaced/i);
    await Bun.sleep(30);
    expect(firstClosed).toBe(true);
    expect(bridge.isConnected).toBe(true);

    const res = await bridge.call("ping");
    expect(res).toEqual({ from: "second" });
  });

  test("port conflict does not throw on start and rejects calls cleanly", async () => {
    const bridge1 = new Bridge();
    bridges.push(bridge1);
    bridge1.start(0);

    const bridge2 = new Bridge();
    bridges.push(bridge2);
    bridge2.start(bridge1.port);

    expect(bridge2.portConflict).not.toBeNull();
    await expect(bridge2.call("ping")).rejects.toThrow(/already in use/i);
  });

  test("WebSocket connection to /other is refused", async () => {
    const bridge = new Bridge();
    bridges.push(bridge);
    bridge.start(0);

    const refused = await new Promise<boolean>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${bridge.port}/other`);
      sockets.push(ws);
      ws.addEventListener("open", () => resolve(false));
      ws.addEventListener("error", () => resolve(true));
      ws.addEventListener("close", () => resolve(true));
    });

    expect(refused).toBe(true);
    expect(bridge.isConnected).toBe(false);
  });
});
