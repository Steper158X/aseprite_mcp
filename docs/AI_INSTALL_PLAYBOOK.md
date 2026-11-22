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
6. **Never skip the plugin + MCP config + smoke test.** Setup is incomplete until the test in §8 passes (or you clearly document what failed).
7. **Do not commit, push, or change git config** unless the user explicitly asks.

---

## 1. Goal (what “done” means)

All of the following are true:

| Check | Meaning |
| --- | --- |
| Project built | `dist/bin.js` exists |
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
| Node.js | `node --version` → need **v20+** |
| npm | `npm --version` |
| Project root | Folder containing this repo’s `package.json` (`name`: `@steper158x/aseprite_mcp`) |
| Aseprite | See §5 / run setup discovery |
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
| Node &lt; 20 or missing | Guide them to https://nodejs.org/ **LTS**. After install, open a **new** terminal and re-check `node --version`. On Windows, suggest reboot once if `node` is still missing. |
| No AI MCP client | Explain they need Cursor, Claude Desktop, or Antigravity. Pause until they pick one. |

---

## 3. Preferred install path (default)

Use this path for almost everyone:

1. Ensure project files are on disk (this repo folder).
2. Install Node.js 20+ if needed.
3. From project root: `npm install` then `npm run build`.
4. Install plugin: `node dist/bin.js install-plugin`.
5. Write MCP config for their client: `node dist/bin.js setup --cursor` (or `--claude` / `--antigravity`).
6. Tell them to restart Aseprite + refresh MCP.
7. Run the §8 smoke test with them.

**Do not** start with release binaries or `npx` unless:

- `npm run build` fails and a GitHub Release binary exists for their OS, or
- the npm package `@steper158x/aseprite_mcp` is confirmed published and they prefer zero local clone.

---

## 4. Project files

### If the user already has this folder open in Cursor

Use the current workspace as the project root. Confirm `package.json` exists.

### If they only have a chat and no folder

Help them get the repo:

**Easiest for beginners (no Git):**

1. Open the GitHub repo page.
2. Green **Code** → **Download ZIP**.
3. Extract somewhere simple, e.g.  
   - Windows: `C:\Users\<User>\aseprite_mcp`  
   - macOS: `/Users/<User>/aseprite_mcp`
4. Open that folder in Cursor (or their editor).

**If Git is available:**

```bash
git clone <repo-url>
cd aseprite_mcp
```

Remember the absolute project path; MCP config needs it.

---

## 5. Build the server

Working directory = project root.

```bash
npm install
npm run build
```

**Verify**

- `dist/bin.js` exists
- `dist/aseprite-mcp-bridge.aseprite-extension` exists (or can be produced by setup/package-plugin)
- `dist/preview/` exists

If `npm run build` fails:

1. Paste/read the full error.
2. Common fixes: wrong directory, Node too old, network blocked on `npm install`.
3. Do not continue to MCP config until `dist/bin.js` exists.

---

## 6. Install the Aseprite plugin

```bash
node dist/bin.js install-plugin
```

Then tell the user in plain language:

1. **Quit Aseprite completely** (not just close the sprite — quit the app).
2. Open Aseprite again.
3. Go to **Edit → Preferences → Extensions**.
4. Confirm **Aseprite MCP Bridge** is listed and enabled.

**Fallback (manual):** drag `dist/aseprite-mcp-bridge.aseprite-extension` onto the Aseprite window → allow script/network trust → restart Aseprite.

If install-plugin fails, read the error, try packaging with `node dist/bin.js package-plugin`, then use the manual drag-and-drop path.

---

## 7. Find Aseprite path + write MCP config

### 7.1 Discover Aseprite

```bash
node dist/bin.js setup --print
```

Read the printed `ASEPRITE_PATH`. If “not found”:

**Windows (Steam):** Steam → right-click Aseprite → Manage → Browse local files → append `\Aseprite.exe`.  
Common: `C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe`

**macOS:** often `/Applications/Aseprite.app/Contents/MacOS/aseprite`

Pass an explicit path:

```bash
node dist/bin.js setup --cursor --aseprite "C:/full/path/to/Aseprite.exe"
```

(Use `--claude` or `--antigravity` instead of `--cursor` when appropriate.)

### 7.2 Write config for the chosen client

| Client | Command |
| --- | --- |
| Cursor | `node dist/bin.js setup --cursor` |
| Claude Desktop | `node dist/bin.js setup --claude` |
| Antigravity | `node dist/bin.js setup --antigravity` |
| Preview only | `node dist/bin.js setup --print` |

