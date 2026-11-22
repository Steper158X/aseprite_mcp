import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LiveBackend, Router } from "../src/backend.ts";
import { Bridge } from "../src/bridge.ts";
import {
  HeadlessBackend,
  type HeadlessRunner,
  type HeadlessRunnerRequest,
} from "../src/headless.ts";

const PNG_A = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
const PNG_B = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x02]);

describe("HeadlessBackend", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs) {
      rmSync(d, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  function makeWorkdir(): string {
    const dir = mkdtempSync(join(tmpdir(), "aseprite-headless-test-"));
    dirs.push(dir);
    return dir;
  }

  test("serializes concurrent calls in queue order and persists state", async () => {
    const workdir = makeWorkdir();
    const trace: string[] = [];
    const seenStates: Array<HeadlessRunnerRequest["state"]> = [];

    const runner: HeadlessRunner = async (req) => {
      trace.push(`start:${req.method}`);
      seenStates.push({ ...req.state });
      if (req.method === "new_sprite") {
        await Bun.sleep(30);
        writeFileSync(req.doc, "doc-v1");
        if (req.render && req.previewPath) writeFileSync(req.previewPath, PNG_A);
        trace.push(`end:${req.method}`);
        return {
          ok: true,
          result: { width: 16, height: 16 },
          previewMeta: { width: 512, height: 512 },
          state: { hasSprite: true, layer: "Layer 1", frame: 1 },
        };
      }
      if (req.method === "draw_pixels") {
        writeFileSync(req.doc, "doc-v2");
        if (req.render && req.previewPath) writeFileSync(req.previewPath, PNG_B);
        trace.push(`end:${req.method}`);
        return {
          ok: true,
          result: { drawn: 4 },
          previewMeta: { width: 512, height: 512 },
          state: { hasSprite: true, layer: "Sketch", frame: 2 },
        };
      }
      trace.push(`end:${req.method}`);
      return {
        ok: true,
        result: { pong: true },
        state: req.state,
      };
    };

    const backend = new HeadlessBackend({ workdir, runner });
    const p1 = backend.call("new_sprite", { width: 16, height: 16 }, { mutating: true });
    const p2 = backend.call("draw_pixels", { pixels: [] }, { mutating: true });
    const p3 = backend.call("ping", {});

    await Promise.all([p1, p2, p3]);

    expect(trace).toEqual([
      "start:new_sprite",
      "end:new_sprite",
      "start:draw_pixels",
      "end:draw_pixels",
      "start:ping",
      "end:ping",
    ]);
    expect(seenStates[1]).toEqual({ hasSprite: true, layer: "Layer 1", frame: 1 });
    expect(seenStates[2]).toEqual({ hasSprite: true, layer: "Sketch", frame: 2 });
  });

  test("snapshot undo and redo restore document, state, and clear redo on new mutation", async () => {
    const workdir = makeWorkdir();
    let docSeq = 0;

    const runner: HeadlessRunner = async (req) => {
      if (req.method === "render_preview") {
        const content = await Bun.file(req.doc).text();
        const bytes = content.includes("v2") ? PNG_B : PNG_A;
        writeFileSync(String(req.params.path), bytes);
        return { ok: true, result: { width: 64, height: 64 }, state: req.state };
      }

      docSeq++;
      const version = req.method === "new_sprite" ? "v1" : `v2-${docSeq}`;
      writeFileSync(req.doc, version);
      if (req.render && req.previewPath) {
        writeFileSync(req.previewPath, version === "v1" ? PNG_A : PNG_B);
      }
      return {
        ok: true,
        result: { version },
        previewMeta: { width: 64, height: 64 },
        state: {
          hasSprite: true,
          layer: req.method === "new_sprite" ? "Layer 1" : "Edited",
          frame: 1,
        },
      };
    };

    const backend = new HeadlessBackend({ workdir, runner });

    await backend.call("new_sprite", { width: 8, height: 8 }, { mutating: true });
    expect(await Bun.file(backend.getDocPath()).text()).toBe("v1");

    await backend.call("draw_pixels", { pixels: [] }, { mutating: true });
    expect(await Bun.file(backend.getDocPath()).text()).toStartWith("v2-");
    expect(Array.from((await backend.render())!.png)).toEqual(Array.from(PNG_B));

    await backend.call("undo", {}, { mutating: true });
    expect(await Bun.file(backend.getDocPath()).text()).toBe("v1");
    expect(backend.getState().layer).toBe("Layer 1");
    expect(Array.from((await backend.render())!.png)).toEqual(Array.from(PNG_A));

    await backend.call("redo", {}, { mutating: true });
    expect(await Bun.file(backend.getDocPath()).text()).toStartWith("v2-");
    expect(backend.getState().layer).toBe("Edited");

    // Undoing twice removes the doc created by new_sprite
    await backend.call("undo", {}, { mutating: true });
    await backend.call("undo", {}, { mutating: true });
    expect(existsSync(backend.getDocPath())).toBe(false);
    expect(await backend.render()).toBeNull();

    // Redo restores new_sprite, then a new mutation clears redo stack
    await backend.call("redo", {}, { mutating: true });
    expect(await Bun.file(backend.getDocPath()).text()).toBe("v1");
    await backend.call("draw_pixels", { pixels: [] }, { mutating: true });
    await expect(backend.call("redo", {}, { mutating: true })).rejects.toThrow(/Nothing to redo/);
  });

  test("error propagation does not pollute undo history", async () => {
    const workdir = makeWorkdir();
    const runner: HeadlessRunner = async (req) => {
      if (req.method === "new_sprite") {
        writeFileSync(req.doc, "v1");
        return { ok: true, result: { ok: true }, state: { hasSprite: true, layer: "Layer 1", frame: 1 } };
      }
      return { ok: false, error: "Bad pixels" };
    };

    const backend = new HeadlessBackend({ workdir, runner });
    await backend.call("new_sprite", {}, { mutating: true });
    await expect(backend.call("draw_pixels", {}, { mutating: true })).rejects.toThrow("Bad pixels");

    // One undo should revert new_sprite (the failed draw_pixels did not push a sticky snapshot)
    await backend.call("undo", {}, { mutating: true });
    expect(existsSync(backend.getDocPath())).toBe(false);
  });

  test("failed mutating call after disk write restores prior document", async () => {
    const workdir = makeWorkdir();
    const runner: HeadlessRunner = async (req) => {
      if (req.method === "new_sprite") {
        writeFileSync(req.doc, "v1");
        if (req.render && req.previewPath) writeFileSync(req.previewPath, PNG_A);
        return {
          ok: true,
          result: { ok: true },
          previewMeta: { width: 8, height: 8 },
          state: { hasSprite: true, layer: "Layer 1", frame: 1 },
        };
      }
      if (req.method === "draw_pixels") {
        writeFileSync(req.doc, "corrupted");
        return { ok: false, error: "preview failed after save" };
      }
      return { ok: true, result: {}, state: req.state };
    };

    const backend = new HeadlessBackend({ workdir, runner });
    await backend.call("new_sprite", {}, { mutating: true });
    await expect(backend.call("draw_pixels", {}, { mutating: true })).rejects.toThrow(
      /preview failed/,
    );
    expect(await Bun.file(backend.getDocPath()).text()).toBe("v1");
    expect(backend.getState().layer).toBe("Layer 1");
  });

  test("keeps prior layer when response omits layer key", async () => {
    const workdir = makeWorkdir();
    const runner: HeadlessRunner = async (req) => {
      if (req.method === "new_sprite") {
        writeFileSync(req.doc, "v1");
        return {
          ok: true,
          result: {},
          state: { hasSprite: true, layer: "Layer 1", frame: 1 },
        };
      }
      return {
        ok: true,
        result: { pong: true },
        state: { hasSprite: true, frame: 2 },
      };
    };

    const backend = new HeadlessBackend({ workdir, runner });
    await backend.call("new_sprite", {}, { mutating: true });
    await backend.call("ping", {});
    expect(backend.getState()).toEqual({ hasSprite: true, layer: "Layer 1", frame: 2 });
  });
});


