import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";

const EXPECTED_TOOLS = [
  "get_status",
  "ping",
  "get_sprite_info",
  "new_sprite",
  "draw_pixels",
  "draw_pixel_art",
  "draw_line",
  "draw_rect",
  "draw_ellipse",
  "fill_area",
  "clear",
  "set_colors",
  "undo",
  "redo",
  "get_screenshot",
];

function extractText(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("\n");
}

async function main(): Promise<void> {
  const repoRoot = resolve(import.meta.dir, "..");
  const entry = resolve(repoRoot, "src", "index.ts");

  const childEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") childEnv[k] = v;
  }

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["run", entry],
    cwd: repoRoot,
    env: childEnv,
    stderr: "pipe",
  });

  const client = new Client({
    name: "aseprite-mcp-smoke",
    version: "0.1.0",
  });

  await client.connect(transport);

  try {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    console.log(`Listed ${names.length} tools: ${names.join(", ")}`);

    for (const expected of EXPECTED_TOOLS) {
      if (!names.includes(expected)) {
        throw new Error(`Missing expected MCP tool: ${expected}`);
      }
    }

    // Give live Aseprite up to ~3.5s to reconnect (minreconnectwait=1..3s)
    let status: Record<string, unknown> = {};
    for (let attempt = 0; attempt < 8; attempt++) {
      const res = await client.callTool({ name: "get_status", arguments: {} });
      const txt = extractText(res as { content: Array<{ type: string; text?: string }> });
      status = JSON.parse(txt) as Record<string, unknown>;
      if (status.connected === true) break;
      await Bun.sleep(500);
    }

    console.log("get_status:", JSON.stringify(status, null, 2));

    if (status.activeBackend) {
      const spriteRes = await client.callTool({
        name: "new_sprite",
        arguments: { width: 16, height: 16 },
      });
      console.log(
        "new_sprite:",
        extractText(spriteRes as { content: Array<{ type: string; text?: string }> }),
      );

      const rectRes = await client.callTool({
        name: "draw_rect",
        arguments: { x: 2, y: 2, width: 12, height: 12, color: "#00ff88", filled: true },
      });
      console.log(
        "draw_rect:",
        extractText(rectRes as { content: Array<{ type: string; text?: string }> }),
      );

      const shotRes = (await client.callTool({
        name: "get_screenshot",
        arguments: {},
      })) as {
        isError?: boolean;
        content: Array<{ type: string; data?: string; mimeType?: string; text?: string }>;
      };

      if (shotRes.isError) {
        console.log("get_screenshot returned error:", extractText(shotRes));
      } else {
        const img = shotRes.content.find((c) => c.type === "image");
        if (!img?.data || img.mimeType !== "image/png") {
          throw new Error("get_screenshot did not return a PNG image content block");
        }
        const bytes = Buffer.from(img.data, "base64");
        if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
          throw new Error("get_screenshot image is missing PNG magic header");
        }
        console.log(`get_screenshot PNG verified (${bytes.length} bytes, valid PNG magic)`);
      }
    } else {
      console.log("No live/headless backend active; skipping live draw_rect + get_screenshot.");
    }
  } finally {
    await client.close();
  }
}

await main();
