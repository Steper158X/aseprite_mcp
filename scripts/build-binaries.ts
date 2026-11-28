import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { packagePlugin } from "../src/plugin-package.ts";

const root = resolve(import.meta.dir, "..");
const outRoot = join(root, "dist", "binaries");

const targets = [
  { target: "bun-windows-x64", name: "aseprite-mcp-windows-x64.exe" },
  { target: "bun-windows-arm64", name: "aseprite-mcp-windows-arm64.exe" },
  { target: "bun-darwin-x64", name: "aseprite-mcp-darwin-x64" },
  { target: "bun-darwin-arm64", name: "aseprite-mcp-darwin-arm64" },
  { target: "bun-linux-x64", name: "aseprite-mcp-linux-x64" },
  { target: "bun-linux-arm64", name: "aseprite-mcp-linux-arm64" },
] as const;

function copyPluginTree(from: string, to: string): void {
  cpSync(from, to, {
    recursive: true,
    filter: (source) => !source.replace(/\\/g, "/").endsWith("/bridge.local.json"),
  });
}

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

const entry = join(root, "src", "cli-main.ts");

for (const { target, name } of targets) {
  const outfile = join(outRoot, name);
  console.log(`Compiling ${target} → ${name}`);
  const result = Bun.spawnSync(
    ["bun", "build", "--compile", `--target=${target}`, entry, "--outfile", outfile],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  if (result.exitCode !== 0) {
    console.error(result.stderr.toString() || result.stdout.toString());
    process.exit(result.exitCode || 1);
  }
  if (!existsSync(outfile)) {
    console.error(`Missing output: ${outfile}`);
    process.exit(1);
  }
}

const assetsDir = join(outRoot, "assets");
mkdirSync(assetsDir, { recursive: true });
copyPluginTree(join(root, "aseprite-plugin"), join(assetsDir, "aseprite-plugin"));
mkdirSync(join(assetsDir, "preview"), { recursive: true });
cpSync(join(root, "src", "preview", "index.html"), join(assetsDir, "preview", "index.html"));

const packed = packagePlugin({ distDir: assetsDir });
console.log(`Packaged extension into assets: ${packed.extPath}`);

// Copy plugin + preview next to the binaries so packageRoot(execDir) works without ASEPRITE_MCP_ROOT.
copyPluginTree(join(assetsDir, "aseprite-plugin"), join(outRoot, "aseprite-plugin"));
mkdirSync(join(outRoot, "preview"), { recursive: true });
cpSync(join(assetsDir, "preview", "index.html"), join(outRoot, "preview", "index.html"));
const extSrc = join(assetsDir, "aseprite-mcp-bridge.aseprite-extension");
if (existsSync(extSrc)) {
  cpSync(extSrc, join(outRoot, "aseprite-mcp-bridge.aseprite-extension"));
}

console.log(`
Binaries written to ${outRoot}
aseprite-plugin/ and preview/ sit next to the executables (also under assets/).
`);
