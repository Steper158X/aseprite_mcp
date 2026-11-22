import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Router } from "../backend.ts";
import { runBackendTool } from "./common.ts";

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
}