Setup **merges** into existing MCP JSON and also installs the plugin unless `--skip-plugin` is passed.

**After writing config**

- **Cursor:** Settings → MCP → refresh/reload (or restart Cursor).
- **Claude Desktop:** fully quit (including tray) and reopen.
- **Antigravity:** refresh MCP or start a new chat.

### 7.3 Expected MCP shape (Node + local build)

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

On Windows prefer forward slashes in JSON (`C:/Users/...`).  
If the AI app cannot find `node`, set `"command"` to the full path from `where.exe node` (Windows) or `which node` (macOS/Linux).

### 7.4 If setup wrote the wrong place

- Re-run setup from **inside the project folder**.
- For Cursor, project config is `.cursor/mcp.json`; global is `~/.cursor/mcp.json`.
- Use `--print` first when unsure; show the user the snippet before writing if they are anxious.

---

## 8. Smoke test (required)

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

**Optional preview:** http://127.0.0.1:7777/  
Badges: LIVE / HEADLESS / DISCONNECTED

If status fails, go to §9 — do not declare setup finished.

---

## 9. Troubleshooting decision tree

| Symptom | Action |
| --- | --- |
| `node` not found | Reinstall Node LTS → new terminal → on Windows reboot once → if MCP still fails, use full path to `node.exe` as `command` |
| MCP server won’t start | Confirm `dist/bin.js` path in config is absolute and correct; reopen AI app |
| Extension missing / Disconnected | Preferences → Extensions → enable bridge → restart Aseprite → File → MCP Bridge… → Connect while AI app is open |
| Port 7777 in use | Only one client should run this server; or set `ASEPRITE_MCP_PORT` to `7778` in MCP `env` |
| Headless does nothing | Fix `ASEPRITE_PATH` to the **executable**, not a folder |
| Preview blank | Start a chat that loads MCP, then reopen http://127.0.0.1:7777/ |
| `npm install` / `build` fails | Stay in project root; check Node ≥ 20; fix network/registry; read full error before guessing |

Always copy the real error text into your reasoning. Propose **one** fix, verify, then continue.

---

## 10. How to talk to beginners (examples)

**Good**

- “ขั้นต่อไปผมจะติดตั้งโปรแกรมช่วยเล็กๆ ให้ Aseprite คุยกับ AI ได้ ใช้เวลาไม่ถึงนาที”
- “ช่วยปิด Aseprite ให้สนิท แล้วเปิดใหม่ทีนึงนะ — เหมือนปิดโปรแกรมแล้วเปิดใหม่ ไม่ใช่แค่ปิดไฟล์รูป”

**Bad**

- “Merge the MCP server entry into your stdio transport config and restart the daemon.”
- Dumping Parts 1–7 of the README in one message.

After success, give **3–5 example prompts** only (from the README), not another wall of docs.

---

## 11. Alternate paths (only when needed)

### Release binary

If GitHub Releases has a zip for their OS and Node build is blocked:

1. Extract to a permanent folder (keep `aseprite-plugin` and `preview` beside the binary).
2. Run `aseprite-mcp-….exe setup --cursor` (or matching binary name).
3. MCP `command` = full path to that binary, `args` = `[]`.

### npm / npx (when package is published)

```bash
npx -y @steper158x/aseprite_mcp setup --cursor
```

MCP entry uses `npx` + `["-y", "@steper158x/aseprite_mcp"]`.  
Until publish is confirmed, prefer the local Node build path (§3–8).

---

## 12. Agent checklist (copy and tick mentally)

```text
[ ] OS / Node ≥ 20 verified
[ ] Project root known; npm install + npm run build OK → dist/bin.js exists
[ ] Plugin installed; user restarted Aseprite; Extensions shows MCP Bridge
[ ] AI client identified
[ ] setup --<client> written; ASEPRITE_PATH set if found
[ ] User refreshed MCP / restarted AI app
[ ] Smoke: status check OK (and ideally a tiny draw test)
[ ] User got 2–3 simple example prompts in their language
```

---

## 13. Reference commands (project root)

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run build` | Build `dist/bin.js` + plugin package |
| `node dist/bin.js install-plugin` | Install Aseprite extension |
| `node dist/bin.js setup --cursor` | Plugin + Cursor MCP config |
| `node dist/bin.js setup --claude` | Plugin + Claude Desktop config |
| `node dist/bin.js setup --antigravity` | Plugin + Antigravity config |
| `node dist/bin.js setup --print` | Print JSON only |
| `node dist/bin.js setup --help` | All setup flags |

Human-oriented details and screenshots live in the READMEs. Prefer this playbook’s sequence when **you** are the one installing.
