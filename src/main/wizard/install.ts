import { spawn, execSync } from "child_process";
import { getDb } from "../store/db";

const INSTALL_COMMANDS: Record<string, [string, string[]]> = {
  gemini: ["npm", ["install", "-g", "@google/gemini-cli"]],
  opencode: ["npm", ["install", "-g", "opencode"]],
};

function canSpawnNpm(): { ok: boolean; error?: string } {
  try {
    execSync("npm --version", { stdio: "pipe", timeout: 5000 });
    return { ok: true };
  } catch {
    return { ok: false, error: "npm not found in PATH. Install Node.js from https://nodejs.org" };
  }
}

function getProxyEnv(): Record<string, string> {
  try {
    const db = getDb();
    const http = db.prepare("SELECT value FROM settings WHERE key = ?").get("proxy_http") as any;
    const https = db.prepare("SELECT value FROM settings WHERE key = ?").get("proxy_https") as any;
    const no = db.prepare("SELECT value FROM settings WHERE key = ?").get("proxy_no") as any;
    const env: Record<string, string> = {};
    if (http?.value) { env.HTTP_PROXY = http.value; env.http_proxy = http.value; }
    if (https?.value) { env.HTTPS_PROXY = https.value; env.https_proxy = https.value; }
    if (no?.value) { env.NO_PROXY = no.value; env.no_proxy = no.value; }
    return env;
  } catch {
    return {};
  }
}

export function installBackend(
  id: string,
  onData: (line: string) => void,
): Promise<{ success: boolean; error?: string }> {
  const cmd = INSTALL_COMMANDS[id];
  if (!cmd)
    return Promise.resolve({ success: false, error: `Unknown backend: ${id}` });

  const check = canSpawnNpm();
  if (!check.ok) return Promise.resolve({ success: false, error: check.error });

  const [binary, args] = cmd;
  const isWin = process.platform === "win32";

  return new Promise((resolve) => {
    const p = spawn(binary, args, {
      stdio: "pipe",
      shell: isWin,
      env: { ...process.env, ...getProxyEnv() },
    });
    let stderrOutput = "";
    p.stdout!.on("data", (buf: Buffer) =>
      buf.toString().split("\n").filter(Boolean).forEach(onData),
    );
    p.stderr!.on("data", (buf: Buffer) => {
      const text = buf.toString();
      stderrOutput += text;
      text.split("\n").filter(Boolean).forEach(onData);
    });
    p.on("close", (code) => {
      if (code === 0) return resolve({ success: true });
      const isPermissionError =
        /EACCES|EPERM|access denied|permission denied/i.test(stderrOutput);
      resolve({
        success: false,
        error: isPermissionError
          ? isWin
            ? `Permission denied. Run "${binary} ${args.join(" ")}" in a terminal opened as Administrator.`
            : `Permission denied. Try: sudo ${binary} ${args.join(" ")}`
          : `Install failed with exit code ${code}. See output above.`,
      });
    });
    p.on("error", (err) =>
      resolve({
        success: false,
        error: `Failed to start installer: ${err.message}`,
      }),
    );
  });
}
