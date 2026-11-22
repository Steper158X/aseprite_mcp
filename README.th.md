[English](README.md) | **ภาษาไทย**

# Aseprite MCP — Live Local Socket Bridge + Headless + Web Preview

เชื่อมต่อ AI Client (Antigravity, Claude Desktop, Cursor ฯลฯ) เข้ากับโปรแกรม **Aseprite** แบบ **Live** เห็น AI วาดลง Canvas จริงทันที พร้อมกด `Ctrl+Z` ย้อนกลับทีละคำสั่ง หรือวาดแทรกได้ทันที และรองรับโหมด **Headless** (`aseprite -b --script`) สำหรับวาด/เรนเดอร์แม้ไม่ได้เปิดโปรแกรม พร้อมหน้า **Web Preview** บนเบราว์เซอร์ที่อัปเดตสดทั้งจาก AI และตอนคุณขีดเส้นเอง

---

## ตัวอย่างผลงาน (Showcase)

![ตัวอย่าง Animation แมวส้มที่วาดสดผ่าน Aseprite MCP](docs/demo-orange-cat.gif)

*Animation แมวส้มยิ้มแฉ่ง 4 เฟรม (`32×32`, `160 ms/frame`, ขยาย 8× สำหรับแสดงผล) วาดสดในหน้าต่าง Aseprite ด้วยคำสั่ง `new_sprite`, `set_layer_props`, `add_layer`, `draw_rect`, `draw_ellipse`, `draw_pixel_art`, `add_frame`, `set_frame_duration` และตรวจสอบภาพแต่ละเฟรมด้วย `get_screenshot`*

---

## สถาปัตยกรรม (Architecture)

```text
AI Client ──(stdio MCP)──► Bun Server (src/index.ts)
                             ├─ Router (src/backend.ts): auto | live | headless
                             │    ├─ LiveBackend     ──► ws://127.0.0.1:7777/aseprite ──► Aseprite Plugin (handlers.lua)
                             │    └─ HeadlessBackend ──► spawn ASEPRITE_PATH -b --script headless.lua (handlers.lua)
                             └─ Web Preview (:7777)
                                  ├─ GET /            (หน้าเว็บ Preview สด + zoom slider + activity log 20 รายการ)
                                  ├─ GET /preview.png (ภาพ PNG ล่าสุด)
                                  └─ WS  /preview     (สตรีมภาพสดเมื่อ AI หรือผู้ใช้แก้ภาพ)
```

---

## การติดตั้ง (Installation)

1. **โคลนโปรเจกต์และติดตั้ง Dependencies (ต้องมี [Bun](https://bun.sh/)):**
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

> **หมายเหตุ (Windows):** ถ้า AI Client หาคำสั่ง `bun` ใน `PATH` ไม่เจอ ให้เปลี่ยน `"command"` เป็นพาธเต็มของ `bun.exe` เช่น `"C:\\Users\\<Username>\\.bun\\bin\\bun.exe"` ส่วน `ASEPRITE_PATH` ใส่ไว้เพื่อให้สลับไปโหมด Headless อัตโนมัติเวลาไม่ได้เปิด Aseprite

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

## เครื่องมือทั้งหมด (30 + 1 Opt-in)

| หมวดหมู่ | Tools |
| --- | --- |
| **สถานะ & ไฟล์** | `get_status`, `ping`, `get_sprite_info`, `list_sprites`, `set_active_sprite`, `new_sprite`, `open_sprite`, `save_sprite` |
| **วาด & สี & Undo** | `draw_pixels`, `draw_pixel_art`, `draw_line`, `draw_rect`, `draw_ellipse`, `fill_area`, `clear`, `set_colors`, `undo`, `redo` |
| **Layers** | `add_layer`, `delete_layer`, `set_active_layer`, `set_layer_props` |
| **Frames** | `add_frame`, `delete_frame`, `set_active_frame`, `set_frame_duration` |
| **Palette** | `get_palette`, `set_palette` |
| **ตรวจสอบภาพ** | `get_screenshot` *(ส่งคืน PNG ขยายคมชัด)*, `get_pixels` *(อ่านค่าสี `#rrggbbaa` สูงสุด `128×128`)* |
| **ขั้นสูง (Opt-in)** | `run_lua` *(เปิดเมื่อตั้ง `ASEPRITE_MCP_ALLOW_LUA=1`)* |

---

## คำสั่ง (Scripts)

- `bun start` — รัน MCP stdio server
- `bun test` — รัน unit tests
- `bun run typecheck` — ตรวจ TypeScript แบบ strict
- `bun run package-plugin` — สร้าง `dist/aseprite-mcp-bridge.aseprite-extension`
- `bun run smoke` — ทดสอบ MCP stdio end-to-end
- `bun run cli --wait 10 <method> '<json>'` — ทดสอบส่งคำสั่งเดี่ยวเข้า Aseprite extension

---

## แก้ปัญหาเบื้องต้น (Troubleshooting)

- **พอร์ต 7777 ชนกัน (Port Conflict):** ถ้าเปิด AI Client สองตัวพร้อมกัน (เช่น Antigravity + Claude Desktop) ตัวแรกจะได้พอร์ต `7777` ส่วนตัวที่สองจะไม่ crash แต่จะคืนข้อความแจ้งพอร์ตชนกัน ให้ปิดตัวหนึ่งหรือตั้ง `ASEPRITE_MCP_PORT` แยก
- **Extension ไม่ขึ้นใน Aseprite:** ตรวจสอบที่ **Edit > Preferences > Extensions** ว่าติ๊กเปิดใช้งานอยู่ และรีสตาร์ท Aseprite หลังติดตั้ง/อัปเดต `.aseprite-extension`
- **ความเร็วโหมด Headless:** โหมด Headless จะเรียก `Aseprite.exe -b` ทีละคำสั่ง (~0.2–1 วินาทีต่อคำสั่ง) ส่วนโหมด Live ตอบสนองทันทีผ่าน WebSocket
- **การใช้งาน `Ctrl+Z` (Undo Semantics):**
  - **โหมด Live:** แต่ละคำสั่งที่แก้ไขภาพจะรวมเป็น 1 `app.transaction` กด `Ctrl+Z` ครั้งเดียวจะย้อนกลับทั้งคำสั่ง ส่วน tool `undo` จะย้อนการกระทำล่าสุดไม่ว่า AI หรือผู้ใช้จะเป็นคนวาด
  - **โหมด Headless:** เก็บ snapshot ไฟล์ `.aseprite` ก่อนการแก้ไขแต่ละครั้ง (สูงสุด 50 ขั้น) เพื่อให้ `undo` / `redo` ทำงานข้าม batch run ได้
