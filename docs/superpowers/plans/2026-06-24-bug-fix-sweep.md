# Bug Fix Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) for syntax tracking.

**Goal:** Fix 9 regression/fresh-install bugs in MyRA — IPC wiring, wizard probe/install, internet access, button handlers, persona editing, animations, and Windows layout.

**Architecture:** Most bugs stem from silent IPC failures (no error handling in renderer IPC calls) and `sandbox: true` in Electron config blocking preload. Fix the foundation first, then sweep feature-specific issues. Layout/animation bugs are independent and can be done in parallel.

**Tech Stack:** Electron 33, React 18, TypeScript 5, Tailwind 3, electron-vite 5

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/main/index.ts:62-67` | BrowserWindow webPreferences (sandbox, preload path) |
| `src/main/index.ts:95-121` | CSP headers (connect-src blocks API calls) |
| `src/renderer/ipc.ts` | Renderer-side IPC wrapper — all calls need try/catch |
| `src/renderer/App.tsx` | Root layout, handleNew, diagnostic banner, mutual exclusion |
| `src/renderer/components/Wizard/WizardStep1.tsx` | Backend probe UI + timeout |
| `src/renderer/components/Wizard/WizardStep2.tsx` | Install UI + skip + error UX |
| `src/main/wizard/probe.ts` | Probe logic (add timeout) |
| `src/main/wizard/install.ts` | Install logic (shell:true on Windows) |
| `src/shared/ipc.ts` | Add CONV_CREATE constant |
| `src/main/ipc.ts` | Add conv:create handler |
| `src/renderer/ipc.ts` | Add createConversation export |
| `src/renderer/components/Settings/SettingsPanel.tsx` | Network/proxy settings UI |
| `src/renderer/index.css` | DPI media query, animation CSS |
| `tailwind.config.ts` | New keyframes for slide-in/out |

---

### Task 1: Diagnose & Fix IPC Foundation

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/renderer/ipc.ts`
- Create: `src/renderer/components/DiagnosticBanner.tsx`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Remove `sandbox: true` from BrowserWindow**

The preload needs `contextBridge.exposeInMainWorld` to work. While `sandbox: true` allows this in Electron 33, it restricts preload capabilities unnecessarily and can cause subtle failures when combined with `electron-vite`'s module resolution. Switch to `sandbox: false` which is the standard for Electron apps using `contextBridge`.

In `src/main/index.ts:62-67`, change:

```ts
webPreferences: {
  preload: path.join(__dirname, "../preload/index.js"),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
},
```

to:

```ts
webPreferences: {
  preload: path.join(__dirname, "../preload/index.js"),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false,
},
```

- [ ] **Step 2: Fix CSP to allow outbound HTTPS connections**

The current CSP `connect-src 'self'` blocks all HTTPS requests from the renderer. API backends (OpenAI, OpenRouter, etc.) make requests from the main process via `BaseHttpAdapter`, so this doesn't affect them. But wider `connect-src` is needed for future features and to avoid confusing blocks.

In `src/main/index.ts:103-114`, change the CSP to allow HTTPS connections:

```ts
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  `connect-src ${connectSrc} https: wss:`,
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");
```

- [ ] **Step 3: Wrap all renderer IPC calls in try/catch with error state**

In `src/renderer/ipc.ts`, add a wrapper function that catches IPC errors and sets a global error flag:

```ts
export let lastIpcError: Error | null = null;
export function clearIpcError() { lastIpcError = null; }

function ipcInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return window.ipc.invoke(channel, ...args).catch((err: Error) => {
    lastIpcError = err;
    console.error(`IPC ${channel} failed:`, err);
    throw err;
  }) as Promise<T>;
}
```

Then replace every `window.ipc.invoke(...)` call through the file with `ipcInvoke(...)`. For example:

