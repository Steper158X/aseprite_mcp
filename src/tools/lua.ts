import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Router } from "../backend.ts";
import { runBackendTool } from "./common.ts";

export function registerLuaTools(server: McpServer, router: Router): void {
  server.registerTool(
    "run_lua",
    {
      description:
        "Execute custom Aseprite Lua code inside a single undoable transaction (only enabled when ASEPRITE_MCP_ALLOW_LUA=1). Return a value with `return ...` to receive its string representation.",
      inputSchema: {
        code: z.string().min(1).describe("Lua chunk to execute in Aseprite"),
      },
    },
    async ({ code }) =>
      runBackendTool(
        router,
        "run_lua",
        { code },
        { mutating: true, toolName: "run_lua" },
      ),
  );
}
