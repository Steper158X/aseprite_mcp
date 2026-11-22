import { describe, expect, test } from "bun:test";
import {
  rasterizeEllipse,
  rasterizeLine,
  rasterizePixelArt,
  rasterizeRect,
} from "../src/raster.ts";

describe("rasterizeLine", () => {
  test("horizontal and diagonal lines include exact endpoints and expected count", () => {
    const hLine = rasterizeLine(0, 2, 4, 2, "#ff0000");
    expect(hLine).toHaveLength(5);
    expect(hLine[0]).toEqual({ x: 0, y: 2, color: "#ff0000" });
    expect(hLine[4]).toEqual({ x: 4, y: 2, color: "#ff0000" });

    const diag = rasterizeLine(1, 1, 5, 5, "#00ff00");
    expect(diag).toHaveLength(5);
    expect(diag).toContainEqual({ x: 1, y: 1, color: "#00ff00" });
    expect(diag).toContainEqual({ x: 5, y: 5, color: "#00ff00" });
  });

  test("single point line with brush size 3 stamps a 3x3 square", () => {
    const dot = rasterizeLine(5, 5, 5, 5, "#ffffff", 3);
    expect(dot).toHaveLength(9);
    expect(dot).toContainEqual({ x: 4, y: 4, color: "#ffffff" });
    expect(dot).toContainEqual({ x: 6, y: 6, color: "#ffffff" });
  });
});

describe("rasterizeRect", () => {
  test("filled rect produces exactly width * height pixels", () => {
    const rect = rasterizeRect(2, 3, 4, 5, "#123456", true);
    expect(rect).toHaveLength(20);
    expect(rect).toContainEqual({ x: 2, y: 3, color: "#123456" });
    expect(rect).toContainEqual({ x: 5, y: 7, color: "#123456" });
  });

  test("outline rect produces perimeter without duplicate corners", () => {
    const outline = rasterizeRect(0, 0, 4, 3, "#abcdef", false);
    // 4*3 = 12 minus 2 interior pixels = 10
    expect(outline).toHaveLength(10);
    const keys = new Set(outline.map((p) => `${p.x},${p.y}`));
    expect(keys.size).toBe(10);
    expect(keys.has("1,1")).toBe(false);
    expect(keys.has("2,1")).toBe(false);
  });
});

describe("rasterizeEllipse", () => {
  test("outline ellipse is symmetric and stays within bounding box", () => {
    for (const [w, h] of [
      [4, 4],
      [5, 5],
      [11, 7],
      [8, 12],
    ] as const) {
      const x0 = 10;
      const y0 = 20;
      const pixels = rasterizeEllipse(x0, y0, w, h, "#ff00ff", false);
      const set = new Set(pixels.map((p) => `${p.x},${p.y}`));
      expect(set.size).toBe(pixels.length);

      for (const p of pixels) {
        expect(p.x).toBeGreaterThanOrEqual(x0);
        expect(p.x).toBeLessThanOrEqual(x0 + w - 1);
        expect(p.y).toBeGreaterThanOrEqual(y0);
        expect(p.y).toBeLessThanOrEqual(y0 + h - 1);

        const mx = 2 * x0 + w - 1 - p.x;
        const my = 2 * y0 + h - 1 - p.y;
        expect(set.has(`${mx},${p.y}`)).toBe(true);
        expect(set.has(`${p.x},${my}`)).toBe(true);
      }
    }
  });

  test("filled ellipse is symmetric and contains center", () => {
    const pixels = rasterizeEllipse(0, 0, 7, 5, "#00ffff", true);
    const set = new Set(pixels.map((p) => `${p.x},${p.y}`));
    expect(set.has("3,2")).toBe(true);
    expect(set.has("0,0")).toBe(false);
    expect(set.has("6,4")).toBe(false);
    for (const p of pixels) {
      expect(set.has(`${6 - p.x},${p.y}`)).toBe(true);
      expect(set.has(`${p.x},${4 - p.y}`)).toBe(true);
    }
  });
});

describe("rasterizePixelArt", () => {
  test("skips transparentChar and maps palette colors at offset", () => {
    const pixels = rasterizePixelArt(
      10,
      20,
      [".X.", "XOX", ".X."],
      { X: "#000000", O: "#ff0000" },
      ".",
    );
    expect(pixels).toEqual([
      { x: 11, y: 20, color: "#000000" },
      { x: 10, y: 21, color: "#000000" },
      { x: 11, y: 21, color: "#ff0000" },
      { x: 12, y: 21, color: "#000000" },
      { x: 11, y: 22, color: "#000000" },
    ]);
  });

  test("throws on unmapped palette character", () => {
    expect(() =>
      rasterizePixelArt(0, 0, [".Z."], { X: "#000000" }, "."),
    ).toThrow(/Unknown palette character "Z"/);
  });
});
