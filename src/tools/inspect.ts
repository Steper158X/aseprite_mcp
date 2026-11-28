import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Router } from "../backend.ts";
import { asArray } from "../protocol.ts";
import { jsonOk, toolError } from "./common.ts";

export function registerInspectTools(server: McpServer, router: Router): void {
  server.registerTool(
    "get_screenshot",
    {
      description:
        "Render the active sprite (or one layer) with nearest-neighbor scaling so the longest side is at most maxSize (default 512) and return it as a PNG image.",
      inputSchema: {
        frame: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("1-based frame number to render (defaults to active frame)"),
        scale: z
          .number()
          .int()
          .min(1)
          .max(64)
          .optional()
          .describe("Optional integer scale. When omitted, the image is fit to maxSize."),
        maxSize: z
          .number()
          .int()
          .min(1)
          .max(4096)
          .optional()
          .describe("Longest side of the returned PNG in pixels (default 512). Larger sprites are downscaled."),
        layer: z
          .string()
          .min(1)
          .optional()
          .describe("Render only this layer (name or Group/Name path). Omit for the flattened sprite."),
      },
    },
    async ({ frame, scale, maxSize, layer }) => {
      try {
        const rendered = await router.render({
          frame,
          scale,
          maxSize: maxSize ?? 512,
          layer,
        });
        return {
          content: [
            {
              type: "image",
              data: Buffer.from(rendered.png).toString("base64"),
              mimeType: "image/png",
            },
            {
              type: "text",
              text: JSON.stringify({
                mode: rendered.mode,
                width: rendered.width,
                height: rendered.height,
                spriteWidth: rendered.spriteWidth,
                spriteHeight: rendered.spriteHeight,
                scale: rendered.scale,
                frame: rendered.frame,
              }),
            },
          ],
        };
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "get_pixels",
    {
      description:
        "Read raw #RRGGBBAA hex pixel values for a rectangular region (max 256x256) of the active sprite, either flattened (default) or from a specific layer. Out-of-bounds pixels return #00000000.",
      inputSchema: {
        x: z.number().int().describe("Top-left 0-based X coordinate"),
        y: z.number().int().describe("Top-left 0-based Y coordinate"),
        width: z.number().int().min(1).max(256).describe("Region width in pixels (1-256)"),
        height: z.number().int().min(1).max(256).describe("Region height in pixels (1-256)"),
        layer: z
          .string()
          .optional()
          .describe("Optional layer name; if provided and flattened is not true, reads only that layer"),
        flattened: z
          .boolean()
          .optional()
          .describe("Read flattened composite image (default true unless layer is specified)"),
        frame: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("1-based frame number (defaults to active frame)"),
      },
    },
    async ({ x, y, width, height, layer, flattened, frame }) => {
      try {
        const { mode, result } = await router.call<Record<string, unknown>>("get_pixels", {
          x,
          y,
          width,
          height,
          ...(layer !== undefined ? { layer } : {}),
          ...(flattened !== undefined ? { flattened } : {}),
          ...(frame !== undefined ? { frame } : {}),
        });
        return jsonOk(mode, {
          ...result,
          rows: asArray<string[]>(result.rows).map((r) => asArray<string>(r)),
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
