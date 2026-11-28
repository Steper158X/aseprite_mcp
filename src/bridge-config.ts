import { randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { extensionsBaseDir } from "./plugin-install.ts";
import { DEFAULT_BRIDGE_PORT, getBridgePort } from "./protocol.ts";

export interface BridgeLocalConfig {
  token: string;
  luaKey: string;
  port: number;
}

/** Directory the server and the Aseprite plugin both read. Override in tests. */
export function bridgeConfigDir(): string {
  const override = process.env.ASEPRITE_MCP_CONFIG_DIR?.trim();
  if (override) return resolve(override);
  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(appData, "aseprite-mcp");
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "aseprite-mcp");
  }
  const xdg = process.env.XDG_CONFIG_HOME?.trim();
  return join(xdg && xdg.length > 0 ? xdg : join(homedir(), ".config"), "aseprite-mcp");
}

export function bridgeConfigPath(): string {
  return join(bridgeConfigDir(), "bridge.json");
}

export function installedBridgeConfigPath(): string {
  return join(extensionsBaseDir(), "aseprite-mcp-bridge", "bridge.local.json");
}

export function tokenMatches(provided: string | null | undefined, required: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(required);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function previewUrl(port: number, token: string | null): string {
  const url = new URL(`http://127.0.0.1:${port}/`);
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

function readConfigFile(path: string): Partial<BridgeLocalConfig> | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<BridgeLocalConfig>;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readBridgeConfig(): Partial<BridgeLocalConfig> | null {
  return readConfigFile(bridgeConfigPath());
}

function writeSecret(path: string, config: BridgeLocalConfig): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    // Windows ACLs may reject the Unix mode. The file is still local-user-only in practice.
  }
}

export function resolveListenPort(): number {
  if (process.env.ASEPRITE_MCP_PORT?.trim()) return getBridgePort();
  const existing = readBridgeConfig();
  if (
    typeof existing?.port === "number" &&
    Number.isInteger(existing.port) &&
    existing.port >= 1 &&
    existing.port <= 65535
  ) {
    return existing.port;
  }
  return DEFAULT_BRIDGE_PORT;
}

let cached: { config: BridgeLocalConfig; path: string } | null = null;

/** Create or refresh the shared bridge file (token, lua key, port). */
export function loadOrCreateBridgeConfig(options?: { port?: number; token?: string }): BridgeLocalConfig {
  const existing = readBridgeConfig() ?? {};
  const envToken = process.env.ASEPRITE_MCP_TOKEN?.trim();
  const token =
    options?.token?.trim() ||
    envToken ||
    (typeof existing.token === "string" && existing.token.trim() ? existing.token.trim() : "") ||
    randomBytes(24).toString("hex");
  const luaKey =
    typeof existing.luaKey === "string" && existing.luaKey.trim()
      ? existing.luaKey.trim()
      : randomBytes(24).toString("hex");
  const port = options?.port ?? resolveListenPort();
  const config: BridgeLocalConfig = { token, luaKey, port };
  const path = bridgeConfigPath();
  writeSecret(path, config);
  const installedDir = dirname(installedBridgeConfigPath());
  if (existsSync(installedDir)) {
    writeSecret(installedBridgeConfigPath(), config);
  }
  cached = { config, path };
  return config;
}

export function getBridgeSecrets(): BridgeLocalConfig {
  const path = bridgeConfigPath();
  const envToken = process.env.ASEPRITE_MCP_TOKEN?.trim();
  if (cached && cached.path === path && (!envToken || cached.config.token === envToken)) {
    return cached.config;
  }
  return loadOrCreateBridgeConfig();
}

/** Reject run_lua unless the process opted in, and attach the lua key the plugin expects. */
export function authorizeLuaCall(
  method: string,
  params: Record<string, unknown>,
): { params: Record<string, unknown>; allowLua: boolean } {
  if (method !== "run_lua") return { params, allowLua: false };
  if (process.env.ASEPRITE_MCP_ALLOW_LUA !== "1") {
    throw new Error(
      "run_lua is disabled. Set ASEPRITE_MCP_ALLOW_LUA=1 to enable custom Lua execution.",
    );
  }
  const secrets = getBridgeSecrets();
  return {
    allowLua: true,
    params: { ...params, luaKey: secrets.luaKey },
  };
}
