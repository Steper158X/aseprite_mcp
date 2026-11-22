import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function moduleDir(importMetaUrl: string = import.meta.url): string {
  return dirname(fileURLToPath(importMetaUrl));
}

function hasPluginDir(dir: string): boolean {
  return existsSync(join(dir, "aseprite-plugin", "package.json"));
}

function walkForPackageRoot(start: string): string | null {
  let current = start;
  for (let i = 0; i < 8; i++) {
    if (hasPluginDir(current)) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

/**
 * Resolve the package / install root that contains `aseprite-plugin/`.
 * Order: ASEPRITE_MCP_ROOT → next to compiled binary → assets/ beside binary → walk from this module.
 */
export function packageRoot(): string {
  const fromEnv = process.env.ASEPRITE_MCP_ROOT?.trim();
  if (fromEnv && hasPluginDir(fromEnv)) {
    return fromEnv;
  }

  const execDir = dirname(process.execPath);
  if (hasPluginDir(execDir)) {
    return execDir;
  }
  const assetsBesideExec = join(execDir, "assets");
  if (hasPluginDir(assetsBesideExec)) {
    return assetsBesideExec;
  }

  const walked = walkForPackageRoot(moduleDir());
  if (walked) return walked;

  return join(moduleDir(), "..");
}

export function pluginRoot(): string {
  return join(packageRoot(), "aseprite-plugin");
}

export function previewHtmlPath(): string | null {
  const root = packageRoot();
  const candidates = [
    join(root, "preview", "index.html"),
    join(root, "dist", "preview", "index.html"),
    join(root, "src", "preview", "index.html"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function packagedExtensionPath(): string {
  const root = packageRoot();
  const candidates = [
    join(root, "dist", "aseprite-mcp-bridge.aseprite-extension"),
    join(root, "aseprite-mcp-bridge.aseprite-extension"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0]!;
}
