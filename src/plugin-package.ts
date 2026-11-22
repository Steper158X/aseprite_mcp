import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { packageRoot, pluginRoot } from "./paths.ts";

export interface PackagePluginResult {
  extPath: string;
  entries: string[];
}

export function packagePlugin(options?: { distDir?: string }): PackagePluginResult {
  const root = packageRoot();
  const pluginDir = pluginRoot();
  const distDir = options?.distDir ?? join(root, "dist");
  const zipPath = join(distDir, "aseprite-mcp-bridge.zip");
  const extPath = join(distDir, "aseprite-mcp-bridge.aseprite-extension");

  if (!existsSync(pluginDir)) {
    throw new Error(`Plugin source directory not found: ${pluginDir}`);
  }

  mkdirSync(distDir, { recursive: true });
  rmSync(zipPath, { force: true });
  rmSync(extPath, { force: true });

  const createZip = spawnSync(
    "tar",
    [
      "-a",
      "-c",
      "-f",
      zipPath,
      "-C",
      pluginDir,
      "package.json",
      "plugin.lua",
      "lib",
    ],
    { cwd: root, encoding: "utf8" },
  );

  if (createZip.status !== 0) {
    throw new Error(`tar failed: ${createZip.stderr || createZip.error?.message || "unknown error"}`);
  }

  renameSync(zipPath, extPath);

  const listArchive = spawnSync("tar", ["-tf", extPath], {
    cwd: root,
    encoding: "utf8",
  });

  if (listArchive.status !== 0) {
    throw new Error(
      `tar -tf failed: ${listArchive.stderr || listArchive.error?.message || "unknown error"}`,
    );
  }

  const entries = (listArchive.stdout ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const required = ["package.json", "plugin.lua", "lib/handlers.lua", "lib/util.lua"];
  const missing = required.filter((name) => !entries.includes(name));
  if (missing.length > 0) {
    throw new Error(
      `Archive verification failed: missing ${missing.join(", ")}. Got:\n${entries.join("\n")}`,
    );
  }

  return { extPath, entries };
}

export function runPackagePluginCli(): void {
  try {
    const { extPath, entries } = packagePlugin();
    console.log(`Packaged extension: ${extPath}`);
    console.log(`Contents:\n${entries.map((e) => `  - ${e}`).join("\n")}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