```ts
// Before
export async function listConversations(limit = 50, offset = 0): Promise<Conversation[]> {
  return window.ipc.invoke(IPC.CONV_LIST, { limit, offset }) as Promise<Conversation[]>;
}

// After
export async function listConversations(limit = 50, offset = 0): Promise<Conversation[]> {
  return ipcInvoke<Conversation[]>(IPC.CONV_LIST, { limit, offset });
}
```

Do this for ALL exported functions in `src/renderer/ipc.ts`.

- [ ] **Step 4: Add DiagnosticBanner component**

Create `src/renderer/components/DiagnosticBanner.tsx`:

```tsx
import { useState, useEffect } from "react";
import { lastIpcError, clearIpcError } from "../ipc";

export function DiagnosticBanner() {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const e = lastIpcError;
      if (e && e !== error) {
        setError(e);
        clearIpcError();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [error]);

  if (!error) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-100 dark:bg-yellow-900 border-b border-yellow-300 dark:border-yellow-700 px-4 py-2 text-sm text-yellow-900 dark:text-yellow-100 flex items-center gap-2">
      <span className="font-medium">⚠ IPC Error:</span>
      <span className="truncate">{error.message}</span>
      <button
        onClick={() => setError(null)}
        className="ml-auto text-xs px-2 py-0.5 rounded bg-yellow-200 dark:bg-yellow-800 hoverable:hover:bg-yellow-300 dark:hoverable:hover:bg-yellow-700"
      >
        Dismiss
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Mount DiagnosticBanner in App.tsx**

In `src/renderer/App.tsx`, import and add the banner at the top of the root div:

```tsx
import { DiagnosticBanner } from "./components/DiagnosticBanner";

// In the JSX, as first child of the root div:
<div className="flex min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
  <DiagnosticBanner />
  <Sidebar ... />
  ...
</div>
```

Also replace `min-h-[100dvh]` with `min-h-screen` here (part of Windows layout fix):

```diff
- <div className="flex min-h-[100dvh] bg-white dark:bg-gray-950 ...">
+ <div className="flex min-h-screen bg-white dark:bg-gray-950 ...">
```

- [ ] **Step 6: Build and test**

Run: `npm run build`

If build fails, fix any TypeScript errors. Then run: `npm run dev`

Expected: The app loads. If IPC is broken, a yellow banner appears at the top showing the error. If IPC works, no banner.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "fix: diagnose IPC failures — sandbox:false, CSP connect-src, error boundaries"
```

---

### Task 2: Fix Wizard Probe (Timeout + Error Handling)

**Files:**
- Modify: `src/main/wizard/probe.ts`
- Modify: `src/renderer/components/Wizard/WizardStep1.tsx`

- [ ] **Step 1: Add timeout to probeBackend**

In `src/main/wizard/probe.ts`:

```ts
import { AdapterManager } from "../adapters/manager";

export async function probeBackend(
  id: string,
  timeoutMs = 10_000,
): Promise<{ available: boolean; authenticated: boolean }> {
  const adapter = AdapterManager.get(id);
  if (!adapter) return { available: false, authenticated: false };

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Probe timed out for ${id}`)), timeoutMs),
  );

  try {
    const [available, authenticated] = await Promise.race([
      Promise.all([adapter.isAvailable(), adapter.checkAuth()]),
      timeout,
    ]);
    return { available, authenticated };
  } catch {
    return { available: false, authenticated: false };
  }
}
```

- [ ] **Step 2: Update WizardStep1 to handle probe errors**

In `src/renderer/components/Wizard/WizardStep1.tsx`, add error state tracking:

```tsx
const [errors, setErrors] = useState<Record<string, string>>({});

