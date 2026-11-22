import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { packageRoot } from "./paths.ts";
import { installPlugin } from "./plugin-install.ts";
import { packagePlugin } from "./plugin-package.ts";
import { spawnCapture } from "./process-utils.ts";

export type McpClientTarget = "cursor" | "claude" | "antigravity" | "print";

export interface SetupOptions {
  clients?: McpClientTarget[];
  asepritePath?: string;
  skipPlugin?: boolean;
  command?: string;
  args?: string[];
  dryRun?: boolean;
}

export interface SetupResult {
  asepritePath: string | null;
  pluginTarget: string | null;
  extensionPath: string | null;
  configsWritten: string[];
  mcpSnippet: Record<string, unknown>;
}

const STEAM_CANDIDATES_WIN = [
  "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Aseprite\\Aseprite.exe",
  "C:\\Program Files\\Steam\\steamapps\\common\\Aseprite\\Aseprite.exe",
  "D:\\SteamLibrary\\steamapps\\common\\Aseprite\\Aseprite.exe",
  "E:\\SteamLibrary\\steamapps\\common\\Aseprite\\Aseprite.exe",
  "F:\\SteamLibrary\\steamapps\\common\\Aseprite\\Aseprite.exe",
];

const STEAM_CANDIDATES_MAC = [
  "/Applications/Aseprite.app/Contents/MacOS/aseprite",
  join(homedir(), "Applications/Aseprite.app/Contents/MacOS/aseprite"),
  join(
    homedir(),
    "Library/Application Support/Steam/steamapps/common/Aseprite/Aseprite.app/Contents/MacOS/aseprite",
  ),
];

const STEAM_CANDIDATES_LINUX = [
  join(homedir(), ".steam/steam/steamapps/common/Aseprite/aseprite"),
  join(homedir(), ".local/share/Steam/steamapps/common/Aseprite/aseprite"),
  "/usr/bin/aseprite",
];

/** Resolve a path that may be an .app bundle into the inner MacOS binary. */
export function normalizeAsepritePath(raw: string): string | null {
  const p = resolve(raw.trim());
  if (!existsSync(p)) return null;

  if (process.platform === "darwin") {
    const trimmed = p.replace(/[/\\]+$/, "");
    if (/\.app$/i.test(trimmed)) {
      const inner = join(trimmed, "Contents", "MacOS", "aseprite");
      return existsSync(inner) ? inner : null;
    }
  }

  return p;
}

export async function findAsepritePath(explicit?: string): Promise<string | null> {
  if (explicit?.trim()) {
    return normalizeAsepritePath(explicit);
  }

  const fromEnv = process.env.ASEPRITE_PATH?.trim();
  if (fromEnv) {
    const normalized = normalizeAsepritePath(fromEnv);
    if (normalized) return normalized;
  }

  const whichCmd = process.platform === "win32" ? "where" : "which";
  const names =
    process.platform === "win32" ? ["Aseprite.exe", "aseprite.exe"] : ["aseprite"];

  for (const name of names) {
    try {
      const result = await spawnCapture(whichCmd, [name], { timeoutMs: 5000 });
      const first = result.stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l && existsSync(l));
      if (first) {
        const normalized = normalizeAsepritePath(first);
        if (normalized) return normalized;
      }
    } catch {}
  }

  const candidates =
    process.platform === "win32"
      ? STEAM_CANDIDATES_WIN
      : process.platform === "darwin"
        ? STEAM_CANDIDATES_MAC
        : STEAM_CANDIDATES_LINUX;

  for (const candidate of candidates) {
    const normalized = normalizeAsepritePath(candidate);
    if (normalized) return normalized;
  }

  return null;
}

function isNodeExecutable(execPath: string): boolean {
  const base = basename(execPath).toLowerCase();
  return base === "node" || base === "node.exe";
}

function isBunExecutable(execPath: string): boolean {
  const base = basename(execPath).toLowerCase();
  return base === "bun" || base === "bun.exe";
}

