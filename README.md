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
| **Node.js 20 or newer** | Required for the recommended npm install. Free download: https://nodejs.org/ (LTS) |

You can skip Node.js if you use a [GitHub Release zip](#alternative-install--release-zip) instead.

---

## Recommended install — npm

The package `@steper158x/aseprite_mcp` is published on npm. You do not clone this repository for the usual install.

### 1. Install Node.js (if you do not have it)

1. Go to https://nodejs.org/ and install the **LTS** version (20 or newer).
2. Close and reopen your terminal (PowerShell on Windows, Terminal on macOS).
3. Check that it works:

```bash
node --version
npx --version
```

You should see a Node version like `v20.x.x` or higher. If the command is not found, restart the computer once and try again.

### 2. Install the plugin and write MCP config

Open a terminal **in the project folder you have open in Cursor** (any folder is fine for Claude Desktop or Antigravity). Run one command:

```bash
# Cursor (writes .cursor/mcp.json in the current project; removes aseprite from ~/.cursor/mcp.json so only one server runs)
npx -y @steper158x/aseprite_mcp setup --cursor

# Claude Desktop
npx -y @steper158x/aseprite_mcp setup --claude

# Antigravity
npx -y @steper158x/aseprite_mcp setup --antigravity

# Only print the JSON so you can copy it yourself
npx -y @steper158x/aseprite_mcp setup --print
```

Setup installs the Aseprite extension and tries to find Aseprite for you. If the summary says Aseprite was not found, find the program below and run the same command again with:

```bash
npx -y @steper158x/aseprite_mcp setup --cursor --aseprite "C:/path/to/Aseprite.exe"
```

Use `--claude` or `--antigravity` instead of `--cursor` when that is your app.

Then **fully quit and reopen Aseprite**.

Check: in Aseprite go to **Edit → Preferences → Extensions**. You should see **Aseprite MCP Bridge** and it should be checked.

You can also open **File → MCP Bridge...** later to see Connect / Disconnect status.

### 3. Find your Aseprite path (if setup did not)

Your AI config needs the full path to the Aseprite program (for drawing even when the window is closed).

#### Windows (Steam)

1. Open Steam.
2. Right-click **Aseprite** → **Manage → Browse local files**.
3. Copy the folder path, then add `\Aseprite.exe` at the end.

Common examples:

- `C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe`
- `D:\SteamLibrary\steamapps\common\Aseprite\Aseprite.exe`

#### macOS

Typical path:

- `/Applications/Aseprite.app/Contents/MacOS/aseprite`

If you installed from Steam, it may live under:

- `~/Library/Application Support/Steam/steamapps/common/Aseprite/Aseprite.app/Contents/MacOS/aseprite`

### 4. What the MCP config looks like

Setup writes an entry named `"aseprite"`. This is the shape (your `ASEPRITE_PATH` will differ):

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

If you edit the file yourself, merge that object inside `"mcpServers"` and keep any other servers you already have.

On Windows, either style works in JSON:

- Forward slashes: `C:/Users/Alex/...`
- Or escaped backslashes: `C:\\Users\\Alex\\...`

**Cursor**

- In a project: `.cursor/mcp.json`
- Otherwise: `~/.cursor/mcp.json`

Then open **Cursor Settings → MCP** and refresh / reload.

**Claude Desktop**

- **Windows:** press `Win+R`, paste `%APPDATA%\Claude`, press Enter, open `claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

Fully quit Claude Desktop (including the tray icon) and open it again.

**Antigravity**

Edit `~/.gemini/config/mcp_config.json`  
(Windows: `C:\Users\<YourUsername>\.gemini\config\mcp_config.json`)

Refresh MCP servers from the Antigravity UI (or start a new chat).

---

## First test

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

## Alternative install — release zip

Each GitHub Release (tags `v*`) includes one zip per system. Node.js is not required.

| System | Zip | Program inside |
| --- | --- | --- |
| Windows x64 | `aseprite-mcp-windows-x64.exe.zip` | `aseprite-mcp-windows-x64.exe` |
| macOS Apple silicon | `aseprite-mcp-darwin-arm64.zip` | `aseprite-mcp-darwin-arm64` |
| macOS Intel | `aseprite-mcp-darwin-x64.zip` | `aseprite-mcp-darwin-x64` |
| Linux x64 | `aseprite-mcp-linux-x64.zip` | `aseprite-mcp-linux-x64` |

1. Download the zip for your system from the latest GitHub Release.
2. Extract it somewhere permanent, for example `C:\Tools\aseprite-mcp\`.
3. Keep `aseprite-plugin` and `preview` next to the executable. Do not delete them.
4. Run setup once. On Windows:

```bash
aseprite-mcp-windows-x64.exe setup --cursor
```

On macOS or Linux, run the matching program name from the table with the same arguments (`setup --cursor`, `--claude`, or `--antigravity`).

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

## Alternative install — build from source

Use this when you cloned the repository and want to run **this** checkout instead of the published npm package.

Requirements:

- Node.js 20 or newer (npm comes with it)
- This repository on disk

Bun is not required to build or run the server. `npm run build` and `bun run build` both run the same Node script (`scripts/build.mjs`).

```bash
git clone https://github.com/Steper158X/aseprite_mcp.git
cd aseprite_mcp
npm install
npm run build
node dist/bin.js setup --cursor
```

`npm install` downloads libraries once. `npm run build` creates:

- `dist/bin.js` — the program your AI app will run
- `dist/aseprite-mcp-bridge.aseprite-extension` — the Aseprite plugin package
- `dist/preview/` — files for the live web preview page

You can drag that `.aseprite-extension` file onto the Aseprite window instead of using `install-plugin`. If Aseprite asks for script / network permission, choose **Give full trust** (or the closest wording), then restart Aseprite.

Manual MCP entry for a local build. Replace `<PROJECT>` and `<ASEPRITE>` with your paths:

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

If the AI app cannot find `node`, set `"command"` to the full path of `node.exe` (Windows: `where.exe node`) or `node` (macOS/Linux: `which node`).

People who change the code also need [Bun](https://bun.sh/) for unit tests (`npm test` / `bun test`) and for release executables (`bun run build:binaries`).

---

## Troubleshooting

| Problem | What to try |
| --- | --- |
| `node` or `npx` is not recognized | Reinstall Node.js LTS, then open a **new** terminal. On Windows, reboot once if needed. |
| AI says it cannot find `node` or `npx` | In MCP config, set `"command"` to the full path of `node.exe` or `npx.cmd` (Windows: `where.exe node` and `where.exe npx`). |
| Extension missing / Disconnected | **Edit → Preferences → Extensions** → enable **Aseprite MCP Bridge** → restart Aseprite → **File → MCP Bridge... → Connect** while the AI app is open. |
| Port 7777 already in use | Usually two `aseprite` entries (project `.cursor/mcp.json` **and** `~/.cursor/mcp.json`) or an orphan Node process. Run `npx -y @steper158x/aseprite_mcp setup --cursor` again (it clears the duplicate), kill orphans, refresh MCP once. Last resort: `"ASEPRITE_MCP_PORT": "7778"` in MCP `env`, and set the same port in **File → MCP Bridge...**. |
| Headless does nothing | Double-check `ASEPRITE_PATH` points to the real `Aseprite.exe` / `aseprite` binary, not a folder. |
| Setup wrote the wrong folder | For Cursor, run setup from inside the project folder you have open. Use `--print` first to preview. |
| `npm run build` fails | Run it from the repository root with Node.js 20+. `npm install` must finish first so the `esbuild` dev dependency is present. |
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
AI Client ──(stdio MCP)──► Node server
                             ├─ Live  → WebSocket → Aseprite extension
                             ├─ Headless → Aseprite -b --script
                             └─ Web Preview on :7777
```

Useful commands from the project folder:

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies (Node.js 20+) |
| `npm run build` | Build `dist/bin.js` + extension with Node |
| `bun run build` | Same build script as `npm run build` |
| `npm run typecheck` | Typecheck with `tsc --noEmit` |
| `npm run start:node` | Run the MCP server with Node |
| `npm test` | Unit tests (requires Bun on `PATH`) |
| `bun run build:binaries` | Compile release executables (requires Bun) |
| `node dist/bin.js setup --help` | Setup wizard options |
| `node dist/bin.js install-plugin` | Install extension into Aseprite |
| `node dist/bin.js package-plugin` | Build `.aseprite-extension` only |

End users install with `npx` or a release zip. Building from this repository needs Node.js 20 or newer. Bun is only required for unit tests and `build:binaries`.
