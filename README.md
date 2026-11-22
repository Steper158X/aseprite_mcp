**English** | [ภาษาไทย](README.th.md)

# Aseprite MCP — Live Local Socket Bridge + Headless + Web Preview

Connect AI clients (Antigravity, Claude Desktop, Cursor, etc.) directly to **Aseprite** so you can watch pixel art being drawn **live on your open canvas**, press `Ctrl+Z` to undo each AI action cleanly in one step, or jump in and draw alongside the AI at any time.

It also supports **Headless mode** (`aseprite -b --script`) when Aseprite is closed and provides a built-in **Web Preview** (`http://127.0.0.1:7777/`) that streams live updates from both AI tool calls and your own manual brushstrokes.

---

## Showcase

![Animated Orange Cat created live via Aseprite MCP](docs/demo-orange-cat.gif)

*4-frame smiling orange tabby animation (`32×32`, `160 ms/frame`, scaled 8× for display) created live inside Aseprite using `new_sprite`, `set_layer_props`, `add_layer`, `draw_rect`, `draw_ellipse`, `draw_pixel_art`, `add_frame`, `set_frame_duration`, and verified frame-by-frame with `get_screenshot`.*

---

## Architecture

```text
AI Client ──(stdio MCP)──► Bun Server (src/index.ts)
                             ├─ Router (src/backend.ts): auto | live | headless
                             │    ├─ LiveBackend     ──► ws://127.0.0.1:7777/aseprite ──► Aseprite Extension (handlers.lua)
                             │    └─ HeadlessBackend ──► spawn ASEPRITE_PATH -b --script headless.lua (handlers.lua)
                             └─ Web Preview (:7777)
                                  ├─ GET /            (live pixel viewer + zoom slider + last 20 activity log)
                                  ├─ GET /preview.png (latest rendered PNG)
                                  └─ WS  /preview     (real-time stream from AI edits & manual strokes)
```

- **Single Bun process:** Hosts MCP over `stdio`, the WebSocket bridge for Aseprite, and the Web Preview HTTP/WS server on one port (`7777` by default).
- **One undo step per edit:** Every mutating tool in Live mode wraps its canvas update in a single `app.transaction(...)` followed by `app.refresh()`.
- **Shared Lua engine:** Both Live and Headless modes execute the exact same `lib/handlers.lua` and `lib/util.lua`.

---

## Installation

1. **Clone & install dependencies (requires [Bun](https://bun.sh/)):**
   ```bash
   git clone <repo-url>
   cd aseprite_mcp
   bun install
   ```

2. **Package the Aseprite extension:**
   ```bash
   bun run package-plugin
   ```
   This builds `dist/aseprite-mcp-bridge.aseprite-extension`.

3. **Install the extension into Aseprite:**
   - Open **Aseprite** and drag `dist/aseprite-mcp-bridge.aseprite-extension` directly into the Aseprite window (or go to **Edit > Preferences > Extensions > Add Extension** and select the file).
   - If prompted for script/network permissions, choose **Give full trust**, then restart Aseprite once.
   - Verify **Aseprite MCP Bridge** is listed and enabled under **Edit > Preferences > Extensions**.

---

## AI Client Configuration

### Antigravity (`~/.gemini/config/mcp_config.json`)

```json
{
  "mcpServers": {
    "aseprite": {
      "command": "bun",
      "args": ["run", "F:/coding/aseprite_mcp/src/index.ts"],
      "env": {
        "ASEPRITE_PATH": "F:/SteamLibrary/steamapps/common/Aseprite/Aseprite.exe"
      }
    }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "aseprite": {
      "command": "bun",
      "args": ["run", "F:/coding/aseprite_mcp/src/index.ts"],
      "env": {
        "ASEPRITE_PATH": "F:/SteamLibrary/steamapps/common/Aseprite/Aseprite.exe"
      }
    }
  }
}
```

### Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "aseprite": {
      "command": "bun",
      "args": ["run", "F:/coding/aseprite_mcp/src/index.ts"],
      "env": {
        "ASEPRITE_PATH": "F:/SteamLibrary/steamapps/common/Aseprite/Aseprite.exe"
      }
    }
  }
}
```

> **Windows tip:** If your AI client cannot find `bun` on `PATH`, set `"command"` to the full path of `bun.exe`, e.g. `"C:\\Users\\<Username>\\.bun\\bin\\bun.exe"`. Setting `ASEPRITE_PATH` is optional — omit it for Live-only mode, or include it to enable Headless fallback when Aseprite is closed.

---

## Web Preview

Once the MCP server is running, open your browser to:
- **Live Preview UI:** `http://127.0.0.1:7777/`
- **Latest Frame PNG:** `http://127.0.0.1:7777/preview.png`

