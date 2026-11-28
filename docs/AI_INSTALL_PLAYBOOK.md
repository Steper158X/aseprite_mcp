# Aseprite MCP — AI Install Playbook

> **Audience: AI agents only.**  
> Humans should follow [README.md](../README.md) / [README.th.md](../README.th.md).  
> This file tells an AI how to install Aseprite MCP **for a non-technical user**, step by step.  
> Users may give you this document via a **URL** (raw GitHub link) or a local `@` file — treat both the same: fetch/read the full playbook, then follow it.

If the user asks to install, set up, ติดตั้ง, or “ทำให้ใช้ได้” Aseprite MCP — **follow this playbook**. Do not improvise a different install path unless this one fails.

---

## 0. Role and tone

You are a patient setup assistant. The user may not know what Node, MCP, terminal, or JSON are.

**Rules of engagement**

1. **One step at a time.** Never dump the whole guide. Finish and verify one step before the next.
2. **Run commands yourself** when you have a terminal/shell tool. Prefer doing the work over telling the user to copy-paste.
3. **Ask only when blocked.** Prefer detecting OS, paths, and installed tools yourself.
4. **Speak the user’s language.** If they write Thai, reply in simple Thai. If English, use plain English. Avoid jargon; if you must use a term, define it in one short phrase.
5. **Never invent paths.** Always verify files exist before writing them into MCP config.
6. **Never skip the plugin + MCP config + smoke test.** Setup is incomplete until the test in §6 passes (or you clearly document what failed).
7. **Do not commit, push, or change git config** unless the user explicitly asks.

---

## 1. Goal (what “done” means)

All of the following are true:

| Check | Meaning |
| --- | --- |
| Server installed | `npx` can run `@steper158x/aseprite_mcp`, or a release binary / local `dist/bin.js` exists |
| Plugin installed | Aseprite shows **Aseprite MCP Bridge** under Extensions |
| MCP config written | Cursor / Claude / Antigravity has an `aseprite` server entry |
| Smoke OK | User (or you via MCP) can get status / draw a tiny test |

Optional but recommended: `ASEPRITE_PATH` points at a real Aseprite executable (needed for headless mode).

---

## 2. First discovery (do this before installing)

Run these checks yourself when possible. Ask the user only for what you cannot detect.

### 2.1 Detect environment

| Fact | How to detect |
| --- | --- |
| OS | `win32` / `darwin` / `linux` from the environment |
| Shell | PowerShell on Windows; zsh/bash on macOS/Linux |
| Node.js | `node --version` → need **v20+** for the npm path |
| npx | `npx --version` |
| This repo open? | A folder whose `package.json` `name` is `@steper158x/aseprite_mcp` |
| Aseprite | `npx -y @steper158x/aseprite_mcp setup --print`, or the paths in §4 |
| AI client | Ask once if unclear: **Cursor**, **Claude Desktop**, or **Antigravity** |

### 2.2 Ask the user (only if needed)

Ask **at most one short question at a time**, for example:

- “คุณใช้แอปไหนคุยกับ AI อยู่คะ/ครับ — Cursor, Claude Desktop, หรือ Antigravity?”
- “ลง Aseprite ไว้แล้วหรือยัง (Steam หรือซื้อตรงก็ได้)?”

Do **not** ask for Node.js, Git, or paths if you can check them.

### 2.3 Prerequisites gate

| Missing | What you do |
| --- | --- |
| No Aseprite | Stop. Explain they need a licensed Aseprite install first. Link: https://www.aseprite.org/ — do not continue past plugin install. |
| Node &lt; 20 or missing, and they can install it | Guide them to https://nodejs.org/ **LTS**. After install, open a **new** terminal and re-check `node --version`. On Windows, suggest reboot once if `node` is still missing. |
| Node missing and they cannot install it | Switch to the release zip in §8. |
| No AI MCP client | Explain they need Cursor, Claude Desktop, or Antigravity. Pause until they pick one. |

---

## 3. Preferred install path (default): npm

Use this for almost everyone. The package `@steper158x/aseprite_mcp` is published. Do **not** clone the repo unless §7 applies.

1. Ensure Node.js 20+ (`node --version`, `npx --version`).
2. From the folder they have open in Cursor (any folder is fine for Claude or Antigravity), run **one** command:

```bash
npx -y @steper158x/aseprite_mcp setup --cursor
```

Use `--claude` or `--antigravity` instead of `--cursor` to match their app. Add `--print` first if you want to show the JSON before writing.

3. Read the setup summary. If Aseprite was not found, pass the real executable:

```bash
npx -y @steper158x/aseprite_mcp setup --cursor --aseprite "C:/full/path/to/Aseprite.exe"
```

4. Tell them to quit Aseprite completely and open it again. Confirm **Edit → Preferences → Extensions** shows **Aseprite MCP Bridge** enabled.
5. Refresh MCP (Cursor) or fully restart the AI app (Claude Desktop).
6. Run the §6 smoke test.

