[English](README.md) | **ภาษาไทย**

# Aseprite MCP — Live Local Socket Bridge + Headless + Web Preview

ให้ AI (Antigravity, Claude Desktop, Cursor ฯลฯ) ช่วยวาด Pixel Art และทำ Animation **ลงในหน้าต่างโปรแกรม Aseprite จริงแบบสดๆ** เห็น AI วาดบน Canvas ทันที กด `Ctrl+Z` ย้อนกลับทีละคำสั่งได้ หรือจะใช้เมาส์/ปากกาวาดแทรกไปพร้อมกับ AI ก็ได้ทันที

นอกจากนี้ยังทำงานได้ **แม้ไม่ได้เปิดโปรแกรม Aseprite** (โหมด Headless ผ่าน `ASEPRITE_PATH`) และมีหน้า **Web Preview** (`http://127.0.0.1:7777/`) ที่แสดงภาพอัปเดตสดทั้งเวลาที่ AI วาดและเวลาที่คุณวาดเองด้วยมือ

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

## คู่มือติดตั้งตั้งแต่เริ่มต้น (สำหรับผู้ใช้งานทั่วไป ทำตามทีละขั้น)

ไม่ต้องตั้งค่า Python, Virtualenv หรือเครื่องมือซับซ้อนใดๆ เพราะโปรเจกต์นี้ใช้ **Bun** ตัวเดียวรันจบทุกอย่าง

### ขั้นที่ 1: ติดตั้งโปรแกรม Bun

Bun คือโปรแกรมตัวกลางสำหรับรันเซิร์ฟเวอร์เชื่อมต่อระหว่าง AI กับ Aseprite

#### สำหรับ Windows
1. กดปุ่ม **Start (รูป Windows)** พิมพ์คำว่า `PowerShell` แล้วเปิดโปรแกรม **Windows PowerShell**
2. ก๊อปปี้คำสั่งนี้ไปวางแล้วกด **Enter**:
   ```powershell
   powershell -c "irm bun.sh/install.ps1 | iex"
   ```
3. รอจนติดตั้งเสร็จ แล้ว **ปิดหน้าต่าง PowerShell เดิมทิ้ง จากนั้นเปิด PowerShell ขึ้นมาใหม่** *(เพื่อให้ Windows รู้จักคำสั่ง `bun`)*
4. พิมพ์คำสั่งเช็คเพื่อความชัวร์:
   ```powershell
   bun --version
   ```
   ถ้าขึ้นเลขเวอร์ชัน (เช่น `1.4.4`) แปลว่าติดตั้งสำเร็จแล้ว!
5. *(แนะนำสำหรับขั้นตอนตั้งค่า AI)* เช็คที่อยู่เต็มของไฟล์ `bun.exe` ด้วยคำสั่ง:
   ```powershell
   where.exe bun
   ```
   ปกติจะอยู่ที่ `C:\Users\<ชื่อผู้ใช้ของคุณ>\.bun\bin\bun.exe`

