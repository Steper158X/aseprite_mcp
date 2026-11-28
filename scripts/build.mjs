/**
 * Node build for dist/bin.js, the preview page, and the Aseprite extension.
 * Invoked by both `npm run build` and `bun run build`.
 */
import * as esbuild from "esbuild";
import { chmodSync, cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(root, "dist");
const previewSrc = join(root, "src", "preview");
const previewDest = join(distDir, "preview");
const binPath = join(distDir, "bin.js");

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

await esbuild.build({
  entryPoints: [join(root, "src", "cli-main.ts")],
  outfile: binPath,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  // Keep npm dependencies external. Bundling `ws` into ESM breaks its dynamic
  // require() of Node builtins ("Dynamic require of events is not supported").
  packages: "external",
  // cli-main.ts already starts with a shebang. Drop that copy and emit one banner
  // so the bundle has a single hashbang line Node will accept.
  banner: { js: "#!/usr/bin/env node" },
  plugins: [
    {
      name: "strip-entry-shebang",
      setup(build) {
        build.onLoad({ filter: /cli-main\.ts$/ }, (args) => {
          const contents = readFileSync(args.path, "utf8").replace(/^#!.*\r?\n/, "");
          return { contents, loader: "ts" };
        });
      },
    },
  ],
  legalComments: "none",
  logLevel: "warning",
});

if (process.platform !== "win32") {
  chmodSync(binPath, 0o755);
}

mkdirSync(previewDest, { recursive: true });
cpSync(join(previewSrc, "index.html"), join(previewDest, "index.html"));

const helperOut = join(tmpdir(), `aseprite-mcp-package-plugin-${process.pid}.mjs`);
try {
  await esbuild.build({
    entryPoints: [join(root, "src", "plugin-package.ts")],
    outfile: helperOut,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    packages: "external",
    logLevel: "warning",
  });
  const mod = await import(pathToFileURL(helperOut).href);
  const packed = mod.packagePlugin({
    distDir,
    pluginDir: join(root, "aseprite-plugin"),
  });
  console.log(`Packaged extension: ${packed.extPath}`);
} finally {
  rmSync(helperOut, { force: true });
}

console.log(`Built Node entry: ${binPath}`);