For Cursor, run setup **inside the project folder they have open** so it writes that folder’s `.cursor/mcp.json` and removes a duplicate `aseprite` entry from `~/.cursor/mcp.json`.

The MCP entry setup writes looks like this:

```json
{
  "mcpServers": {
    "aseprite": {
      "command": "npx",
      "args": ["-y", "@steper158x/aseprite_mcp"],
      "env": {
        "ASEPRITE_PATH": "<ASEPRITE>",
        "ASEPRITE_MCP_TOKEN": "<written by setup>",
        "ASEPRITE_MCP_PORT": "7777"
      }
    }
  }
}
```

Setup generates `ASEPRITE_MCP_TOKEN` and writes the same token and port into the Aseprite extension. Tell them to restart Aseprite after setup so the extension loads that file. Do not commit the token.

Open/save/export stay inside the server's working directory unless `ASEPRITE_MCP_FS_ROOT` is set (`*` disables the sandbox).

**Do not** start by cloning or by `npm run build` unless the user already has this repository open and wants to run that checkout (§7), or `npx` fails and a release zip is the fallback (§8).

---

## 4. Find Aseprite when setup does not

**Windows (Steam):** Steam → right-click Aseprite → Manage → Browse local files → append `\Aseprite.exe`.  
Common: `C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe`

**macOS:** often `/Applications/Aseprite.app/Contents/MacOS/aseprite`

On Windows, JSON may use forward slashes (`C:/Users/...`) or escaped backslashes.

---

## 5. After config is written

- **Cursor:** Settings → MCP → refresh/reload (or restart Cursor).
- **Claude Desktop:** fully quit (including tray) and reopen. Config file: `%APPDATA%\Claude\claude_desktop_config.json` on Windows, `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS.
- **Antigravity:** `~/.gemini/config/mcp_config.json` (Windows: `C:\Users\<User>\.gemini\config\mcp_config.json`). Refresh MCP or start a new chat.

Setup **merges** into existing MCP JSON and also installs the plugin unless `--skip-plugin` is passed.

If setup wrote the wrong place: re-run from the correct folder, or use `--print` and show the snippet before writing.

---

## 6. Smoke test (required)

Guide the user:

1. Open **Aseprite** and leave it open.
2. In the AI chat, ask (match their language):

```text
Check Aseprite MCP status
```

or Thai:

```text
เช็คสถานะ Aseprite MCP ให้หน่อย
```

**Success signals**

- Bridge connected / Live, or server running and ready
- Optional follow-up: create a 32×32 sprite and draw a simple shape; pixels appear in Aseprite

**Optional preview:** use `previewUrl` from `get_status` (it includes the local bridge token). A bare `http://127.0.0.1:7777/` without the token returns 401.  
Badges: LIVE / HEADLESS / DISCONNECTED

If status fails, go to §9 — do not declare setup finished.

---

## 7. Build from source (only when this repo is the one they should run)

Use this when the chat already has this repository open and they want **this checkout**, not the published npm package. Also use it if you are developing.

Requirements: Node.js 20+ and npm. Bun is **not** required for this build.

From the repository root (the folder whose `package.json` name is `@steper158x/aseprite_mcp`):

```bash
npm install
npm run build
node dist/bin.js setup --cursor
```

`npm run build` runs `node scripts/build.mjs` (esbuild). `bun run build` runs that same script.

**Verify**

- `dist/bin.js` exists
- `dist/aseprite-mcp-bridge.aseprite-extension` exists
- `dist/preview/` exists

Manual MCP shape for a local build:

```json
{
  "mcpServers": {
    "aseprite": {
      "command": "node",
      "args": ["<PROJECT>/dist/bin.js"],
      "env": {
        "ASEPRITE_PATH": "<ASEPRITE>",
        "ASEPRITE_MCP_TOKEN": "<written by setup>",
        "ASEPRITE_MCP_PORT": "7777"
      }
    }
  }
}
```

`<PROJECT>` is the absolute repository path. On Windows prefer forward slashes in JSON. If the AI app cannot find `node`, set `"command"` to the full path from `where.exe node` (Windows) or `which node` (macOS/Linux).

Plugin-only commands, still from the repo root:

```bash
node dist/bin.js install-plugin
node dist/bin.js package-plugin
```

Manual plugin fallback: drag `dist/aseprite-mcp-bridge.aseprite-extension` onto Aseprite → allow script/network trust → restart Aseprite.

If `npm run build` fails: wrong directory, Node older than 20, or `npm install` did not finish (esbuild is a dev dependency). Read the full error. Do not write MCP config that points at `dist/bin.js` until that file exists.

