import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { LiveBackend, Router } from "./backend.ts";
import { Bridge } from "./bridge.ts";
import { HeadlessBackend } from "./headless.ts";
import { PreviewHub } from "./preview.ts";
import { getBridgePort } from "./protocol.ts";
import { startHttpServer } from "./server.ts";
import { registerDrawTools } from "./tools/draw.ts";
import { registerFrameTools } from "./tools/frames.ts";
import { registerInspectTools } from "./tools/inspect.ts";
import { registerLayerTools } from "./tools/layers.ts";
import { registerPaletteTools } from "./tools/palette.ts";
import { registerSpriteTools } from "./tools/sprite.ts";
import { registerStatusTools } from "./tools/status.ts";

async function main(): Promise<void> {
  const port = getBridgePort();
  const bridge = new Bridge();
  const preview = new PreviewHub();
  const serverHandle = startHttpServer({ port, bridge, preview });

  const live = new LiveBackend(bridge);
  const headless = new HeadlessBackend();
  const router = new Router({
    bridge,
    live,
    headless: headless.isAvailable() ? headless : null,
  });

  let lastOwnRenderTs = 0;
  let renderInFlight = false;
  let renderQueued = false;

  router.setFrameListener((frame) => {
    lastOwnRenderTs = Date.now();
    preview.publishFrame(frame);
  });

  preview.publishStatus(router.getStatus());

  bridge.onConnectionChange(() => {
    preview.publishStatus(router.getStatus());
  });

  const triggerManualRender = async () => {
    if (renderInFlight) {
      renderQueued = true;
      return;
    }
    renderInFlight = true;
    try {
      do {
        renderQueued = false;
        if (router.getModeSetting() === "headless" || !live.isAvailable()) {
          break;
        }
        try {
          const rendered = await live.render();
          if (rendered) {
            lastOwnRenderTs = Date.now();
            preview.publishFrame({
              ...rendered,
              mode: "live",
              tool: "manual_edit",
              ts: Date.now(),
            });
          }
        } catch {
          // Ignore if no sprite is open or Aseprite disconnected mid-render
        }
      } while (renderQueued);
    } finally {
      renderInFlight = false;
    }
  };

  bridge.onEvent((event) => {
    if (event !== "sprite_changed") return;
    if (router.getModeSetting() === "headless" || !live.isAvailable()) return;
    if (Date.now() - lastOwnRenderTs <= 300) return;
    void triggerManualRender();
  });

  const mcp = new McpServer({
    name: "aseprite-mcp",
    version: "0.1.0",
  });

  registerStatusTools(mcp, router);
  registerSpriteTools(mcp, router);
  registerDrawTools(mcp, router);
  registerLayerTools(mcp, router);
  registerFrameTools(mcp, router);
  registerPaletteTools(mcp, router);
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
  const previewUrl = `http://127.0.0.1:${serverHandle.port}/`;
  console.error(
    `[aseprite-mcp] MCP server ready (ws://127.0.0.1:${serverHandle.port}/aseprite, preview ${previewUrl})`,
  );

  if (process.env.ASEPRITE_MCP_OPEN_PREVIEW === "1" && !serverHandle.portConflict) {
    try {
      Bun.spawn(["cmd", "/c", "start", "", previewUrl], {
        stdout: "ignore",
        stderr: "ignore",
      });
    } catch {
      // ignore browser launch failure
    }
  }
}

main().catch((err) => {
  console.error("[aseprite-mcp] Fatal error:", err);
  process.exit(1);
});