describe("Router mode selection", () => {
  test("selects live vs headless according to auto, live, and headless modes", () => {
    const workdir = mkdtempSync(join(tmpdir(), "aseprite-router-test-"));
    try {
      const bridge = new Bridge();
      const live = new LiveBackend(bridge, workdir);
      const headless = new HeadlessBackend({
        workdir,
        runner: async () => ({ ok: true, result: {} }),
      });

      // Live unavailable, headless available -> auto picks headless
      const autoRouter = new Router({ mode: "auto", bridge, live, headless });
      expect(autoRouter.resolveBackend().kind).toBe("headless");

      // Forced live mode fails when bridge disconnected
      const liveRouter = new Router({ mode: "live", bridge, live, headless });
      expect(() => liveRouter.resolveBackend()).toThrow(/not connected/i);

      // Forced headless fails when no headless backend provided
      const headlessMissing = new Router({ mode: "headless", bridge, live, headless: null });
      expect(() => headlessMissing.resolveBackend()).toThrow(/ASEPRITE_PATH/);

      // Auto fails cleanly when neither is available
      const noneRouter = new Router({ mode: "auto", bridge, live, headless: null });
      expect(() => noneRouter.resolveBackend()).toThrow(/ASEPRITE_PATH/);
    } finally {
      rmSync(workdir, { recursive: true, force: true });
    }
  });
});
