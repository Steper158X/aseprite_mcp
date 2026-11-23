import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cursorConfigTargets,
  normalizeAsepritePath,
  removeAsepriteFromMcpConfig,
} from "../src/setup.ts";

describe("normalizeAsepritePath", () => {
  test("returns null for missing paths", () => {
    expect(normalizeAsepritePath(join(tmpdir(), "no-such-aseprite-bin"))).toBeNull();
  });

  test("returns existing file paths as-is on this platform", () => {
    const dir = join(tmpdir(), `aseprite-norm-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "Aseprite.exe");
    writeFileSync(file, "x");
    try {
      expect(normalizeAsepritePath(file)).toBe(file);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("resolves macOS .app bundles to Contents/MacOS/aseprite when present", () => {
    if (process.platform !== "darwin") {
      // Simulate the darwin branch by only checking the helper ignores non-.app dirs here.
      const dir = join(tmpdir(), `aseprite-app-${Date.now()}`);
      mkdirSync(dir, { recursive: true });
      try {
        expect(normalizeAsepritePath(dir)).toBe(dir);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
      return;
    }

    const app = join(tmpdir(), `Aseprite-${Date.now()}.app`);
    const inner = join(app, "Contents", "MacOS", "aseprite");
    mkdirSync(join(app, "Contents", "MacOS"), { recursive: true });
    writeFileSync(inner, "x");
    try {
      expect(normalizeAsepritePath(app)).toBe(inner);
    } finally {
      rmSync(app, { recursive: true, force: true });
    }
  });
});

describe("cursorConfigTargets", () => {
  test("prefers project .cursor/mcp.json inside a project tree", () => {
    const dir = join(tmpdir(), `aseprite-cursor-targets-${Date.now()}`);
    mkdirSync(join(dir, ".cursor"), { recursive: true });
    writeFileSync(join(dir, "package.json"), "{}");
    try {
      const targets = cursorConfigTargets(dir);
      expect(targets.primary).toBe(join(dir, ".cursor", "mcp.json"));
      expect(targets.alternate).toContain(join(".cursor", "mcp.json"));
      expect(targets.alternate).not.toBe(targets.primary);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("removeAsepriteFromMcpConfig", () => {
  test("removes only aseprite and leaves other servers", () => {
    const dir = join(tmpdir(), `aseprite-mcp-clear-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "mcp.json");
    writeFileSync(
      file,
      JSON.stringify(
        {
          mcpServers: {
            aseprite: { command: "node", args: ["bin.js"] },
            other: { command: "echo" },
          },
        },
        null,
        2,
      ),
    );
    try {
      expect(removeAsepriteFromMcpConfig(file)).toBe(true);
      const next = JSON.parse(readFileSync(file, "utf8")) as {
        mcpServers: Record<string, unknown>;
      };
      expect(next.mcpServers.aseprite).toBeUndefined();
      expect(next.mcpServers.other).toEqual({ command: "echo" });
      expect(removeAsepriteFromMcpConfig(file)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
