import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Router } from "../backend.ts";
import {
  MAX_RASTER_PIXELS,
  rasterizeEllipse,
  rasterizeLine,
  rasterizePixelArt,
  rasterizeRect,
} from "../raster.ts";
import { hexColorSchema, layerFrameShape, runBackendTool, toolError } from "./common.ts";

const MAX_PIXELS = MAX_RASTER_PIXELS;
const MAX_DIM = 4096;

export function registerDrawTools(server: McpServer, router: Router): void {
  server.registerTool(
    "draw_pixels",
    {
      description:
        "Draw individual pixels onto a cel. Coordinates are 0-based from top-left; frames are 1-based; colors are #RRGGBB or #RRGGBBAA (replaces existing pixel color without alpha blending). Each call is one Ctrl+Z undo step. Use get_screenshot afterward to inspect your work.",
      inputSchema: {
        pixels: z
          .array(
            z.object({
              x: z.number().int().describe("0-based X pixel coordinate"),
              y: z.number().int().describe("0-based Y pixel coordinate"),
              color: hexColorSchema.describe("Hex color (#RRGGBB or #RRGGBBAA)"),
            }),
          )
          .min(1)
          .max(MAX_PIXELS)
          .describe("List of pixels to draw (max 20000)"),
        ...layerFrameShape,
      },
    },
    async ({ pixels, layer, frame }) =>
      runBackendTool(
        router,
        "draw_pixels",
        { pixels, layer, frame },
        { mutating: true, toolName: "draw_pixels" },
      ),
  );

  server.registerTool(
    "draw_pixel_art",
    {
      description:
        "Draw a sprite grid from ASCII rows and a character-to-hex palette map in a single undo step. Coordinates are 0-based from top-left; frames are 1-based; transparentChar (default '.') is skipped. Use get_screenshot afterward to inspect your work.",
      inputSchema: {
        x: z.number().int().describe("Top-left 0-based X offset on the canvas"),
        y: z.number().int().describe("Top-left 0-based Y offset on the canvas"),
        rows: z
          .array(z.string().max(MAX_DIM))
          .min(1)
          .max(MAX_DIM)
          .describe("Strings representing each pixel row from top to bottom"),
        palette: z
          .record(z.string().length(1), hexColorSchema)
          .describe("Map from single character to #RRGGBB or #RRGGBBAA hex color"),
        transparentChar: z
          .string()
          .length(1)
          .optional()
          .describe("Character treated as transparent/skipped (default '.')"),
        ...layerFrameShape,
      },
    },
    async ({ x, y, rows, palette, transparentChar, layer, frame }) => {
      try {
        const pixels = rasterizePixelArt(x, y, rows, palette, transparentChar ?? ".");
        return await runBackendTool(
          router,
          "draw_pixels",
          { pixels, layer, frame },
          { mutating: true, toolName: "draw_pixel_art" },
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "draw_line",
    {
      description:
        "Draw a line between two 0-based pixel coordinates with optional square brush thickness. One Ctrl+Z undo step. Use get_screenshot afterward to inspect your work.",
      inputSchema: {
        x1: z.number().int().describe("Start X (0-based)"),
        y1: z.number().int().describe("Start Y (0-based)"),
        x2: z.number().int().describe("End X (0-based)"),
        y2: z.number().int().describe("End Y (0-based)"),
        color: hexColorSchema.describe("Hex color (#RRGGBB or #RRGGBBAA)"),
        size: z
          .number()
          .int()
          .min(1)
          .max(64)
          .optional()
          .describe("Square brush thickness in pixels (default 1)"),
        ...layerFrameShape,
      },
    },
    async ({ x1, y1, x2, y2, color, size, layer, frame }) => {
      try {
        const pixels = rasterizeLine(x1, y1, x2, y2, color, size ?? 1);
        return await runBackendTool(
          router,
          "draw_pixels",
          { pixels, layer, frame },
          { mutating: true, toolName: "draw_line" },
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "draw_rect",
    {
      description:
        "Draw an outline or filled rectangle at 0-based top-left (x, y) with pixel width and height. One Ctrl+Z undo step. Use get_screenshot afterward to inspect your work.",
      inputSchema: {
        x: z.number().int().describe("Top-left X (0-based)"),
        y: z.number().int().describe("Top-left Y (0-based)"),
        width: z.number().int().min(1).max(MAX_DIM).describe("Rectangle width in pixels"),
        height: z.number().int().min(1).max(MAX_DIM).describe("Rectangle height in pixels"),
        color: hexColorSchema.describe("Hex color (#RRGGBB or #RRGGBBAA)"),
        filled: z.boolean().optional().describe("Fill interior (default false)"),
        ...layerFrameShape,
      },
    },
    async ({ x, y, width, height, color, filled, layer, frame }) => {
      try {
        const pixels = rasterizeRect(x, y, width, height, color, filled ?? false);
        return await runBackendTool(
          router,
          "draw_pixels",
          { pixels, layer, frame },
          { mutating: true, toolName: "draw_rect" },
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "draw_ellipse",
    {
      description:
        "Draw an outline or filled ellipse fitting inside the 0-based bounding box (x, y, width, height). One Ctrl+Z undo step. Use get_screenshot afterward to inspect your work.",
      inputSchema: {
        x: z.number().int().describe("Bounding box top-left X (0-based)"),
        y: z.number().int().describe("Bounding box top-left Y (0-based)"),
        width: z.number().int().min(1).max(MAX_DIM).describe("Bounding box width in pixels"),
        height: z.number().int().min(1).max(MAX_DIM).describe("Bounding box height in pixels"),
        color: hexColorSchema.describe("Hex color (#RRGGBB or #RRGGBBAA)"),
        filled: z.boolean().optional().describe("Fill interior (default false)"),
        ...layerFrameShape,
      },
    },
    async ({ x, y, width, height, color, filled, layer, frame }) => {
      try {
        const pixels = rasterizeEllipse(x, y, width, height, color, filled ?? false);
        return await runBackendTool(
          router,
          "draw_pixels",
          { pixels, layer, frame },
          { mutating: true, toolName: "draw_ellipse" },
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "fill_area",
    {
      description:
        "4-way contiguous paint-bucket flood fill starting at 0-based (x, y). One Ctrl+Z undo step. Use get_screenshot afterward to inspect your work.",
      inputSchema: {
        x: z.number().int().describe("Seed X coordinate (0-based)"),
        y: z.number().int().describe("Seed Y coordinate (0-based)"),
        color: hexColorSchema.describe("Fill hex color (#RRGGBB or #RRGGBBAA)"),
        ...layerFrameShape,
      },
    },
    async ({ x, y, color, layer, frame }) =>
      runBackendTool(
        router,
        "fill_area",
        { x, y, color, layer, frame },
        { mutating: true, toolName: "fill_area" },
      ),
  );

  server.registerTool(
    "clear",
    {
      description:
        "Clear a rectangular region to transparent pixels, or omit rect to clear the entire cel on the target layer/frame. One Ctrl+Z undo step.",
      inputSchema: {
        rect: z
          .object({
            x: z.number().int(),
            y: z.number().int(),
            width: z.number().int().min(1).max(MAX_DIM),
            height: z.number().int().min(1).max(MAX_DIM),
          })
          .optional()
          .describe("Optional 0-based rectangle to clear; omit to clear the whole cel"),
        ...layerFrameShape,
      },
    },
    async ({ rect, layer, frame }) =>
      runBackendTool(
        router,
        "clear",
        { ...(rect ? { rect } : {}), layer, frame },
        { mutating: true, toolName: "clear" },
      ),
  );

  server.registerTool(
    "set_colors",
    {
      description:
        "Set Aseprite's active foreground (fg) and/or background (bg) UI swatch colors.",
      inputSchema: {
        fg: hexColorSchema.optional().describe("Foreground hex color (#RRGGBB or #RRGGBBAA)"),
        bg: hexColorSchema.optional().describe("Background hex color (#RRGGBB or #RRGGBBAA)"),
      },
    },
    async ({ fg, bg }) => {
      if (fg === undefined && bg === undefined) {
        return toolError("Provide at least one of fg or bg");
      }
      return runBackendTool(router, "set_colors", {
        ...(fg !== undefined ? { fg } : {}),
        ...(bg !== undefined ? { bg } : {}),
      });
    },
  );

  server.registerTool(
    "undo",
    {
      description:
        "Undo the most recent action in Aseprite's undo history (note: undoes the last edit regardless of whether the AI or the user drew it).",
    },
    async () => runBackendTool(router, "undo", {}, { mutating: true, toolName: "undo" }),
  );

  server.registerTool(
    "redo",
    {
      description: "Redo the most recently undone action in Aseprite.",
    },
    async () => runBackendTool(router, "redo", {}, { mutating: true, toolName: "redo" }),
  );
}
