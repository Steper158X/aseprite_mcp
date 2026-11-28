import { existsSync, realpathSync } from "node:fs";
import { basename, dirname, join, normalize, resolve, sep } from "node:path";

export const DEFAULT_BRIDGE_PORT = 7777;

export interface BridgeRequest {
  id: string;
  method: string;
  params: Record<string, unknown>;
}

export type BridgeResponse =
  | { id: string; ok: true; result: unknown }
  | { id: string; ok: false; error: string };

export interface HelloInfo {
  type: "hello";
  plugin: string;
  aseprite: string;
  apiVersion: number;
}

export interface Pixel {
  x: number;
  y: number;
  color: string;
}

let nextId = 1;

export function createRequestId(): string {
  return `req_${nextId++}`;
}

export function getBridgePort(envValue = process.env.ASEPRITE_MCP_PORT): number {
  if (!envValue) return DEFAULT_BRIDGE_PORT;
  const parsed = Number.parseInt(envValue, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(
      `Invalid ASEPRITE_MCP_PORT "${envValue}" (expected integer 1-65535)`,
    );
  }
  return parsed;
}

function readTimeoutMs(envValue: string | undefined, fallback: number, name: string): number {
  if (!envValue?.trim()) return fallback;
  const parsed = Number.parseInt(envValue, 10);
  if (!Number.isInteger(parsed) || parsed < 100 || parsed > 600_000) {
    throw new Error(`Invalid ${name} "${envValue}" (expected milliseconds 100-600000)`);
  }
  return parsed;
}

export function getCallTimeoutMs(envValue = process.env.ASEPRITE_MCP_CALL_TIMEOUT_MS): number {
  return readTimeoutMs(envValue, 15_000, "ASEPRITE_MCP_CALL_TIMEOUT_MS");
}

export function getHeadlessTimeoutMs(envValue = process.env.ASEPRITE_MCP_HEADLESS_TIMEOUT_MS): number {
  return readTimeoutMs(envValue, 30_000, "ASEPRITE_MCP_HEADLESS_TIMEOUT_MS");
}

export function getReconnectTimeoutMs(envValue = process.env.ASEPRITE_MCP_RECONNECT_MS): number {
  return readTimeoutMs(envValue, 4_000, "ASEPRITE_MCP_RECONNECT_MS");
}

export function getBridgeToken(envValue = process.env.ASEPRITE_MCP_TOKEN): string | null {
  const trimmed = envValue?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Filesystem root for open/save/export.
 * Unset → the server's current directory.
 * `*` or `unrestricted` → no sandbox.
 */
export function getFsRoot(envValue = process.env.ASEPRITE_MCP_FS_ROOT): string | null {
  const trimmed = envValue?.trim();
  if (!trimmed) return resolve(process.cwd());
  if (trimmed === "*" || trimmed.toLowerCase() === "unrestricted") return null;
  return resolve(trimmed);
}

/** True when `resolvedPath` is `root` or a descendant. Comparison can ignore case. */
export function pathWithinRoot(
  resolvedPath: string,
  root: string,
  options?: { caseInsensitive?: boolean; pathSep?: string },
): boolean {
  const pathSep = options?.pathSep ?? sep;
  const fold = (value: string) => (options?.caseInsensitive ? value.toLowerCase() : value);
  const rootPath = fold(normalize(root));
  const target = fold(normalize(resolvedPath));
  const prefix = rootPath.endsWith(pathSep) ? rootPath : rootPath + pathSep;
  return target === rootPath || target.startsWith(prefix);
}

/** Resolve a path, following symlinks through the nearest existing ancestor. */
export function resolveRealPath(pathValue: string): string {
  const absolute = resolve(pathValue);
  const missing: string[] = [];
  let current = absolute;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) break;
    missing.push(basename(current));
    current = parent;
  }
  let base = current;
  if (existsSync(current)) {
    try {
      base = realpathSync(current);
    } catch {
      base = current;
    }
  }
  return missing.reduceRight((acc, part) => join(acc, part), base);
}

export function assertPathAllowed(pathValue: string, root = getFsRoot()): string {
  const resolved = resolveRealPath(pathValue);
  if (!root) return resolved;
  const rootResolved = resolveRealPath(root);
  const caseInsensitive = process.platform === "win32";
  if (!pathWithinRoot(resolved, rootResolved, { caseInsensitive })) {
    throw new Error(`Path escapes ASEPRITE_MCP_FS_ROOT (${rootResolved}): ${pathValue}`);
  }
  return resolved;
}

export function notConnectedMessage(port = DEFAULT_BRIDGE_PORT): string {
  return `Aseprite is not connected. Open Aseprite with the 'Aseprite MCP Bridge' extension installed (it auto-connects to ws://127.0.0.1:${port}/aseprite).`;
}

/** Lua's json.encode turns an empty table into `{}` rather than `[]`. */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function normalizeLayerTree(value: unknown): unknown[] {
  return asArray<Record<string, unknown>>(value).map((layer) => {
    if (!layer || typeof layer !== "object") return layer;
    if (!("layers" in layer)) return layer;
    return { ...layer, layers: normalizeLayerTree(layer.layers) };
  });
}
