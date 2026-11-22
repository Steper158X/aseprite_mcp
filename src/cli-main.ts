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
  ASEPRITE_PATH           Path to Aseprite for headless mode
  ASEPRITE_MODE           auto | live | headless
  ASEPRITE_MCP_PORT       Preview/WS port (default 7777)
  ASEPRITE_MCP_ROOT       Override package root (plugin/assets location)
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
