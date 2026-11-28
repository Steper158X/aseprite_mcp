[English](README.md) | **ภาษาไทย**

# Aseprite MCP — คู่มือตั้งค่าสำหรับผู้ใช้ทั่วไป

โปรเจกต์นี้ทำให้ AI (เช่น Cursor, Claude Desktop, Antigravity) **วาด Pixel Art ลงในโปรแกรม Aseprite บนเครื่องคุณแบบสดๆ** คุณเห็นทุกเส้นบนผ้าใบ กด `Ctrl+Z` ย้อนกลับได้ และวาดด้วยเมาส์แทรกไปพร้อมกันได้

คู่มือนี้เขียนสำหรับคนที่**ยังไม่เคยตั้งค่าอะไรแนวนี้มาก่อน** ทำตามทีละขั้นได้เลย ไม่จำเป็นต้องเขียนโปรแกรมเป็น

**อยากให้ AI ติดตั้งให้?** ก๊อปข้อความทั้งก้อนด้านล่าง ไปวางในแชท Cursor (หรือแอป AI ที่รองรับ) แล้วส่งเลย:

```text
อ่านคู่มือติดตั้งจากลิงก์นี้ แล้วติดตั้ง Aseprite MCP ให้ฉันทีละขั้น
ฉันเป็นมือใหม่ — อธิบายภาษา่ายๆ ทำทีละขั้น และรันคำสั่งให้เองได้ถ้าทำได้

https://raw.githubusercontent.com/Steper158X/aseprite_mcp/main/docs/AI_INSTALL_PLAYBOOK.md
```

