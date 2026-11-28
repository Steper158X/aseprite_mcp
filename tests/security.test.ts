import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { WebSocket as NodeWebSocket } from "ws";
import { LiveBackend, Router } from "../src/backend.ts";
import { authorizeLuaCall, tokenMatches } from "../src/bridge-config.ts";
import { Bridge } from "../src/bridge.ts";
import { HeadlessBackend } from "../src/headless.ts";
import {
  assertPathAllowed,
  getFsRoot,
  pathWithinRoot,
} from "../src/protocol.ts";
import { originAllowed, startHttpServer, type HttpServerHandle } from "../src/server.ts";
import { parseLibraryFoldersVdf } from "../src/steam-libraries.ts";

describe("filesystem sandbox", () => {
  test("defaults to the current directory and honors the unrestricted sentinel", () => {
    expect(getFsRoot("")).toBe(resolve(process.cwd()));
    expect(getFsRoot("*")).toBeNull();
    expect(getFsRoot("unrestricted")).toBeNull();
    expect(getFsRoot("/tmp/aseprite-art")).toBe(resolve("/tmp/aseprite-art"));
  });

  test("pathWithinRoot can ignore case", () => {
    expect(
      pathWithinRoot("C:\\Art\\Sprite.aseprite", "c:\\art", {
        caseInsensitive: true,
        pathSep: "\\",
      }),
    ).toBe(true);
    expect(
      pathWithinRoot("C:\\Other\\Sprite.aseprite", "c:\\art", {
        caseInsensitive: true,
        pathSep: "\\",
      }),
    ).toBe(false);
  });

  test("rejects a symlink that points outside the root", () => {
    const dir = mkdtempSync(join(tmpdir(), "aseprite-fs-"));
    const root = join(dir, "root");
    const outside = join(dir, "secret.png");
    mkdirSync(root);
    writeFileSync(outside, "nope");
    const link = join(root, "link.png");
    try {
      symlinkSync(outside, link);
    } catch {
      rmSync(dir, { recursive: true, force: true });
      return;
    }
    try {
      expect(() => assertPathAllowed(link, root)).toThrow(/ASEPRITE_MCP_FS_ROOT/);
      expect(assertPathAllowed(join(root, "inside.png"), root)).toContain("inside.png");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("bridge origin and preview auth", () => {
  const handles: HttpServerHandle[] = [];

  afterEach(() => {
    for (const handle of handles) handle.stop();
    handles.length = 0;
  });

  test("originAllowed accepts localhost and rejects other sites", () => {
    expect(originAllowed(undefined, 7777)).toBe(true);
    expect(originAllowed("http://127.0.0.1:7777", 7777)).toBe(true);
    expect(originAllowed("http://localhost:7777", 7777)).toBe(true);
    expect(originAllowed("http://[::1]:7777", 7777)).toBe(true);
    expect(originAllowed("https://evil.example", 7777)).toBe(false);
    expect(originAllowed("http://127.0.0.1:9", 7777)).toBe(false);
    expect(originAllowed("not a url", 7777)).toBe(false);
  });

  test("preview HTTP and websocket require the token", async () => {
    const bridge = new Bridge();
    const handle = await startHttpServer({
      port: 0,
      bridge,
      token: "preview-secret",
      preview: {
        attach() {},
        detach() {},
        getHtmlResponse: () => ({ status: 200, headers: { "content-type": "text/html" }, body: "ok" }),
        getPngResponse: () => ({ status: 200, headers: { "content-type": "image/png" }, body: "png" }),
      },
    });
    handles.push(handle);

    const denied = await fetch(`http://127.0.0.1:${handle.port}/`);
    expect(denied.status).toBe(401);
    const allowed = await fetch(`http://127.0.0.1:${handle.port}/?token=preview-secret`);
    expect(allowed.status).toBe(200);

      const status = await new Promise<number>((resolve, reject) => {
      const ws = new NodeWebSocket(`ws://127.0.0.1:${handle.port}/preview`, {
        headers: { Origin: "https://evil.example" },
      });
      ws.on("open", () => {
        ws.close();
        reject(new Error("hostile origin was accepted"));
      });
      ws.on("unexpected-response", (_request, res) => {
        void _request;
        resolve(res.statusCode ?? 0);
      });
      ws.on("error", () => resolve(403));
    });
    expect(status).toBe(403);
  });

  test("token comparison rejects a different length", () => {
    expect(tokenMatches("abc", "abcdef")).toBe(false);
    expect(tokenMatches("abcdef", "abcdef")).toBe(true);
    expect(tokenMatches(null, "abcdef")).toBe(false);
  });
});

describe("run_lua gate", () => {
  test("refuses run_lua until the process opts in", () => {
    const prev = process.env.ASEPRITE_MCP_ALLOW_LUA;
    delete process.env.ASEPRITE_MCP_ALLOW_LUA;
    try {
      expect(() => authorizeLuaCall("run_lua", { code: "return 1" })).toThrow(/ASEPRITE_MCP_ALLOW_LUA/);
      expect(authorizeLuaCall("ping", {}).allowLua).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.ASEPRITE_MCP_ALLOW_LUA;
      else process.env.ASEPRITE_MCP_ALLOW_LUA = prev;
    }
  });

  test("attaches the lua key only after the opt-in", () => {
    const dir = mkdtempSync(join(tmpdir(), "aseprite-lua-key-"));
    const prevAllow = process.env.ASEPRITE_MCP_ALLOW_LUA;
    const prevDir = process.env.ASEPRITE_MCP_CONFIG_DIR;
    process.env.ASEPRITE_MCP_ALLOW_LUA = "1";
    process.env.ASEPRITE_MCP_CONFIG_DIR = dir;
    try {
      const gated = authorizeLuaCall("run_lua", { code: "return 1" });
      expect(gated.allowLua).toBe(true);
      expect(typeof gated.params.luaKey).toBe("string");
      expect(String(gated.params.luaKey).length).toBeGreaterThan(10);
    } finally {
      if (prevAllow === undefined) delete process.env.ASEPRITE_MCP_ALLOW_LUA;
      else process.env.ASEPRITE_MCP_ALLOW_LUA = prevAllow;
      if (prevDir === undefined) delete process.env.ASEPRITE_MCP_CONFIG_DIR;
      else process.env.ASEPRITE_MCP_CONFIG_DIR = prevDir;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("steam libraryfolders.vdf", () => {
  test("reads escaped library paths", () => {
    const text = `
"libraryfolders"
{
  "0"
  {
    "path" "C:\\\\Program Files (x86)\\\\Steam"
  }
  "1"
  {
    "path" "F:\\\\SteamLibrary"
  }
}
`;
    expect(parseLibraryFoldersVdf(text)).toEqual([
      "C:\\Program Files (x86)\\Steam",
      "F:\\SteamLibrary",
    ]);
  });
});

describe("auto mode after a blink", () => {
  test("resolveBackend throws instead of selecting headless", async () => {
    const bridge = new Bridge();
    await bridge.start(0, { token: null });
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${bridge.port}/aseprite`);
      await new Promise<void>((resolve, reject) => {
        ws.addEventListener("open", () => resolve());
        ws.addEventListener("error", () => reject(new Error("socket failed")));
      });
      ws.close();
      await Bun.sleep(20);
      const router = new Router({
        mode: "auto",
        bridge,
        live: new LiveBackend(bridge),
        headless: new HeadlessBackend({
          workdir: mkdtempSync(join(tmpdir(), "aseprite-sec-router-")),
          runner: async () => ({ ok: true, result: {} }),
        }),
      });
      expect(() => router.resolveBackend()).toThrow(/not connected/i);
    } finally {
      bridge.stop();
    }
  });
});
