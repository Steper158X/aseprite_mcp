import type { Pixel } from "./protocol.ts";

export const MAX_RASTER_PIXELS = 20000;

function assertPixelBudget(estimate: number, label: string): void {
  if (estimate > MAX_RASTER_PIXELS) {
    throw new Error(`${label} would touch ~${estimate} pixels (max ${MAX_RASTER_PIXELS})`);
  }
}

function addPixel(map: Map<string, Pixel>, x: number, y: number, color: string): void {
  map.set(`${x},${y}`, { x, y, color });
}

function stampBrush(
  map: Map<string, Pixel>,
  cx: number,
  cy: number,
  size: number,
  color: string,
): void {
  const s = Math.max(1, Math.round(size));
  if (s === 1) {
    addPixel(map, cx, cy, color);
    return;
  }
  const startOffset = -Math.floor((s - 1) / 2);
  const endOffset = startOffset + s - 1;
  for (let dy = startOffset; dy <= endOffset; dy++) {
    for (let dx = startOffset; dx <= endOffset; dx++) {
      addPixel(map, cx + dx, cy + dy, color);
    }
  }
}

export function rasterizeLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  size = 1,
): Pixel[] {
  let cx = Math.round(x1);
  let cy = Math.round(y1);
  const tx = Math.round(x2);
  const ty = Math.round(y2);
  const brush = Math.max(1, Math.round(size));
  const steps = Math.max(Math.abs(tx - cx), Math.abs(ty - cy)) + 1;
  assertPixelBudget(steps * brush * brush, "Line");

  const dx = Math.abs(tx - cx);
  const sx = cx < tx ? 1 : -1;
  const dy = -Math.abs(ty - cy);
  const sy = cy < ty ? 1 : -1;
  let err = dx + dy;

  const pixels = new Map<string, Pixel>();
  while (true) {
    stampBrush(pixels, cx, cy, brush, color);
    if (cx === tx && cy === ty) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      cx += sx;
    }
    if (e2 <= dx) {
      err += dx;
      cy += sy;
    }
  }

  return Array.from(pixels.values());
}

export function rasterizeRect(
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  filled = false,
): Pixel[] {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const w = Math.round(width);
  const h = Math.round(height);
  if (w <= 0 || h <= 0) return [];

  const estimate = filled ? w * h : 2 * w + 2 * Math.max(0, h - 2);
  assertPixelBudget(estimate, "Rectangle");

  const pixels = new Map<string, Pixel>();
  const x1 = x0 + w - 1;
  const y1 = y0 + h - 1;

  if (filled) {
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        addPixel(pixels, px, py, color);
      }
    }
    return Array.from(pixels.values());
  }

  for (let px = x0; px <= x1; px++) {
    addPixel(pixels, px, y0, color);
  }
  if (h > 1) {
    for (let px = x0; px <= x1; px++) {
      addPixel(pixels, px, y1, color);
    }
  }
  for (let py = y0 + 1; py < y1; py++) {
    addPixel(pixels, x0, py, color);
    if (w > 1) {
      addPixel(pixels, x1, py, color);
    }
  }

  return Array.from(pixels.values());
}

export function rasterizeEllipse(
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  filled = false,
): Pixel[] {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const w = Math.round(width);
  const h = Math.round(height);
  if (w <= 0 || h <= 0) return [];

  // Bounding-box upper bound before allocation.
  assertPixelBudget(w * h, "Ellipse");

  if (w === 1 || h === 1) {
    return rasterizeRect(x0, y0, w, h, color, true);
  }

  const pixels = new Map<string, Pixel>();
  let lx0 = x0;
  let lx1 = x0 + w - 1;
  const a = lx1 - lx0;
  const b = h - 1;
  let b1 = b & 1;

  let dx = 4 * (1 - a) * b * b;
  let dy = 4 * (b1 + 1) * a * a;
  let err = dx + dy + b1 * a * a;

  let ly0 = y0 + Math.floor((b + 1) / 2);
  let ly1 = ly0 - b1;
  const aStep = 8 * a * a;
  const bStep = 8 * b * b;

  const plotSpan = (sx0: number, sx1: number, sy0: number, sy1: number) => {
    if (filled) {
      for (let px = sx0; px <= sx1; px++) {
        addPixel(pixels, px, sy0, color);
        addPixel(pixels, px, sy1, color);
      }
    } else {
      addPixel(pixels, sx1, sy0, color);
      addPixel(pixels, sx0, sy0, color);
      addPixel(pixels, sx0, sy1, color);
      addPixel(pixels, sx1, sy1, color);
    }
  };

  while (lx0 <= lx1) {
    plotSpan(lx0, lx1, ly0, ly1);
    const e2 = 2 * err;
    if (e2 <= dy) {
      ly0++;
      ly1--;
      dy += aStep;
      err += dy;
    }
    if (e2 >= dx || 2 * err > dy) {
      lx0++;
      lx1--;
      dx += bStep;
      err += dx;
    }
  }

  while (ly0 - ly1 < b) {
    ly0++;
    ly1--;
    plotSpan(lx0 - 1, lx1 + 1, ly0, ly1);
  }

  return Array.from(pixels.values());
}

export function rasterizePixelArt(
  x: number,
  y: number,
  rows: string[],
  palette: Record<string, string>,
  transparentChar = ".",
): Pixel[] {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  let estimate = 0;
  for (const row of rows) {
    estimate += [...row].filter((ch) => ch !== transparentChar).length;
  }
  assertPixelBudget(estimate, "Pixel art");

  const pixels: Pixel[] = [];

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx] ?? "";
    let colIdx = 0;
    for (const ch of row) {
      if (ch !== transparentChar) {
        const color = palette[ch];
        if (!color) {
          throw new Error(
            `Unknown palette character "${ch}" at row ${rowIdx}, column ${colIdx}`,
          );
        }
        pixels.push({ x: x0 + colIdx, y: y0 + rowIdx, color });
      }
      colIdx++;
    }
  }

  return pixels;
}
