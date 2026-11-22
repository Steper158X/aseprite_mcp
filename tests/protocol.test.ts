import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  assertPathAllowed,
  getBridgePort,
  normalizeLayerTree,
} from "../src/protocol.ts";

describe("getBridgePort", () => {
  test("defaults and accepts valid ports", () => {
    expect(getBridgePort(undefined)).toBe(7777);
    expect(getBridgePort("9000")).toBe(9000);
  });

  test("throws on invalid values", () => {
    expect(() => getBridgePort("nope")).toThrow(/Invalid ASEPRITE_MCP_PORT/);
    expect(() => getBridgePort("0")).toThrow(/Invalid ASEPRITE_MCP_PORT/);
    expect(() => getBridgePort("99999")).toThrow(/Invalid ASEPRITE_MCP_PORT/);
  });
});

describe("assertPathAllowed", () => {
  test("allows any path when root is null", () => {
    expect(assertPathAllowed("sprite.aseprite", null)).toContain("sprite.aseprite");
  });

  test("rejects paths outside root", () => {
    const root = join(process.cwd(), "sandbox-root");
    expect(() => assertPathAllowed(join(root, "..", "outside.png"), root)).toThrow(
      /ASEPRITE_MCP_FS_ROOT/,
    );
    expect(assertPathAllowed(join(root, "ok.png"), root)).toContain("ok.png");
  });
});

describe("normalizeLayerTree", () => {
  test("turns empty nested layer objects into arrays", () => {
    const normalized = normalizeLayerTree([
      { name: "Group", isGroup: true, layers: {} },
      { name: "Ink", isGroup: false },
    ]);
    expect(normalized).toEqual([
      { name: "Group", isGroup: true, layers: [] },
      { name: "Ink", isGroup: false },
    ]);
  });
});
