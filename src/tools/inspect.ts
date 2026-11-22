import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Router } from "../backend.ts";
import { toolError } from "./common.ts";

export function registerInspectTools(server: McpServer, router: Router): void {
  server.registerTool(
    "get_screenshot",
    {
      description:
        "Render the flattened active sprite (upscaled with crisp nearest-neighbor pixels up to ~512px) and return it as a PNG image so you can visually inspect your pixel art.",
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
          .describe("Optional integer upscale factor (auto-scales longest side up to ~512px if omitted)"),
      },
    },
    async ({ frame, scale }) => {
      try {
        const rendered = await router.render({ frame, scale });
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
}
