import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pluginRoot } from "./paths.ts";

export function extensionsBaseDir(): string {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (appData) {
      return join(appData, "Aseprite", "extensions");
    }
  }

  const home = process.env.HOME ?? homedir();
  if (process.platform === "darwin") {
    return join(home, "Library", "Application Support", "Aseprite", "extensions");
  }
  return join(home, ".config", "aseprite", "extensions");
}

export function installPlugin(sourceDir = pluginRoot()): string {
  if (!existsSync(sourceDir)) {
    throw new Error(`Plugin source directory not found: ${sourceDir}`);
  }

  const extensionsBase = extensionsBaseDir();
  const targetDir = join(extensionsBase, "aseprite-mcp-bridge");

  mkdirSync(extensionsBase, { recursive: true });
  rmSync(targetDir, { recursive: true, force: true });
  cpSync(sourceDir, targetDir, {
    recursive: true,
    filter: (source) => !source.replace(/\\/g, "/").endsWith("/bridge.local.json"),
  });
  return targetDir;
}

export function runInstallPluginCli(): void {
  try {
    const targetDir = installPlugin();
    console.log(`Installed aseprite-mcp-bridge to: ${targetDir}`);
    console.log("Restart Aseprite (if currently open) to load the extension.");
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
