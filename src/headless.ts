import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { type Backend, getWorkdir, type RenderedPreview } from "./backend.ts";

export interface HeadlessState {
  layer?: string;
  frame?: number;
  hasSprite?: boolean;
}

export interface HeadlessRunnerRequest {
  method: string;
  params: Record<string, unknown>;
  doc: string;
  save: boolean;
  render: boolean;
  previewPath?: string;
  renderFrame?: number;
  renderScale?: number;
  renderMaxSize?: number;
  state: HeadlessState;
}

export interface HeadlessRunnerResponse {
  ok: boolean;
  result?: unknown;
  error?: string;
  previewMeta?: {
    width: number;
    height: number;
    spriteWidth?: number;
    spriteHeight?: number;
    scale?: number;
    frame?: number;
  };
  state?: HeadlessState;
}

export type HeadlessRunner = (
  req: HeadlessRunnerRequest,
  context: { asepritePath: string; headlessLua: string; libDir: string; workdir: string },
) => Promise<HeadlessRunnerResponse>;

interface Snapshot {
  filePath: string | null;
  state: HeadlessState;
  sourcePath?: string;
}

const MAX_HISTORY = 50;
const SPAWN_TIMEOUT_MS = 30000;

export async function defaultHeadlessRunner(
  req: HeadlessRunnerRequest,
  context: { asepritePath: string; headlessLua: string; libDir: string; workdir: string },
): Promise<HeadlessRunnerResponse> {
  const tmpDir = join(context.workdir, "tmp");
  mkdirSync(tmpDir, { recursive: true });

  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const reqPath = join(tmpDir, `req-${token}.json`);
  const resPath = join(tmpDir, `res-${token}.json`);

  writeFileSync(reqPath, JSON.stringify(req), "utf8");

  try {
    const proc = Bun.spawn(
      [
        context.asepritePath,
        "-b",
        "--script-param",
        `req=${reqPath}`,
        "--script-param",
        `res=${resPath}`,
        "--script-param",
        `lib=${context.libDir}`,
        "--script",
        context.headlessLua,
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        proc.kill();
      } catch {
        // ignore kill error
      }
    }, SPAWN_TIMEOUT_MS);

    const [exitCode, stdoutText, stderrText] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    clearTimeout(timer);

    if (timedOut) {
      throw new Error(
        `Aseprite headless command "${req.method}" timed out after ${SPAWN_TIMEOUT_MS}ms`,
      );
    }

    if (!existsSync(resPath)) {
      throw new Error(
        `Aseprite headless exited with code ${exitCode} without writing response. stdout=${stdoutText.trim()} stderr=${stderrText.trim()}`,
      );
    }

    const parsed = (await Bun.file(resPath).json()) as HeadlessRunnerResponse;
    if (exitCode !== 0 && parsed.ok !== false) {
      throw new Error(
        `Aseprite headless exited with code ${exitCode}. stdout=${stdoutText.trim()} stderr=${stderrText.trim()}`,
      );
    }
    return parsed;
  } finally {
    rmSync(reqPath, { force: true });
    rmSync(resPath, { force: true });
  }
}

export interface HeadlessBackendOptions {
  asepritePath?: string;
  workdir?: string;
  headlessLua?: string;
  libDir?: string;
  runner?: HeadlessRunner;
}

export class HeadlessBackend implements Backend {
  readonly kind = "headless" as const;

  private readonly asepritePath: string;
  private readonly workdir: string;
  private readonly headlessLua: string;
  private readonly libDir: string;
  private readonly runner: HeadlessRunner;
  private readonly hasCustomRunner: boolean;

