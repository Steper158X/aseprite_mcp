import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Router } from "../backend.ts";
import { layerFrameShape, runBackendTool } from "./common.ts";

export function registerCelTools(server: McpServer, router: Router): void {
  server.registerTool(
    "set_selection",
    {
      description:
        "Replace the sprite selection with a 0-based rectangle, or clear it. One Ctrl+Z undo step.",
      inputSchema: {
        x: z.number().int().optional(),
        y: z.number().int().optional(),
        width: z.number().int().min(1).optional(),
        height: z.number().int().min(1).optional(),
        clear: z.boolean().optional().describe("Clear the selection instead of setting a rectangle"),
      },
    },
    async ({ x, y, width, height, clear }) =>
      runBackendTool(
        router,
        "set_selection",
        {
          ...(x !== undefined ? { x } : {}),
          ...(y !== undefined ? { y } : {}),
          ...(width !== undefined ? { width } : {}),
          ...(height !== undefined ? { height } : {}),
          ...(clear !== undefined ? { clear } : {}),
        },
        { mutating: true, toolName: "set_selection" },
      ),
  );

  server.registerTool(
    "get_selection",
    {
      description: "Read the active sprite's selection bounds.",
    },
    async () => runBackendTool(router, "get_selection", {}),
  );

  server.registerTool(
    "get_cel",
    {
      description: "Read a cel's position, opacity, and image size on a layer and frame.",
      inputSchema: { ...layerFrameShape },
    },
    async ({ layer, frame }) => runBackendTool(router, "get_cel", { layer, frame }),
  );

  server.registerTool(
    "set_cel_props",
    {
      description:
        "Move a cel (x, y are the image origin on the sprite) and/or set its opacity (0-255). One Ctrl+Z undo step.",
      inputSchema: {
        ...layerFrameShape,
        x: z.number().int().optional(),
        y: z.number().int().optional(),
        opacity: z.number().int().min(0).max(255).optional(),
      },
    },
    async ({ layer, frame, x, y, opacity }) =>
      runBackendTool(
        router,
        "set_cel_props",
        {
          layer,
          frame,
          ...(x !== undefined ? { x } : {}),
          ...(y !== undefined ? { y } : {}),
          ...(opacity !== undefined ? { opacity } : {}),
        },
        { mutating: true, toolName: "set_cel_props" },
      ),
  );

  server.registerTool(
    "link_cels",
    {
      description:
        "Make the destination cel share the source cel's image (Aseprite linked cels). One Ctrl+Z undo step.",
      inputSchema: {
        layer: z.string().min(1).optional(),
        frame: z.number().int().min(1),
        sourceLayer: z.string().min(1).optional(),
        sourceFrame: z.number().int().min(1),
      },
    },
    async ({ layer, frame, sourceLayer, sourceFrame }) =>
      runBackendTool(
        router,
        "link_cels",
        {
          frame,
          sourceFrame,
          ...(layer !== undefined ? { layer } : {}),
          ...(sourceLayer !== undefined ? { sourceLayer } : {}),
        },
        { mutating: true, toolName: "link_cels" },
      ),
  );

  server.registerTool(
    "unlink_cel",
    {
      description: "Give a linked cel its own image copy. One Ctrl+Z undo step.",
      inputSchema: { ...layerFrameShape },
    },
    async ({ layer, frame }) =>
      runBackendTool(
        router,
        "unlink_cel",
        { layer, frame },
        { mutating: true, toolName: "unlink_cel" },
      ),
  );
}