#### สำหรับ macOS / Linux
1. เปิดโปรแกรม **Terminal**
2. วางคำสั่งนี้แล้วกด **Enter**:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```
3. ปิดแล้วเปิด **Terminal** ใหม่ จากนั้นตรวจสอบด้วยคำสั่ง:
   ```bash
   bun --version
   ```

---

### ขั้นที่ 2: ดาวน์โหลดโปรเจกต์และแพ็กปลั๊กอิน

- **วิธีที่ 1 — ดาวน์โหลดเป็นไฟล์ ZIP (ไม่ต้องใช้ Git):**
  1. ดาวน์โหลดโปรเจกต์นี้เป็นไฟล์ `.zip` แล้วแตกไฟล์ไปวางไว้ในโฟลเดอร์ที่หาง่าย เช่น `F:\coding\aseprite_mcp`
  2. เปิดเข้าไปในโฟลเดอร์ `aseprite_mcp` แล้วคลิกที่ช่อง Address Bar ด้านบน พิมพ์ `powershell` แล้วกด **Enter** *(จะได้หน้าต่าง PowerShell ที่เปิดตรงโฟลเดอร์นี้พอดี)*
- **วิธีที่ 2 — ใช้ Git:**
  ```bash
  git clone <repo-url>
  cd aseprite_mcp
  ```

จากนั้นรัน 2 คำสั่งนี้ทีละบรรทัด:
```bash
bun install
bun run package-plugin
```
- `bun install` ใช้ติดตั้งส่วนประกอบที่จำเป็น (ทำครั้งเดียว)
- `bun run package-plugin` จะสร้างไฟล์ปลั๊กอินตัวเดียวชื่อ `dist/aseprite-mcp-bridge.aseprite-extension`

---

### ขั้นที่ 3: ติดตั้งปลั๊กอินลงใน Aseprite

1. เปิดโปรแกรม **Aseprite** ขึ้นมา
2. เปิดโฟลเดอร์ `dist` ในโปรเจกต์ แล้ว **ลากไฟล์ `aseprite-mcp-bridge.aseprite-extension` ไปวางลงในหน้าต่างโปรแกรม Aseprite**
   - *อีกวิธี:* ใน Aseprite กดเมนู **Edit > Preferences > Extensions > Add Extension** แล้วเลือกไฟล์ `dist/aseprite-mcp-bridge.aseprite-extension` จากนั้นกด **Apply / OK**
3. หากมีหน้าต่างเด้งถามขอสิทธิ์ script/network ให้กดอนุญาต (**Give full trust**)
4. **ปิดแล้วเปิด Aseprite ใหม่ 1 ครั้ง** เพื่อให้ปลั๊กอินเริ่มทำงานและเชื่อมต่ออัตโนมัติ
5. ลองเข้าไปเช็คที่ **Edit > Preferences > Extensions** ว่ามี **Aseprite MCP Bridge** แสดงและติ๊กถูกอยู่
   - *(ทริค)* สามารถเช็คสถานะหรือกดเชื่อมต่อ/ตัดการเชื่อมต่อเองได้ตลอดที่เมนู **File > MCP Bridge...**

---

### ขั้นที่ 4: เชื่อมต่อเข้ากับโปรแกรม AI (เลือกตัวที่คุณใช้)

> **วิธีหาพาธไฟล์ `Aseprite.exe` (สำหรับคนที่ลงผ่าน Steam บน Windows):**  
> เปิด Steam → คลิกขวาที่เกม/โปรแกรม **Aseprite** → เลือก **Manage > Browse local files** → ก๊อปปี้ที่อยู่โฟลเดอร์มาเติม `\Aseprite.exe` ต่อท้าย (มักจะอยู่ที่ `F:\SteamLibrary\steamapps\common\Aseprite\Aseprite.exe` หรือ `C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe`)

#### Antigravity
เปิดไฟล์ `~/.gemini/config/mcp_config.json` (บน Windows คือ `C:\Users\<ชื่อผู้ใช้ของคุณ>\.gemini\config\mcp_config.json`):

```json
{
  "mcpServers": {
    "aseprite": {
      "command": "C:\\Users\\<ชื่อผู้ใช้ของคุณ>\\.bun\\bin\\bun.exe",
      "args": ["run", "F:\\coding\\aseprite_mcp\\src\\index.ts"],
      "env": {
        "ASEPRITE_PATH": "F:\\SteamLibrary\\steamapps\\common\\Aseprite\\Aseprite.exe"
      }
    }
  }
}
```
จากนั้นกด **Additional Options (`...`) > MCP Servers > Refresh** (หรือเปิดแชทใหม่)

#### Claude Desktop
เปิดไฟล์ตั้งค่า:
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json` *(กดปุ่ม `Win+R` พิมพ์ `%APPDATA%\Claude` แล้วกด Enter)*
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

เพิ่มส่วนของ `"aseprite"` เข้าไปใน `"mcpServers"`:
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
ปิดโปรแกรม Claude Desktop ให้สนิท (เช็คตรงไอคอนมุมขวาล่างใกล้ๆ นาฬิกาด้วย) แล้วเปิดใหม่

#### Cursor
สร้างหรือแก้ไขไฟล์ `.cursor/mcp.json` ในโปรเจกต์ (หรือตั้งค่า Global MCP ของ Cursor):
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
แล้วกดรีเฟรชที่ **Cursor Settings > MCP**

> **ข้อควรรู้สำหรับ Windows:** ถ้า AI Client ฟ้องว่าหาคำสั่ง `bun` ไม่เจอ ให้เปลี่ยน `"command": "bun"` เป็นพาธเต็มของ `bun.exe` ที่เช็คไว้ในขั้นที่ 1 เช่น `"C:\\Users\\<ชื่อผู้ใช้ของคุณ>\\.bun\\bin\\bun.exe"`  
> **เรื่อง `ASEPRITE_PATH`:** ใส่ไว้เพื่อให้ AI วาดและเรนเดอร์ภาพต่อได้แม้คุณปิดโปรแกรม Aseprite อยู่ (ถ้าอยากใช้เฉพาะตอนเปิดโปรแกรมอย่างเดียว ไม่ต้องใส่ `"env"` ก็ได้ครับ)