useEffect(() => {
  BACKENDS.filter((b) => !b.bundled).forEach(async (b) => {
    try {
      const result = await probeBackend(b.id);
      setStatuses((prev) =>
        prev.map((s) =>
          s.id === b.id ? { ...s, ...result, loading: false } : s,
        ),
      );
    } catch (err) {
      setStatuses((prev) =>
        prev.map((s) =>
          s.id === b.id ? { ...s, available: false, authenticated: false, loading: false } : s,
        ),
      );
      setErrors((prev) => ({ ...prev, [b.id]: `Probe failed: ${(err as Error).message}` }));
    }
  });
}, []);
```

Add error message display below each backend row in the JSX:

```tsx
{errors[b.id] && (
  <p className="text-xs text-red-500">{errors[b.id]}</p>
)}
```

- [ ] **Step 3: Build and test**

Run: `npm run build`. If it passes, open the app and verify the wizard step 1 shows backend detection with loading → success/failure states.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: wizard probe timeout and error handling"
```

---

### Task 3: Fix Wizard Install (Windows shell + skip option)

**Files:**
- Modify: `src/main/wizard/install.ts`
- Modify: `src/renderer/components/Wizard/WizardStep2.tsx`

- [ ] **Step 1: Add shell:true on Windows and npm detection**

In `src/main/wizard/install.ts`:

```ts
import { spawn, execSync } from "child_process";

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
      env: { ...process.env },
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
```

- [ ] **Step 2: Add skip button to WizardStep2**

In `src/renderer/components/Wizard/WizardStep2.tsx`, add a "Skip" button next to each install action, and a message that they can install later from Settings:

```tsx
<div className="flex items-center justify-between">
  <span className="font-medium text-sm">{LABELS[id] ?? id}</span>
  <div className="flex gap-2">
    <button
      onClick={() => install(id)}
      disabled={installing[id] || done[id]}
      className="btn-sm bg-blue-600 text-white hoverable:hover:bg-blue-700 disabled:opacity-50"
    >
      {done[id] ? "Installed" : installing[id] ? "Installing..." : "Install"}
    </button>
    <button
      onClick={() => setDone((prev) => ({ ...prev, [id]: true }))}
      disabled={done[id]}
      className="btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800 disabled:opacity-30"
    >
      Skip
    </button>
  </div>
</div>
```

- [ ] **Step 3: Build and test**

Run: `npm run build`. Verify the wizard step 2 shows install buttons and skip buttons.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: wizard install — shell:true on Windows, skip option"
```

---

### Task 4: Add Connectivity Check + Proxy Support

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/renderer/components/Settings/SettingsPanel.tsx`
- Modify: `src/main/ipc.ts`
- Modify: `src/renderer/ipc.ts`
- Modify: `src/shared/ipc.ts`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Add `UPDATE_AVAILABLE` constant to shared IPC**

In `src/shared/ipc.ts`, add to the `IPC` object:

```ts
NET_CHECK: "net:check",
NET_SET_PROXY: "net:set-proxy",
NET_GET_PROXY: "net:get-proxy",
```

And add to `IpcInvokeMap`:

```ts
[IPC.NET_CHECK]: void;
[IPC.NET_SET_PROXY]: { httpProxy: string; httpsProxy: string; noProxy: string };
[IPC.NET_GET_PROXY]: void;
```

And add to `IpcReturnMap`:

```ts
[IPC.NET_CHECK]: { online: boolean };
[IPC.NET_GET_PROXY]: { httpProxy: string; httpsProxy: string; noProxy: string };
```

- [ ] **Step 2: Add network IPC handlers in main process**

In `src/main/ipc.ts`, add:

```ts
import https from "https";

// In registerIpcHandlers:

ipcMain.handle(IPC.NET_CHECK, async () => {
  try {
    await new Promise<void>((resolve, reject) => {
      const req = https.get("https://registry.npmjs.org", { timeout: 5000 }, (res) => {
        resolve();
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    });
    return { online: true };
  } catch {
    return { online: false };
  }
});

ipcMain.handle(IPC.NET_GET_PROXY, () => {
  return {
    httpProxy: process.env.HTTP_PROXY || process.env.http_proxy || "",
    httpsProxy: process.env.HTTPS_PROXY || process.env.https_proxy || "",
    noProxy: process.env.NO_PROXY || process.env.no_proxy || "",
  };
});

ipcMain.handle(IPC.NET_SET_PROXY, (_event, { httpProxy, httpsProxy, noProxy }) => {
  ConvStore.setSetting("proxy_http", httpProxy || "");
  ConvStore.setSetting("proxy_https", httpsProxy || "");
  ConvStore.setSetting("proxy_no", noProxy || "");
});
```

