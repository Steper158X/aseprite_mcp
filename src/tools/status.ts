import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Router } from "../backend.ts";
import { jsonOk, runBackendTool } from "./common.ts";

export function registerStatusTools(server: McpServer, router: Router): void {
  server.registerTool(
    "get_status",
    {
      description:
        "Check Aseprite MCP connection status, active backend mode (live/headless), WebSocket/Preview URLs, and any port conflict. Works even when Aseprite is not connected.",
    },
    async () => {
      const status = router.getStatus();
      return jsonOk(status.activeBackend ?? "none", status);
    },
  );

  server.registerTool(
    "ping",
    {
      description:
        "Ping the active Aseprite backend to verify responsiveness and check whether a sprite is open.",
    },
    async () => runBackendTool(router, "ping", {}),
  );
}
