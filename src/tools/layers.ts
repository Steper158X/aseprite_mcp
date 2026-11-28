import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Router } from "../backend.ts";
import { asArray } from "../protocol.ts";
import { jsonOk, runBackendTool, toolError } from "./common.ts";

const BLEND_MODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color_dodge",
  "color_burn",
  "hard_light",
  "soft_light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
  "addition",
  "subtract",
  "divide",
] as const;

export function registerLayerTools(server: McpServer, router: Router): void {
  server.registerTool(
    "add_layer",
    {
      description:
        "Add a new layer (or group layer if group=true) to the active sprite and select it. One Ctrl+Z undo step.",
      inputSchema: {
        name: z.string().min(1).describe("Name of the new layer. Must be unique in the sprite."),
        group: z.boolean().optional().describe("Create a group layer instead of an image layer (default false)"),
        parent: z
          .string()
          .min(1)
          .optional()
          .describe("Parent group name or Group/Name path. Omit to add at the sprite root."),
      },
    },
    async ({ name, group, parent }) => {
      try {
        const { mode, result } = await router.call<Record<string, unknown>>(
          "add_layer",
          { name, ...(group !== undefined ? { group } : {}), ...(parent !== undefined ? { parent } : {}) },
          { mutating: true, toolName: "add_layer" },
        );
        return jsonOk(mode, { ...result, layers: asArray(result.layers) });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "delete_layer",
    {
      description:
        "Delete a named layer from the active sprite (cannot delete the last top-level layer). One Ctrl+Z undo step.",
      inputSchema: {
        name: z.string().min(1).describe("Layer name or Group/Name path"),
      },
    },
    async ({ name }) => {
      try {
        const { mode, result } = await router.call<Record<string, unknown>>(
          "delete_layer",
          { name },
          { mutating: true, toolName: "delete_layer" },
        );
        return jsonOk(mode, { ...result, layers: asArray(result.layers) });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "set_active_layer",
    {
      description: "Select a named layer as the active layer in Aseprite.",
      inputSchema: {
        name: z.string().min(1).describe("Layer name or Group/Name path"),
      },
    },
    async ({ name }) => runBackendTool(router, "set_active_layer", { name }),
  );

  server.registerTool(
    "set_layer_props",
    {
      description:
        "Update layer properties (rename, toggle visibility, set opacity 0..255, or set blendMode). One Ctrl+Z undo step.",
      inputSchema: {
        name: z.string().min(1).describe("Layer name or Group/Name path"),
        newName: z.string().min(1).optional().describe("Optional new name for the layer"),
        visible: z.boolean().optional().describe("Layer visibility"),
        opacity: z.number().int().min(0).max(255).optional().describe("Layer opacity (0-255)"),
        blendMode: z.enum(BLEND_MODES).optional().describe("Layer blend mode (not valid for group layers)"),
      },
    },
    async ({ name, newName, visible, opacity, blendMode }) =>
      runBackendTool(
        router,
        "set_layer_props",
        {
          name,
          ...(newName !== undefined ? { newName } : {}),
          ...(visible !== undefined ? { visible } : {}),
          ...(opacity !== undefined ? { opacity } : {}),
          ...(blendMode !== undefined ? { blendMode } : {}),
        },
        { mutating: true, toolName: "set_layer_props" },
      ),
  );

  server.registerTool(
    "move_layer",
    {
      description:
        "Move a layer before or after another layer, into a group, or to a 0-based stackIndex within its parent. One Ctrl+Z undo step.",
      inputSchema: {
        name: z.string().min(1).describe("Layer name or Group/Name path"),
        before: z.string().min(1).optional().describe("Place this layer just before the named layer"),
        after: z.string().min(1).optional().describe("Place this layer just after the named layer"),
        parent: z.string().min(1).optional().describe("Move into this group. Use an empty parent to leave it unset."),
        stackIndex: z.number().int().min(0).optional().describe("0-based index within the parent"),
      },
    },
    async ({ name, before, after, parent, stackIndex }) =>
      runBackendTool(
        router,
        "move_layer",
        {
          name,
          ...(before !== undefined ? { before } : {}),
          ...(after !== undefined ? { after } : {}),
          ...(parent !== undefined ? { parent } : {}),
          ...(stackIndex !== undefined ? { stackIndex } : {}),
        },
        { mutating: true, toolName: "move_layer" },
      ),
  );

  server.registerTool(
    "duplicate_layer",
    {
      description:
        "Duplicate a layer, including its cels, as an independent copy (linked cels are unlinked). One Ctrl+Z undo step.",
      inputSchema: {
        name: z.string().min(1).describe("Layer name or Group/Name path"),
        newName: z.string().min(1).optional().describe("Name for the copy. Must be unique."),
      },
    },
    async ({ name, newName }) =>
      runBackendTool(
        router,
        "duplicate_layer",
        { name, ...(newName !== undefined ? { newName } : {}) },
        { mutating: true, toolName: "duplicate_layer" },
      ),
  );
}
