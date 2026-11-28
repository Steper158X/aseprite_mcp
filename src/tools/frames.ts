import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Router } from "../backend.ts";
import { hexColorSchema, runBackendTool } from "./common.ts";

export function registerFrameTools(server: McpServer, router: Router): void {
  server.registerTool(
    "add_frame",
    {
      description:
        "Insert a new animation frame after the specified 1-based frame (defaults to active frame), optionally copying cel contents (default copy=true), and activate it. One Ctrl+Z undo step.",
      inputSchema: {
        after: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("1-based frame number after which to insert (defaults to active frame)"),
        copy: z
          .boolean()
          .optional()
          .describe("Copy cels from the source frame into the new frame (default true)"),
      },
    },
    async ({ after, copy }) =>
      runBackendTool(
        router,
        "add_frame",
        {
          ...(after !== undefined ? { after } : {}),
          ...(copy !== undefined ? { copy } : {}),
        },
        { mutating: true, toolName: "add_frame" },
      ),
  );

  server.registerTool(
    "delete_frame",
    {
      description:
        "Delete a 1-based animation frame (cannot delete the last remaining frame). One Ctrl+Z undo step.",
      inputSchema: {
        frame: z.number().int().min(1).describe("1-based frame number to delete"),
      },
    },
    async ({ frame }) =>
      runBackendTool(
        router,
        "delete_frame",
        { frame },
        { mutating: true, toolName: "delete_frame" },
      ),
  );

  server.registerTool(
    "set_active_frame",
    {
      description: "Switch the active animation frame (1-based).",
      inputSchema: {
        frame: z.number().int().min(1).describe("1-based frame number to activate"),
      },
    },
    async ({ frame }) => runBackendTool(router, "set_active_frame", { frame }),
  );

  server.registerTool(
    "set_frame_duration",
    {
      description: "Set the playback duration (in milliseconds) of a 1-based animation frame. One Ctrl+Z undo step.",
      inputSchema: {
        frame: z.number().int().min(1).describe("1-based frame number"),
        ms: z.number().int().min(1).max(60000).describe("Frame duration in milliseconds"),
      },
    },
    async ({ frame, ms }) =>
      runBackendTool(
        router,
        "set_frame_duration",
        { frame, ms },
        { mutating: true, toolName: "set_frame_duration" },
      ),
  );

  server.registerTool(
    "add_tag",
    {
      description:
        "Add an animation tag covering a 1-based frame range. aniDir is forward, reverse, or pingpong. One Ctrl+Z undo step.",
      inputSchema: {
        name: z.string().min(1),
        fromFrame: z.number().int().min(1),
        toFrame: z.number().int().min(1),
        aniDir: z.enum(["forward", "reverse", "pingpong"]).optional(),
        color: hexColorSchema.optional(),
      },
    },
    async ({ name, fromFrame, toFrame, aniDir, color }) =>
      runBackendTool(
        router,
        "add_tag",
        {
          name,
          fromFrame,
          toFrame,
          ...(aniDir !== undefined ? { aniDir } : {}),
          ...(color !== undefined ? { color } : {}),
        },
        { mutating: true, toolName: "add_tag" },
      ),
  );

  server.registerTool(
    "set_tag",
    {
      description: "Update an existing animation tag's range, direction, color, or name. One Ctrl+Z undo step.",
      inputSchema: {
        name: z.string().min(1),
        newName: z.string().min(1).optional(),
        fromFrame: z.number().int().min(1).optional(),
        toFrame: z.number().int().min(1).optional(),
        aniDir: z.enum(["forward", "reverse", "pingpong"]).optional(),
        color: hexColorSchema.optional(),
      },
    },
    async ({ name, newName, fromFrame, toFrame, aniDir, color }) =>
      runBackendTool(
        router,
        "set_tag",
        {
          name,
          ...(newName !== undefined ? { newName } : {}),
          ...(fromFrame !== undefined ? { fromFrame } : {}),
          ...(toFrame !== undefined ? { toFrame } : {}),
          ...(aniDir !== undefined ? { aniDir } : {}),
          ...(color !== undefined ? { color } : {}),
        },
        { mutating: true, toolName: "set_tag" },
      ),
  );

  server.registerTool(
    "delete_tag",
    {
      description: "Delete an animation tag by name. One Ctrl+Z undo step.",
      inputSchema: { name: z.string().min(1) },
    },
    async ({ name }) =>
      runBackendTool(router, "delete_tag", { name }, { mutating: true, toolName: "delete_tag" }),
  );
}
