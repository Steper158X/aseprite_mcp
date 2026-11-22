import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

export async function readFileBytes(path: string): Promise<Uint8Array> {
  const buf = await readFile(path);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

export function readFileBytesSync(path: string): Uint8Array {
  const buf = readFileSync(path);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

export async function readJsonFile<T>(path: string): Promise<T> {
  const text = await readFile(path, "utf8");
  return JSON.parse(text) as T;
}
