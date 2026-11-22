import type { Server, ServerWebSocket } from "bun";
import {
  type BridgeResponse,
  createRequestId,
  DEFAULT_BRIDGE_PORT,
  type HelloInfo,
  notConnectedMessage,
} from "./protocol.ts";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface BridgeStatus {
  connected: boolean;
  port: number;
  url: string;
  portConflict: string | null;
  hello: HelloInfo | null;
}

export class Bridge {
  private server: Server<undefined> | null = null;
  private client: ServerWebSocket<undefined> | null = null;
  private helloInfo: HelloInfo | null = null;
  private configuredPort = DEFAULT_BRIDGE_PORT;
  private _portConflict: string | null = null;
  private pending = new Map<string, PendingRequest>();
  private connectionWaiters = new Set<() => void>();
  private textDecoder = new TextDecoder();

  get isConnected(): boolean {
    return this.client !== null;
  }

  get info(): HelloInfo | null {
    return this.helloInfo;
  }

  get port(): number {
    return this.server?.port ?? this.configuredPort;
  }

  get portConflict(): string | null {
    return this._portConflict;
  }

  getStatus(): BridgeStatus {
    return {
      connected: this.isConnected,
      port: this.port,
      url: `ws://127.0.0.1:${this.port}`,
      portConflict: this._portConflict,
      hello: this.helloInfo,
    };
  }

  start(port = DEFAULT_BRIDGE_PORT): void {
    if (this.server) return;
    this.configuredPort = port;
    this._portConflict = null;

    try {
      this.server = Bun.serve<undefined>({
        hostname: "127.0.0.1",
        port,
        fetch(req, server) {
          if (server.upgrade(req)) {
            return;
          }
          return new Response("Aseprite MCP Bridge WebSocket endpoint", { status: 426 });
        },
        websocket: {
          idleTimeout: 960,
          sendPings: true,
          open: (ws) => {
            this.handleOpen(ws);
          },
          message: (ws, message) => {
            this.handleMessage(ws, message);
          },
          close: (ws) => {
            this.handleClose(ws);
          },
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code =
        err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : "";
      if (code === "EADDRINUSE" || /EADDRINUSE|in use|listen/i.test(msg)) {
        this._portConflict = `Port 127.0.0.1:${port} is already in use (another Aseprite MCP server may already be running). Stop the other server or set ASEPRITE_MCP_PORT. (${msg})`;
        console.error(`[aseprite-mcp] ${this._portConflict}`);
        return;
      }
      throw err;
    }
  }

  stop(): void {
    this.rejectAllPending(new Error("Bridge stopped"));
    this.rejectAllWaiters();
    const active = this.client;
    this.client = null;
    this.helloInfo = null;
    if (active) {
      try {
        active.close(1000, "Server stopping");
      } catch {
        // ignore close errors on shutdown
      }
    }
    if (this.server) {
      this.server.stop(true);
      this.server = null;
    }
  }

  waitForConnection(timeoutMs = 10000): Promise<void> {
    if (this._portConflict) {
      return Promise.reject(new Error(this._portConflict));
    }
    if (this.client) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.connectionWaiters.delete(onConnect);
        reject(new Error(notConnectedMessage(this.port)));
      }, timeoutMs);

      const onConnect = () => {
        clearTimeout(timer);
        this.connectionWaiters.delete(onConnect);
        resolve();
      };

      this.connectionWaiters.add(onConnect);
    });
  }

  call<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = 15000,
  ): Promise<T> {
    if (this._portConflict) {
      return Promise.reject(new Error(this._portConflict));
    }
    if (!this.client) {
      return Promise.reject(new Error(notConnectedMessage(this.port)));
    }

    const id = createRequestId();
    const payload = JSON.stringify({ id, method, params });

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Aseprite request "${method}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });

      try {
        this.client!.send(payload);
      } catch (err) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  private handleOpen(ws: ServerWebSocket<undefined>): void {
    const previous = this.client;
    if (previous && previous !== ws) {
      this.rejectAllPending(new Error("Replaced by newer Aseprite connection"));
      try {
        previous.close(1000, "Replaced by newer connection");
      } catch {
        // ignore close errors on replaced socket
      }
    }

    this.client = ws;
    this.helloInfo = null;

    for (const notify of this.connectionWaiters) {
      notify();
    }
  }

  private handleMessage(ws: ServerWebSocket<undefined>, message: string | Buffer<ArrayBuffer>): void {
    if (ws !== this.client) return;

    const text = typeof message === "string" ? message : this.textDecoder.decode(message);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error("[aseprite-mcp] Received invalid JSON from Aseprite plugin");
      return;
    }

    if (!parsed || typeof parsed !== "object") return;
    const obj = parsed as Record<string, unknown>;

    if (obj.type === "hello") {
      this.helloInfo = {
        type: "hello",
        plugin: typeof obj.plugin === "string" ? obj.plugin : "unknown",
        aseprite: typeof obj.aseprite === "string" ? obj.aseprite : "unknown",
        apiVersion: typeof obj.apiVersion === "number" ? obj.apiVersion : 0,
      };
      return;
    }

    if (typeof obj.id !== "string") return;
    const entry = this.pending.get(obj.id);
    if (!entry) return;

    this.pending.delete(obj.id);
    clearTimeout(entry.timer);

    const response = obj as unknown as BridgeResponse;
    if (response.ok) {
      entry.resolve(response.result);
    } else {
      entry.reject(new Error(typeof response.error === "string" ? response.error : "Aseprite error"));
    }
  }

  private handleClose(ws: ServerWebSocket<undefined>): void {
    if (this.client !== ws) return;
    this.client = null;
    this.helloInfo = null;
    this.rejectAllPending(new Error("Aseprite disconnected"));
  }

  private rejectAllPending(err: Error): void {
    for (const [id, entry] of this.pending) {
      this.pending.delete(id);
      clearTimeout(entry.timer);
      entry.reject(err);
    }
  }

  private rejectAllWaiters(): void {
    this.connectionWaiters.clear();
  }
}
