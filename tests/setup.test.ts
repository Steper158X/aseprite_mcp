import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeAsepritePath } from "../src/setup.ts";

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
