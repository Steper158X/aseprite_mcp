**English** | [ภาษาไทย](README.th.md)

# Aseprite MCP — Setup Guide

This project lets an AI assistant (Cursor, Claude Desktop, Antigravity, and similar apps) **draw pixel art live inside Aseprite** on your computer. You see every stroke on the canvas, you can undo with `Ctrl+Z`, and you can draw with the mouse at the same time.

You do **not** need to know programming to follow this guide. Work through the steps in order.

**Prefer the AI to install for you?** Copy the whole prompt below into Cursor (or another MCP-capable chat) and send it:

```text
Read this install playbook and install Aseprite MCP for me step by step.
I am a beginner — explain simply, do one step at a time, and run commands yourself when you can.

https://raw.githubusercontent.com/Steper158X/aseprite_mcp/main/docs/AI_INSTALL_PLAYBOOK.md
```

(Readable page: [docs/AI_INSTALL_PLAYBOOK.md](https://github.com/Steper158X/aseprite_mcp/blob/main/docs/AI_INSTALL_PLAYBOOK.md). If this repo is already open in the chat, you can `@docs/AI_INSTALL_PLAYBOOK.md` instead of the URL.)

---

## Examples of what this can make

| Animated Sprite (32×32, 4 Frames) | Animated Cozy Piano Room (96×96, 6 Layers, 4 Frames) |
| :---: | :---: |
| ![Animated Orange Cat created live via Aseprite MCP](docs/demo-orange-cat.gif) | ![Animated Cozy Isometric Piano Room created live via Aseprite MCP](docs/demo-piano-room.gif) |
| 4-frame smiling orange tabby | 4-frame isometric piano room with layers |

| 1. Room shell | 2. Window & decor | 3. Piano & bench | 4. Pianist | 5. Sunlight |
| :---: | :---: | :---: | :---: | :---: |
| ![Step 1](docs/layers/01-room-shell.png) | ![Step 2](docs/layers/02-window-decor.png) | ![Step 3](docs/layers/03-piano-bench.png) | ![Step 4](docs/layers/04-pianist.png) | ![Step 5](docs/layers/05-sunlight.png) |

---

## What you will set up

Three pieces work together:

1. **Aseprite** — the pixel art program (you already need a licensed copy).
2. **Aseprite MCP Bridge** — a small Aseprite extension that talks to the AI bridge.
3. **Aseprite MCP server** — a small local program your AI app starts automatically.

After setup, you open Aseprite, open your AI app, and type something like:  
`Create a 32x32 canvas and draw a cute orange cat`

---

## Before you begin — checklist

| Item | Notes |
| --- | --- |
| Aseprite installed | Steam or standalone is fine |
| An AI app that supports MCP | Cursor, Claude Desktop, or Antigravity |
| About 10–15 minutes | First-time setup only |
| **Node.js 20 or newer** *(recommended path)* | Free download: https://nodejs.org/ (LTS) |

Optional later: a ready-made **release binary** from this project's GitHub Releases page (no Node.js needed). Prefer that only if someone already published a release zip for your OS.

---

## Part 1 — Get the project files

### Option A — Download ZIP (no Git needed)

1. Open this repository on GitHub.
2. Click the green **Code** button → **Download ZIP**.
3. Extract the ZIP somewhere easy to find, for example:
   - Windows: `C:\Users\<YourUsername>\aseprite_mcp`
   - macOS: `/Users/<YourUsername>/aseprite_mcp`
4. Remember this folder path. You will paste it into settings later.

### Option B — Git clone

```bash
git clone <this-repo-url>
cd aseprite_mcp
```

Replace `<this-repo-url>` with the real GitHub URL of this repository.

---

## Part 2 — Install Node.js (if you do not have it)

1. Go to https://nodejs.org/ and install the **LTS** version.
2. Close and reopen your terminal (PowerShell on Windows, Terminal on macOS).
3. Check that it works:

```bash
node --version
```

You should see a version like `v20.x.x` or higher. If the command is not found, restart the computer once and try again.

---

## Part 3 — Install dependencies and build

1. Open a terminal **inside the project folder** from Part 1.
   - Windows tip: open the folder in File Explorer, click the address bar, type `powershell`, press Enter.
2. Run these commands one by one:

```bash
npm install
npm run build
```

What this does:

- `npm install` downloads the libraries the server needs (once).
- `npm run build` creates:
  - `dist/bin.js` — the program your AI app will run
  - `dist/aseprite-mcp-bridge.aseprite-extension` — the Aseprite plugin package
  - `dist/preview/` — files for the live web preview page

If a command fails, copy the full error text and check [Troubleshooting](#troubleshooting) below.

---

## Part 4 — Install the Aseprite plugin

### Easy way (recommended)

Still in the project folder, run:

```bash
node dist/bin.js install-plugin
```

Then **fully quit and reopen Aseprite**.

Check: in Aseprite go to **Edit → Preferences → Extensions**. You should see **Aseprite MCP Bridge** and it should be checked.

### Manual way (drag and drop)

1. Open the `dist` folder inside the project.
2. Drag `aseprite-mcp-bridge.aseprite-extension` onto the Aseprite window.
3. If Aseprite asks for script / network permission, choose **Give full trust** (or the closest wording).
4. Restart Aseprite once.
5. Confirm under **Edit → Preferences → Extensions**.

You can also open **File → MCP Bridge...** later to see Connect / Disconnect status.

---

## Part 5 — Find your Aseprite path

Your AI config needs the full path to the Aseprite program (for drawing even when the window is closed).

### Windows (Steam)

1. Open Steam.
2. Right-click **Aseprite** → **Manage → Browse local files**.
3. Copy the folder path, then add `\Aseprite.exe` at the end.

Common examples:

- `C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe`
- `D:\SteamLibrary\steamapps\common\Aseprite\Aseprite.exe`

### macOS

Typical path:

- `/Applications/Aseprite.app/Contents/MacOS/aseprite`

If you installed from Steam, it may live under:

- `~/Library/Application Support/Steam/steamapps/common/Aseprite/Aseprite.app/Contents/MacOS/aseprite`

### Tip

The setup command can often find Aseprite for you:

```bash
node dist/bin.js setup --print
```

Look at the printed `ASEPRITE_PATH` value. If it says “not found”, set the path yourself in Part 6.

---

## Part 6 — Connect your AI app

You will add an entry named `"aseprite"` to your AI app's MCP settings.

**Replace these placeholders with your real paths:**

- `<PROJECT>` → your project folder from Part 1  
  Example: `C:/Users/Alex/aseprite_mcp`
- `<ASEPRITE>` → your Aseprite executable from Part 5  
  Example: `C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe`

On Windows, either style works in JSON:

- Forward slashes: `C:/Users/Alex/...`
- Or escaped backslashes: `C:\\Users\\Alex\\...`

### Shortcut: let setup write the file

From the project folder:

```bash
# Cursor (writes .cursor/mcp.json in the current folder, or ~/.cursor/mcp.json)
node dist/bin.js setup --cursor

# Claude Desktop
node dist/bin.js setup --claude

# Antigravity
node dist/bin.js setup --antigravity

# Only print the JSON so you can copy it yourself
node dist/bin.js setup --print
```

### Cursor (manual)

Create or edit `.cursor/mcp.json` in your project (or your global Cursor MCP settings):

```json
{
  "mcpServers": {
    "aseprite": {
      "command": "node",
      "args": ["<PROJECT>/dist/bin.js"],
      "env": {
        "ASEPRITE_PATH": "<ASEPRITE>"
      }
    }
  }
}
```

Then open **Cursor Settings → MCP** and refresh / reload.

### Claude Desktop (manual)

Config file locations:

- **Windows:** press `Win+R`, paste `%APPDATA%\Claude`, press Enter, open `claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

Merge this inside `"mcpServers"` (keep any other servers you already have):

```json
{
  "mcpServers": {
    "aseprite": {
      "command": "node",
      "args": ["<PROJECT>/dist/bin.js"],
      "env": {
        "ASEPRITE_PATH": "<ASEPRITE>"
      }
    }
  }
}
```

Fully quit Claude Desktop (including the tray icon) and open it again.

### Antigravity (manual)

Edit `~/.gemini/config/mcp_config.json`  
(Windows: `C:\Users\<YourUsername>\.gemini\config\mcp_config.json`)

```json
{
  "mcpServers": {
    "aseprite": {
      "command": "node",
      "args": ["<PROJECT>/dist/bin.js"],
      "env": {
        "ASEPRITE_PATH": "<ASEPRITE>"
      }
    }
  }
}
```

Refresh MCP servers from the Antigravity UI (or start a new chat).

---

## Part 7 — First test

1. Open **Aseprite** and leave it open.
2. Open your AI app.
3. Ask:

```text
Check Aseprite MCP status
```

You want a reply that says the bridge is connected (Live), or at least that the server is running.

Then try:

```text
Create a 32x32 RGB sprite and draw a cute smiling orange cat on its own layer
```

Watch the Aseprite window. Pixels should appear live.

### Live web preview (optional)

While the AI app has the MCP server running, open a browser to:

- http://127.0.0.1:7777/ — interactive preview
- http://127.0.0.1:7777/preview.png — latest image only

Status badge meanings:

- **LIVE** — connected to open Aseprite
- **HEADLESS** — drawing in the background without the GUI
- **DISCONNECTED** — waiting for Aseprite or the first render

---

## Everyday use

### Draw together (Live mode)

1. Keep Aseprite open.
2. Chat with the AI as usual.
3. Each AI drawing command is one Undo step → press **`Ctrl+Z`** once to undo that step.
4. You can paint with Aseprite tools at any time while the AI works.
5. For animations, press **`Enter`** in Aseprite to preview playback.

### Draw with Aseprite closed (Headless mode)

If `ASEPRITE_PATH` is set correctly, the server can still draw using Aseprite in the background. Use the web preview to watch progress, then ask the AI to save or export the file.

### Example prompts

- `Check Aseprite MCP status`
- `Create a 32x32 RGB sprite and draw a cute smiling orange tabby cat on its own layer`
- `Take a screenshot of the canvas and check if the proportions look good`
- `Turn this into a 4-frame tail-wagging animation at 160ms per frame`
- `Add a Shadow layer with 50% opacity and multiply blend mode`
- `Save this sprite as C:/art/cat.aseprite and also export C:/art/cat.gif`

Use folders that already exist on your machine, or ask the AI to create them if your setup allows it.

---

## Alternative install — release binary

If this project publishes GitHub Releases with a zip for your OS:

1. Download the zip for your system (Windows / macOS / Linux).
2. Extract it somewhere permanent, for example `C:\Tools\aseprite-mcp\`.
3. Keep `aseprite-plugin` and `preview` next to the `.exe` (or binary). Do not delete them.
4. Run setup once:

```bash
aseprite-mcp-windows-x64.exe setup --cursor
```

5. In MCP config, point `"command"` at that executable and leave `"args"` as `[]`.

```json
{
  "mcpServers": {
    "aseprite": {
      "command": "C:/Tools/aseprite-mcp/aseprite-mcp-windows-x64.exe",
      "args": [],
      "env": {
        "ASEPRITE_PATH": "<ASEPRITE>"
      }
    }
  }
}
```

---

## Alternative install — npm (when published)

When the package `@steper158x/aseprite_mcp` is available on npm, you can use:

```bash
npx -y @steper158x/aseprite_mcp setup --cursor
```

And this MCP entry:

```json
{
  "mcpServers": {
    "aseprite": {
      "command": "npx",
      "args": ["-y", "@steper158x/aseprite_mcp"],
      "env": {
        "ASEPRITE_PATH": "<ASEPRITE>"
      }
    }
  }
}
```

Until then, use **Part 1–6** (Node + project folder) or a release binary.

---

## Troubleshooting

| Problem | What to try |
| --- | --- |
| `node` is not recognized | Reinstall Node.js LTS, then open a **new** terminal. On Windows, reboot once if needed. |
| AI says it cannot find `node` | In MCP config, set `"command"` to the full path of `node.exe` (Windows: run `where.exe node` in PowerShell). |
| Extension missing / Disconnected | **Edit → Preferences → Extensions** → enable **Aseprite MCP Bridge** → restart Aseprite → **File → MCP Bridge... → Connect** while the AI app is open. |
| Port 7777 already in use | You may have two AI apps running this server at once. Close one, or set `"ASEPRITE_MCP_PORT": "7778"` in the MCP `env` block. |
| Headless does nothing | Double-check `ASEPRITE_PATH` points to the real `Aseprite.exe` / `aseprite` binary, not a folder. |
| Setup wrote the wrong folder | Run setup from inside the project folder, or pass `--command` / `--arg` yourself. Use `--print` first to preview. |
| Preview page is blank | Start a chat that loads the MCP server, then open http://127.0.0.1:7777/ again. |

---

## Extra settings (optional)

Add these under the `"env"` block in your MCP config only if you need them:

| Name | Default | Meaning |
| --- | --- | --- |
| `ASEPRITE_PATH` | (empty) | Path to Aseprite for headless drawing |
| `ASEPRITE_MODE` | `auto` | `auto`, `live`, or `headless` |
| `ASEPRITE_MCP_PORT` | `7777` | Preview and bridge port |
| `ASEPRITE_MCP_OPEN_PREVIEW` | `0` | Set `1` to open the preview page when the server starts |
| `ASEPRITE_MCP_ALLOW_LUA` | `0` | Set `1` to allow the advanced `run_lua` tool |

---

## For developers

```text
AI Client ──(stdio MCP)──► Node/Bun server
                             ├─ Live  → WebSocket → Aseprite extension
                             ├─ Headless → Aseprite -b --script
                             └─ Web Preview on :7777
```

Useful commands from the project folder:

| Command | Purpose |
| --- | --- |
| `npm run build` | Build `dist/bin.js` + extension |
| `npm run start:node` | Run the MCP server with Node |
| `npm test` | Unit tests (requires Bun) |
| `node dist/bin.js setup --help` | Setup wizard options |
| `node dist/bin.js install-plugin` | Install extension into Aseprite |
| `node dist/bin.js package-plugin` | Build `.aseprite-extension` only |

Bun is supported for local development (`bun install`, `bun start`, `bun test`) but **end users only need Node.js** for the steps above.
