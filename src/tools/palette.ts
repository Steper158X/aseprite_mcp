import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Router } from "../backend.ts";
import { asArray } from "../protocol.ts";
import { hexColorSchema, jsonOk, runBackendTool, toolError } from "./common.ts";

export function registerPaletteTools(server: McpServer, router: Router): void {
  server.registerTool(
    "get_palette",
    {
      description: "Get all colors in the active sprite's palette as #RRGGBBAA hex strings.",
    },
    async () => {
      try {
        const { mode, result } = await router.call<Record<string, unknown>>("get_palette", {});
        return jsonOk(mode, {
          size: result.size,
          colors: asArray(result.colors),
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "set_palette",
    {
      description:
        "Replace the active sprite's palette with 1 to 256 hex colors (#RRGGBB or #RRGGBBAA). One Ctrl+Z undo step.",
      inputSchema: {
        colors: z
          .array(hexColorSchema)
          .min(1)
          .max(256)
          .describe("Ordered array of 1-256 hex colors (#RRGGBB or #RRGGBBAA)"),
      },
    },
    async ({ colors }) =>
      runBackendTool(
        router,
        "set_palette",
        { colors },
        { mutating: true, toolName: "set_palette" },
      ),
  );
}