---

## วิธีใช้งานแบบละเอียด (How to Use)

### 1. โหมด Live (แนะนำ — เห็น AI วาดสดๆ บนหน้าจอ Aseprite)
1. **เปิดโปรแกรม Aseprite** ทิ้งไว้ (ปลั๊กอินจะเชื่อมต่อมาที่ `ws://127.0.0.1:7777/aseprite` อัตโนมัติ)
2. เปิดโปรแกรม AI ที่ตั้งค่าไว้ แล้วพิมพ์สั่งงานได้เลย
3. **เห็นภาพขึ้นสดทันที:** ทุกเส้น สี เลเยอร์ และเฟรมที่ AI สั่งจะโผล่บนผ้าใบใน Aseprite ทันที
4. **แก้ไขแทรกหรือย้อนกลับได้ตลอด:**
   - ทุก 1 คำสั่งวาดของ AI จะถูกมัดเป็น **1 Undo step** — ถ้าไม่ชอบตรงไหน กด **`Ctrl+Z` ครั้งเดียว** ใน Aseprite เพื่อลบขั้นตอนนั้นได้เลย
   - สามารถใช้เครื่องมือดินสอ ยางลบ หรือถังสีใน Aseprite วาดต่อหรือแต่งเพิ่มพร้อมกับ AI ได้ทันที
   - ถ้าทำเป็น Animation สามารถกดปุ่ม **`Enter`** ใน Aseprite เพื่อดูภาพเคลื่อนไหวแบบลูปได้ทันที

### 2. โหมด Headless (ใช้งานได้แม้ไม่ได้เปิดหน้าต่าง Aseprite)
1. หากใส่ `ASEPRITE_PATH` ไว้ในคอนฟิก แม้จะปิดโปรแกรม Aseprite อยู่ AI ก็ยังสามารถสั่งวาด สร้างเลเยอร์ ทำ Animation และเรนเดอร์ภาพได้ตามปกติ
2. ระบบจะรัน `Aseprite.exe -b` เบื้องหลังให้อัตโนมัติเมื่อ AI เรียกใช้คำสั่ง
3. คุณสามารถเปิดดูภาพผลงานสดๆ ผ่านหน้า **Web Preview (`http://127.0.0.1:7777/`)** หรือสั่งให้ AI บันทึกเป็นไฟล์ `.aseprite`, `.png`, `.gif` ได้เลย
4. มีระบบเก็บประวัติ `undo`/`redo` อัตโนมัติย้อนหลังได้สูงสุด **50 ขั้นตอน**

### 3. การใช้งานหน้า Web Preview (`http://127.0.0.1:7777/`)
ระหว่างที่เปิด AI Client ที่เชื่อม MCP อยู่ สามารถเปิดเว็บเบราว์เซอร์ (Chrome/Edge) เข้าลิงก์:
- **`http://127.0.0.1:7777/`** — หน้าต่าง Web Preview สด
- **`http://127.0.0.1:7777/preview.png`** — ลิงก์รูปภาพ PNG ล่าสุด

ในหน้า Web Preview มีอะไรบ้าง:
- **ป้ายสถานะ (มุมซ้ายบน):**
  - สีเขียว **`LIVE`** = เชื่อมต่ออยู่กับหน้าต่าง Aseprite ที่เปิดไว้
  - สีฟ้า **`HEADLESS`** = กำลังทำงานผ่าน Aseprite แบบเบื้องหลัง
  - สีเทา **`DISCONNECTED`** = ยังไม่ได้เชื่อมต่อ Aseprite หรือยังไม่มีภาพแรก
- **แถบ Zoom:** ปรับขนาดซูม `25%`–`200%` โดยคงความคมของเม็ดพิกเซล (`image-rendering: pixelated`) บนพื้นหลังตารางหมากรุกโปร่งใส
- **Activity Log (20 รายการล่าสุด):** แสดงประวัติคำสั่งที่ AI วาด และถ้าคุณวาดเองด้วยมือใน Aseprite หน้าเว็บก็จะขึ้น **`manual_edit`** พร้อมอัปเดตภาพบนเว็บให้เห็นสดๆ ด้วย!

