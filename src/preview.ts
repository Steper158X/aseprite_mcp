import type { ServerWebSocket } from "bun";
import { join } from "node:path";
import type { PreviewFrameEvent } from "./backend.ts";
import type { PreviewTransport, WsClientData } from "./server.ts";

interface StoredFrame {
  png: Uint8Array<ArrayBuffer>;
  pngBase64: string;
  mode: string;
  width: number;
  height: number;
  spriteWidth?: number;
  spriteHeight?: number;
  tool: string;
  ts: number;
}

export interface PreviewHistoryEntry {
  tool: string;
  mode: string;
  ts: number;
}

const MAX_HISTORY = 20;

export class PreviewHub implements PreviewTransport {
  private clients = new Set<ServerWebSocket<WsClientData>>();
  private latestFrame: StoredFrame | null = null;
  private latestStatus: Record<string, unknown> | null = null;
  private history: PreviewHistoryEntry[] = [];
  private readonly htmlPath = join(import.meta.dir, "preview", "index.html");

  attach(ws: ServerWebSocket<WsClientData>): void {
    this.clients.add(ws);
    if (this.latestStatus) {
      this.safeSend(ws, JSON.stringify({ type: "status", ...this.latestStatus }));
    }
    if (this.latestFrame) {
      this.safeSend(ws, this.buildFrameMessage(this.latestFrame));
    }
  }

  detach(ws: ServerWebSocket<WsClientData>): void {
    this.clients.delete(ws);
  }

  publishFrame(frame: PreviewFrameEvent): void {
    const pngBase64 = Buffer.from(frame.png).toString("base64");
    const pngCopy = new Uint8Array(frame.png.byteLength);
    pngCopy.set(frame.png);

    const stored: StoredFrame = {
      png: pngCopy,
      pngBase64,
      mode: frame.mode,
      width: frame.width,
      height: frame.height,
      spriteWidth: frame.spriteWidth,
      spriteHeight: frame.spriteHeight,
      tool: frame.tool,
      ts: frame.ts,
    };

    this.latestFrame = stored;
    this.history.unshift({ tool: frame.tool, mode: frame.mode, ts: frame.ts });
    if (this.history.length > MAX_HISTORY) {
      this.history.length = MAX_HISTORY;
    }

    this.broadcast(this.buildFrameMessage(stored));
  }

  publishStatus(status: Record<string, unknown>): void {
    this.latestStatus = status;
    this.broadcast(JSON.stringify({ type: "status", ...status }));
  }

  getHtmlResponse(): Response {
    return new Response(Bun.file(this.htmlPath), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  getPngResponse(): Response {
    if (!this.latestFrame) {
      return new Response("No preview frame yet", { status: 404 });
    }
    return new Response(this.latestFrame.png, {
      headers: {
        "content-type": "image/png",
        "cache-control": "no-store",
      },
    });
  }

  private buildFrameMessage(frame: StoredFrame): string {
    return JSON.stringify({
      type: "frame",
      png: frame.pngBase64,
      mode: frame.mode,
      width: frame.width,
      height: frame.height,
      spriteWidth: frame.spriteWidth,
      spriteHeight: frame.spriteHeight,
      tool: frame.tool,
      ts: frame.ts,
      history: this.history,
    });
  }

  private broadcast(payload: string): void {
    for (const ws of this.clients) {
      this.safeSend(ws, payload);
    }
  }

  private safeSend(ws: ServerWebSocket<WsClientData>, payload: string): void {
    try {
      ws.send(payload);
    } catch {
      this.clients.delete(ws);
    }
  }
}