function detectRuntimeCommand(): { command: string; args: string[] } {
  const execName = basename(process.execPath).toLowerCase();
  if (execName.includes("aseprite-mcp") || execName.includes("aseprite_mcp")) {
    return { command: process.execPath, args: [] };
  }

  const root = packageRoot();
  const inNodeModules =
    root.includes(`${sep}node_modules${sep}`) ||
    root.includes("/node_modules/") ||
    root.endsWith(`${sep}node_modules`) ||
    /[/\\]node_modules[/\\](@[^/\\]+[/\\])?aseprite[-_]mcp$/i.test(root);

  if (inNodeModules) {
    return { command: "npx", args: ["-y", "@steper158x/aseprite_mcp"] };
  }

  const distBin = join(root, "dist", "bin.js");
  const srcCli = join(root, "src", "cli-main.ts");

  // Prefer Node + built entry so MCP clients do not depend on Bun.
  if (existsSync(distBin)) {
    if (isNodeExecutable(process.execPath)) {
      return { command: process.execPath, args: [distBin] };
    }
    return { command: "node", args: [distBin] };
  }

  if (isBunExecutable(process.execPath) && existsSync(srcCli)) {
    return { command: process.execPath, args: ["run", srcCli] };
  }

  const entry = process.argv[1];
  if (entry) {
    if (isBunExecutable(process.execPath) && entry.endsWith(".ts")) {
      return { command: process.execPath, args: ["run", entry] };
    }
    if (isNodeExecutable(process.execPath)) {
      return { command: process.execPath, args: [entry] };
    }
    return { command: "node", args: [entry] };
  }

  return { command: "npx", args: ["-y", "@steper158x/aseprite_mcp"] };
}

function buildMcpServerEntry(
  command: string,
  args: string[],
  asepritePath: string | null,
): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    command,
    args,
  };
  if (asepritePath) {
    entry.env = { ASEPRITE_PATH: asepritePath };
  }
  return entry;
}

