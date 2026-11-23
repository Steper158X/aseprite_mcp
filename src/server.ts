import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { getBridgeToken } from "./protocol.ts";
import type { AppWebSocket } from "./ws-types.ts";

export type { WsClientData } from "./ws-types.ts";

export interface BridgeTransport {
  attach(ws: AppWebSocket): void;
  onMessage(ws: AppWebSocket, message: string | Buffer): void;
  detach(ws: AppWebSocket): void;
  setListeningPort(port: number): void;
  setPortConflict(conflict: string | null): void;
}

export interface PreviewHttpPayload {
  status: number;
  headers: Record<string, string>;
  body: Buffer | string | Uint8Array;
}

export interface PreviewTransport {
  attach(ws: AppWebSocket): void;
  detach(ws: AppWebSocket): void;
  getHtmlResponse(): PreviewHttpPayload;
  getPngResponse(): PreviewHttpPayload;
}

export interface StartHttpServerOptions {
  port: number;
  bridge: BridgeTransport;
  preview?: PreviewTransport;
  token?: string | null;
}

export interface HttpServerHandle {
  server: Server | null;
  port: number;
  portConflict: string | null;
  stop(): void;
}

function writePayload(res: ServerResponse, payload: PreviewHttpPayload): void {
  res.writeHead(payload.status, payload.headers);
  res.end(payload.body);
}

function writeText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(body);
}

export async function startHttpServer(options: StartHttpServerOptions): Promise<HttpServerHandle> {
  const { port, bridge, preview } = options;
  const requiredToken = options.token === undefined ? getBridgeToken() : options.token;

  const httpServer = createServer((req, res) => {
    void handleHttpRequest(req, res, preview);
  });

  const asepriteWss = new WebSocketServer({ noServer: true });
  const previewWss = new WebSocketServer({ noServer: true });

  const pingTimers: ReturnType<typeof setInterval>[] = [];

  const trackAlive = (wss: WebSocketServer) => {
    const timer = setInterval(() => {
      for (const client of wss.clients) {
        const ws = client as WebSocket & { isAlive?: boolean };
        if (ws.isAlive === false) {
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        try {
          ws.ping();
        } catch {
          ws.terminate();
        }
      }
    }, 30_000);
    // Don't keep process alive solely for pings
    timer.unref?.();
    pingTimers.push(timer);
  };

  trackAlive(asepriteWss);
  trackAlive(previewWss);

  asepriteWss.on("connection", (ws) => {
    const appWs = wrapWs(ws);
    (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
    ws.on("pong", () => {
      (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
    });
    bridge.attach(appWs);
    ws.on("message", (data, isBinary) => {
      const message = isBinary
        ? Buffer.isBuffer(data)
          ? data
          : Buffer.from(data as ArrayBuffer)
        : data.toString();
      bridge.onMessage(appWs, message);
    });
    ws.on("close", () => {
      bridge.detach(appWs);
    });
  });

  previewWss.on("connection", (ws) => {
    if (!preview) {
      ws.close();
      return;
    }
    const appWs = wrapWs(ws);
    (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
    ws.on("pong", () => {
      (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
    });
    preview.attach(appWs);
    ws.on("close", () => {
      preview.detach(appWs);
    });
  });

  httpServer.on("upgrade", (req, socket, head) => {
    let url: URL;
    try {
      const host = req.headers.host ?? "127.0.0.1";
      url = new URL(req.url ?? "/", `http://${host}`);
    } catch {
      socket.write("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    if (url.pathname === "/aseprite") {
      if (requiredToken) {
        const provided = url.searchParams.get("token");
        if (provided !== requiredToken) {
          socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
          socket.destroy();
          return;
        }
      }
      asepriteWss.handleUpgrade(req, socket, head, (ws) => {
        asepriteWss.emit("connection", ws, req);
      });
      return;
    }

    if (url.pathname === "/preview" && preview) {
      previewWss.handleUpgrade(req, socket, head, (ws) => {
        previewWss.emit("connection", ws, req);
      });
      return;
    }

    socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
    socket.destroy();
  });

  try {
    const actualPort = await listen(httpServer, port);
    bridge.setPortConflict(null);
    bridge.setListeningPort(actualPort);

    return {
      server: httpServer,
      port: actualPort,
      portConflict: null,
      stop() {
        for (const timer of pingTimers) clearInterval(timer);
        try {
          asepriteWss.close();
        } catch {}
        try {
          previewWss.close();
        } catch {}
        httpServer.close();
        httpServer.closeAllConnections?.();
      },
    };
  } catch (err) {
    for (const timer of pingTimers) clearInterval(timer);
    const msg = err instanceof Error ? err.message : String(err);
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";

    if (code === "EADDRINUSE" || /EADDRINUSE|in use|listen/i.test(msg)) {
      const conflict = `Port 127.0.0.1:${port} is already in use (another node aseprite-mcp / dist/bin.js process is likely listening). Refresh or stop the other MCP server in Cursor, kill the orphan node process, or set ASEPRITE_MCP_PORT. Closing Aseprite alone does not free this port. (${msg})`;
      console.error(`[aseprite-mcp] ${conflict}`);
      bridge.setListeningPort(port);
      bridge.setPortConflict(conflict);
      return {
        server: null,
        port,
        portConflict: conflict,
        stop() {},
      };
    }
    throw err;
  }
}

function wrapWs(ws: WebSocket): AppWebSocket {
  return {
    send(data: string | Uint8Array) {
      ws.send(data);
    },
    close(code?: number, reason?: string) {
      ws.close(code, reason);
    },
  };
}

function listen(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => {
      server.off("listening", onListening);
      reject(err);
    };
    const onListening = () => {
      server.off("error", onError);
      const addr = server.address();
      if (addr && typeof addr === "object") {
        resolve(addr.port);
      } else {
        resolve(port);
      }
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}

async function handleHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  preview: PreviewTransport | undefined,
): Promise<void> {
  try {
    const host = req.headers.host ?? "127.0.0.1";
    const url = new URL(req.url ?? "/", `http://${host}`);

    if (req.method === "GET" && url.pathname === "/") {
      if (!preview) {
        writeText(res, 404, "Web preview not enabled");
        return;
      }
      writePayload(res, preview.getHtmlResponse());
      return;
    }

    if (req.method === "GET" && url.pathname === "/preview.png") {
      if (!preview) {
        writeText(res, 404, "Not found");
        return;
      }
      writePayload(res, preview.getPngResponse());
      return;
    }

    writeText(res, 404, "Not found");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) {
      writeText(res, 500, msg);
    } else {
      res.end();
    }
  }
}
