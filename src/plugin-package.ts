import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { packageRoot, pluginRoot } from "./paths.ts";

const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_HEADER_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const VERSION_MADE_BY_UNIX = 0x0314;
const VERSION_NEEDED_PKZIP_20 = 20;
const FLAG_UTF8 = 0x0800;
const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;
const DIR_EXTERNAL_ATTRS = ((0o040755 << 16) | 0x10) >>> 0;
const FILE_EXTERNAL_ATTRS = (0o100644 << 16) >>> 0;

const ROOT_PLUGIN_ENTRIES = ["lib", "package.json", "plugin.lua"] as const;
const REQUIRED_ARCHIVE_ENTRIES = [
  "package.json",
  "plugin.lua",
  "lib/handlers.lua",
  "lib/util.lua",
  "lib/commands.lua",
] as const;

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i]!;
    crc = (CRC32_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const rawYear = date.getFullYear();
  if (rawYear < 1980) {
    return {
      dosTime: 0,
      dosDate: (1 << 5) | 1,
    };
  }
  const year = Math.min(rawYear, 2107);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | ((seconds >> 1) & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
  return { dosTime, dosDate };
}

function hasNonAscii(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 0x7f) return true;
  }
  return false;
}

interface SourceEntry {
  archivePath: string;
  fullPath: string;
  isDirectory: boolean;
  mtime: Date;
}

function collectSourceEntries(pluginDir: string): SourceEntry[] {
  const entries: SourceEntry[] = [];

  const visit = (fullPath: string, relArchivePath: string): void => {
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      const dirArchivePath = relArchivePath.endsWith("/") ? relArchivePath : `${relArchivePath}/`;
      entries.push({
        archivePath: dirArchivePath,
        fullPath,
        isDirectory: true,
        mtime: stat.mtime,
      });

      const children = readdirSync(fullPath, { withFileTypes: true }).sort((a, b) =>
        a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
      );
      for (const child of children) {
        if (child.name === "bridge.local.json") continue;
        const childFullPath = join(fullPath, child.name);
        const childArchivePath = posix.join(relArchivePath.replace(/\/+$/, ""), child.name);
        visit(childFullPath, childArchivePath);
      }
      return;
    }

    if (stat.isFile()) {
      entries.push({
        archivePath: relArchivePath.replace(/\\/g, "/"),
        fullPath,
        isDirectory: false,
        mtime: stat.mtime,
      });
    }
  };

  const sortedRoots = [...ROOT_PLUGIN_ENTRIES].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const name of sortedRoots) {
    const fullPath = join(pluginDir, name);
    if (!existsSync(fullPath)) {
      throw new Error(`Required plugin source entry not found: ${fullPath}`);
    }
    visit(fullPath, name.replace(/\\/g, "/"));
  }

  return entries;
}

interface PreparedZipEntry {
  archivePath: string;
  nameBytes: Buffer;
  flags: number;
  method: number;
  dosTime: number;
  dosDate: number;
  crc: number;
  compressed: Buffer;
  uncompressedSize: number;
  externalAttrs: number;
  localHeaderOffset: number;
}