- [ ] **Step 3: Add renderer-side network functions**

In `src/renderer/ipc.ts`:

```ts
export async function checkConnectivity(): Promise<{ online: boolean }> {
  return ipcInvoke<{ online: boolean }>(IPC.NET_CHECK);
}
export async function getProxySettings(): Promise<{ httpProxy: string; httpsProxy: string; noProxy: string }> {
  return ipcInvoke(IPC.NET_GET_PROXY) as Promise<any>;
}
export async function setProxySettings(settings: { httpProxy: string; httpsProxy: string; noProxy: string }): Promise<void> {
  await ipcInvoke(IPC.NET_SET_PROXY, settings);
}
```

- [ ] **Step 4: Add connectivity check on app start**

In `src/renderer/App.tsx`, add a state and effect for connectivity:

```tsx
const [online, setOnline] = useState(true);

useEffect(() => {
  checkConnectivity().then((r) => setOnline(r.online)).catch(() => setOnline(false));
}, []);
```

Add a banner when offline, somewhere near the toolbar:

```tsx
{!online && (
  <div className="px-4 py-1 bg-yellow-100 dark:bg-yellow-900 text-xs text-yellow-800 dark:text-yellow-200 border-b border-yellow-200 dark:border-yellow-700">
    No internet connection. Some features require internet access.
  </div>
)}
```

- [ ] **Step 5: Add proxy settings to Settings panel**

In `src/renderer/components/Settings/SettingsPanel.tsx`, add a "Network" section:

```tsx
import { checkConnectivity, getProxySettings, setProxySettings } from "../../ipc";

// Inside component:
const [proxyHttp, setProxyHttp] = useState("");
const [proxyHttps, setProxyHttps] = useState("");
const [proxyNo, setProxyNo] = useState("");

useEffect(() => {
  getProxySettings().then((p) => {
    setProxyHttp(p.httpProxy);
    setProxyHttps(p.httpsProxy);
    setProxyNo(p.noProxy);
  }).catch(() => {});
}, []);

const saveProxy = async () => {
  await setProxySettings({ httpProxy: proxyHttp, httpsProxy: proxyHttps, noProxy: proxyNo });
};
```

Add JSX (insert after the API Keys section, before the re-run wizard section):

```tsx
<div className="border-t border-gray-200 dark:border-gray-700 pt-4">
  <h4 className="text-sm font-semibold mb-2">Network Proxy</h4>
  <div className="flex flex-col gap-2">
    <input className="text-sm border rounded-lg px-2 py-1.5 dark:bg-gray-800 dark:border-gray-600" placeholder="HTTP_PROXY" value={proxyHttp} onChange={(e) => setProxyHttp(e.target.value)} />
    <input className="text-sm border rounded-lg px-2 py-1.5 dark:bg-gray-800 dark:border-gray-600" placeholder="HTTPS_PROXY" value={proxyHttps} onChange={(e) => setProxyHttps(e.target.value)} />
    <input className="text-sm border rounded-lg px-2 py-1.5 dark:bg-gray-800 dark:border-gray-600" placeholder="NO_PROXY" value={proxyNo} onChange={(e) => setProxyNo(e.target.value)} />
    <button onClick={saveProxy} className="btn-md bg-blue-600 text-white hoverable:hover:bg-blue-700">Save Proxy</button>
  </div>
</div>
```

- [ ] **Step 6: Inject proxy env into spawned processes**

In `src/main/wizard/install.ts`, before `spawn`, read proxy settings from DB and inject into env:

