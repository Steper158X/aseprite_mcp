**English** | [ภาษาไทย](README.th.md)

# Aseprite MCP — Live Local Socket Bridge + Headless + Web Preview

Let an AI assistant (Antigravity, Claude Desktop, Cursor, etc.) draw pixel art and animations **live inside your open Aseprite window**. Every AI edit appears immediately on your canvas, can be undone with a single `Ctrl+Z`, and lets you draw alongside the AI at any time.

It also works **even when Aseprite is closed** (Headless mode via `ASEPRITE_PATH`) and includes a built-in **Web Preview** (`http://127.0.0.1:7777/`) that updates live from both AI tool calls and your own manual brushstrokes.

---

## Showcase

| Animated Sprite (32×32, 4 Frames) | Isometric Cozy Piano Room (96×96, 6 Layers) |
| :---: | :---: |
| ![Animated Orange Cat created live via Aseprite MCP](docs/demo-orange-cat.gif) | ![Cozy Isometric Piano Room created live via Aseprite MCP](docs/demo-piano-room.png) |
| 4-frame smiling orange tabby (`160 ms/frame`, 8× display) built with `draw_pixel_art`, `add_frame`, `set_frame_duration` | Multi-layer 2:1 isometric diorama (`Backdrop`, `Room Shell`, `Window & Decor`, `Piano & Bench`, `Pianist`, `Sunlight` screen-blend sunbeams) built with `draw_line`, `fill_area`, `draw_pixel_art`, `set_layer_props` |

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

---

## Complete Beginner Setup Guide (Step-by-Step)

You do **not** need Python, virtual environments, or complex dev tooling — this project uses **Bun** to run everything in one place.

### Step 1: Install Bun

Bun is the lightweight runtime that runs the Aseprite MCP server.

#### On Windows
1. Open the **Start Menu**, type `PowerShell`, and click **Windows PowerShell**.
2. Paste this command and press **Enter**:
   ```powershell
   powershell -c "irm bun.sh/install.ps1 | iex"
   ```
3. **Close PowerShell and open a new PowerShell window** (so Windows picks up the new `bun` command).
4. Verify it works by running:
   ```powershell
   bun --version
   ```
   You should see a version number like `1.4.4`.
5. *(Optional — helpful for AI Client config later)* Find the exact path to `bun.exe`:
   ```powershell
   where.exe bun
   ```
   It is usually `C:\Users\<YourUsername>\.bun\bin\bun.exe`.

