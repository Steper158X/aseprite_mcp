import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const sourceDir = resolve(import.meta.dir, "..", "aseprite-plugin");
if (!existsSync(sourceDir)) {
  console.error(`Plugin source directory not found: ${sourceDir}`);
  process.exit(1);
}

const appData = process.env.APPDATA;
const extensionsBase = appData
  ? join(appData, "Aseprite", "extensions")
  : join(process.env.HOME ?? "", ".config", "aseprite", "extensions");

const targetDir = join(extensionsBase, "aseprite-mcp-bridge");

mkdirSync(extensionsBase, { recursive: true });
rmSync(targetDir, { recursive: true, force: true });
cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Installed aseprite-mcp-bridge to: ${targetDir}`);
console.log("Restart Aseprite (if currently open) to load the extension.");