```ts
import { getDb } from "../store/db";

function getProxyEnv(): Record<string, string> {
  const db = getDb();
  const http = db.prepare("SELECT value FROM settings WHERE key = ?").get("proxy_http") as any;
  const https = db.prepare("SELECT value FROM settings WHERE key = ?").get("proxy_https") as any;
  const no = db.prepare("SELECT value FROM settings WHERE key = ?").get("proxy_no") as any;
  const env: Record<string, string> = {};
  if (http?.value) { env.HTTP_PROXY = http.value; env.http_proxy = http.value; }
  if (https?.value) { env.HTTPS_PROXY = https.value; env.https_proxy = https.value; }
  if (no?.value) { env.NO_PROXY = no.value; env.no_proxy = no.value; }
  return env;
}

// In the spawn call:
const p = spawn(binary, args, {
  stdio: "pipe",
  shell: isWin,
  env: { ...process.env, ...getProxyEnv() },
});
```

- [ ] **Step 7: Build and test**

Run: `npm run build`. Verify connectivity banner appears/disappears. Verify proxy settings save and load.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: connectivity check, proxy settings, env forwarding"
```

---

### Task 5: Wire New Chat / Pipeline Buttons

**Files:**
- Modify: `src/shared/ipc.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/renderer/ipc.ts`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Add `CONV_CREATE` IPC constant**

In `src/shared/ipc.ts`, add to the IPC object:

```ts
CONV_CREATE: "conv:create",
```

And to `IpcInvokeMap`:

```ts
[IPC.CONV_CREATE]: { title: string; backend: string; personaId?: string };
```

- [ ] **Step 2: Add conv:create main process handler**

In `src/main/ipc.ts`:

```ts
ipcMain.handle(IPC.CONV_CREATE, (_event, { title, backend, personaId }) => {
  return ConvStore.createConversation(title || "New conversation", backend || "claude", personaId || null);
});
```

- [ ] **Step 3: Add renderer-side createConversation**

In `src/renderer/ipc.ts`:

```ts
export async function createConversation(title: string, backend: string, personaId?: string): Promise<Conversation> {
  return ipcInvoke<Conversation>(IPC.CONV_CREATE, { title, backend, personaId });
}
```

- [ ] **Step 4: Change handleNew to create conversation immediately**

In `src/renderer/App.tsx`:

```ts
import { createConversation } from "./ipc";

const handleNew = useCallback(async () => {
  try {
    const conv = await createConversation(
      `Conversation ${new Date().toLocaleDateString()}`,
      backend,
      personaId ?? undefined,
    );
    setActiveConvId(conv.id);
    setActiveConvMeta(conv);
    setRefreshTrigger((n) => n + 1);
  } catch (err) {
    console.error("Failed to create conversation:", err);
  }
}, [backend, personaId]);
```

- [ ] **Step 5: Build and test**

Run: `npm run build`. Click "+ New" in sidebar — a new conversation should appear immediately in the list and open in the chat view.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix: new chat creates conversation immediately"
```

---

### Task 6: Fix Animations — Replace max-width with translateX

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `tailwind.config.ts`
- Modify: `src/renderer/components/Sidebar/Sidebar.tsx`

- [ ] **Step 1: Add slide keyframes to tailwind config**

In `tailwind.config.ts`, add to `keyframes`:

```ts
"slide-in-right": {
  "0%": { transform: "translateX(100%)" },
  "100%": { transform: "translateX(0)" },
},
"slide-out-right": {
  "0%": { transform: "translateX(0)" },
  "100%": { transform: "translateX(100%)" },
},
```

And to `animation`:

```ts
"slide-in-right": "slide-in-right 200ms cubic-bezier(0.32, 0.72, 0, 1) forwards",
"slide-out-right": "slide-out-right 200ms cubic-bezier(0.32, 0.72, 0, 1) forwards",
```

- [ ] **Step 2: Replace right panel slide mechanism**

In `src/renderer/App.tsx`, replace the three right panel divs (Personas, Pipelines, Settings). Currently each uses `transition-[max-width,opacity]`. Replace with a single abstraction.

