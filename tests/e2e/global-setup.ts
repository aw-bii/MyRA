import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

const PROJECT_ROOT = path.join(__dirname, "..", "..");

function getElectronPath(): string {
  const pathTxt = path.join(PROJECT_ROOT, "node_modules", "electron", "path.txt");
  const exeName = fs.readFileSync(pathTxt, "utf8").trim();
  return path.join(PROJECT_ROOT, "node_modules", "electron", "dist", exeName);
}

async function waitForCDP(
  url: string,
  child: ReturnType<typeof spawn>,
  retries = 40,
  delayMs = 500,
): Promise<void> {
  for (let i = 0; i < retries; i++) {
    if (child.exitCode !== null) {
      throw new Error(
        `Electron process exited before CDP became ready (exit code: ${child.exitCode})`,
      );
    }
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`CDP endpoint ${url} did not become ready after ${retries * delayMs}ms`);
}

export default async function globalSetup() {
  // Clean up specific files from a previous E2E run so the wizard always shows:
  // - conversations.db: SQLite state
  // - Local Storage: contains wizardDone flag set by app
  // We do NOT delete the entire directory since Electron writes DevToolsActivePort
  // to it during startup.
  const e2eDataDir = path.join(os.tmpdir(), "bii-e2e-test");
  const dbPath = path.join(e2eDataDir, "conversations.db");
  const dbShm = path.join(e2eDataDir, "conversations.db-shm");
  const dbWal = path.join(e2eDataDir, "conversations.db-wal");
  const localStorageDir = path.join(e2eDataDir, "Local Storage");
  const sessionStorageDir = path.join(e2eDataDir, "Session Storage");
  for (const p of [dbPath, dbShm, dbWal]) {
    if (fs.existsSync(p)) fs.rmSync(p);
  }
  for (const d of [localStorageDir, sessionStorageDir]) {
    if (fs.existsSync(d)) fs.rmSync(d, { recursive: true });
  }

  const electronExe = getElectronPath();
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  env.E2E_TEST = "1";

  const child = spawn(electronExe, ["."], {
    env,
    stdio: ["pipe", "ignore", "pipe"],
    cwd: PROJECT_ROOT,
    detached: false,
  });

  // Store the PID so global teardown can kill it
  process.env._E2E_ELECTRON_PID = String(child.pid);

  child.stderr?.on("data", (d) => process.stderr.write("[electron-setup] " + d));

  await waitForCDP("http://localhost:9222/json/version", child);
  process.stderr.write("[global-setup] Electron CDP ready\n");
}
