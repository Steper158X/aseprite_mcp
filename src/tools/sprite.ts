import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Router } from "../backend.ts";
import { asArray, assertPathAllowed, normalizeLayerTree } from "../protocol.ts";
import { jsonOk, runBackendTool, toolError } from "./common.ts";

export function registerSpriteTools(server: McpServer, router: Router): void {
  server.registerTool(
    "get_sprite_info",
    {
      description:
        "Inspect the active sprite: dimensions, colorMode, layer tree (with paths), animation tags, frame count and durations, active layer/frame, and palette size.",
    },
    async () => {
      try {
        const { mode, result } = await router.call<Record<string, unknown>>("get_sprite_info", {});
        return jsonOk(mode, {
          ...result,
          layers: normalizeLayerTree(result.layers),
          frames: asArray(result.frames),
          tags: asArray(result.tags),
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
      if (index !== undefined && filename !== undefined) {
        return toolError("Provide only one of index or filename");
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
    async ({ path }) => {
      try {
        const allowed = assertPathAllowed(path);
        return await runBackendTool(
          router,
          "open_sprite",
          { path: allowed },
          { mutating: true, toolName: "open_sprite" },
        );
      } catch (err) {
        return toolError(err);
      }
    },
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
    async ({ path }) => {
      try {
        const params =
          path !== undefined ? { path: assertPathAllowed(path) } : {};
        return await runBackendTool(router, "save_sprite", params, {
          mutating: true,
          toolName: "save_sprite",
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "resize_sprite",
    {
      description:
        "Resize the active sprite canvas to width and height in pixels. One Ctrl+Z undo step.",
      inputSchema: {
        width: z.number().int().min(1).max(65535),
        height: z.number().int().min(1).max(65535),
      },
    },
    async ({ width, height }) =>
      runBackendTool(router, "resize_sprite", { width, height }, { mutating: true, toolName: "resize_sprite" }),
  );

  server.registerTool(
    "crop_sprite",
    {
      description: "Crop the active sprite to a 0-based rectangle. One Ctrl+Z undo step.",
      inputSchema: {
        x: z.number().int(),
        y: z.number().int(),
        width: z.number().int().min(1).max(65535),
        height: z.number().int().min(1).max(65535),
      },
    },
    async ({ x, y, width, height }) =>
      runBackendTool(
        router,
        "crop_sprite",
        { x, y, width, height },
        { mutating: true, toolName: "crop_sprite" },
      ),
  );

  server.registerTool(
    "flip_sprite",
    {
      description: "Flip the active sprite horizontally or vertically. One Ctrl+Z undo step.",
      inputSchema: {
        orientation: z.enum(["horizontal", "vertical"]),
      },
    },
    async ({ orientation }) =>
      runBackendTool(
        router,
        "flip_sprite",
        { orientation },
        { mutating: true, toolName: "flip_sprite" },
      ),
  );

  server.registerTool(
    "rotate_sprite",
    {
      description: "Rotate the active sprite by 90, 180, or 270 degrees clockwise. One Ctrl+Z undo step.",
      inputSchema: {
        angle: z.union([z.literal(90), z.literal(180), z.literal(270)]),
      },
    },
    async ({ angle }) =>
      runBackendTool(router, "rotate_sprite", { angle }, { mutating: true, toolName: "rotate_sprite" }),
  );

  server.registerTool(
    "export_spritesheet",
    {
      description:
        "Export the active sprite as a spritesheet PNG. Optional tag limits the export to that animation tag. Does not rescale the sprite.",
      inputSchema: {
        path: z.string().min(1).describe("Destination PNG path"),
        layout: z
          .enum(["horizontal", "vertical", "rows", "columns", "packed"])
          .optional()
          .describe("Sheet layout (default horizontal)"),
        tag: z.string().min(1).optional().describe("Export only this animation tag"),
        padding: z.number().int().min(0).max(256).optional().describe("Padding between frames in pixels"),
        dataPath: z.string().min(1).optional().describe("Optional JSON metadata path"),
      },
    },
    async ({ path, layout, tag, padding, dataPath }) => {
      try {
        return await runBackendTool(
          router,
          "export_spritesheet",
          {
            path: assertPathAllowed(path),
            ...(layout !== undefined ? { layout } : {}),
            ...(tag !== undefined ? { tag } : {}),
            ...(padding !== undefined ? { padding } : {}),
            ...(dataPath !== undefined ? { dataPath: assertPathAllowed(dataPath) } : {}),
          },
          { toolName: "export_spritesheet" },
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