Contributors running tests need [Bun](https://bun.sh/) as well: `npm test` is `bun test`. `bun run build:binaries` also needs Bun. End-user install does not.

---

## 8. Release zip (no Node.js)

Use this when Node cannot be installed, or `npx` fails and a GitHub Release zip exists for their OS.

The release workflow (tags `v*`) publishes:

| System | Zip | Binary inside |
| --- | --- | --- |
| Windows x64 | `aseprite-mcp-windows-x64.zip` | `aseprite-mcp-windows-x64.exe` |
| Windows arm64 | `aseprite-mcp-windows-arm64.zip` | `aseprite-mcp-windows-arm64.exe` |
| macOS Apple silicon | `aseprite-mcp-darwin-arm64.zip` | `aseprite-mcp-darwin-arm64` |
| macOS Intel | `aseprite-mcp-darwin-x64.zip` | `aseprite-mcp-darwin-x64` |
| Linux x64 | `aseprite-mcp-linux-x64.zip` | `aseprite-mcp-linux-x64` |
| Linux arm64 | `aseprite-mcp-linux-arm64.zip` | `aseprite-mcp-linux-arm64` |

1. Download the matching zip from the latest GitHub Release.
2. Extract to a permanent folder. Keep `aseprite-plugin` and `preview` beside the binary.
3. Run `<binary> setup --cursor` (or `--claude` / `--antigravity`).
4. MCP `command` = full path to that binary, `args` = `[]`.

---

## 9. Troubleshooting decision tree

| Symptom | Action |
| --- | --- |
| `node` or `npx` not found | Reinstall Node LTS → new terminal → on Windows reboot once. If they cannot install Node, use §8. |
| MCP server won’t start | For npm: `"command"` is `npx` and args are `["-y", "@steper158x/aseprite_mcp"]`. For a local build: `dist/bin.js` path is absolute. Reopen the AI app. |
| Extension missing / Disconnected | Preferences → Extensions → enable bridge → restart Aseprite → File → MCP Bridge… → Connect while AI app is open |
| Port 7777 in use / connect fails after refresh | Almost always **two** `aseprite` MCP entries (project `.cursor/mcp.json` **and** `~/.cursor/mcp.json`) or an orphan Node process. Fix: `npx -y @steper158x/aseprite_mcp setup --cursor` (clears the duplicate), kill orphans, then refresh MCP once. Do **not** keep `aseprite` in both Cursor configs. Last resort: `ASEPRITE_MCP_PORT=7778` in MCP `env`, run setup again so the bridge file matches, then restart Aseprite. The extension reads the port and token from that file. |
| `get_status` still says port in use after closing Aseprite | Closing Aseprite does **not** free 7777 (the MCP Node process owns it). Refresh the aseprite MCP server or kill the orphan process. |
| Headless does nothing | Fix `ASEPRITE_PATH` to the **executable**, not a folder |
| Preview blank or Unauthorized | Start a chat that loads MCP, then open `previewUrl` from `get_status` (token is in the query string). |
| `npm install` / `npm run build` fails | You are on the source path (§7). Stay in the repo root; Node ≥ 20; let `npm install` finish so `esbuild` is installed. |

Always copy the real error text into your reasoning. Propose **one** fix, verify, then continue.

---

## 10. How to talk to beginners (examples)

**Good**

- “ขั้นต่อไปผมจะติดตั้งโปรแกรมช่วยเล็กๆ ให้ Aseprite คุยกับ AI ได้ ใช้เวลาไม่ถึงนาที”
- “ช่วยปิด Aseprite ให้สนิท แล้วเปิดใหม่ทีนึงนะ — เหมือนปิดโปรแกรมแล้วเปิดใหม่ ไม่ใช่แค่ปิดไฟล์รูป”

**Bad**

- “Merge the MCP server entry into your stdio transport config and restart the daemon.”
- Dumping the whole README in one message.

After success, give **3–5 example prompts** only (from the README), not another wall of docs.

---

## 11. Agent checklist (copy and tick mentally)

```text
[ ] OS detected; AI client identified
[ ] Node ≥ 20, or a release zip chosen because Node is unavailable
[ ] Setup command finished (npx, local dist/bin.js, or release binary)
[ ] Plugin installed; user restarted Aseprite; Extensions shows MCP Bridge
[ ] Setup wrote ASEPRITE_MCP_TOKEN (do not commit it) and the user restarted Aseprite so the extension loads it
[ ] ASEPRITE_PATH set when the executable was found
[ ] User refreshed MCP / restarted AI app
[ ] Smoke: status check OK (and ideally a tiny draw test)
[ ] User got 2–3 simple example prompts in their language
```

---

## 12. Reference commands

| Command | When |
| --- | --- |
| `npx -y @steper158x/aseprite_mcp setup --cursor` | Default install (also `--claude`, `--antigravity`, `--print`) |
| `npx -y @steper158x/aseprite_mcp setup --cursor --aseprite "<path>"` | Default install with an explicit Aseprite executable |
| `npm install` | Source checkout only |
| `npm run build` | Source checkout only. Node 20+. Same as `bun run build` |
| `npm run typecheck` | Contributors. `tsc --noEmit` |
| `npm test` | Contributors. Requires Bun |
| `node dist/bin.js install-plugin` | Source checkout: install the extension |
| `node dist/bin.js setup --help` | All setup flags |

Human-oriented details and screenshots live in the READMEs. Prefer this playbook’s sequence when **you** are the one installing.
