import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const sourceDir = resolve(import.meta.dir, "..", "aseprite-plugin");
if (!existsSync(sourceDir)) {
  console.error(`Plugin source directory not found: ${sourceDir}`);
  process.exit(1);
}

function extensionsBaseDir(): string {
  if (process.env.APPDATA) {
    return join(process.env.APPDATA, "Aseprite", "extensions");
  }

  const home = process.env.HOME ?? homedir();
  if (process.platform === "darwin") {
    return join(home, "Library", "Application Support", "Aseprite", "extensions");
  }
  // Linux / other Unix: Aseprite uses ~/.config/aseprite/extensions
  return join(home, ".config", "aseprite", "extensions");
}

const extensionsBase = extensionsBaseDir();
const targetDir = join(extensionsBase, "aseprite-mcp-bridge");

mkdirSync(extensionsBase, { recursive: true });
rmSync(targetDir, { recursive: true, force: true });
cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Installed aseprite-mcp-bridge to: ${targetDir}`);
console.log("Restart Aseprite (if currently open) to load the extension.");
