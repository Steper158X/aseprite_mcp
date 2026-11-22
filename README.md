# Aseprite MCP — Live Local Socket Bridge + Headless + Web Preview

เชื่อมต่อ AI Client (Claude Desktop, Cursor ฯลฯ) เข้ากับโปรแกรม **Aseprite** แบบ **Live** เห็น AI วาดลง Canvas จริงทันที พร้อมกด `Ctrl+Z` ย้อนกลับทีละคำสั่ง หรือวาดแทรกได้ทันที และรองรับโหมด **Headless** (`aseprite -b --script`) สำหรับวาด/เรนเดอร์แม้ไม่ได้เปิดหน้าต่างโปรแกรม พร้อมหน้า **Web Preview** บนเบราว์เซอร์ที่อัปเดตสดทั้งจาก AI และตอนคุณขีดเส้นเอง

## สถาปัตยกรรม (Architecture)

```text
AI Client ──(stdio MCP)──► Bun Server (src/index.ts)
                             ├─ Router (src/backend.ts): auto | live | headless
                             │    ├─ LiveBackend     ──► ws://127.0.0.1:7777/aseprite ──► Aseprite Plugin (handlers.lua)
                             │    └─ HeadlessBackend ──► spawn ASEPRITE_PATH -b --script headless.lua (handlers.lua)
                             └─ Web Preview (:7777)
                                  ├─ GET /            (หน้าเว็บ Preview สด + zoom + activity log)
                                  ├─ GET /preview.png (ภาพ PNG ล่าสุด)
                                  └─ WS  /preview     (สตรีมภาพสดเมื่อ AI หรือผู้ใช้แก้ภาพ)
```

---

## การติดตั้ง (Installation)

1. **ติดตั้ง Dependencies (ใช้ Bun ครั้งเดียวจบ):**
   ```bash
   git clone <repo-url>
   cd aseprite_mcp
   bun install
   ```

2. **แพ็ก Aseprite Extension:**
   ```bash
   bun run package-plugin
   ```
   จะได้ไฟล์ `dist/aseprite-mcp-bridge.aseprite-extension`

3. **ติดตั้ง Extension ลงใน Aseprite:**
   - เปิด **Aseprite** แล้วลากไฟล์ `dist/aseprite-mcp-bridge.aseprite-extension` ไปวางในหน้าต่างโปรแกรม (หรือไปที่ **Edit > Preferences > Extensions > Add Extension** แล้วเลือกไฟล์นี้)
   - กดอนุญาตหากมีหน้าต่างขอสิทธิ์ (**Give full trust**) และรีสตาร์ท Aseprite 1 ครั้ง
   - ตรวจสอบว่ามี **Aseprite MCP Bridge** ใน **Edit > Preferences > Extensions**

---

## การตั้งค่า AI Client (MCP Config)

### Claude Desktop
เพิ่มลงใน `claude_desktop_config.json`:

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

### Cursor
เพิ่มลงใน `.cursor/mcp.json`:

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

> **หมายเหตุ (Windows):** ถ้า AI Client หาคำสั่ง `bun` ใน `PATH` ไม่เจอ ให้เปลี่ยน `"command"` เป็นพาธเต็มของ `bun.exe` เช่น `"C:/Users/<Username>/.bun/bin/bun.exe"`

---

## หน้า Web Preview
เมื่อ AI Client เปิดใช้งาน MCP Server แล้ว สามารถเปิดเบราว์เซอร์ไปที่:
- **Preview UI:** `http://127.0.0.1:7777/`
- **ภาพ PNG ล่าสุด:** `http://127.0.0.1:7777/preview.png`

---

## โหมดการทำงาน (Modes) & ตัวแปรสภาพแวดล้อม (Env Vars)

### โหมด (`ASEPRITE_MODE`)

| ค่า (`ASEPRITE_MODE`) | พฤติกรรม |
| --- | --- |
| `auto` *(ค่าเริ่มต้น)* | ใช้ **Live** ถ้า Aseprite เปิดและเชื่อมอยู่; ถ้าไม่ได้เปิด จะสลับไปใช้ **Headless** เมื่อตั้งค่า `ASEPRITE_PATH` ไว้ |
| `live` | บังคับวาดผ่าน Aseprite ที่เปิดอยู่เท่านั้น (ถ้าไม่ได้เปิดจะคืน error) |
| `headless` | บังคับรันแบบ batch (`ASEPRITE_PATH -b --script`) แม้จะมี Aseprite เปิดอยู่ |