function buildZipBuffer(entries: SourceEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const prepared: PreparedZipEntry[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.archivePath, "utf8");
    const flags = hasNonAscii(entry.archivePath) ? FLAG_UTF8 : 0;
    const { dosTime, dosDate } = toDosDateTime(entry.mtime);

    let method = METHOD_STORE;
    let crc = 0;
    let compressed: Buffer = Buffer.alloc(0);
    let uncompressedSize = 0;
    let externalAttrs = DIR_EXTERNAL_ATTRS;

    if (!entry.isDirectory) {
      const raw = readFileSync(entry.fullPath);
      uncompressedSize = raw.length;
      crc = crc32(raw);
      const deflated = deflateRawSync(raw, { level: 9 });
      if (deflated.length < raw.length) {
        method = METHOD_DEFLATE;
        compressed = deflated;
      } else {
        method = METHOD_STORE;
        compressed = raw;
      }
      externalAttrs = FILE_EXTERNAL_ATTRS;
    }

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(LOCAL_FILE_HEADER_SIG, 0);
    localHeader.writeUInt16LE(VERSION_NEEDED_PKZIP_20, 4);
    localHeader.writeUInt16LE(flags, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localHeaderOffset = offset;
    localParts.push(localHeader, nameBytes, compressed);
    offset += localHeader.length + nameBytes.length + compressed.length;

    prepared.push({
      archivePath: entry.archivePath,
      nameBytes,
      flags,
      method,
      dosTime,
      dosDate,
      crc,
      compressed,
      uncompressedSize,
      externalAttrs,
      localHeaderOffset,
    });
  }

  const centralDirOffset = offset;
  const centralParts: Buffer[] = [];
  let centralDirSize = 0;

  for (const item of prepared) {
    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(CENTRAL_DIR_HEADER_SIG, 0);
    cdHeader.writeUInt16LE(VERSION_MADE_BY_UNIX, 4);
    cdHeader.writeUInt16LE(VERSION_NEEDED_PKZIP_20, 6);
    cdHeader.writeUInt16LE(item.flags, 8);
    cdHeader.writeUInt16LE(item.method, 10);
    cdHeader.writeUInt16LE(item.dosTime, 12);
    cdHeader.writeUInt16LE(item.dosDate, 14);
    cdHeader.writeUInt32LE(item.crc, 16);
    cdHeader.writeUInt32LE(item.compressed.length, 20);
    cdHeader.writeUInt32LE(item.uncompressedSize, 24);
    cdHeader.writeUInt16LE(item.nameBytes.length, 28);
    cdHeader.writeUInt16LE(0, 30);
    cdHeader.writeUInt16LE(0, 32);
    cdHeader.writeUInt16LE(0, 34);
    cdHeader.writeUInt16LE(0, 36);
    cdHeader.writeUInt32LE(item.externalAttrs, 38);
    cdHeader.writeUInt32LE(item.localHeaderOffset, 42);

    centralParts.push(cdHeader, item.nameBytes);
    centralDirSize += cdHeader.length + item.nameBytes.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIG, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(prepared.length, 8);
  eocd.writeUInt16LE(prepared.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

export function verifyZipArchive(zipBuffer: Buffer): Map<string, Buffer> {
  if (zipBuffer.length < 22) {
    throw new Error(`Invalid ZIP archive: buffer too small (${zipBuffer.length} bytes)`);
  }

  if (zipBuffer.readUInt32LE(0) !== LOCAL_FILE_HEADER_SIG) {
    throw new Error("Invalid ZIP archive: missing PK\\x03\\x04 local file header signature");
  }

  const minOffset = Math.max(0, zipBuffer.length - 22 - 65535);
  let eocdOffset = -1;
  for (let i = zipBuffer.length - 22; i >= minOffset; i--) {
    if (zipBuffer.readUInt32LE(i) === EOCD_SIG) {
      const commentLen = zipBuffer.readUInt16LE(i + 20);
      if (i + 22 + commentLen === zipBuffer.length) {
        eocdOffset = i;
        break;
      }
    }
  }

  if (eocdOffset < 0) {
    throw new Error("Invalid ZIP archive: missing End of Central Directory record");
  }

  const diskNumber = zipBuffer.readUInt16LE(eocdOffset + 4);
  const cdDisk = zipBuffer.readUInt16LE(eocdOffset + 6);
  const diskEntries = zipBuffer.readUInt16LE(eocdOffset + 8);
  const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
  const cdSize = zipBuffer.readUInt32LE(eocdOffset + 12);
  const cdOffset = zipBuffer.readUInt32LE(eocdOffset + 16);

  if (diskNumber !== 0 || cdDisk !== 0 || diskEntries !== totalEntries) {
    throw new Error("Invalid ZIP archive: multi-disk archives are not supported");
  }
  if (cdOffset + cdSize > eocdOffset) {
    throw new Error("Invalid ZIP archive: central directory bounds exceed EOCD offset");
  }

  const contents = new Map<string, Buffer>();
  let cursor = cdOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (cursor + 46 > cdOffset + cdSize) {
      throw new Error(`Invalid ZIP archive: truncated central directory entry #${i}`);
    }
    if (zipBuffer.readUInt32LE(cursor) !== CENTRAL_DIR_HEADER_SIG) {
      throw new Error(`Invalid ZIP archive: bad central directory signature at offset ${cursor}`);
    }

    const flags = zipBuffer.readUInt16LE(cursor + 8);
    const method = zipBuffer.readUInt16LE(cursor + 10);
    const crc = zipBuffer.readUInt32LE(cursor + 16);
    const compSize = zipBuffer.readUInt32LE(cursor + 20);
    const uncompSize = zipBuffer.readUInt32LE(cursor + 24);
    const nameLen = zipBuffer.readUInt16LE(cursor + 28);
    const extraLen = zipBuffer.readUInt16LE(cursor + 30);
    const commentLen = zipBuffer.readUInt16LE(cursor + 32);
    const localOffset = zipBuffer.readUInt32LE(cursor + 42);

    const headerEnd = cursor + 46 + nameLen + extraLen + commentLen;
    if (headerEnd > cdOffset + cdSize) {
      throw new Error(`Invalid ZIP archive: central directory entry #${i} exceeds directory size`);
    }

    if ((flags & 0x01) !== 0 || (flags & 0x08) !== 0) {
      throw new Error(`Invalid ZIP archive: unsupported flags (0x${flags.toString(16)})`);
    }

    const name = zipBuffer.toString("utf8", cursor + 46, cursor + 46 + nameLen);
    cursor = headerEnd;

    if (localOffset + 30 > cdOffset) {
      throw new Error(`Invalid ZIP archive: local header out of bounds for ${name}`);
    }
    if (zipBuffer.readUInt32LE(localOffset) !== LOCAL_FILE_HEADER_SIG) {
      throw new Error(`Invalid ZIP archive: bad local header signature for ${name}`);
    }

    const lfFlags = zipBuffer.readUInt16LE(localOffset + 6);
    const lfMethod = zipBuffer.readUInt16LE(localOffset + 8);
    const lfCrc = zipBuffer.readUInt32LE(localOffset + 14);
    const lfCompSize = zipBuffer.readUInt32LE(localOffset + 18);
    const lfUncompSize = zipBuffer.readUInt32LE(localOffset + 22);
    const lfNameLen = zipBuffer.readUInt16LE(localOffset + 26);
    const lfExtraLen = zipBuffer.readUInt16LE(localOffset + 28);

    const dataStart = localOffset + 30 + lfNameLen + lfExtraLen;
    if (dataStart + compSize > cdOffset) {
      throw new Error(`Invalid ZIP archive: entry data out of bounds for ${name}`);
    }

    const lfName = zipBuffer.toString("utf8", localOffset + 30, localOffset + 30 + lfNameLen);
    if (
      lfName !== name ||
      lfFlags !== flags ||
      lfMethod !== method ||
      lfCrc !== crc ||
      lfCompSize !== compSize ||
      lfUncompSize !== uncompSize
    ) {
      throw new Error(`Invalid ZIP archive: local/central header mismatch for ${name}`);
    }

    const compressedSlice = zipBuffer.subarray(dataStart, dataStart + compSize);
    let uncompressed: Buffer;
    if (method === METHOD_STORE) {
      if (compSize !== uncompSize) {
        throw new Error(`Invalid ZIP archive: stored size mismatch for ${name}`);
      }
      uncompressed = Buffer.from(compressedSlice);
    } else if (method === METHOD_DEFLATE) {
      uncompressed = inflateRawSync(compressedSlice);
    } else {
      throw new Error(`Invalid ZIP archive: unsupported compression method ${method} for ${name}`);
    }

    if (uncompressed.length !== uncompSize) {
      throw new Error(
        `Invalid ZIP archive: decompressed length mismatch for ${name} (expected ${uncompSize}, got ${uncompressed.length})`,
      );
    }

    const actualCrc = crc32(uncompressed);
    if (actualCrc !== crc) {
      throw new Error(
        `Invalid ZIP archive: CRC32 mismatch for ${name} (expected 0x${crc.toString(16)}, got 0x${actualCrc.toString(16)})`,
      );
    }

    contents.set(name, uncompressed);
  }

  if (cursor !== cdOffset + cdSize) {
    throw new Error("Invalid ZIP archive: central directory size mismatch");
  }

  return contents;
}

export interface PackagePluginResult {
  extPath: string;
  entries: string[];
}

export function packagePlugin(options?: {
  distDir?: string;
  pluginDir?: string;
}): PackagePluginResult {
  const root = packageRoot();
  const pluginDir = options?.pluginDir ?? pluginRoot();
  const distDir = options?.distDir ?? join(root, "dist");
  const legacyZipPath = join(distDir, "aseprite-mcp-bridge.zip");
  const extPath = join(distDir, "aseprite-mcp-bridge.aseprite-extension");

  if (!existsSync(pluginDir)) {
    throw new Error(`Plugin source directory not found: ${pluginDir}`);
  }

  mkdirSync(distDir, { recursive: true });
  rmSync(legacyZipPath, { force: true });
  rmSync(extPath, { force: true });

  const sourceEntries = collectSourceEntries(pluginDir);
  const zipBuffer = buildZipBuffer(sourceEntries);
  writeFileSync(extPath, zipBuffer);

  const written = readFileSync(extPath);
  const verified = verifyZipArchive(written);
  const entries = [...verified.keys()];

  const missing = REQUIRED_ARCHIVE_ENTRIES.filter((name) => !verified.has(name));
  if (missing.length > 0) {
    throw new Error(
      `Archive verification failed: missing ${missing.join(", ")}. Got:\n${entries.join("\n")}`,
    );
  }

  for (const src of sourceEntries) {
    const archived = verified.get(src.archivePath);
    if (!archived) {
      throw new Error(`Archive verification failed: missing entry ${src.archivePath}`);
    }
    if (!src.isDirectory) {
      const original = readFileSync(src.fullPath);
      if (!archived.equals(original)) {
        throw new Error(`Archive verification failed: content mismatch for ${src.archivePath}`);
      }
    }
  }

  return { extPath, entries };
}

export function runPackagePluginCli(): void {
  try {
    const { extPath, entries } = packagePlugin();
    console.log(`Packaged extension: ${extPath}`);
    console.log(`Contents:\n${entries.map((e) => `  - ${e}`).join("\n")}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
