import { spawn, execSync } from "child_process";
import { getDb } from "../store/db";

type InstallCommand =
  | { type: "npm"; pkg: string }
  | { type: "curl"; url: string; shell: "sh" | "pwsh" };

const INSTALL_COMMANDS: Record<
  string,
  InstallCommand | ((platform: string) => InstallCommand)
> = {
  claude: { type: "curl", url: "https://claude.ai/install.sh", shell: "sh" },
  gemini: { type: "npm", pkg: "@google/gemini-cli" },
  opencode: { type: "curl", url: "https://opencode.ai/install", shell: "sh" },
  ollama: (platform: string) =>
    platform === "win32"
      ? { type: "curl", url: "https://ollama.com/install.ps1", shell: "pwsh" }
      : { type: "curl", url: "https://ollama.com/install.sh", shell: "sh" },
  codex: {
    type: "curl",
    url: "https://chatgpt.com/codex/install.sh",
    shell: "sh",
  },
};

function getProxyEnv(): Record<string, string> {
  try {
    const db = getDb();
    const http = db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get("proxy_http") as any;
    const https = db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get("proxy_https") as any;
    const no = db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get("proxy_no") as any;
    const env: Record<string, string> = {};
    if (http?.value) {
      env.HTTP_PROXY = http.value;
      env.http_proxy = http.value;
    }
    if (https?.value) {
      env.HTTPS_PROXY = https.value;
      env.https_proxy = https.value;
    }
    if (no?.value) {
      env.NO_PROXY = no.value;
      env.no_proxy = no.value;
    }
    return env;
  } catch {
    return {};
  }
}

function getInstallCommand(id: string): string {
  const cmdDef = INSTALL_COMMANDS[id];
  if (!cmdDef) return "";
  const cmd = typeof cmdDef === "function" ? cmdDef(process.platform) : cmdDef;
  if (cmd.type === "npm") {
    return `npm install -g ${cmd.pkg}`;
  }
  if (cmd.shell === "pwsh") {
    return `irm ${cmd.url} | iex`;
  }
  return `curl -fsSL ${cmd.url} | sh`;
}

export function installBackend(
  id: string,
  onData: (line: string) => void,
): Promise<{
  success: boolean;
  error?: string;
  available?: boolean;
  authenticated?: boolean;
}> {
  const cmdDef = INSTALL_COMMANDS[id];
  if (!cmdDef) {
    return Promise.resolve({ success: false, error: `Unknown backend: ${id}` });
  }

  const cmd = typeof cmdDef === "function" ? cmdDef(process.platform) : cmdDef;
  const isWin = process.platform === "win32";
  const env = { ...process.env, ...getProxyEnv() };

  let binary: string;
  let args: string[];

  if (cmd.type === "npm") {
    try {
      execSync("npm --version", { stdio: "pipe", timeout: 5000 });
    } catch {
      return Promise.resolve({
        success: false,
        error: "npm not found in PATH. Install Node.js from https://nodejs.org",
      });
    }
    binary = "npm";
    args = ["install", "-g", cmd.pkg];
  } else {
    if (cmd.shell === "pwsh") {
      binary = "powershell.exe";
      args = ["-Command", `irm ${cmd.url} | iex`];
    } else if (isWin) {
      // Windows has no `sh`; use PowerShell to download + run the shell script via WSL/Git Bash if available,
      // otherwise show a manual install hint.
      binary = "powershell.exe";
      args = [
        "-Command",
        `$tmp = [System.IO.Path]::GetTempFileName() + '.sh'; ` +
          `Invoke-WebRequest -Uri '${cmd.url}' -OutFile $tmp; ` +
          `if (Get-Command bash -ErrorAction SilentlyContinue) { bash $tmp } ` +
          `else { Write-Error 'bash not found. Install Git for Windows or WSL, then re-run.' }; ` +
          `Remove-Item $tmp -Force`,
      ];
    } else {
      binary = "sh";
      args = ["-c", `curl -fsSL ${cmd.url} | sh`];
    }
  }

  const installCommandHint = getInstallCommand(id);

  return new Promise((resolve) => {
    const p = spawn(binary, args, {
      stdio: "pipe",
      shell: cmd.type === "npm" && isWin,
      env,
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
            ? `Permission denied. Run this command in a terminal opened as Administrator:\n${installCommandHint}`
            : `Permission denied. Try running this command with sudo:\n${installCommandHint}`
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
