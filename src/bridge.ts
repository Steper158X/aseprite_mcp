import {
  type BridgeResponse,
  createRequestId,
  DEFAULT_BRIDGE_PORT,
  getBridgeToken,
  getCallTimeoutMs,
  type HelloInfo,
  notConnectedMessage,
} from "./protocol.ts";
import {
  type BridgeTransport,
  type HttpServerHandle,
  type PreviewTransport,
  startHttpServer,
} from "./server.ts";
import type { AppWebSocket } from "./ws-types.ts";

export interface BridgeStartOptions {
  preview?: PreviewTransport;
  /** `null` disables auth (tests). Omit to use ASEPRITE_MCP_TOKEN, which is also null when unset. */
  token?: string | null;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface ConnectionWaiter {
  resolve: () => void;
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

export class Bridge implements BridgeTransport {
  private serverHandle: HttpServerHandle | null = null;
  private client: AppWebSocket | null = null;
  private helloInfo: HelloInfo | null = null;
  private listeningPort = DEFAULT_BRIDGE_PORT;
  private _portConflict: string | null = null;
  private preview: PreviewTransport | undefined;
  private ensurePromise: Promise<void> | null = null;
  private pending = new Map<string, PendingRequest>();
  private connectionWaiters = new Set<ConnectionWaiter>();
  private eventListeners = new Set<(event: string, data: Record<string, unknown>) => void>();
  private connectionListeners = new Set<(connected: boolean) => void>();
  private textDecoder = new TextDecoder();
  private authToken: string | null | undefined;
  private _everConnected = false;

  /** True after a plugin has connected at least once during this process. */
  get everConnected(): boolean {
    return this._everConnected;
  }

  get token(): string | null {
    return this.authToken ?? null;
  }

  get isConnected(): boolean {
    return this.client !== null;
  }

  get info(): HelloInfo | null {
    return this.helloInfo;
  }

  get port(): number {
    return this.serverHandle?.port ?? this.listeningPort;
  }

  get portConflict(): string | null {
    return this._portConflict;
  }

  setListeningPort(port: number): void {
    this.listeningPort = port;
  }

  setPortConflict(conflict: string | null): void {
    this._portConflict = conflict;
  }

  getStatus(): BridgeStatus {
    return {
      connected: this.isConnected,
      port: this.port,
      url: `ws://127.0.0.1:${this.port}/aseprite`,
      portConflict: this._portConflict,
      hello: this.helloInfo,
    };
  }

  async start(port = DEFAULT_BRIDGE_PORT, options?: BridgeStartOptions): Promise<void> {
    // A prior EADDRINUSE soft-fail leaves a handle with server=null; allow retry.
    if (options?.preview !== undefined) {
      this.preview = options.preview;
    }
    if (options && "token" in options) {
      this.authToken = options.token ?? null;
    } else if (this.authToken === undefined) {
      this.authToken = getBridgeToken();
    }
    if (this.serverHandle?.server) return;
    if (this.serverHandle) {
      this.serverHandle.stop();
      this.serverHandle = null;
    }
    this.listeningPort = port;
    this._portConflict = null;
    this.serverHandle = await startHttpServer({
      port,
      bridge: this,
      preview: this.preview,
      token: this.authToken,
    });
  }

  /** Retry listen after a soft-fail when the port may have been freed. */
  async ensureListening(): Promise<void> {
    if (this.serverHandle?.server) return;
    if (this.ensurePromise) return this.ensurePromise;
    this.ensurePromise = this.start(this.listeningPort).finally(() => {
      this.ensurePromise = null;
    });
    return this.ensurePromise;
  }

  stop(): void {
    this.rejectAllPending(new Error("Bridge stopped"));
    this.rejectAllWaiters(new Error("Bridge stopped"));
    const active = this.client;
    this.client = null;
    this.helloInfo = null;
    this._portConflict = null;
    this._everConnected = false;
    if (active) {
      try {
        active.close(1001, "Server stopping");
      } catch {}
    }
    if (this.serverHandle) {
      this.serverHandle.stop();
      this.serverHandle = null;
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
      const entry: ConnectionWaiter = {
        resolve: () => {
          clearTimeout(entry.timer);
          this.connectionWaiters.delete(entry);
          resolve();
        },
        reject: (err: Error) => {
          clearTimeout(entry.timer);
          this.connectionWaiters.delete(entry);
          reject(err);
        },
        timer: setTimeout(() => {
          this.connectionWaiters.delete(entry);
          reject(new Error(notConnectedMessage(this.port)));
        }, timeoutMs),
      };
      this.connectionWaiters.add(entry);
    });
  }

  call<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = getCallTimeoutMs(),
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

  onEvent(cb: (event: string, data: Record<string, unknown>) => void): () => void {
    this.eventListeners.add(cb);
    return () => {
      this.eventListeners.delete(cb);
    };
  }

  onConnectionChange(cb: (connected: boolean) => void): () => void {
    this.connectionListeners.add(cb);
    return () => {
      this.connectionListeners.delete(cb);
    };
  }

  attach(ws: AppWebSocket): void {
    const previous = this.client;
    if (previous && previous !== ws) {
      this.rejectAllPending(new Error("Replaced by newer Aseprite connection"));
      try {
        previous.close(1000, "Replaced by newer connection");
      } catch {}
    }

    this.client = ws;
    this._everConnected = true;
    this.helloInfo = null;

    for (const waiter of [...this.connectionWaiters]) {
      waiter.resolve();
    }
    this.emitConnectionChange(true);
  }

  onMessage(ws: AppWebSocket, message: string | Buffer): void {
    if (ws !== this.client) return;

    const text =
      typeof message === "string"
        ? message
        : this.textDecoder.decode(message);
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
      this.emitConnectionChange(true);
      return;
    }

    if (obj.type === "event" && typeof obj.event === "string") {
      for (const listener of this.eventListeners) {
        try {
          listener(obj.event, obj);
        } catch {}
      }
      return;
    }

    if (typeof obj.id !== "string") {
      console.error("[aseprite-mcp] Ignoring bridge response with non-string id");
      return;
    }
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

  detach(ws: AppWebSocket): void {
    if (this.client !== ws) return;
    this.client = null;
    this.helloInfo = null;
    this.rejectAllPending(new Error("Aseprite disconnected"));
    this.emitConnectionChange(false);
  }

  private emitConnectionChange(connected: boolean): void {
    for (const listener of this.connectionListeners) {
      try {
        listener(connected);
      } catch {}
    }
  }

  private rejectAllPending(err: Error): void {
    for (const [id, entry] of this.pending) {
      this.pending.delete(id);
      clearTimeout(entry.timer);
      entry.reject(err);
    }
  }

  private rejectAllWaiters(err: Error): void {
    for (const waiter of [...this.connectionWaiters]) {
      waiter.reject(err);
    }
    this.connectionWaiters.clear();
  }
}
