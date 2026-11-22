import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Router } from "../backend.ts";
import { asArray } from "../protocol.ts";
import { jsonOk, runBackendTool, toolError } from "./common.ts";

export function registerSpriteTools(server: McpServer, router: Router): void {
  server.registerTool(
    "get_sprite_info",
    {
      description:
        "Inspect the active sprite: dimensions (width/height), colorMode, layer tree, frame count & durations, active layer/frame, and palette size.",
    },
    async () => {
      try {
        const { mode, result } = await router.call<Record<string, unknown>>("get_sprite_info", {});
        return jsonOk(mode, {
          ...result,
          layers: asArray(result.layers),
          frames: asArray(result.frames),
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "new_sprite",
    {
      description:
        "Create and activate a new sprite canvas with the given pixel dimensions and color mode.",
      inputSchema: {
        width: z.number().int().min(1).max(4096).describe("Canvas width in pixels"),
        height: z.number().int().min(1).max(4096).describe("Canvas height in pixels"),
        colorMode: z
          .enum(["rgb", "gray", "indexed"])
          .optional()
          .describe("Color mode: rgb (default), gray, or indexed"),
      },
    },
    async ({ width, height, colorMode }) =>
      runBackendTool(
        router,
        "new_sprite",
        { width, height, ...(colorMode ? { colorMode } : {}) },
        { mutating: true, toolName: "new_sprite" },
      ),
  );
}