### ตัวแปรสภาพแวดล้อม (Environment Variables)

| ตัวแปร | ค่าเริ่มต้น | คำอธิบาย |
| --- | --- | --- |
| `ASEPRITE_MCP_PORT` | `7777` | พอร์ต HTTP + WebSocket (`/aseprite`, `/preview`, `/`) |
| `ASEPRITE_PATH` | *(ว่าง)* | พาธเต็มไปยัง `Aseprite.exe` เพื่อเปิดใช้โหมด Headless |
| `ASEPRITE_MODE` | `auto` | เลือกโหมด `auto`, `live`, หรือ `headless` |
| `ASEPRITE_MCP_WORKDIR` | `<os.tmpdir()>/aseprite-mcp` | โฟลเดอร์ชั่วคราวสำหรับเรนเดอร์ preview และไฟล์/snapshot ของโหมด Headless |
| `ASEPRITE_MCP_ALLOW_LUA` | `0` | ตั้งเป็น `1` เพื่อเปิดใช้ tool `run_lua` (opt-in) |
| `ASEPRITE_MCP_OPEN_PREVIEW` | `0` | ตั้งเป็น `1` เพื่อเปิดหน้า Web Preview บนเบราว์เซอร์อัตโนมัติตอนเริ่ม server |

---

## แก้ปัญหาเบื้องต้น (Troubleshooting)

- **พอร์ต 7777 ชนกัน (Port Conflict):** ถ้าเปิด Claude Desktop และ Cursor พร้อมกัน ตัวแรกจะได้พอร์ต `7777` ส่วนตัวที่สองจะไม่ crash แต่ทุกคำสั่งจะคืนข้อความแจ้งพอร์ตชนกัน ให้ปิดตัวหนึ่งหรือกำหนด `ASEPRITE_MCP_PORT` ต่างกัน (และเปลี่ยน URL ใน plugin preferences หากใช้ live)
- **Extension ไม่ขึ้นใน Aseprite:** ตรวจสอบที่ **Edit > Preferences > Extensions** ว่าติ๊กเปิดใช้งานอยู่ และรีสตาร์ท Aseprite หลังติดตั้ง/อัปเดต `.aseprite-extension`
- **ความเร็วโหมด Headless:** โหมด Headless จะรัน `Aseprite.exe -b` ทีละคำสั่ง ใช้เวลาประมาณ ~0.2–1 วินาทีต่อคำสั่ง ส่วนโหมด Live ตอบสนองทันทีผ่าน WebSocket
- **การใช้งาน `Ctrl+Z` (Undo Semantics):**
  - **โหมด Live:** แต่ละคำสั่งที่แก้ไขภาพจะถูกรวมเป็น 1 `app.transaction` กด `Ctrl+Z` ครั้งเดียวใน Aseprite จะย้อนกลับทั้งคำสั่งนั้น ส่วน tool `undo` จะย้อนการกระทำล่าสุดในหน้าต่าง Aseprite ไม่ว่า AI หรือผู้ใช้จะเป็นคนวาด
  - **โหมด Headless:** เก็บ snapshot ไฟล์ `.aseprite` ก่อนการแก้ไขแต่ละครั้ง (สูงสุด 50 ขั้น) เพื่อให้ `undo` / `redo` ทำงานข้าม batch run ได้

---

## English Quick Summary

Aseprite MCP bridges AI clients (Claude Desktop, Cursor) to **Aseprite** over a single local Bun server (`127.0.0.1:7777`):
- **Live mode:** Auto-connects from the `.aseprite-extension` plugin to `ws://127.0.0.1:7777/aseprite`, drawing directly onto the open canvas inside single `Ctrl+Z` transactions with live `app.refresh()`.
- **Headless mode:** Set `ASEPRITE_PATH` to `Aseprite.exe` to run the same Lua handlers via `aseprite -b --script` with snapshot-based `undo`/`redo`.
- **Web Preview:** Visit `http://127.0.0.1:7777/` to watch live pixel updates from both AI tool calls and manual Aseprite strokes.

### Scripts
- `bun test` — Run unit tests
- `bun run typecheck` — Run TypeScript strict check
- `bun run package-plugin` — Build `dist/aseprite-mcp-bridge.aseprite-extension`
- `bun run smoke` — Run end-to-end MCP stdio smoke test
