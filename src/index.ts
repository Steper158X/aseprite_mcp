import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { LiveBackend, Router } from "./backend.ts";
import { Bridge } from "./bridge.ts";
import { getBridgePort } from "./protocol.ts";
import { startHttpServer } from "./server.ts";
import { registerDrawTools } from "./tools/draw.ts";
import { registerInspectTools } from "./tools/inspect.ts";
import { registerSpriteTools } from "./tools/sprite.ts";
import { registerStatusTools } from "./tools/status.ts";

async function main(): Promise<void> {
  const port = getBridgePort();
  const bridge = new Bridge();
  const serverHandle = startHttpServer({ port, bridge });

  const live = new LiveBackend(bridge);
  const router = new Router({ bridge, live });

  const mcp = new McpServer({
    name: "aseprite-mcp",
    version: "0.1.0",
  });

  registerStatusTools(mcp, router);
  registerSpriteTools(mcp, router);
  registerDrawTools(mcp, router);
  registerInspectTools(mcp, router);

  const transport = new StdioServerTransport();
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    try {
      await mcp.close();
    } catch {
      // ignore close errors
    }
    bridge.stop();
    serverHandle.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
  transport.onclose = () => {
    void shutdown();
  };

  await mcp.connect(transport);
  console.error(
    `[aseprite-mcp] MCP server ready (ws://127.0.0.1:${serverHandle.port}/aseprite)`,
  );
}

main().catch((err) => {
  console.error("[aseprite-mcp] Fatal error:", err);
  process.exit(1);
});