#### On macOS / Linux
1. Open **Terminal**.
2. Run:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```
3. Close and reopen **Terminal**, then verify:
   ```bash
   bun --version
   ```

---

### Step 2: Download & Prepare the Project

- **Option A — Download ZIP (No Git required):**
  1. Download this repository as a ZIP file and extract it somewhere easy to find, for example `F:\coding\aseprite_mcp`.
  2. Open **PowerShell** (or Terminal) inside that folder (e.g., on Windows, open the folder, click the address bar, type `powershell`, and press **Enter**).
- **Option B — Using Git:**
  ```bash
  git clone <repo-url>
  cd aseprite_mcp
  ```

Next, run these two commands inside the `aseprite_mcp` folder:
```bash
bun install
bun run package-plugin
```
- `bun install` downloads the required packages once.
- `bun run package-plugin` builds the single-file plugin at `dist/aseprite-mcp-bridge.aseprite-extension`.

---

### Step 3: Install the Plugin into Aseprite

1. Open **Aseprite**.
2. Open the `dist` folder inside `aseprite_mcp` and **drag `aseprite-mcp-bridge.aseprite-extension` directly onto the Aseprite window**.
   - *Alternative:* In Aseprite, click **Edit > Preferences > Extensions > Add Extension**, select `dist/aseprite-mcp-bridge.aseprite-extension`, and click **Apply / OK**.
3. If Aseprite asks for permission to run scripts or connect to localhost, choose **Give full trust**.
4. **Restart Aseprite once** so the plugin activates and auto-connects.
5. Check **Edit > Preferences > Extensions** to confirm **Aseprite MCP Bridge** is listed and checked.
   - *(Tip)* You can also check connection status or connect/disconnect manually anytime inside Aseprite under **File > MCP Bridge...**.

---

### Step 4: Connect to Your AI Client

Choose the AI app you use and add the `"aseprite"` entry to its MCP config file.

> **How to find `Aseprite.exe` on Steam (Windows):**  
> Open Steam → Right-click **Aseprite** → **Manage > Browse local files** → Copy the folder path (usually `F:\SteamLibrary\steamapps\common\Aseprite\Aseprite.exe` or `C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe`).

#### Antigravity
Open `~/.gemini/config/mcp_config.json` (on Windows: `C:\Users\<YourUsername>\.gemini\config\mcp_config.json`):

```json
{
  "mcpServers": {
    "aseprite": {
      "command": "C:\\Users\\<YourUsername>\\.bun\\bin\\bun.exe",
      "args": ["run", "F:\\coding\\aseprite_mcp\\src\\index.ts"],
      "env": {
        "ASEPRITE_PATH": "F:\\SteamLibrary\\steamapps\\common\\Aseprite\\Aseprite.exe"
      }
    }
  }
}
```
Then open **Additional Options (`...`) > MCP Servers > Refresh** (or start a new chat).

#### Claude Desktop
Open the config file:
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json` *(Press `Win+R`, type `%APPDATA%\Claude`, press Enter)*
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

Add (merge inside `"mcpServers"` if you already have other servers):
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
Fully quit Claude Desktop (check the system tray) and reopen it.

#### Cursor
Create or edit `.cursor/mcp.json` in your project (or global Cursor MCP settings):
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
Reload Cursor or refresh MCP servers in **Cursor Settings > MCP**.

> **Windows tip:** If your AI client says `command "bun" not found`, replace `"command": "bun"` with the full path you found in Step 1 (e.g. `"C:\\Users\\<YourUsername>\\.bun\\bin\\bun.exe"`).  
> **Note on `ASEPRITE_PATH`:** Including `ASEPRITE_PATH` enables **Headless fallback** when Aseprite is closed. If you only want Live mode, you can omit `"env"`.

---

## How to Use (Detailed Guide)

### 1. Live Mode (Recommended — Draw Together in Real Time)
1. **Open Aseprite** and leave the window open on your screen. (The extension connects automatically to `ws://127.0.0.1:7777/aseprite`.)
2. Open your AI client (Antigravity, Claude Desktop, or Cursor) and start chatting.
3. Ask the AI to check the connection (`"Check Aseprite status"`) or go straight to drawing (`"Create a 32x32 canvas and draw a cute orange cat"`).
4. **Watch it draw live:** Every shape, layer, frame, and pixel appears instantly inside Aseprite!
5. **Undo or edit anytime:**
   - Each AI drawing call is grouped into **one Undo step**, so pressing **`Ctrl+Z`** once in Aseprite reverts that entire AI step cleanly.
   - You can use Aseprite's pencil, eraser, fill, or palette tools right alongside the AI without closing anything.
   - For animations, press **`Enter`** in Aseprite to preview the loop playback.

### 2. Headless Mode (Draw Without Opening Aseprite)
1. As long as `ASEPRITE_PATH` is set in your MCP config, you don't even need to open Aseprite.
2. When Aseprite is closed (`ASEPRITE_MODE=auto`), the server automatically runs `Aseprite.exe -b` in the background to execute every drawing, layer, frame, palette, and export command.
3. You can still ask the AI to save/export the final file (`"Save as my-cat.aseprite"` or `"Export as cat.gif"`), or watch it live on the Web Preview page!
4. Headless mode maintains up to **50 snapshot undo/redo steps** automatically.