### 4. ตัวอย่างคำสั่ง (Prompt) เอาไปลองพิมพ์ได้เลย
- **เช็คการเชื่อมต่อ:** `"เช็คสถานะ Aseprite MCP ให้หน่อย"`
- **สร้างผ้าใบและวาดตัวละคร:** `"สร้าง canvas 32x32 แล้ววาดแมวส้มน่ารักๆ แยกเลเยอร์ไว้ให้หน่อย"`
- **ให้ AI ตรวจงานตัวเอง:** `"แคปภาพจาก Aseprite มาดูหน่อยว่าสัดส่วนโอเคไหม แล้วช่วยแต่งเพิ่มให้สวยขึ้น"`
- **ทำ Animation:** `"ทำเป็น Animation 4 เฟรม ให้น้องแมวกระดิกหางและขยับตัวดุ๊กดิ๊ก ตั้งความเร็วเฟรมละ 160 ms"`
- **จัดการเลเยอร์และสี:** `"เพิ่มเลเยอร์ชื่อ Shadow ปรับ opacity 128 โหมด multiply แล้วดู palette สีตอนนี้ให้หน่อย"`
- **บันทึกและส่งออกไฟล์:** `"เซฟไฟล์เป็น F:/art/cat.aseprite และ export เป็น GIF ชื่อ F:/art/cat.gif"`

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

## คำสั่งสำหรับนักพัฒนา (Developer Scripts)

- `bun start` — รัน MCP stdio server
- `bun test` — รัน unit tests
- `bun run typecheck` — ตรวจ TypeScript แบบ strict
- `bun run package-plugin` — สร้าง `dist/aseprite-mcp-bridge.aseprite-extension`
- `bun run smoke` — ทดสอบ MCP stdio end-to-end
- `bun run cli --wait 10 <method> '<json>'` — ทดสอบส่งคำสั่งเดี่ยวเข้า Aseprite extension

---

## แก้ปัญหาเบื้องต้น (Troubleshooting)

- **ขึ้นข้อความ `'bun' is not recognized` หลังติดตั้ง Bun:** ให้ปิด PowerShell/Terminal แล้วเปิดขึ้นมาใหม่ หากเป็นปัญหาในไฟล์ JSON ของโปรแกรม AI ให้ใส่พาธเต็มของ `bun.exe` (ดูได้จากคำสั่ง `where.exe bun` บน Windows หรือ `which bun` บน macOS/Linux)
- **พอร์ต 7777 ชนกัน (Port Conflict):** ถ้าเปิด AI Client สองตัวพร้อมกัน (เช่น Antigravity + Claude Desktop) ตัวแรกจะได้พอร์ต `7777` ส่วนตัวที่สองจะไม่ crash แต่จะคืนข้อความแจ้งพอร์ตชนกัน ให้ปิดตัวหนึ่งหรือตั้ง `ASEPRITE_MCP_PORT` แยก
- **Aseprite ยังขึ้นว่า Disconnected หรือไม่เห็นเมนู:** เช็คที่ **Edit > Preferences > Extensions** ว่าติ๊กเปิด **Aseprite MCP Bridge** แล้วรีสตาร์ท Aseprite หรือกด **File > MCP Bridge...** แล้วกด **Connect** ขณะเปิด AI Client อยู่
- **ความเร็วโหมด Headless:** โหมด Headless จะเรียก `Aseprite.exe -b` ทีละคำสั่ง (~0.2–1 วินาทีต่อคำสั่ง) ส่วนโหมด Live ตอบสนองทันทีผ่าน WebSocket
- **การใช้งาน `Ctrl+Z` (Undo Semantics):**
  - **โหมด Live:** แต่ละคำสั่งที่แก้ไขภาพจะรวมเป็น 1 `app.transaction` กด `Ctrl+Z` ครั้งเดียวจะย้อนกลับทั้งคำสั่ง ส่วน tool `undo` จะย้อนการกระทำล่าสุดไม่ว่า AI หรือผู้ใช้จะเป็นคนวาด
  - **โหมด Headless:** เก็บ snapshot ไฟล์ `.aseprite` ก่อนการแก้ไขแต่ละครั้ง (สูงสุด 50 ขั้น) เพื่อให้ `undo` / `redo` ทำงานข้าม batch run ได้
