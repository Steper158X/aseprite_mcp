import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { BackendKind, Router } from "../backend.ts";

export const hexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "Expected hex color #RRGGBB or #RRGGBBAA");

export const layerFrameShape = {
  layer: z
    .string()
    .min(1)
    .optional()
    .describe("Target layer name (optional; defaults to active layer)"),
  frame: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("1-based frame number (optional; defaults to active frame)"),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function jsonOk(mode: BackendKind | "none", data: unknown): CallToolResult {
  const payload = isRecord(data) ? { ...data, mode } : { mode, result: data };
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function toolError(err: unknown): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: err instanceof Error ? err.message : String(err),
      },
    ],
  };
}

export async function runBackendTool(
  router: Router,
  method: string,
  params: Record<string, unknown>,
  opts?: { mutating?: boolean; toolName?: string },
): Promise<CallToolResult> {
  try {
    const { mode, result } = await router.call(method, params, opts);
    return jsonOk(mode, result);
  } catch (err) {
    return toolError(err);
  }
}
