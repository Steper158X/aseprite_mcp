import type { Server, ServerWebSocket } from "bun";

export type WsClientData = { kind: "aseprite" } | { kind: "preview" };

export interface BridgeTransport {
  attach(ws: ServerWebSocket<WsClientData>): void;
  onMessage(ws: ServerWebSocket<WsClientData>, message: string | Buffer<ArrayBuffer>): void;
  detach(ws: ServerWebSocket<WsClientData>): void;
  setListeningPort(port: number): void;
  setPortConflict(conflict: string | null): void;
}

export interface PreviewTransport {
  attach(ws: ServerWebSocket<WsClientData>): void;
  detach(ws: ServerWebSocket<WsClientData>): void;
  getHtmlResponse(): Response;
  getPngResponse(): Response;
}

export interface StartHttpServerOptions {
  port: number;
  bridge: BridgeTransport;
  preview?: PreviewTransport;
}

export interface HttpServerHandle {
  server: Server<WsClientData> | null;
  port: number;
  portConflict: string | null;
  stop(): void;
}

export function startHttpServer(options: StartHttpServerOptions): HttpServerHandle {
  const { port, bridge, preview } = options;

  try {
    const server = Bun.serve<WsClientData>({
      hostname: "127.0.0.1",
      port,
      fetch(req, srv) {
        const url = new URL(req.url);

        if (url.pathname === "/aseprite") {
          if (srv.upgrade(req, { data: { kind: "aseprite" } })) {
            return;
          }
          return new Response("Expected WebSocket upgrade", { status: 426 });
        }

        if (url.pathname === "/preview" && preview) {
          if (srv.upgrade(req, { data: { kind: "preview" } })) {
            return;
          }
          return new Response("Expected WebSocket upgrade", { status: 426 });
        }

        if (req.method === "GET" && url.pathname === "/") {
          return preview
            ? preview.getHtmlResponse()
            : new Response("Web preview not enabled", { status: 404 });
        }

        if (req.method === "GET" && url.pathname === "/preview.png") {
          return preview
            ? preview.getPngResponse()
            : new Response("Not found", { status: 404 });
        }

        return new Response("Not found", { status: 404 });
      },
      websocket: {
        idleTimeout: 960,
        sendPings: true,
        open(ws) {
          if (ws.data.kind === "aseprite") {
            bridge.attach(ws);
          } else if (ws.data.kind === "preview") {
            preview?.attach(ws);
          }
        },
        message(ws, message) {
          if (ws.data.kind === "aseprite") {
            bridge.onMessage(ws, message);
          }
        },
        close(ws) {
          if (ws.data.kind === "aseprite") {
            bridge.detach(ws);
          } else if (ws.data.kind === "preview") {
            preview?.detach(ws);
          }
        },
      },
    });

    const actualPort = server.port ?? port;
    bridge.setPortConflict(null);
    bridge.setListeningPort(actualPort);

    return {
      server,
      port: actualPort,
      portConflict: null,
      stop() {
        server.stop(true);
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";

    if (code === "EADDRINUSE" || /EADDRINUSE|in use|listen/i.test(msg)) {
      const conflict = `Port 127.0.0.1:${port} is already in use (another Aseprite MCP server may already be running). Stop the other server or set ASEPRITE_MCP_PORT. (${msg})`;
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
