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
    "list_sprites",
    {
      description:
        "List all currently open sprites in Aseprite (or the current working document in headless mode).",
    },
    async () => {
      try {
        const { mode, result } = await router.call<Record<string, unknown>>("list_sprites", {});
        return jsonOk(mode, {
          sprites: asArray(result.sprites),
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "set_active_sprite",
    {
      description:
        "Switch the active sprite tab in Aseprite by 1-based index or filename (single active doc in headless mode).",
      inputSchema: {
        index: z.number().int().min(1).optional().describe("1-based sprite index from list_sprites"),
        filename: z.string().min(1).optional().describe("Full path or base filename of the open sprite"),
      },
    },
    async ({ index, filename }) => {
      if (index === undefined && filename === undefined) {
        return toolError("Provide either index or filename");
      }
      return runBackendTool(
        router,
        "set_active_sprite",
        {
          ...(index !== undefined ? { index } : {}),
          ...(filename !== undefined ? { filename } : {}),
        },
        { mutating: false },
      );
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

  server.registerTool(
    "open_sprite",
    {
      description:
        "Open an existing .aseprite, .png, or .gif image file from disk and make it the active sprite.",
      inputSchema: {
        path: z.string().min(1).describe("Absolute or relative file path to open"),
      },
    },
    async ({ path }) =>
      runBackendTool(
        router,
        "open_sprite",
        { path },
        { mutating: true, toolName: "open_sprite" },
      ),
  );

  server.registerTool(
    "save_sprite",
    {
      description:
        "Save the active sprite to disk (or export a copy when using a non-.aseprite extension like .png or .gif). Omit path to save back to its existing file.",
      inputSchema: {
        path: z
          .string()
          .min(1)
          .optional()
          .describe("Optional destination path (.aseprite, .png, .gif, etc.)"),
      },
    },
    async ({ path }) =>
      runBackendTool(router, "save_sprite", { ...(path ? { path } : {}) }),
  );
}