(หน้าอ่านบน GitHub: [docs/AI_INSTALL_PLAYBOOK.md](https://github.com/Steper158X/aseprite_mcp/blob/main/docs/AI_INSTALL_PLAYBOOK.md) — ถ้าเปิดโฟลเดอร์โปรเจกต์ในแชทอยู่แล้ว ใช้ `@docs/AI_INSTALL_PLAYBOOK.md` แทนลิงก์ก็ได้)

---

## ตัวอย่างผลงาน

| Animation แมวส้ม (32×32, 4 เฟรม) | ห้องเปียโน Isometric (96×96, 6 เลเยอร์, 4 เฟรม) |
| :---: | :---: |
| ![ตัวอย่างแมวส้ม](docs/demo-orange-cat.gif) | ![ตัวอย่างห้องเปียโน](docs/demo-piano-room.gif) |
| แมวส้มยิ้มแฉ่ง 4 เฟรม | ห้องเปียโนแยกเลเยอร์ |

| 1. โครงห้อง | 2. หน้าต่างและของแต่ง | 3. เปียโน | 4. คนเล่น | 5. แสงแดด |
| :---: | :---: | :---: | :---: | :---: |
| ![ขั้น 1](docs/layers/01-room-shell.png) | ![ขั้น 2](docs/layers/02-window-decor.png) | ![ขั้น 3](docs/layers/03-piano-bench.png) | ![ขั้น 4](docs/layers/04-pianist.png) | ![ขั้น 5](docs/layers/05-sunlight.png) |

---

## สิ่งที่คุณจะติดตั้งมี 3 ส่วน

1. **Aseprite** — โปรแกรมวาด Pixel Art (ต้องมีลิขสิทธิ์/ซื้อไว้แล้ว)
2. **Aseprite MCP Bridge** — ส่วนขยายเล็กๆ ใน Aseprite ที่คุยกับ AI
3. **เซิร์ฟเวอร์ Aseprite MCP** — โปรแกรมเล็กๆ บนเครื่องคุณ ที่แอป AI จะเปิดให้อัตโนมัติ

เมื่อตั้งค่าเสร็จ ให้เปิด Aseprite แล้วเปิดแอป AI จากนั้นพิมพ์ประมาณว่า:  
`สร้าง canvas 32x32 แล้ววาดแมวส้มน่ารักๆ`

---

## ก่อนเริ่ม — เช็คลิสต์

| สิ่งที่ต้องมี | รายละเอียด |
| --- | --- |
| ติดตั้ง Aseprite แล้ว | ลงผ่าน Steam หรือไฟล์ติดตั้งปกติก็ได้ |
| แอป AI ที่รองรับ MCP | Cursor, Claude Desktop หรือ Antigravity |
| เวลาประมาณ 10–15 นาที | ทำครั้งแรกครั้งเดียว |
| **Node.js เวอร์ชัน 20 ขึ้นไป** | ใช้กับวิธีติดตั้งที่แนะนำผ่าน npm ดาวน์โหลดฟรี: https://nodejs.org/ (เลือก LTS) |

ถ้าไม่อยากลง Node.js ให้ใช้ [ไฟล์ zip จาก GitHub Releases](#ทางเลือก--ไฟล์-zip-จาก-releases) แทน

---

## วิธีที่แนะนำ — ติดตั้งผ่าน npm

แพ็กเกจ `@steper158x/aseprite_mcp` อยู่บน npm แล้ว วิธีนี้ไม่ต้องดาวน์โหลดซอร์สโค้ด

### 1. ติดตั้ง Node.js (ถ้ายังไม่มี)

1. เข้า https://nodejs.org/ แล้วติดตั้งเวอร์ชัน **LTS** (20 ขึ้นไป)
2. ปิดแล้วเปิดหน้าต่างเทอร์มินัลใหม่ (Windows ใช้ PowerShell, macOS ใช้ Terminal)
3. ลองพิมพ์:

```bash
node --version
npx --version
```

ควรขึ้นเลขเวอร์ชันประมาณ `v20.x.x` หรือสูงกว่า ถ้าขึ้นว่าไม่รู้จักคำสั่ง ให้รีสตาร์ทเครื่องหนึ่งครั้งแล้วลองใหม่

### 2. ให้คำสั่ง setup ติดตั้งปลั๊กอินและเขียนไฟล์ตั้งค่า

เปิดเทอร์มินัล**ในโฟลเดอร์โปรเจกต์ที่เปิดอยู่ใน Cursor** (ถ้าใช้ Claude Desktop หรือ Antigravity จะเปิดจากโฟลเดอร์ไหนก็ได้) แล้วรันคำสั่งเดียว:

```bash
# Cursor (เขียน .cursor/mcp.json ของโปรเจกต์ และลบ aseprite ออกจาก ~/.cursor/mcp.json เพื่อไม่ให้รันเซิร์ฟเวอร์ซ้ำ)
npx -y @steper158x/aseprite_mcp setup --cursor

# Claude Desktop
npx -y @steper158x/aseprite_mcp setup --claude

# Antigravity
npx -y @steper158x/aseprite_mcp setup --antigravity

# แค่พิมพ์ JSON ออกมาให้ก๊อปเอง
npx -y @steper158x/aseprite_mcp setup --print
```

คำสั่งนี้ติดตั้งส่วนขยายลง Aseprite และพยายามหาโปรแกรม Aseprite ให้ ถ้าสรุปบอกว่าหาไม่เจอ ให้หาพาธตามด้านล่าง แล้วรันซ้ำพร้อมพาธ:

```bash
npx -y @steper158x/aseprite_mcp setup --cursor --aseprite "C:/path/to/Aseprite.exe"
```

ใช้ `--claude` หรือ `--antigravity` แทน `--cursor` ตามแอปที่คุณใช้

จากนั้น**ปิด Aseprite ให้สนิท แล้วเปิดใหม่**

ตรวจผล: ใน Aseprite ไปที่ **Edit → Preferences → Extensions** ควรเห็น **Aseprite MCP Bridge** และมีติ๊กถูก

ภายหลังสามารถเปิด **File → MCP Bridge...** เพื่อดูสถานะ Connect / Disconnect ได้

### 3. หาที่อยู่ไฟล์ Aseprite (ถ้า setup หาไม่เจอ)

แอป AI ต้องรู้พาธเต็มไปยังโปรแกรม Aseprite (เพื่อให้วาดได้แม้ปิดหน้าต่างไว้)

#### Windows (Steam)

1. เปิด Steam
2. คลิกขวาที่ **Aseprite** → **Manage → Browse local files**
3. ก๊อปที่อยู่โฟลเดอร์ แล้วต่อท้ายด้วย `\Aseprite.exe`

ตัวอย่างที่พบบ่อย:

- `C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe`
- `D:\SteamLibrary\steamapps\common\Aseprite\Aseprite.exe`

#### macOS

พาธทั่วไป:

- `/Applications/Aseprite.app/Contents/MacOS/aseprite`

ถ้าลงผ่าน Steam อาจอยู่ที่:

- `~/Library/Application Support/Steam/steamapps/common/Aseprite/Aseprite.app/Contents/MacOS/aseprite`

### 4. หน้าตาไฟล์ตั้งค่า MCP

setup จะเขียนรายการชื่อ `"aseprite"` หน้าตาประมาณนี้ (พาธ Aseprite ของคุณจะต่างออกไป):

```json
{
  "mcpServers": {
    "aseprite": {
      "command": "npx",
      "args": ["-y", "@steper158x/aseprite_mcp"],
      "env": {
        "ASEPRITE_PATH": "<ASEPRITE>",
        "ASEPRITE_MCP_TOKEN": "<setup สร้างให้>",
        "ASEPRITE_MCP_PORT": "7777"
      }
    }
  }
}
```

ถ้าจะแก้ไฟล์เอง ให้ใส่ก้อนนี้อยู่ใน `"mcpServers"` และอย่าลบเซิร์ฟเวอร์อื่นที่มีอยู่

บน Windows ในไฟล์ JSON ใช้ได้ทั้งสองแบบ:

- เครื่องหมาย `/`: `C:/Users/Alex/...`
- หรือ `\\` คู่: `C:\\Users\\Alex\\...`

**Cursor**

- อยู่ในโปรเจกต์: `.cursor/mcp.json`
- ไม่อยู่ในโปรเจกต์: `~/.cursor/mcp.json`

จากนั้นเปิด **Cursor Settings → MCP** แล้วรีเฟรช / รีโหลด

**Claude Desktop**

- **Windows:** กด `Win+R` พิมพ์ `%APPDATA%\Claude` กด Enter แล้วเปิด `claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

ปิด Claude Desktop ให้สนิท (รวมไอคอนมุมขวาล่าง) แล้วเปิดใหม่

**Antigravity**

แก้ไฟล์ `~/.gemini/config/mcp_config.json`  
(Windows: `C:\Users\<ชื่อผู้ใช้ของคุณ>\.gemini\config\mcp_config.json`)

แล้วรีเฟรช MCP ในหน้า Antigravity (หรือเปิดแชทใหม่)

---

## ทดสอบครั้งแรก

1. เปิด **Aseprite** ทิ้งไว้
2. เปิดแอป AI ของคุณ
3. พิมพ์:

```text
เช็คสถานะ Aseprite MCP ให้หน่อย
```

ถ้าสำเร็จ ระบบควรบอกว่าเชื่อมต่อแล้ว (Live) หรืออย่างน้อยเซิร์ฟเวอร์กำลังทำงาน

จากนั้นลอง:

```text
สร้าง canvas 32x32 แล้ววาดแมวส้มยิ้มแฉ่งแยกเลเยอร์ไว้ให้หน่อย
```

ดูหน้าต่าง Aseprite — ควรเห็นพิกเซลโผล่แบบสดๆ

### หน้าเว็บดูภาพสด (ไม่บังคับ)

ขณะที่แอป AI เปิด MCP อยู่ ให้เปิด URL จาก `get_status` (มีโทเค็นของเครื่องนี้อยู่ในลิงก์) เซิร์ฟเวอร์พิมพ์ URL เดียวกันตอนเริ่มทำงาน เปิดหน้าเว็บโดยไม่มีโทเค็นจะถูกปฏิเสธ

- `http://127.0.0.1:7777/?token=…` — หน้าดูภาพแบบสด
- URL เดียวกันแต่เปลี่ยนพาธเป็น `/preview.png` — รูปล่าสุดอย่างเดียว

ความหมายป้ายสถานะ:

- **LIVE** — เชื่อมกับ Aseprite ที่เปิดอยู่
- **HEADLESS** — วาดเบื้องหลังโดยไม่เปิดหน้าต่าง
- **DISCONNECTED** — ยังไม่เชื่อมหรือยังไม่มีภาพแรก

---

## การใช้งานประจำวัน

### วาดด้วยกัน (โหมด Live)

1. เปิด Aseprite ทิ้งไว้
2. สั่งงาน AI ตามปกติ
3. แต่ละคำสั่งวาดของ AI = 1 ขั้น Undo → กด `Ctrl+Z` ครั้งเดียวเพื่อย้อนขั้นนั้น
4. ใช้เครื่องมือใน Aseprite วาดแทรกได้ตลอด
5. ถ้าเป็น Animation กด `Enter` ใน Aseprite เพื่อดูพรีวิว

### วาดแม้ปิด Aseprite (โหมด Headless)

ถ้าใส่ `ASEPRITE_PATH` ถูกต้อง เซิร์ฟเวอร์ยังสั่งวาดเบื้องหลังได้ เปิดหน้าเว็บพรีวิวเพื่อดูความคืบหน้า แล้วค่อยสั่งเซฟหรือ export ไฟล์

### ตัวอย่างประโยคสั่งงาน

- `เช็คสถานะ Aseprite MCP ให้หน่อย`
- `สร้าง canvas 32x32 แล้ววาดแมวส้มน่ารักๆ แยกเลเยอร์ไว้`
- `แคปภาพจาก Aseprite มาดูว่าสัดส่วนโอเคไหม`
- `ทำเป็น Animation 4 เฟรม กระดิกหาง เฟรมละ 160 ms`
- `เพิ่มเลเยอร์ Shadow ความโปร่งแสง 50% โหมด multiply`
- `เซฟเป็น art/cat.aseprite และ export เป็น art/cat.gif`

ไฟล์ที่เปิด บันทึก หรือส่งออกต้องอยู่ในโฟลเดอร์ที่เซิร์ฟเวอร์เริ่มทำงาน ถ้าต้องการโฟลเดอร์อื่น ให้ตั้ง `ASEPRITE_MCP_FS_ROOT` หรือใส่ `*` เพื่อปิดการจำกัด

ถ้า Aseprite เคยเชื่อมแล้วหลุด โหมด auto จะรอสักครู่แล้วแจ้งว่ายังไม่เชื่อม จะไม่ไปวาดไฟล์เบื้องหลังเงียบๆ ถ้าต้องการไฟล์นั้นจริงๆ ให้ตั้ง `ASEPRITE_MODE=headless`

เครื่องมือยังแก้แท็กแอนิเมชัน ส่งออก spritesheet ย่อ/ตัด/พลิก/หมุนแคนวาส จัดเลเยอร์ ย้ายเซล และกำหนด selection ได้ ยังไม่รองรับ tilemap, slice, grid และเลเยอร์ข้อความ

ใช้ที่อยู่โฟลเดอร์ที่มีอยู่จริงบนเครื่องคุณ

---

## ทางเลือก — ไฟล์ zip จาก Releases

GitHub Release (แท็ก `v*`) มีไฟล์ zip แยกตามระบบ ไม่ต้องลง Node.js

| ระบบ | ไฟล์ zip | โปรแกรมข้างใน |
| --- | --- | --- |
| Windows x64 | `aseprite-mcp-windows-x64.zip` | `aseprite-mcp-windows-x64.exe` |
| Windows arm64 | `aseprite-mcp-windows-arm64.zip` | `aseprite-mcp-windows-arm64.exe` |
| macOS Apple silicon | `aseprite-mcp-darwin-arm64.zip` | `aseprite-mcp-darwin-arm64` |
| macOS Intel | `aseprite-mcp-darwin-x64.zip` | `aseprite-mcp-darwin-x64` |
| Linux x64 | `aseprite-mcp-linux-x64.zip` | `aseprite-mcp-linux-x64` |
| Linux arm64 | `aseprite-mcp-linux-arm64.zip` | `aseprite-mcp-linux-arm64` |

1. ดาวน์โหลด zip ของระบบคุณจาก GitHub Release ล่าสุด
2. แตกไปไว้ที่ถาวร เช่น `C:\Tools\aseprite-mcp\`
3. เก็บโฟลเดอร์ `aseprite-plugin` และ `preview` ไว้ข้างไฟล์โปรแกรม อย่าลบ
4. รัน setup ครั้งหนึ่ง ตัวอย่างบน Windows:

```bash
aseprite-mcp-windows-x64.exe setup --cursor
```

บน macOS หรือ Linux ให้รันชื่อโปรแกรมตามตาราง ด้วยอาร์กิวเมนต์เดียวกัน (`setup --cursor`, `--claude`, หรือ `--antigravity`)

5. ใน MCP config ให้ `"command"` ชี้ไปที่ไฟล์นั้น และใส่ `"args": []`

```json
{
  "mcpServers": {
    "aseprite": {
      "command": "C:/Tools/aseprite-mcp/aseprite-mcp-windows-x64.exe",
      "args": [],
      "env": {
        "ASEPRITE_PATH": "<ASEPRITE>",
        "ASEPRITE_MCP_TOKEN": "<setup สร้างให้>",
        "ASEPRITE_MCP_PORT": "7777"
      }
    }
  }
}
```

---

## ทางเลือก — บิลด์จากซอร์ส

ใช้เมื่อคุณโคลน repository นี้ และอยากรันโค้ดชุดนี้ แทนแพ็กเกจบน npm

สิ่งที่ต้องมี:

- Node.js 20 ขึ้นไป (มี npm มาให้)
- ไฟล์ repository นี้อยู่บนเครื่อง

ไม่ต้องมี Bun เพื่อบิลด์หรือรันเซิร์ฟเวอร์ `npm run build` กับ `bun run build` รันสคริปต์ Node ตัวเดียวกัน (`scripts/build.mjs`)

```bash
git clone https://github.com/Steper158X/aseprite_mcp.git
cd aseprite_mcp
npm install
npm run build
node dist/bin.js setup --cursor
```

`npm install` ดาวน์โหลดไลบรารีครั้งเดียว `npm run build` จะสร้าง:

- `dist/bin.js` — โปรแกรมที่แอป AI จะเรียกใช้
- `dist/aseprite-mcp-bridge.aseprite-extension` — ไฟล์ปลั๊กอิน Aseprite
- `dist/preview/` — ไฟล์สำหรับหน้าเว็บดูภาพสด

ลากไฟล์ `.aseprite-extension` ไปวางบนหน้าต่าง Aseprite แทนก็ได้ ถ้ามีหน้าต่างถามสิทธิ์ script / network ให้เลือกอนุญาตเต็มที่ (**Give full trust** หรือข้อความใกล้เคียง) แล้วรีสตาร์ท Aseprite

ถ้าตั้ง MCP เองสำหรับบิลด์ในเครื่อง ให้แทน `<PROJECT>` และ `<ASEPRITE>` ด้วยพาธจริง:

```json
{
  "mcpServers": {
    "aseprite": {
      "command": "node",
      "args": ["<PROJECT>/dist/bin.js"],
      "env": {
        "ASEPRITE_PATH": "<ASEPRITE>",
        "ASEPRITE_MCP_TOKEN": "<setup สร้างให้>",
        "ASEPRITE_MCP_PORT": "7777"
      }
    }
  }
}
```

ถ้าแอป AI หา `node` ไม่เจอ ให้ใส่พาธเต็มของ `node.exe` (Windows: `where.exe node`) หรือ `node` (macOS/Linux: `which node`)

คนที่แก้โค้ดต้องมี [Bun](https://bun.sh/) เพิ่ม สำหรับเทส (`npm test` / `bun test`) และสำหรับไฟล์ executable ของ Release (`bun run build:binaries`)

---

## แก้ปัญหาเบื้องต้น

| อาการ | ลองทำแบบนี้ |
| --- | --- |
| ขึ้นว่าไม่รู้จักคำสั่ง `node` หรือ `npx` | ติดตั้ง Node.js LTS ใหม่ แล้วเปิดเทอร์มินัล**หน้าต่างใหม่** บน Windows อาจต้องรีสตาร์ทเครื่อง |
| แอป AI หา `node` หรือ `npx` ไม่เจอ | ใน MCP config ใส่พาธเต็มของ `node.exe` หรือ `npx.cmd` (Windows: รัน `where.exe node` และ `where.exe npx` ใน PowerShell) |
| ไม่เห็นปลั๊กอิน / Disconnected | **Edit → Preferences → Extensions** → เปิด **Aseprite MCP Bridge** → รีสตาร์ท Aseprite → **File → MCP Bridge... → Connect** ขณะเปิดแอป AI อยู่ |
| พอร์ต 7777 ชนกัน | มักมี `aseprite` สองที่ (`.cursor/mcp.json` ของโปรเจกต์ **และ** `~/.cursor/mcp.json`) หรือโปรเซส Node ค้าง รัน `npx -y @steper158x/aseprite_mcp setup --cursor` อีกครั้ง (จะลบรายการซ้ำ) ฆ่าโปรเซสค้าง แล้วรีเฟรช MCP ครั้งเดียว สุดท้ายค่อยใส่ `"ASEPRITE_MCP_PORT": "7778"` ใน `env` แล้วรัน setup หรือรีสตาร์ทเซิร์ฟเวอร์ให้เขียนไฟล์บริดจ์ใหม่ จากนั้นรีสตาร์ท Aseprite ส่วนขยายจะอ่านพอร์ตจากไฟล์นั้นตอนเชื่อมต่อ |
| โหมด Headless ไม่ทำงาน | เช็คว่า `ASEPRITE_PATH` ชี้ไปที่ไฟล์ `Aseprite.exe` / `aseprite` จริง ไม่ใช่โฟลเดอร์ |
| setup เขียนไฟล์ผิดที่ | ถ้าใช้ Cursor ให้รัน setup จากในโฟลเดอร์โปรเจกต์ที่เปิดอยู่ ใช้ `--print` ดูก่อนค่อยเขียน |
| `npm run build` พัง | รันจากโฟลเดอร์รากของ repository ด้วย Node.js 20 ขึ้นไป ต้อง `npm install` ให้จบก่อน เพื่อให้มี `esbuild` |
| หน้าพรีวิวว่างหรือขึ้น Unauthorized | ให้แชทที่โหลด MCP ทำงานก่อน แล้วเปิด `previewUrl` จาก `get_status` (มีโทเค็นอยู่ในลิงก์) |

---

## การตั้งค่าเพิ่มเติม (ไม่บังคับ)

ใส่ในบล็อก `"env"` ของ MCP config เมื่อจำเป็นเท่านั้น:

| ชื่อ | ค่าเริ่มต้น | ความหมาย |
| --- | --- | --- |
| `ASEPRITE_PATH` | (ว่าง) | พาธ Aseprite สำหรับวาดแบบปิดหน้าต่าง |
| `ASEPRITE_MODE` | `auto` | `auto`, `live`, หรือ `headless` ถ้าเคยเชื่อม GUI แล้วหลุด `auto` จะรอให้กลับมา ไม่สลับไปวาดไฟล์เบื้องหลังเงียบๆ |
| `ASEPRITE_MCP_PORT` | `7777` | พอร์ตพรีวิวและการเชื่อมต่อ setup บันทึกไว้ให้ส่วนขยายใช้พอร์ตเดียวกัน |
| `ASEPRITE_MCP_TOKEN` | สร้างให้ | รหัสลับที่ใช้ร่วมกัน `setup` เป็นคนสร้าง ถ้ายังไม่มี เซิร์ฟเวอร์จะสร้างตอนเริ่มทำงาน |
| `ASEPRITE_MCP_FS_ROOT` | โฟลเดอร์ที่เซิร์ฟเวอร์เริ่ม | เปิด/บันทึก/ส่งออกต้องอยู่ในโฟลเดอร์นี้ ใส่ `*` หรือ `unrestricted` เพื่อปิดการจำกัด |
| `ASEPRITE_MCP_OPEN_PREVIEW` | `0` | ตั้ง `1` เพื่อเปิดหน้าพรีวิวตอนเซิร์ฟเวอร์เริ่ม |
| `ASEPRITE_MCP_ALLOW_LUA` | ไม่ตั้ง | ตั้ง `1` เพื่อเปิด `run_lua` และต้องเปิด Allow run_lua ใน **File → MCP Bridge...** ด้วย |
| `ASEPRITE_MCP_CALL_TIMEOUT_MS` | `15000` | เวลารอคำสั่งแบบสด |
| `ASEPRITE_MCP_HEADLESS_TIMEOUT_MS` | `30000` | เวลารอ Aseprite แบบปิดหน้าต่างหนึ่งครั้ง |
| `ASEPRITE_MCP_RECONNECT_MS` | `4000` | โหมด auto รอให้ Aseprite ต่อกลับนานเท่าไร |
| `ASEPRITE_MCP_CONFIG_DIR` | โฟลเดอร์ตั้งค่าของผู้ใช้ | เปลี่ยนที่เก็บ `bridge.json` (โทเค็น, กุญแจ lua, พอร์ต) |

---

## สำหรับนักพัฒนา

```text
แอป AI ──(stdio MCP)──► เซิร์ฟเวอร์ Node
                           ├─ Live  → WebSocket → ส่วนขยาย Aseprite
                           ├─ Headless → Aseprite -b --script
                           └─ หน้า Web Preview ที่พอร์ต 7777
```

คำสั่งที่ใช้บ่อยในโฟลเดอร์โปรเจกต์:

| คำสั่ง | ใช้ทำอะไร |
| --- | --- |
| `npm install` | ติดตั้งไลบรารี (Node.js 20 ขึ้นไป) |
| `npm run build` | สร้าง `dist/bin.js` และปลั๊กอินด้วย Node |
| `bun run build` | สคริปต์บิลด์เดียวกับ `npm run build` |
| `npm run typecheck` | ตรวจชนิดด้วย `tsc --noEmit` |
| `npm run start:node` | รันเซิร์ฟเวอร์ MCP ด้วย Node |
| `npm test` | รันเทส (ต้องมี Bun ใน `PATH`) |
| `bun run build:binaries` | คอมไพล์ไฟล์ executable สำหรับ Release (ต้องมี Bun) |
| `node dist/bin.js setup --help` | ดูตัวเลือกตัวช่วยติดตั้ง |
| `node dist/bin.js install-plugin` | ติดตั้งส่วนขยายลง Aseprite |
| `node dist/bin.js package-plugin` | สร้างไฟล์ `.aseprite-extension` |

ผู้ใช้ทั่วไปติดตั้งด้วย `npx` หรือไฟล์ zip จาก Release การบิลด์จาก repository นี้ใช้ Node.js 20 ขึ้นไป Bun ใช้เฉพาะตอนรันเทสและตอน `build:binaries`
