export type WsClientKind = "aseprite" | "preview";

export type WsClientData = { kind: WsClientKind };

/** Minimal WebSocket surface used by Bridge / PreviewHub (Bun or `ws`). */
export interface AppWebSocket {
  send(data: string | Uint8Array): void;
  close(code?: number, reason?: string): void;
}