### 3. Using the Web Preview (`http://127.0.0.1:7777/`)
Whenever your AI client has the MCP server running, open a browser to:
- **`http://127.0.0.1:7777/`** — Interactive Web Preview
- **`http://127.0.0.1:7777/preview.png`** — Direct latest PNG image

What you'll see in the Web Preview:
- **Status Badge** at top-left:
  - Green **`LIVE`** = Connected to your open Aseprite window
  - Blue **`HEADLESS`** = Rendering via background Aseprite batch runs
  - Gray **`DISCONNECTED`** = Waiting for Aseprite or first render
- **Zoom Slider**: Scale pixels cleanly (`25%`–`200%`) with sharp nearest-neighbor rendering (`image-rendering: pixelated`) over a transparent checkerboard.
- **Activity Log (Last 20)**: Shows each AI command (`draw_pixel_art`, `add_frame`, etc.) and even **`manual_edit`** automatically whenever you paint in Aseprite with your own mouse/stylus!

### 4. Example Prompts You Can Try
- **Check setup:** `"Check Aseprite MCP status"`
- **Start a canvas & draw:** `"Create a 32x32 RGB sprite and draw a cute smiling orange tabby cat on its own layer"`
- **Refine & inspect:** `"Take a screenshot of the canvas and check if the proportions look good"`
- **Make it animated:** `"Turn this into a 4-frame tail-wagging animation at 160ms per frame"`
- **Manage layers & palette:** `"Add a Shadow layer with 50% opacity and multiply blend mode, then get the current palette"`
- **Save & export:** `"Save this sprite as F:/art/cat.aseprite and also export a copy as F:/art/cat.gif"`

---

## Modes & Environment Variables

### Backend Modes (`ASEPRITE_MODE`)

| Mode | Behavior |
| --- | --- |
| `auto` *(default)* | Uses **Live** whenever Aseprite is open and connected; automatically falls back to **Headless** if `ASEPRITE_PATH` is set. |
| `live` | Requires a live Aseprite GUI connection via the extension; returns a clear error if Aseprite is not connected. |
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

## Developer Scripts

- `bun start` — Run the MCP stdio server directly
- `bun test` — Run unit tests (`bridge`, `headless`, `preview`, `raster`)
- `bun run typecheck` — Run strict TypeScript check (`tsc --noEmit`)
- `bun run package-plugin` — Build `dist/aseprite-mcp-bridge.aseprite-extension`
- `bun run smoke` — Run end-to-end MCP stdio smoke test (Live, Headless, or offline status check)
- `bun run cli --wait 10 <method> '<json>'` — Send a single command directly to the live Aseprite extension

---

## Troubleshooting

- **"bun is not recognized" after installing Bun:** Close PowerShell/Terminal completely and open a fresh one. In AI Client JSON configs, use the full path to `bun.exe` (found via `where.exe bun` on Windows or `which bun` on macOS/Linux).
- **Port `7777` conflict:** Running two AI clients at once (e.g., Antigravity + Claude Desktop) causes the second server to hit `EADDRINUSE`. It stays alive without crashing and reports the port conflict on tool calls. Close one client or set a custom `ASEPRITE_MCP_PORT`.
- **Aseprite says "Disconnected" or extension missing:** Check **Edit > Preferences > Extensions** to confirm **Aseprite MCP Bridge** is checked, restart Aseprite, or click **File > MCP Bridge...** and click **Connect** while an AI client is running.
- **Headless latency:** Headless mode launches `Aseprite.exe -b` per call (~0.2–1 s per action), whereas Live mode executes immediately over WebSocket.
- **`Ctrl+Z` undo behavior:**
  - **Live mode:** Each mutating MCP tool call is one `app.transaction` (`Ctrl+Z` reverts one entire shape/pixel batch). Note that the `undo` tool calls `app.undo()`, which undoes the most recent action regardless of whether the AI or the user made it.
  - **Headless mode:** Keeps up to 50 `.aseprite` file snapshots in `ASEPRITE_MCP_WORKDIR/history` for multi-step `undo` / `redo`.
