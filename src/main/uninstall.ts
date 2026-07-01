import { app, shell } from "electron";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { closeDb } from "./store/db";

export function findWindowsUninstaller(installDir: string): string | null {
  let entries: string[];
  try {
    entries = fs.readdirSync(installDir);
  } catch {
    return null;
  }
  const match = entries.find((f) => /^uninstall.*\.exe$/i.test(f));
  return match ? `${installDir}\\${match}` : null;
}

export function findMacAppBundle(execPath: string): string | null {
  let dir = execPath;
  while (true) {
    if (dir.toLowerCase().endsWith(".app")) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function wipeAppData(): void {
  closeDb();
  fs.rmSync(app.getPath("userData"), { recursive: true, force: true });
}

export async function performUninstall(): Promise<void> {
  if (!app.isPackaged) {
    throw new Error("Uninstall isn't available in development mode.");
  }

  if (process.platform === "win32") {
    const installDir = path.win32.dirname(process.execPath);
    const uninstallerPath = findWindowsUninstaller(installDir);
    if (!uninstallerPath) {
      throw new Error("Could not find the Windows uninstaller.");
    }
    wipeAppData();
    spawn(uninstallerPath, [], { detached: true, stdio: "ignore" });
    app.exit(0);
    return;
  }

  if (process.platform === "darwin") {
    const bundlePath = findMacAppBundle(process.execPath);
    if (!bundlePath) {
      throw new Error("Could not locate the app bundle.");
    }
    wipeAppData();
    await shell.trashItem(bundlePath);
    app.exit(0);
    return;
  }

  throw new Error("Uninstall is not supported on this platform.");
}