Create a helper component or inline the pattern. For each panel div, change from:

```tsx
<div className={`overflow-hidden transition-[max-width,opacity] duration-200 ease-press ${
  showPersonas ? "max-w-72 opacity-100 border-l border-gray-200 dark:border-gray-700" : "max-w-0 opacity-0"
}`}>
  <div className="w-72 lg:w-56 overflow-y-auto h-full">
    <PersonaPanel ... />
  </div>
</div>
```

to:

```tsx
<div
  className={`overflow-hidden transition-transform duration-200 ease-drawer ${
    showPersonas ? "translate-x-0" : "translate-x-full"
  } ${showPersonas ? "border-l border-gray-200 dark:border-gray-700" : ""}`}
  style={{ pointerEvents: showPersonas ? "auto" : "none" }}
>
  <div className="w-56 lg:w-64 overflow-y-auto h-full">
    <PersonaPanel ... />
  </div>
</div>
```

Do the same for Pipelines and Settings panels.

- [ ] **Step 3: Fix sidebar collapse animation**

Replace `transition-[width]` on the sidebar with a grid-based approach. In `src/renderer/App.tsx`, wrap the sidebar and main area in a grid:

```tsx
<div className="grid" style={{ gridTemplateColumns: sidebarCollapsed ? "0fr 1fr" : "auto 1fr", transition: "grid-template-columns 200ms cubic-bezier(0.32, 0.72, 0, 1)" }}>
  <Sidebar ... />
  <div className="flex flex-col flex-1 min-w-0 overflow-x-hidden">
    ...
  </div>
</div>
```

Note: `grid-template-columns` transition may not be supported in all Chromium versions. As a fallback, keep the `w-0` / `w-64` approach but add `overflow-hidden` to prevent content overflow during collapse.

- [ ] **Step 4: Add mutual exclusion guard**

In `src/renderer/App.tsx`, ensure only one right panel is open at a time. Replace individual toggles:

```tsx
const togglePanel = (panel: "personas" | "pipelines" | "settings") => {
  setShowPersonas(panel === "personas" ? !showPersonas : false);
  setShowPipelines(panel === "pipelines" ? !showPipelines : false);
  setShowSettings(panel === "settings" ? !showSettings : false);
};
```

Update the toolbar onClick handlers:

```tsx
<button onClick={() => togglePanel("personas")} ...>
<button onClick={() => togglePanel("pipelines")} ...>
<button onClick={() => togglePanel("settings")} ...>
```

Remove `setShowPersonas(false)` and `setShowPipelines(false)` from individual button handlers (the togglePanel function handles mutual exclusion).

- [ ] **Step 5: Build and test**

Run: `npm run build`. Open the app. Toggle persona/pipeline/settings panels — they should slide in from the right smoothly without overlapping. Sidebar collapse/expand should work without layout jumping.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix: replace max-width transitions with translateX, mutual exclusion"
```

---

### Task 7: Fix Windows Layout — Overflow, Scaling, Responsive

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/Sidebar/Sidebar.tsx`
- Modify: `src/renderer/index.css`

- [ ] **Step 1: Remove min-w-[480px] constraint**

In `src/renderer/App.tsx`, find the main content area div and change:

```diff
- <div className="flex flex-col flex-1 min-w-[480px]">
+ <div className="flex flex-col flex-1 min-w-0 overflow-x-hidden">
```

- [ ] **Step 2: Add responsive sidebar overlay mode**

In `src/renderer/App.tsx`, track viewport width:

```tsx
const [viewportLg, setViewportLg] = useState(window.innerWidth >= 1024);

useEffect(() => {
  const onResize = () => setViewportLg(window.innerWidth >= 1024);
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}, []);
```

For small viewports (< 1024px), wrap the sidebar in an overlay panel. Instead of modifying Sidebar.tsx, modify App.tsx to wrap Sidebar conditionally:

