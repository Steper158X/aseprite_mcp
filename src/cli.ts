import { Bridge } from "./bridge.ts";
import { getBridgePort } from "./protocol.ts";

function printUsage(): void {
  console.error("Usage: bun run src/cli.ts [--wait <seconds>] <method> ['<json-params>']");
}

function parseArgs(argv: string[]): {
  waitSec: number;
  method: string | undefined;
  rawParams: string | undefined;
} {
  let waitSec = 10;
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--wait" || arg === "-w") {
      const next = argv[i + 1];
      const parsed = next !== undefined ? Number(next) : NaN;
      if (!Number.isFinite(parsed) || parsed <= 0) {
        console.error("--wait requires a positive number of seconds");
        process.exit(2);
      }
      waitSec = parsed;
      i++;
      continue;
    }
    if (arg.startsWith("--wait=")) {
      const parsed = Number(arg.slice("--wait=".length));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        console.error("--wait requires a positive number of seconds");
        process.exit(2);
      }
      waitSec = parsed;
      continue;
    }
    positional.push(arg);
  }

  return {
    waitSec,
    method: positional[0],
    rawParams: positional[1],
  };
}

async function main(): Promise<void> {
  const { waitSec, method, rawParams } = parseArgs(process.argv.slice(2));
  if (!method) {
    printUsage();
    process.exit(2);
  }

  let params: Record<string, unknown> = {};
  if (rawParams) {
    try {
      const parsed = JSON.parse(rawParams) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Params JSON must be an object");
      }
      params = parsed as Record<string, unknown>;
    } catch (err) {
      console.error(
        `Invalid JSON params: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(2);
    }
  }

  const port = getBridgePort();
  const bridge = new Bridge();
  await bridge.start(port);

  if (bridge.portConflict) {
    console.error(JSON.stringify({ ok: false, error: bridge.portConflict }, null, 2));
    bridge.stop();
    process.exit(1);
  }

  try {
    await bridge.waitForConnection(Math.round(waitSec * 1000));
    const result = await bridge.call(method, params, 15000);
    console.log(JSON.stringify({ ok: true, result }, null, 2));
  } catch (err) {
    console.error(
      JSON.stringify(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } finally {
    bridge.stop();
  }
}

await main();
