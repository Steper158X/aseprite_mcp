export const DEFAULT_BRIDGE_PORT = 7531;

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
    return DEFAULT_BRIDGE_PORT;
  }
  return parsed;
}

export function notConnectedMessage(port = DEFAULT_BRIDGE_PORT): string {
  return `Aseprite is not connected. Open Aseprite with the 'Aseprite MCP Bridge' extension installed (it auto-connects to ws://127.0.0.1:${port}).`;
}

/** Lua's json.encode turns an empty table into `{}` rather than `[]`. */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
