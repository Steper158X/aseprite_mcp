import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Pull `"path" "..."` values out of a Steam libraryfolders.vdf file. */
export function parseLibraryFoldersVdf(text: string): string[] {
  const paths: string[] = [];
  const re = /"path"\s+"((?:\\.|[^"\\])*)"/g;
  for (const match of text.matchAll(re)) {
    const raw = match[1] ?? "";
    const unescaped = raw.replace(/\\\\/g, "\\").replace(/\\"/g, '"');
    if (unescaped.trim()) paths.push(unescaped);
  }
  return paths;
}

function steamRoots(): string[] {
  if (process.platform === "win32") {
    const roots = [
      process.env["ProgramFiles(x86)"],
      process.env.ProgramFiles,
      join(homedir(), "Steam"),
    ];
    return roots.filter((value): value is string => Boolean(value)).map((root) => join(root, "Steam"));
  }
  if (process.platform === "darwin") {
    return [join(homedir(), "Library", "Application Support", "Steam")];
  }
  return [join(homedir(), ".steam", "steam"), join(homedir(), ".local", "share", "Steam")];
}

function asepriteExecutableNames(): string[] {
  return process.platform === "win32" ? ["Aseprite.exe", "aseprite.exe"] : ["aseprite"];
}

/** Candidate Aseprite binaries discovered from Steam's libraryfolders.vdf. */
export function steamAsepriteCandidates(): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const root of steamRoots()) {
    const vdfPath = join(root, "steamapps", "libraryfolders.vdf");
    let libraries: string[] = [];
    if (existsSync(vdfPath)) {
      try {
        libraries = parseLibraryFoldersVdf(readFileSync(vdfPath, "utf8"));
      } catch {
        libraries = [];
      }
    }
    if (!libraries.includes(root)) libraries.push(root);
    for (const library of libraries) {
      for (const name of asepriteExecutableNames()) {
        const candidate = join(library, "steamapps", "common", "Aseprite", name);
        if (seen.has(candidate)) continue;
        seen.add(candidate);
        found.push(candidate);
      }
    }
  }
  return found;
}