  private readonly docPath: string;
  private readonly historyDir: string;
  private sourcePath: string | undefined;
  private state: HeadlessState = {};
  private latestPreview: RenderedPreview | null = null;
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private snapshotSeq = 1;
  private previewSeq = 1;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: HeadlessBackendOptions = {}) {
    this.asepritePath = options.asepritePath ?? process.env.ASEPRITE_PATH?.trim() ?? "";
    this.workdir = options.workdir ?? getWorkdir();
    const pluginRoot = resolve(import.meta.dir, "..", "aseprite-plugin");
    this.headlessLua = options.headlessLua ?? join(pluginRoot, "headless.lua");
    this.libDir = options.libDir ?? join(pluginRoot, "lib");
    this.runner = options.runner ?? defaultHeadlessRunner;
    this.hasCustomRunner = Boolean(options.runner);

    this.docPath = join(this.workdir, "current.aseprite");
    this.historyDir = join(this.workdir, "history");
  }

  isAvailable(): boolean {
    if (this.hasCustomRunner) return true;
    return Boolean(this.asepritePath && existsSync(this.asepritePath));
  }

  getDocPath(): string {
    return this.docPath;
  }

  getSourcePath(): string | undefined {
    return this.sourcePath;
  }

  getState(): HeadlessState {
    return { ...this.state };
  }

  call<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    opts?: { mutating?: boolean },
  ): Promise<T> {
    return this.enqueue(async () => {
      if (method === "undo") {
        return (await this.performUndo()) as T;
      }
      if (method === "redo") {
        return (await this.performRedo()) as T;
      }
      if (method === "list_sprites") {
        return this.performListSprites() as T;
      }
      if (method === "set_active_sprite") {
        return (await this.performSetActiveSprite()) as T;
      }
      if (method === "save_sprite") {
        return (await this.performSaveSprite(params)) as T;
      }

      const mutating = Boolean(opts?.mutating);
      let pushedSnapshot = false;

      if (mutating) {
        this.pushSnapshot(this.undoStack);
        pushedSnapshot = true;
      }

      const previewPath = mutating ? this.nextPreviewPath() : undefined;
      try {
        const res = await this.invoke(method, params, {
          save: mutating,
          render: mutating,
          previewPath,
        });

        if (mutating) {
          this.clearStack(this.redoStack);
        } else if (method === "set_active_frame") {
          this.latestPreview = null;
        }
        if (method === "open_sprite" && typeof params.path === "string") {
          this.sourcePath = params.path;
        } else if (method === "new_sprite") {
          this.sourcePath = undefined;
        }

        if (mutating && previewPath && existsSync(previewPath)) {
          const png = await Bun.file(previewPath).bytes();
          this.latestPreview = {
            png,
            width: res.previewMeta?.width ?? 0,
            height: res.previewMeta?.height ?? 0,
            spriteWidth: res.previewMeta?.spriteWidth,
            spriteHeight: res.previewMeta?.spriteHeight,
            scale: res.previewMeta?.scale,
            frame: res.previewMeta?.frame,
          };
        } else if (mutating && !res.state?.hasSprite) {
          this.latestPreview = null;
        }

        return res.result as T;
      } catch (err) {
        if (pushedSnapshot) {
          const reverted = this.undoStack.pop();
          if (reverted?.filePath) {
            rmSync(reverted.filePath, { force: true });
          }
        }
        throw err;
      } finally {
        if (previewPath) {
          rmSync(previewPath, { force: true });
        }
      }
    });
  }

  render(opts?: {
    frame?: number;
    scale?: number;
    maxSize?: number;
  }): Promise<RenderedPreview | null> {
    return this.enqueue(async () => {
      const hasCustomOpts =
        opts?.frame !== undefined || opts?.scale !== undefined || opts?.maxSize !== undefined;
      if (!hasCustomOpts && this.latestPreview) {
        return this.latestPreview;
      }
      if (!existsSync(this.docPath)) {
        return null;
      }

      const previewPath = this.nextPreviewPath();
      try {
        const res = await this.invoke(
          "render_preview",
          {
            path: previewPath,
            ...(opts?.frame !== undefined ? { frame: opts.frame } : {}),
            ...(opts?.scale !== undefined ? { scale: opts.scale } : {}),
            ...(opts?.maxSize !== undefined ? { maxSize: opts.maxSize } : {}),
          },
          { save: false, render: false },
        );

        const png = await Bun.file(previewPath).bytes();
        const meta = (res.result ?? {}) as {
          width?: number;
          height?: number;
          spriteWidth?: number;
          spriteHeight?: number;
          scale?: number;
          frame?: number;
        };
        const rendered: RenderedPreview = {
          png,
          width: meta.width ?? 0,
          height: meta.height ?? 0,
          spriteWidth: meta.spriteWidth,
          spriteHeight: meta.spriteHeight,
          scale: meta.scale,
          frame: meta.frame,
        };
        if (!hasCustomOpts) {
          this.latestPreview = rendered;
        }
        return rendered;
      } finally {
        rmSync(previewPath, { force: true });
      }
    });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async invoke(
    method: string,
    params: Record<string, unknown>,
    opts: { save: boolean; render: boolean; previewPath?: string },
  ): Promise<HeadlessRunnerResponse> {
    mkdirSync(this.workdir, { recursive: true });
    const req: HeadlessRunnerRequest = {
      method,
      params,
      doc: this.docPath,
      save: opts.save,
      render: opts.render,
      ...(opts.previewPath ? { previewPath: opts.previewPath } : {}),
      state: { ...this.state },
    };

    const res = await this.runner(req, {
      asepritePath: this.asepritePath,
      headlessLua: this.headlessLua,
      libDir: this.libDir,
      workdir: this.workdir,
    });

    if (!res.ok) {
      throw new Error(res.error || `Headless call "${method}" failed`);
    }

    if (res.state) {
      this.state = {
        ...(res.state.layer !== undefined ? { layer: res.state.layer } : {}),
        ...(res.state.frame !== undefined ? { frame: res.state.frame } : {}),
        hasSprite: res.state.hasSprite,
      };
    }

    return res;
  }

  private nextPreviewPath(): string {
    mkdirSync(this.workdir, { recursive: true });
    return join(this.workdir, `headless-preview-${Date.now()}-${this.previewSeq++}.png`);
  }

  private captureCurrentSnapshot(): Snapshot {
    mkdirSync(this.historyDir, { recursive: true });
    let filePath: string | null = null;
    if (existsSync(this.docPath)) {
      filePath = join(this.historyDir, `snap-${this.snapshotSeq++}.aseprite`);
      copyFileSync(this.docPath, filePath);
    }
    return {
      filePath,
      state: { ...this.state },
      sourcePath: this.sourcePath,
    };
  }

  private pushSnapshot(stack: Snapshot[]): void {
    stack.push(this.captureCurrentSnapshot());
    while (stack.length > MAX_HISTORY) {
      const oldest = stack.shift();
      if (oldest?.filePath) {
        rmSync(oldest.filePath, { force: true });
      }
    }
  }

  private clearStack(stack: Snapshot[]): void {
    while (stack.length > 0) {
      const item = stack.pop();
      if (item?.filePath) {
        rmSync(item.filePath, { force: true });
      }
    }
  }

  private async restoreSnapshot(snap: Snapshot): Promise<void> {
    if (snap.filePath && existsSync(snap.filePath)) {
      mkdirSync(this.workdir, { recursive: true });
      copyFileSync(snap.filePath, this.docPath);
    } else {
      rmSync(this.docPath, { force: true });
    }
    this.state = { ...snap.state };
    this.sourcePath = snap.sourcePath;
    this.latestPreview = null;

    if (existsSync(this.docPath)) {
      const previewPath = this.nextPreviewPath();
      try {
        const res = await this.invoke(
          "render_preview",
          { path: previewPath },
          { save: false, render: false },
        );
        if (existsSync(previewPath)) {
          const png = await Bun.file(previewPath).bytes();
          const meta = (res.result ?? {}) as {
            width?: number;
            height?: number;
            spriteWidth?: number;
            spriteHeight?: number;
            scale?: number;
            frame?: number;
          };
          this.latestPreview = {
            png,
            width: meta.width ?? 0,
            height: meta.height ?? 0,
            spriteWidth: meta.spriteWidth,
            spriteHeight: meta.spriteHeight,
            scale: meta.scale,
            frame: meta.frame,
          };
        }
      } finally {
        rmSync(previewPath, { force: true });
      }
    }
  }

  private async performUndo(): Promise<{ undone: boolean }> {
    const snap = this.undoStack.pop();
    if (!snap) {
      throw new Error("Nothing to undo");
    }
    this.pushSnapshot(this.redoStack);
    await this.restoreSnapshot(snap);
    if (snap.filePath) {
      rmSync(snap.filePath, { force: true });
    }
    return { undone: true };
  }

  private async performRedo(): Promise<{ redone: boolean }> {
    const snap = this.redoStack.pop();
    if (!snap) {
      throw new Error("Nothing to redo");
    }
    this.pushSnapshot(this.undoStack);
    await this.restoreSnapshot(snap);
    if (snap.filePath) {
      rmSync(snap.filePath, { force: true });
    }
    return { redone: true };
  }

  private performListSprites() {
    if (!existsSync(this.docPath)) {
      return { sprites: [] };
    }
    return {
      sprites: [
        {
          index: 1,
          filename: this.sourcePath ?? this.docPath,
          active: true,
        },
      ],
    };
  }

  private async performSetActiveSprite() {
    if (!existsSync(this.docPath)) {
      throw new Error("No active sprite — open or create one");
    }
    const res = await this.invoke("get_sprite_info", {}, { save: false, render: false });
    return res.result;
  }

  private async performSaveSprite(params: Record<string, unknown>) {
    if (!existsSync(this.docPath)) {
      throw new Error("No active sprite — open or create one");
    }
    const targetPath =
      typeof params.path === "string" && params.path.trim() !== ""
        ? params.path.trim()
        : this.sourcePath;
    if (!targetPath) {
      throw new Error(
        "No save path provided and current headless sprite has no source file path.",
      );
    }

    const res = await this.invoke(
      "save_sprite",
      { path: targetPath, copyOnly: true },
      { save: false, render: false },
    );

    const lower = targetPath.toLowerCase();
    if (lower.endsWith(".aseprite") || lower.endsWith(".ase")) {
      this.sourcePath = targetPath;
    }

    return res.result;
  }
}
