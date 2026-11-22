import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pluginRoot } from "../src/paths.ts";
import { crc32, packagePlugin, verifyZipArchive } from "../src/plugin-package.ts";

describe("crc32", () => {
  test("matches standard IEEE 802.3 test vector", () => {
    const input = Buffer.from("123456789", "ascii");
    expect(crc32(input)).toBe(0xcbf43926);
    expect(crc32(Buffer.alloc(0))).toBe(0);
  });
});

describe("packagePlugin", () => {
  test("produces a valid PKZIP .aseprite-extension archive matching source files", () => {
    const dir = join(tmpdir(), `aseprite-pack-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });

    try {
      const result = packagePlugin({ distDir: dir });
      expect(result.extPath).toBe(join(dir, "aseprite-mcp-bridge.aseprite-extension"));
      expect(existsSync(result.extPath)).toBe(true);

      const rawZip = readFileSync(result.extPath);
      expect(rawZip[0]).toBe(0x50);
      expect(rawZip[1]).toBe(0x4b);
      expect(rawZip[2]).toBe(0x03);
      expect(rawZip[3]).toBe(0x04);
      expect(rawZip.includes(Buffer.from("ustar", "ascii"))).toBe(false);

      for (const entry of result.entries) {
        expect(entry.includes("\\")).toBe(false);
      }

      const required = ["package.json", "plugin.lua", "lib/handlers.lua", "lib/util.lua"];
      for (const req of required) {
        expect(result.entries).toContain(req);
      }
      expect(result.entries).toContain("lib/");

      const verified = verifyZipArchive(rawZip);
      const srcPluginDir = pluginRoot();
      for (const [name, content] of verified.entries()) {
        if (name.endsWith("/")) {
          expect(content.length).toBe(0);
        } else {
          const diskBytes = readFileSync(join(srcPluginDir, ...name.split("/")));
          expect(content.equals(diskBytes)).toBe(true);
        }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("verifyZipArchive", () => {
  test("rejects a non-ZIP buffer such as a POSIX ustar TAR archive", () => {
    const tarHeader = Buffer.alloc(512, 0);
    Buffer.from("package.json", "ascii").copy(tarHeader, 0);
    Buffer.from("ustar  ", "ascii").copy(tarHeader, 257);
    expect(() => verifyZipArchive(tarHeader)).toThrow(/PK\\x03\\x04|Invalid ZIP archive/);
  });

  test("rejects an archive with corrupted CRC data", () => {
    const dir = join(tmpdir(), `aseprite-corrupt-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });

    try {
      const result = packagePlugin({ distDir: dir });
      const rawZip = Buffer.from(readFileSync(result.extPath));

      // Flip a bit in the stored CRC32 inside the first local file header (offset 14..17)
      // or central directory. First entry is "lib/" with CRC 0; corrupting its CRC triggers mismatch.
      rawZip[14] = (rawZip[14]! ^ 0xff) & 0xff;
      expect(() => verifyZipArchive(rawZip)).toThrow(/Invalid ZIP archive/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
