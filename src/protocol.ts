import { normalize, resolve, sep } from "node:path";

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

export function getBridgeToken(envValue = process.env.ASEPRITE_MCP_TOKEN): string | null {
  const trimmed = envValue?.trim();
  return trimmed ? trimmed : null;
}

/** Optional filesystem root. When set, open/save paths must stay under it. */
export function getFsRoot(envValue = process.env.ASEPRITE_MCP_FS_ROOT): string | null {
  const trimmed = envValue?.trim();
  return trimmed ? resolve(trimmed) : null;
}

export function assertPathAllowed(pathValue: string, root = getFsRoot()): string {
  const resolved = resolve(pathValue);
  if (!root) return resolved;
  const normalizedRoot = normalize(root.endsWith(sep) ? root : root + sep);
  const normalizedPath = normalize(resolved);
  if (normalizedPath !== root && !normalizedPath.startsWith(normalizedRoot)) {
    throw new Error(`Path escapes ASEPRITE_MCP_FS_ROOT (${root}): ${pathValue}`);
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
