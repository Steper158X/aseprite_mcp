import { spawn } from "node:child_process";
import { platform } from "node:os";

export interface SpawnResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export function spawnCapture(
  command: string,
  args: string[],
  options?: { timeoutMs?: number },
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const timeoutMs = options?.timeoutMs;
    const timer =
      timeoutMs !== undefined
        ? setTimeout(() => {
            timedOut = true;
            try {
              child.kill();
            } catch {}
          }, timeoutMs)
        : null;

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (timedOut) {
        reject(
          new Error(
            `Command "${command}" timed out after ${timeoutMs}ms` +
              (stderr ? `: ${stderr.trim()}` : ""),
          ),
        );
        return;
      }
      resolve({ exitCode: code, stdout, stderr });
    });
  });
}

export function openUrlInBrowser(url: string): void {
  try {
    const os = platform();
    const child =
      os === "win32"
        ? spawn("cmd", ["/c", "start", "", url], {
            stdio: "ignore",
            detached: true,
            windowsHide: true,
          })
        : os === "darwin"
          ? spawn("open", [url], { stdio: "ignore", detached: true })
          : spawn("xdg-open", [url], { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
  } catch {}
}