The preview renders with crisp `image-rendering: pixelated` on a checkerboard background, displays active mode (`Live` / `Headless` / `Disconnected`), includes a zoom slider, logs the last 20 tool actions, and updates on both AI edits and manual strokes inside Aseprite.

---

## Modes & Environment Variables

### Backend Modes (`ASEPRITE_MODE`)

| Mode | Behavior |
| --- | --- |
| `auto` *(default)* | Uses **Live** whenever Aseprite is open and connected; automatically falls back to **Headless** if `ASEPRITE_PATH` is set. |
| `live` | Requires a live Aseprite GUI connection via the extension; returns a helpful error if Aseprite is not connected. |
| `headless` | Always spawns `ASEPRITE_PATH -b --script` even if Aseprite GUI is open. |

### Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `ASEPRITE_MCP_PORT` | `7777` | Port for HTTP Preview (`/`, `/preview.png`) and WebSockets (`/aseprite`, `/preview`). |
| `ASEPRITE_PATH` | *(unset)* | Full path to `Aseprite.exe` to enable Headless batch mode. |
| `ASEPRITE_MODE` | `auto` | Backend mode: `auto`, `live`, or `headless`. |
| `ASEPRITE_MCP_WORKDIR` | `<os.tmpdir()>/aseprite-mcp` | Temp directory for preview PNGs and Headless workspace/history snapshots. |
| `ASEPRITE_MCP_ALLOW_LUA` | `0` | Set to `1` to register the opt-in `run_lua` escape-hatch tool. |
| `ASEPRITE_MCP_OPEN_PREVIEW` | `0` | Set to `1` to automatically open `http://127.0.0.1:<port>/` in your browser on startup. |

---

## Available Tools (30 + 1 opt-in)

| Category | Tools |
| --- | --- |
| **Status & Files** | `get_status`, `ping`, `get_sprite_info`, `list_sprites`, `set_active_sprite`, `new_sprite`, `open_sprite`, `save_sprite` |
| **Drawing & History** | `draw_pixels`, `draw_pixel_art`, `draw_line`, `draw_rect`, `draw_ellipse`, `fill_area`, `clear`, `set_colors`, `undo`, `redo` |
| **Layers** | `add_layer`, `delete_layer`, `set_active_layer`, `set_layer_props` |
| **Frames** | `add_frame`, `delete_frame`, `set_active_frame`, `set_frame_duration` |
| **Palette** | `get_palette`, `set_palette` |
| **Inspection** | `get_screenshot` *(returns crisp upscaled PNG)*, `get_pixels` *(returns `#rrggbbaa` grid up to `128×128`)* |
| **Advanced (Opt-in)** | `run_lua` *(enabled only when `ASEPRITE_MCP_ALLOW_LUA=1`)* |

---

## Scripts

- `bun start` — Run the MCP stdio server directly
- `bun test` — Run unit tests (`bridge`, `headless`, `preview`, `raster`)
- `bun run typecheck` — Run strict TypeScript check (`tsc --noEmit`)
- `bun run package-plugin` — Build `dist/aseprite-mcp-bridge.aseprite-extension`
- `bun run smoke` — Run end-to-end MCP stdio smoke test (works in Live, Headless, or offline status check)
- `bun run cli --wait 10 <method> '<json>'` — Send a single command directly to the live Aseprite extension

---

## Troubleshooting

- **Port `7777` conflict:** Running two AI clients at once (e.g., Antigravity + Claude Desktop) causes the second server to hit `EADDRINUSE`. It stays alive without crashing and reports the port conflict on tool calls. Close one client or set a custom `ASEPRITE_MCP_PORT` (and update the bridge URL under **File > Scripts** / plugin preferences).
- **Extension not loaded / menu commands missing:** Check **Edit > Preferences > Extensions** to confirm **Aseprite MCP Bridge** is enabled, and restart Aseprite after installing or updating `.aseprite-extension`.
- **Headless latency:** Headless mode launches `Aseprite.exe -b` per call (~0.2–1 s per action), whereas Live mode executes immediately over WebSocket.
- **`Ctrl+Z` undo behavior:**
  - **Live mode:** Each mutating MCP tool call is one `app.transaction` (`Ctrl+Z` reverts one entire shape/pixel batch). Note that the `undo` tool calls `app.undo()`, which undoes the most recent action regardless of whether the AI or the user made it.
  - **Headless mode:** Keeps up to 50 `.aseprite` file snapshots in `ASEPRITE_MCP_WORKDIR/history` for multi-step `undo` / `redo`.
