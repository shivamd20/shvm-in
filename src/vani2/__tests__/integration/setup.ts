/**
 * Global setup for Vani 2 integration tests.
 * If VANI2_INTEGRATION_BASE_URL is set, uses that (assume server already running).
 * Otherwise spawns `wrangler dev` and waits for readiness.
 */
import { spawn } from "node:child_process";
import { once } from "node:events";

const DEFAULT_PORT = 8787;
const BASE_URL = `http://localhost:${DEFAULT_PORT}`;
const READY_TIMEOUT_MS = 20_000;

export default async function globalSetup(): Promise<() => Promise<void>> {
  const existing = process.env.VANI2_INTEGRATION_BASE_URL;
  if (existing) {
    process.env.VANI2_INTEGRATION_BASE_URL = existing;
    return async () => {};
  }

  const child = spawn("npx", ["wrangler", "dev", "--port", String(DEFAULT_PORT)], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  const ready = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`wrangler dev did not become ready within ${READY_TIMEOUT_MS}ms`));
    }, READY_TIMEOUT_MS);

    const onData = (data: Buffer) => {
      const s = data.toString();
      if (/Ready on|localhost:8787|Listening on/.test(s)) {
        clearTimeout(timeout);
        resolve();
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    child.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        clearTimeout(timeout);
        reject(new Error(`wrangler dev exited with code ${code}`));
      }
    });
  });

  try {
    await ready;
    // Extra moment for DO to be routable
    await new Promise((r) => setTimeout(r, 500));
  } catch (e) {
    child.kill("SIGTERM");
    throw e;
  }

  process.env.VANI2_INTEGRATION_BASE_URL = BASE_URL;

  return async () => {
    child.kill("SIGTERM");
    await once(child, "exit").catch(() => {});
  };
}