function mergeMcpConfig(filePath: string, serverEntry: Record<string, unknown>, dryRun: boolean): void {
  let existing: Record<string, unknown> = {};
  if (existsSync(filePath)) {
    const raw = readFileSync(filePath, "utf8");
    try {
      existing = JSON.parse(raw) as Record<string, unknown>;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const backup = `${filePath}.bak-${Date.now()}`;
      if (!dryRun) {
        renameSync(filePath, backup);
        console.warn(
          `[setup] Invalid JSON in ${filePath} (${msg}). Moved aside to ${backup}. Writing a fresh config with only aseprite.`,
        );
      } else {
        console.warn(
          `[dry-run] Invalid JSON in ${filePath} (${msg}). Would move aside and write a fresh config.`,
        );
      }
      existing = {};
    }
  }

  const mcpServers =
    existing.mcpServers && typeof existing.mcpServers === "object"
      ? { ...(existing.mcpServers as Record<string, unknown>) }
      : {};
  mcpServers.aseprite = serverEntry;
  const next = { ...existing, mcpServers };

  if (dryRun) {
    console.log(`[dry-run] would write ${filePath}`);
    console.log(JSON.stringify(next, null, 2));
    return;
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

function looksLikeProjectDir(dir: string): boolean {
  return (
    existsSync(join(dir, ".cursor")) ||
    existsSync(join(dir, "package.json")) ||
    existsSync(join(dir, ".git"))
  );
}

function cursorUserConfigPath(): string {
  return join(homedir(), ".cursor", "mcp.json");
}

function cursorConfigPath(): string {
  const cwd = process.cwd();
  const projectLocal = join(cwd, ".cursor", "mcp.json");
  if (existsSync(projectLocal) || looksLikeProjectDir(cwd)) {
    return projectLocal;
  }
  return cursorUserConfigPath();
}

function claudeConfigPath(): string {
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(appData, "Claude", "claude_desktop_config.json");
  }
  return join(homedir(), ".config", "Claude", "claude_desktop_config.json");
}

function antigravityConfigPath(): string {
  return join(homedir(), ".gemini", "config", "mcp_config.json");
}

export async function runSetup(options: SetupOptions = {}): Promise<SetupResult> {
  const clients = options.clients?.length ? options.clients : (["print"] as McpClientTarget[]);
  const dryRun = Boolean(options.dryRun);

  const asepritePath = await findAsepritePath(options.asepritePath);
  const runtime = options.command
    ? { command: options.command, args: options.args ?? [] }
    : detectRuntimeCommand();

  let pluginTarget: string | null = null;
  let extensionPath: string | null = null;

  if (!options.skipPlugin) {
    if (!dryRun) {
      try {
        const packed = packagePlugin();
        extensionPath = packed.extPath;
      } catch (err) {
        console.warn(
          `[setup] Could not package .aseprite-extension (${err instanceof Error ? err.message : String(err)}). Continuing with folder install.`,
        );
      }
      pluginTarget = installPlugin();
    } else {
      console.log("[dry-run] would install Aseprite plugin and package extension");
    }
  }

  const serverEntry = buildMcpServerEntry(runtime.command, runtime.args, asepritePath);
  const mcpSnippet = { mcpServers: { aseprite: serverEntry } };
  const configsWritten: string[] = [];

  for (const client of clients) {
    if (client === "print") {
      console.log("\nMCP config snippet:\n");
      console.log(JSON.stringify(mcpSnippet, null, 2));
      continue;
    }

    const path =
      client === "cursor"
        ? cursorConfigPath()
        : client === "claude"
          ? claudeConfigPath()
          : antigravityConfigPath();

    mergeMcpConfig(path, serverEntry, dryRun);
    if (!dryRun) configsWritten.push(path);
    else configsWritten.push(`(dry-run) ${path}`);
  }

  console.log("\nSetup summary");
  console.log(`  Aseprite: ${asepritePath ?? "(not found — set ASEPRITE_PATH for headless mode)"}`);
  console.log(`  Plugin:   ${pluginTarget ?? "(skipped)"}`);
  console.log(`  Extension:${extensionPath ? ` ${extensionPath}` : " (not packaged)"}`);
  console.log(`  Command:  ${runtime.command} ${runtime.args.join(" ")}`);
  if (configsWritten.length) {
    console.log("  Configs:");
    for (const c of configsWritten) console.log(`    - ${c}`);
  }
  console.log("\nNext steps:");
  console.log("  1. Restart Aseprite so the MCP Bridge extension loads.");
  console.log("  2. Refresh MCP servers in your AI client (or restart the app).");
  console.log("  3. Ask: \"Check Aseprite MCP status\"");

  return {
    asepritePath,
    pluginTarget,
    extensionPath,
    configsWritten,
    mcpSnippet,
  };
}

export async function runSetupCli(argv: string[]): Promise<void> {
  const clients: McpClientTarget[] = [];
  let asepritePath: string | undefined;
  let skipPlugin = false;
  let dryRun = false;
  let command: string | undefined;
  const args: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--cursor") clients.push("cursor");
    else if (arg === "--claude") clients.push("claude");
    else if (arg === "--antigravity") clients.push("antigravity");
    else if (arg === "--print") clients.push("print");
    else if (arg === "--skip-plugin") skipPlugin = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--aseprite" || arg === "--aseprite-path") {
      asepritePath = argv[++i];
    } else if (arg === "--command") {
      command = argv[++i];
    } else if (arg === "--arg") {
      const value = argv[++i];
      if (value !== undefined) args.push(value);
    } else if (arg === "--help" || arg === "-h") {
      printSetupHelp();
      return;
    } else {
      console.error(`Unknown setup option: ${arg}`);
      printSetupHelp();
      process.exit(2);
    }
  }

  await runSetup({
    clients: clients.length ? clients : ["print"],
    asepritePath,
    skipPlugin,
    dryRun,
    command,
    args: command ? args : undefined,
  });
}

function printSetupHelp(): void {
  console.log(`Usage: aseprite-mcp setup [options]

Options:
  --cursor              Write/merge Cursor MCP config (project .cursor/mcp.json, else ~/.cursor/mcp.json)
  --claude              Write/merge Claude Desktop MCP config
  --antigravity         Write/merge Antigravity (~/.gemini) MCP config
  --print               Print MCP JSON snippet (default if no client flags)
  --aseprite <path>     Path to Aseprite executable (or .app on macOS)
  --skip-plugin         Do not install the Aseprite extension
  --command <cmd>       Override MCP command (default: auto-detect)
  --arg <value>         Extra arg for --command (repeatable)
  --dry-run             Show actions without writing files
  -h, --help            Show this help
`);
}
