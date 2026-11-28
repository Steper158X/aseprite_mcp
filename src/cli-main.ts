#!/usr/bin/env node
import { startMcpServer } from "./index.ts";
import { runInstallPluginCli } from "./plugin-install.ts";
import { runPackagePluginCli } from "./plugin-package.ts";
import { runSetupCli } from "./setup.ts";

function printHelp(): void {
  console.log(`aseprite-mcp — Live Aseprite MCP bridge

Usage:
  aseprite-mcp [serve]              Start MCP stdio server (default)
  aseprite-mcp setup [options]      Install plugin + write MCP config
  aseprite-mcp install-plugin       Install Aseprite extension only
  aseprite-mcp package-plugin       Build .aseprite-extension into dist/
  aseprite-mcp help                 Show this help

Environment:
  ASEPRITE_PATH                 Path to Aseprite for headless mode
  ASEPRITE_MODE                 auto | live | headless (default auto)
  ASEPRITE_MCP_PORT             Preview/WS port (default 7777, or the port in the bridge config)
  ASEPRITE_MCP_TOKEN            Bridge token. setup generates one and the server requires it.
  ASEPRITE_MCP_FS_ROOT          Directory open/save/export must stay inside (default: cwd).
                                Use * or unrestricted to disable the sandbox.
  ASEPRITE_MCP_ALLOW_LUA        Set to 1 to register run_lua. Also enable it in the Aseprite dialog.
  ASEPRITE_MCP_CALL_TIMEOUT_MS  Live request timeout (default 15000)
  ASEPRITE_MCP_HEADLESS_TIMEOUT_MS  Headless Aseprite timeout (default 30000)
  ASEPRITE_MCP_RECONNECT_MS     How long auto mode waits for the GUI to return (default 4000)
  ASEPRITE_MCP_CONFIG_DIR       Override the directory of bridge.json (token, lua key, port)
  ASEPRITE_MCP_OPEN_PREVIEW     Set to 1 to open the preview page on startup
  ASEPRITE_MCP_ROOT             Override package root (plugin/assets location)
`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0];

  if (!cmd || cmd === "serve") {
    await startMcpServer();
    return;
  }

  if (cmd === "setup") {
    await runSetupCli(argv.slice(1));
    return;
  }

  if (cmd === "install-plugin") {
    runInstallPluginCli();
    return;
  }

  if (cmd === "package-plugin") {
    runPackagePluginCli();
    return;
  }

  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    return;
  }

  console.error(`Unknown command: ${cmd}\n`);
  printHelp();
  process.exit(2);
}

main().catch((err) => {
  console.error("[aseprite-mcp] Fatal error:", err);
  process.exit(1);
});
