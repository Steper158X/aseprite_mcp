import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");
const pluginDir = join(repoRoot, "aseprite-plugin");
const distDir = join(repoRoot, "dist");
const zipPath = join(distDir, "aseprite-mcp-bridge.zip");
const extPath = join(distDir, "aseprite-mcp-bridge.aseprite-extension");

if (!existsSync(pluginDir)) {
  console.error(`Plugin source directory not found: ${pluginDir}`);
  process.exit(1);
}

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

const createZip = Bun.spawnSync(
  [
    "tar",
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
  { cwd: repoRoot, stdout: "pipe", stderr: "pipe" },
);

if (createZip.exitCode !== 0) {
  console.error(`tar failed: ${createZip.stderr.toString()}`);
  process.exit(createZip.exitCode || 1);
}

renameSync(zipPath, extPath);

const listArchive = Bun.spawnSync(["tar", "-tf", extPath], {
  cwd: repoRoot,
  stdout: "pipe",
  stderr: "pipe",
});

if (listArchive.exitCode !== 0) {
  console.error(`tar -tf failed: ${listArchive.stderr.toString()}`);
  process.exit(listArchive.exitCode || 1);
}

const entries = listArchive.stdout
  .toString()
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

if (!entries.includes("package.json") || !entries.includes("plugin.lua")) {
  console.error(
    `Archive verification failed: expected package.json and plugin.lua at root. Got:\n${entries.join("\n")}`,
  );
  process.exit(1);
}

console.log(`Packaged extension: ${extPath}`);
console.log(`Contents:\n${entries.map((e) => `  - ${e}`).join("\n")}`);