```tsx
{viewportLg ? (
  <Sidebar ... />
) : (
  <>
    {!sidebarCollapsed && (
      <div className="fixed inset-0 z-30 bg-black/30" onClick={() => setSidebarCollapsed(true)} />
    )}
    <div className={`fixed left-0 top-0 z-40 h-full transition-transform duration-200 ease-drawer ${sidebarCollapsed ? "-translate-x-full" : "translate-x-0"}`}>
      <Sidebar ... />
    </div>
  </>
)}
```

- [ ] **Step 3: Add DPI-aware media query to index.css**

In `src/renderer/index.css`, add:

```css
@media (min-resolution: 1.25dppx) {
  .btn-sm { @apply px-1.5 py-0.5; }
  .btn-md { @apply px-2 py-1; }
  .sidebar-item { @apply px-2 py-1.5; }
}
```

Add `sidebar-item` class usage in `ConvItem.tsx:59`:

```diff
- className={`flex-1 text-left px-3 py-2 rounded-lg text-sm truncate ...`}
+ className={`sidebar-item flex-1 text-left px-3 py-2 rounded-lg text-sm truncate ...`}
```

- [ ] **Step 4: Make toolbar scroll horizontally instead of wrapping**

In `src/renderer/App.tsx`, change the toolbar nav:

```diff
- <nav aria-label="Toolbar" className="flex items-center gap-2 px-4 py-2 border-b ... flex-wrap">
+ <nav aria-label="Toolbar" className="flex items-center gap-2 px-4 py-2 border-b ... overflow-x-auto flex-shrink-0">
```

Add `flex-shrink-0` to each toolbar button group to prevent them from shrinking.

- [ ] **Step 5: Replace all `min-h-[100dvh]` with `min-h-screen`**

Search the entire codebase for `min-h-[100dvh]`:

In `src/renderer/App.tsx` — already done in Task 1.
In `src/renderer/components/Wizard/SetupWizard.tsx:46`:

```diff
- <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-gray-950">
+ <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
```

- [ ] **Step 6: Build and test**

Run: `npm run build`. Open the app on Windows at 100%, 125%, and 150% DPI scaling. Verify:
- No horizontal overflow
- Sidebar overlays on narrow viewports
- Toolbar items don't wrap
- Buttons remain readable at high DPI

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "fix: Windows layout — overflow, DPI scaling, responsive sidebar"
```

---

### Task 8: Final Integration Test & Verification

**Files:** None (verification only)

- [ ] **Step 1: Run typecheck**

```bash
npm run typecheck
```

Fix any type errors.

- [ ] **Step 2: Run linter**

```bash
npm run lint
```

Fix any lint errors.

- [ ] **Step 3: Run unit tests**

```bash
npm test
```

Fix any test failures.

- [ ] **Step 4: Build production bundle**

```bash
npm run build
```

- [ ] **Step 5: Run E2E tests (if available)**

```bash
npm run test:e2e
```

- [ ] **Step 6: Manual verification checklist**

Verify each of the original 9 issues in the running app:

| # | Issue | How to Verify |
|---|-------|--------------|
| 1 | Sidebar blank/same shade | Sidebar has visible bg contrast vs main area; conversation list loads |
| 2 | Probe doesn't run | Wizard step 1 probes backends and shows result indicators |
| 3 | Install doesn't work | Wizard step 2 shows install/skip buttons; npm spawn works on Windows |
| 4 | No internet | Connectivity banner shows when offline; proxy settings save |
| 5 | New chat buttons | "+ New" creates conversation immediately; it appears in sidebar |
| 6 | Persona prompts | Persona panel shows list; edit button opens form with prompt field |
| 7 | Animations messy | Right panels slide smoothly; no overlap; no layout jump |
| 8 | Windows layout | No overflow at any DPI; sidebar overlaid on small screens |
| 9 | Buttons don't work | All buttons produce visible state changes or IPC results |

- [ ] **Step 7: Commit final verification fixes**

```bash
git add -A
git commit -m "fix: final integration fixes from verification"
```
