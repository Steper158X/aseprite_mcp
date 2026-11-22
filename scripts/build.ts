import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { packagePlugin } from "../src/plugin-package.ts";

const root = resolve(import.meta.dir, "..");
const distDir = join(root, "dist");
const previewSrc = join(root, "src", "preview");
const previewDest = join(distDir, "preview");

mkdirSync(distDir, { recursive: true });

// Clear Node build outputs only. Keep dist/binaries/ from build:binaries.
for (const name of [
  "bin.js",
  "cli-main.js",
  "preview",
  "aseprite-mcp-bridge.aseprite-extension",
  "aseprite-mcp-bridge.zip",
]) {
  rmSync(join(distDir, name), { recursive: true, force: true });
}

const bundle = Bun.spawnSync(
  [
    "bun",
    "build",
    join(root, "src", "cli-main.ts"),
    "--outdir",
    distDir,
    "--target",
    "node",
    "--format",
    "esm",
    "--sourcemap=none",
  ],
  { cwd: root, stdout: "pipe", stderr: "pipe" },
);

if (bundle.exitCode !== 0) {
  console.error(bundle.stderr.toString() || bundle.stdout.toString());
  process.exit(bundle.exitCode || 1);
}

const built = join(distDir, "cli-main.js");
const binPath = join(distDir, "bin.js");
if (existsSync(built)) {
  renameSync(built, binPath);
}

if (!existsSync(binPath)) {
  console.error("Build failed: dist/bin.js not found");
  process.exit(1);
}

const code = readFileSync(binPath, "utf8");
const withShebang = code.startsWith("#!") ? code : `#!/usr/bin/env node\n${code}`;
writeFileSync(binPath, withShebang, "utf8");

mkdirSync(previewDest, { recursive: true });
cpSync(join(previewSrc, "index.html"), join(previewDest, "index.html"));

const packed = packagePlugin({ distDir });
console.log(`Packaged extension: ${packed.extPath}`);

console.log(`Built Node entry: ${binPath}`);
