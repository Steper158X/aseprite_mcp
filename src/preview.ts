import { readFileSync } from "node:fs";
import type { PreviewFrameEvent } from "./backend.ts";
import { previewHtmlPath } from "./paths.ts";
import type { PreviewHttpPayload, PreviewTransport } from "./server.ts";
import type { AppWebSocket } from "./ws-types.ts";

interface StoredFrame {
  png: Uint8Array;
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
  private clients = new Set<AppWebSocket>();
  private latestFrame: StoredFrame | null = null;
  private latestStatus: Record<string, unknown> | null = null;
  private history: PreviewHistoryEntry[] = [];
  private htmlPath: string | null = null;

  attach(ws: AppWebSocket): void {
    this.clients.add(ws);
    if (this.latestStatus) {
      this.safeSend(ws, JSON.stringify({ type: "status", ...this.latestStatus }));
    }
    if (this.latestFrame) {
      this.safeSend(ws, this.buildFrameMessage(this.latestFrame));
    }
  }

  detach(ws: AppWebSocket): void {
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

  getHtmlResponse(): PreviewHttpPayload {
    if (this.htmlPath === null) {
      this.htmlPath = previewHtmlPath();
    }
    if (!this.htmlPath) {
      return {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
        body: "Preview HTML not found. Set ASEPRITE_MCP_ROOT or ship preview/index.html next to the binary.",
      };
    }
    const body = readFileSync(this.htmlPath);
    return {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
      body,
    };
  }

  getPngResponse(): PreviewHttpPayload {
    if (!this.latestFrame) {
      return {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
        body: "No preview frame yet",
      };
    }
    return {
      status: 200,
      headers: {
        "content-type": "image/png",
        "cache-control": "no-store",
      },
      body: Buffer.from(this.latestFrame.png),
    };
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

  private safeSend(ws: AppWebSocket, payload: string): void {
    try {
      ws.send(payload);
    } catch {
      this.clients.delete(ws);
    }
  }
}
