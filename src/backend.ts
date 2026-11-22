import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Bridge } from "./bridge.ts";
import { notConnectedMessage } from "./protocol.ts";

export type BackendKind = "live" | "headless";
export type BackendMode = "auto" | "live" | "headless";

export interface RenderedPreview {
  png: Uint8Array;
  width: number;
  height: number;
  spriteWidth?: number;
  spriteHeight?: number;
  scale?: number;
  frame?: number;
}

export interface PreviewFrameEvent extends RenderedPreview {
  mode: BackendKind;
  tool: string;
  ts: number;
}

export interface Backend {
  readonly kind: BackendKind;
  isAvailable(): boolean;
  call<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    opts?: { mutating?: boolean },
  ): Promise<T>;
  render(opts?: {
    frame?: number;
    scale?: number;
    maxSize?: number;
  }): Promise<RenderedPreview | null>;
}

export function getWorkdir(): string {
  return process.env.ASEPRITE_MCP_WORKDIR?.trim() || join(tmpdir(), "aseprite-mcp");
}

export function getConfiguredMode(envValue = process.env.ASEPRITE_MODE): BackendMode {
  const normalized = envValue?.trim().toLowerCase();
  if (normalized === "live" || normalized === "headless" || normalized === "auto") {
    return normalized;
  }
  return "auto";
}

export class LiveBackend implements Backend {
  readonly kind = "live" as const;
  private seq = 1;
  private readonly bridge: Bridge;
  private readonly workdir: string;

  constructor(bridge: Bridge, workdir = getWorkdir()) {
    this.bridge = bridge;
    this.workdir = workdir;
  }

  isAvailable(): boolean {
    return this.bridge.isConnected && !this.bridge.portConflict;
  }

  call<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return this.bridge.call<T>(method, params);
  }

  async render(opts?: {
    frame?: number;
    scale?: number;
    maxSize?: number;
  }): Promise<RenderedPreview | null> {
    mkdirSync(this.workdir, { recursive: true });
    const outPath = join(this.workdir, `live-preview-${Date.now()}-${this.seq++}.png`);

    try {
      const params: Record<string, unknown> = { path: outPath };
      if (opts?.frame !== undefined) params.frame = opts.frame;
      if (opts?.scale !== undefined) params.scale = opts.scale;
      if (opts?.maxSize !== undefined) params.maxSize = opts.maxSize;

      const meta = await this.bridge.call<{
        width: number;
        height: number;
        spriteWidth?: number;
        spriteHeight?: number;
        scale?: number;
        frame?: number;
      }>("render_preview", params);

      const png = await Bun.file(outPath).bytes();
      return {
        png,
        width: meta.width,
        height: meta.height,
        spriteWidth: meta.spriteWidth,
        spriteHeight: meta.spriteHeight,
        scale: meta.scale,
        frame: meta.frame,
      };
    } finally {
      rmSync(outPath, { force: true });
    }
  }
}

export interface RouterOptions {
  mode?: BackendMode;
  bridge: Bridge;
  live: LiveBackend;
  headless?: Backend | null;
  onFrame?: (frame: PreviewFrameEvent) => void;
}

export class Router {
  private readonly modeOverride?: BackendMode;
  private readonly bridge: Bridge;
  private readonly live: LiveBackend;
  private readonly headless: Backend | null;
  private onFrame?: (frame: PreviewFrameEvent) => void;

  constructor(options: RouterOptions) {
    this.modeOverride = options.mode;
    this.bridge = options.bridge;
    this.live = options.live;
    this.headless = options.headless ?? null;
    this.onFrame = options.onFrame;
  }

  setFrameListener(listener: (frame: PreviewFrameEvent) => void): void {
    this.onFrame = listener;
  }

  getModeSetting(): BackendMode {
    return this.modeOverride ?? getConfiguredMode();
  }

  resolveBackend(): Backend {
    if (this.bridge.portConflict) {
      throw new Error(this.bridge.portConflict);
    }

    const mode = this.getModeSetting();
    if (mode === "live") {
      if (this.live.isAvailable()) return this.live;
      throw new Error(notConnectedMessage(this.bridge.port));
    }

    if (mode === "headless") {
      if (this.headless?.isAvailable()) return this.headless;
      throw new Error(
        "ASEPRITE_MODE=headless is set, but ASEPRITE_PATH is not configured or points to a missing Aseprite executable.",
      );
    }

    if (this.live.isAvailable()) return this.live;
    if (this.headless?.isAvailable()) return this.headless;

    throw new Error(
      `${notConnectedMessage(this.bridge.port)} Alternatively, set ASEPRITE_PATH to Aseprite.exe to enable headless mode.`,
    );
  }

  async call<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    opts?: { mutating?: boolean; toolName?: string },
  ): Promise<{ mode: BackendKind; result: T }> {
    const backend = this.resolveBackend();
    const result = await backend.call<T>(method, params, opts);

    if (opts?.mutating && this.onFrame) {
      try {
        const rendered = await backend.render();
        if (rendered) {
          this.onFrame({
            ...rendered,
            mode: backend.kind,
            tool: opts.toolName ?? method,
            ts: Date.now(),
          });
        }
      } catch {
        // Ignore preview render failures (e.g. if no active sprite remains)
      }
    }

    return { mode: backend.kind, result };
  }

  async render(opts?: {
    frame?: number;
    scale?: number;
    maxSize?: number;
  }): Promise<{ mode: BackendKind } & RenderedPreview> {
    const backend = this.resolveBackend();
    const rendered = await backend.render(opts);
    if (!rendered) {
      throw new Error("No active sprite — open or create one");
    }
    return { mode: backend.kind, ...rendered };
  }

  getStatus() {
    const bridgeStatus = this.bridge.getStatus();
    const modeSetting = this.getModeSetting();
    const headlessAvailable = Boolean(this.headless?.isAvailable());

    let activeBackend: BackendKind | null = null;
    if (!bridgeStatus.portConflict) {
      if (modeSetting === "live" && this.live.isAvailable()) {
        activeBackend = "live";
      } else if (modeSetting === "headless" && headlessAvailable) {
        activeBackend = "headless";
      } else if (modeSetting === "auto") {
        if (this.live.isAvailable()) activeBackend = "live";
        else if (headlessAvailable) activeBackend = "headless";
      }
    }

    return {
      modeSetting,
      activeBackend,
      connected: bridgeStatus.connected,
      port: bridgeStatus.port,
      previewUrl: `http://127.0.0.1:${bridgeStatus.port}/`,
      wsUrl: bridgeStatus.url,
      hello: bridgeStatus.hello,
      headlessAvailable,
      portConflict: bridgeStatus.portConflict,
    };
  }
}
