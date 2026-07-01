# Setup & Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the wizard so it reliably shows on first open, installs backends correctly on Windows, guides users through API key entry on a dedicated step, replaces the terminal log with a spinner, shows a meaningful completion summary, and prompts the user to restart the app after CLI installs so PATH changes take effect.

**Architecture:** The wizard grows from 3 steps to 4: (1) probe, (2) install CLI tools, (3) auth CLI tools, (4) enter API keys. WizardStep2 re-probes on mount to avoid showing already-installed tools. The main-process installer uses PowerShell on Windows instead of `sh`. After any CLI install completes, WizardStep2 shows a "Restart app" banner — Electron inherits PATH at launch, so a relaunch is the most reliable way to pick up new PATH entries. Wizard first-run detection checks backend availability in addition to the `wizard_done` flag to survive userData persistence across reinstalls.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Electron IPC, child_process.spawn, better-sqlite3

## Global Constraints

- All new IPC calls must use channel names from `src/shared/ipc.ts`; never use raw strings
- `spawn()` calls must use argv arrays, never shell strings, except where explicitly noted
- Renderer runs with `contextIsolation: true` — no direct Node access from renderer
- Tailwind only — no inline styles except where existing code uses them
- Match existing btn-sm / btn-md / btn-lg class conventions throughout wizard components
- Run `npm test` after every task; all tests must pass before committing

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/main/wizard/install.ts` | Use PowerShell on Windows for curl-based installs |
| Modify | `src/renderer/components/Wizard/SetupWizard.tsx` | 4-step flow; smarter first-run detection |
| Modify | `src/renderer/components/Wizard/WizardStep2.tsx` | Re-probe on mount; spinner UI instead of `<pre>`; restart-app banner after install |
| Modify | `src/renderer/components/Wizard/WizardStep3.tsx` | Show list of available tools, not generic message |
| Create | `src/renderer/components/Wizard/WizardStep4.tsx` | API key entry for claude-api, gemini-api, openrouter |
| Modify | `src/renderer/App.tsx` | First-run detection: check backends when wizard_done flag is stale |
| Modify | `src/shared/ipc.ts` | Add `APP_RELAUNCH` channel |
| Modify | `src/main/ipc.ts` | Register `app:relaunch` handler |
| Modify | `src/renderer/ipc/app.ts` | Export `relaunchApp()` wrapper |

---

### Task 1: Fix Windows spawn sh ENOENT

**Files:**
- Modify: `src/main/wizard/install.ts:102-110`
- Test: `src/main/wizard/install.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `installBackend(id, onData)` — same signature, now works on Windows

- [ ] **Step 1: Write the failing test**

```typescript
// src/main/wizard/install.test.ts — add inside existing describe block
it("uses powershell on win32 for curl-based backends", async () => {
  const originalPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32", writable: true });

  const spawnCalls: { binary: string; args: string[] }[] = [];
  vi.spyOn(childProcess, "spawn").mockImplementation((binary: string, args: string[]) => {
    spawnCalls.push({ binary, args });
    const fake = new EventEmitter() as any;
    fake.stdout = new EventEmitter();
    fake.stderr = new EventEmitter();
    setTimeout(() => fake.emit("close", 0), 0);
    return fake;
  });

  await installBackend("claude", () => {});
  expect(spawnCalls[0].binary).toBe("powershell.exe");
  expect(spawnCalls[0].args[0]).toBe("-Command");

  Object.defineProperty(process, "platform", { value: originalPlatform, writable: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- install.test
```
Expected: FAIL — current code uses `binary = "sh"` on all non-pwsh platforms.

- [ ] **Step 3: Replace `sh` with PowerShell on Windows in the curl branch**

In `src/main/wizard/install.ts`, replace lines 103–110:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- install.test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/wizard/install.ts src/main/wizard/install.test.ts
git commit -m "fix: use PowerShell for curl-based installs on Windows"
```

---

### Task 2: Re-probe on WizardStep2 mount to filter already-installed tools

**Files:**
- Modify: `src/renderer/components/Wizard/WizardStep2.tsx`
- Test: `src/renderer/components/Wizard/WizardStep2.test.tsx`

**Interfaces:**
- Consumes: `probeBackend(id: string): Promise<{ available: boolean; authenticated: boolean }>` from `../../ipc/backend`
- Produces: same `Props` interface, but `missing` prop is the initial list; component filters it after re-probing

- [ ] **Step 1: Write the failing test**

```typescript
// src/renderer/components/Wizard/WizardStep2.test.tsx — add test
it("hides backends that are now available when re-probing on mount", async () => {
  vi.mocked(probeBackend).mockResolvedValue({ available: true, authenticated: false });
  render(<WizardStep2 missing={["gemini"]} onNext={vi.fn()} onBack={vi.fn()} />);
  // After re-probe resolves, gemini is available → should not show Install button
  await waitFor(() => {
    expect(screen.queryByRole("button", { name: /Install/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- WizardStep2.test
```
Expected: FAIL — current code never re-probes.

- [ ] **Step 3: Add re-probe effect to WizardStep2**

In `src/renderer/components/Wizard/WizardStep2.tsx`, add after the existing imports and state declarations:

```typescript
// Add to existing state block at top of WizardStep2:
const [filtered, setFiltered] = useState<string[]>(missing);
const [reprobing, setReprobing] = useState(true);

useEffect(() => {
  let cancelled = false;
  Promise.all(
    missing.map(async (id) => {
      try {
        const r = await probeBackend(id);
        return r.available ? null : id;
      } catch {
        return id;
      }
    }),
  ).then((results) => {
    if (!cancelled) {
      setFiltered(results.filter((x): x is string => x !== null));
      setReprobing(false);
    }
  });
  return () => { cancelled = true; };
}, [missing]);
```

Replace all uses of `missing` inside the JSX with `filtered`. Keep the early-return for `filtered.length === 0`:

```tsx
if (reprobing) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">Checking installed tools…</h2>
        <p className="text-xs text-text-muted">Re-checking which tools are already available.</p>
      </div>
      <div className="flex justify-center py-6">
        <div className="w-6 h-6 rounded-full border-2 border-border border-t-primary animate-spin" />
      </div>
    </div>
  );
}

if (filtered.length === 0) {
  // existing "All tools found" JSX, unchanged
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- WizardStep2.test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Wizard/WizardStep2.tsx src/renderer/components/Wizard/WizardStep2.test.tsx
git commit -m "fix: re-probe backends on WizardStep2 mount to skip already-installed tools"
```

---

### Task 3: Replace terminal `<pre>` log with spinner + status line in WizardStep2

**Files:**
- Modify: `src/renderer/components/Wizard/WizardStep2.tsx`
- Test: `src/renderer/components/Wizard/WizardStep2.test.tsx`

**Interfaces:**
- Consumes: same IPC events as before
- Produces: same component, visual change only — no interface change

- [ ] **Step 1: Write the failing test**

```typescript
it("shows a spinner while installing and hides the terminal pre block", async () => {
  vi.mocked(installBackend).mockImplementation(
    () => new Promise((res) => setTimeout(() => res({ success: true }), 100)),
  );
  vi.mocked(probeBackend).mockResolvedValue({ available: true, authenticated: false });
  render(<WizardStep2 missing={["gemini"]} onNext={vi.fn()} onBack={vi.fn()} />);
  await waitFor(() => screen.getByRole("button", { name: /^Install$/ }));
  fireEvent.click(screen.getByRole("button", { name: /^Install$/ }));
  expect(screen.getByTestId("install-spinner-gemini")).toBeInTheDocument();
  expect(screen.queryByRole("log")).toBeNull(); // no <pre> terminal
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- WizardStep2.test
```
Expected: FAIL — `install-spinner-gemini` doesn't exist and `<pre>` does exist.

- [ ] **Step 3: Replace `<pre>` block with spinner + last-line status**

In `src/renderer/components/Wizard/WizardStep2.tsx`, replace:

```tsx
{(logs[id] ?? []).length > 0 && (
  <pre className="text-xs bg-gray-900 text-gray-300 rounded-lg p-2 max-h-24 overflow-y-auto">
    {logs[id].join("\n")}
  </pre>
)}
```

with:

```tsx
{installing[id] && (
  <div className="flex items-center gap-2 text-xs text-text-muted" data-testid={`install-spinner-${id}`}>
    <div className="w-4 h-4 rounded-full border-2 border-border border-t-primary animate-spin flex-shrink-0" />
    <span className="truncate">{logs[id]?.at(-1) ?? "Installing…"}</span>
  </div>
)}
{!installing[id] && done[id] && verified[id] && (
  <p className="text-xs text-primary">Installed and detected on PATH ✓</p>
)}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- WizardStep2.test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Wizard/WizardStep2.tsx src/renderer/components/Wizard/WizardStep2.test.tsx
git commit -m "feat: replace install terminal log with spinner and status line"
```

---

### Task 4: Create WizardStep4 for API key entry

**Files:**
- Create: `src/renderer/components/Wizard/WizardStep4.tsx`
- Create: `src/renderer/components/Wizard/WizardStep4.test.tsx`

**Interfaces:**
- Consumes:
  - `storeKey(key: string, value: string): Promise<void>` from `../../ipc/key`
  - `probeBackend(id: string): Promise<{ available: boolean; authenticated: boolean }>` from `../../ipc/backend`
- Produces:
  ```typescript
  interface Props {
    onComplete: () => void;
    onBack: () => void;
  }
  export function WizardStep4({ onComplete, onBack }: Props): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// src/renderer/components/Wizard/WizardStep4.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WizardStep4 } from "./WizardStep4";
import * as keyIpc from "../../ipc/key";
import * as backendIpc from "../../ipc/backend";

vi.mock("../../ipc/key");
vi.mock("../../ipc/backend");

beforeEach(() => {
  vi.mocked(keyIpc.storeKey).mockResolvedValue(undefined);
  vi.mocked(backendIpc.probeBackend).mockResolvedValue({ available: true, authenticated: true });
});

describe("WizardStep4", () => {
  it("renders API key inputs for claude-api, gemini-api, openrouter", () => {
    render(<WizardStep4 onComplete={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByLabelText(/Claude API Key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Gemini API Key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/OpenRouter API Key/i)).toBeInTheDocument();
  });

  it("stores key and shows verified state on Save", async () => {
    render(<WizardStep4 onComplete={vi.fn()} onBack={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Claude API Key/i), {
      target: { value: "sk-ant-test" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Claude API Key/i }));
    await waitFor(() => {
      expect(keyIpc.storeKey).toHaveBeenCalledWith("claude-api", "sk-ant-test");
    });
    expect(await screen.findByText(/Saved ✓/i)).toBeInTheDocument();
  });

  it("calls onComplete when Finish is clicked", () => {
    const onComplete = vi.fn();
    render(<WizardStep4 onComplete={onComplete} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Finish Setup/i }));
    expect(onComplete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- WizardStep4.test
```
Expected: FAIL — file doesn't exist.

- [ ] **Step 3: Create WizardStep4.tsx**

```typescript
// src/renderer/components/Wizard/WizardStep4.tsx
import { useState } from "react";
import { storeKey } from "../../ipc/key";
import { probeBackend } from "../../ipc/backend";

const API_BACKENDS = [
  { id: "claude-api", label: "Claude API Key", placeholder: "sk-ant-api03-…", keyName: "claude-api" },
  { id: "gemini-api", label: "Gemini API Key", placeholder: "AIza…", keyName: "gemini-api" },
  { id: "openrouter", label: "OpenRouter API Key", placeholder: "sk-or-v1-…", keyName: "openrouter" },
];

interface Props {
  onComplete: () => void;
  onBack: () => void;
}

export function WizardStep4({ onComplete, onBack }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const save = async (id: string, keyName: string) => {
    const val = values[id]?.trim();
    if (!val) {
      setErrors((prev) => ({ ...prev, [id]: "Enter a key before saving." }));
      return;
    }
    setSaving((prev) => ({ ...prev, [id]: true }));
    setErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
    try {
      await storeKey(keyName, val);
      setSaved((prev) => ({ ...prev, [id]: true }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, [id]: (err as Error).message }));
    } finally {
      setSaving((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">Enter API keys</h2>
        <p className="text-xs text-text-muted">
          Optional — skip any you don't use. Keys are encrypted and stored locally.
        </p>
      </div>
      {API_BACKENDS.map(({ id, label, placeholder, keyName }) => (
        <div key={id} className="flex flex-col gap-2 border border-border rounded-xl p-4">
          <label htmlFor={`key-${id}`} className="font-medium text-sm">{label}</label>
          <div className="flex gap-2">
            <input
              id={`key-${id}`}
              type="password"
              placeholder={placeholder}
              value={values[id] ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [id]: e.target.value }))}
              disabled={saved[id]}
              className="flex-1 text-xs border rounded-lg px-3 py-1.5 bg-surface border-border-strong font-mono disabled:opacity-50"
            />
            <button
              onClick={() => save(id, keyName)}
              disabled={saving[id] || saved[id]}
              aria-label={`Save ${label}`}
              className="btn-sm bg-primary text-on-primary hoverable:hover:bg-primary-dark disabled:opacity-50"
            >
              {saved[id] ? "Saved ✓" : saving[id] ? "Saving…" : "Save"}
            </button>
          </div>
          {errors[id] && <p className="text-xs text-red-500">{errors[id]}</p>}
        </div>
      ))}
      <button
        onClick={onComplete}
        className="btn-lg bg-primary text-on-primary hoverable:hover:bg-primary-dark"
      >
        Finish Setup
      </button>
      <button
        onClick={onBack}
        className="btn-md w-full text-text-muted hoverable:hover:text-text-base transition-transform duration-100 ease-press active:scale-95"
      >
        Back
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- WizardStep4.test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Wizard/WizardStep4.tsx src/renderer/components/Wizard/WizardStep4.test.tsx
git commit -m "feat: add WizardStep4 for dedicated API key entry"
```

---

### Task 5: Wire 4-step flow in SetupWizard + improve first-run detection

**Files:**
- Modify: `src/renderer/components/Wizard/SetupWizard.tsx`
- Modify: `src/renderer/App.tsx:33-43`
- Test: no new test file needed — covered by existing App.test.tsx + WizardStep tests

**Interfaces:**
- Consumes:
  - `WizardStep4` from `./WizardStep4`
  - `listAvailableBackends(): Promise<BackendInfo[]>` from `../../ipc/backend` (already exists via `IPC.BACKEND_LIST`)
- Produces: `SetupWizard` with `step: 1 | 2 | 3 | 4`

- [ ] **Step 1: Update SetupWizard to 4 steps**

Replace `src/renderer/components/Wizard/SetupWizard.tsx` entirely:

```typescript
import { useState } from "react";
import { WizardStep1 } from "./WizardStep1";
import { WizardStep2 } from "./WizardStep2";
import { WizardStep3 } from "./WizardStep3";
import { WizardStep4 } from "./WizardStep4";
import { markWizardDone } from "../../ipc/backend";

interface BackendStatus {
  id: string;
  available: boolean;
  authenticated: boolean;
  loading: boolean;
}

interface Props {
  onComplete: () => void;
}

const STEP_LABELS: Record<number, string> = {
  1: "Setting up your tools",
  2: "Install additional tools",
  3: "Sign in to your AI tools",
  4: "Enter API keys",
};

export function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [statuses, setStatuses] = useState<BackendStatus[]>([]);

  const missing = statuses.filter((s) => !s.available).map((s) => s.id);

  const handleComplete = async () => {
    await markWizardDone();
    localStorage.setItem("wizardDone", "1");
    onComplete();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-subtle">
      <div className="w-full max-w-md bg-surface rounded-2xl shadow-xl p-8 motion-safe:animate-scale-in">
        <div className="flex gap-1 mb-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ease-press ${step >= n ? "bg-primary" : "bg-bubble-strong"}`}
            />
          ))}
        </div>
        <div className="text-xs text-text-muted mb-8">
          Step {step} of 4 — {STEP_LABELS[step]}
        </div>
        {step === 1 && (
          <WizardStep1 onNext={(s) => { setStatuses(s); setStep(2); }} />
        )}
        {step === 2 && (
          <WizardStep2
            missing={missing}
            onNext={() => setStep(3)}
            onBack={() => { setStatuses([]); setStep(1); }}
          />
        )}
        {step === 3 && (
          <WizardStep3
            statuses={statuses}
            onComplete={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <WizardStep4
            onComplete={handleComplete}
            onBack={() => setStep(3)}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Fix first-run detection in App.tsx**

Replace lines 33–43 in `src/renderer/App.tsx`:

```typescript
useEffect(() => {
  // Fast path: localStorage already confirmed wizard done
  if (localStorage.getItem("wizardDone") === "1") {
    setWizardDone(true);
    return;
  }
  // DB check: wizard_done persists across reinstalls in userData
  getSetting("wizard_done").then((val) => {
    if (val === "1") {
      // Extra guard: if no backend is available (fresh machine), re-run wizard
      import("./ipc/backend").then(({ listAvailableBackends }) =>
        listAvailableBackends()
      ).then((backends) => {
        const anyAvailable = backends.some((b) => b.available);
        if (anyAvailable) {
          localStorage.setItem("wizardDone", "1");
          setWizardDone(true);
        }
        // else: wizard_done flag is stale; leave wizardDone = false to show wizard
      }).catch(() => {
        // If backend listing fails, trust the DB flag
        localStorage.setItem("wizardDone", "1");
        setWizardDone(true);
      });
    }
  });
}, []);
```

- [ ] **Step 3: Ensure `listAvailableBackends` is exported from `src/renderer/ipc/backend.ts`**

Check if the function exists:
```
grep -n "listAvailableBackends\|BACKEND_LIST" src/renderer/ipc/backend.ts
```

If it doesn't exist, add to `src/renderer/ipc/backend.ts`:
```typescript
import type { BackendInfo } from "../../shared/types";
export async function listAvailableBackends(): Promise<BackendInfo[]> {
  return ipcInvoke<BackendInfo[]>(IPC.BACKEND_LIST);
}
```

- [ ] **Step 4: Run all wizard tests**

```
npm test -- Wizard
```
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Wizard/SetupWizard.tsx src/renderer/App.tsx src/renderer/ipc/backend.ts
git commit -m "feat: 4-step wizard flow with smarter first-run detection"
```

---

### Task 6: Improve WizardStep3 to list available tools instead of generic message

**Files:**
- Modify: `src/renderer/components/Wizard/WizardStep3.tsx:61-69`
- Test: `src/renderer/components/Wizard/WizardStep3.test.tsx`

**Interfaces:**
- Consumes: `statuses: BackendStatus[]` prop (unchanged)
- Produces: same component, shows available tool names when all are signed in

- [ ] **Step 1: Write the failing test**

```typescript
// src/renderer/components/Wizard/WizardStep3.test.tsx — add test
it("lists available tools by name when no auth is needed", () => {
  const statuses = [
    { id: "claude", available: true, authenticated: true, loading: false },
    { id: "gemini", available: true, authenticated: true, loading: false },
    { id: "opencode", available: false, authenticated: false, loading: false },
  ];
  render(<WizardStep3 statuses={statuses} onComplete={vi.fn()} onBack={vi.fn()} />);
  expect(screen.getByText("Claude Code")).toBeInTheDocument();
  expect(screen.getByText("Gemini CLI")).toBeInTheDocument();
  expect(screen.queryByText("Opencode")).toBeNull(); // not available, don't show
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- WizardStep3.test
```
Expected: FAIL — current code shows generic "All tools are signed in" text, not individual names.

- [ ] **Step 3: Replace generic message with tool list**

In `src/renderer/components/Wizard/WizardStep3.tsx`, replace lines 61–69:

```tsx
{needsAuth.length === 0 && (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2 text-sm font-medium text-text-base">
      <CheckCircle size={16} weight="fill" className="text-primary flex-shrink-0" />
      All CLI tools are signed in
    </div>
    <div className="flex flex-col gap-1 pl-6">
      {statuses
        .filter((s) => s.available)
        .map((s) => (
          <span key={s.id} className="text-xs text-text-muted">
            {BACKEND_LABELS[s.id] ?? s.id}
          </span>
        ))}
    </div>
  </div>
)}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- WizardStep3.test
```
Expected: PASS

- [ ] **Step 5: Run full test suite**

```
npm test
```
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Wizard/WizardStep3.tsx src/renderer/components/Wizard/WizardStep3.test.tsx
git commit -m "feat: show available tool list in wizard step 3 instead of generic message"
```

---

### Task 7: Show "Restart app" banner after CLI install so PATH changes take effect

**Root cause:** Electron inherits PATH from the shell that launched it at startup. When the wizard installs a CLI tool (e.g. `npm install -g @google/gemini-cli`), the new binary is written to disk but the running process's `PATH` doesn't include it. Re-probing immediately after install will always say "not detected" until the app relaunches with a fresh environment.

**Fix:** After any successful install in WizardStep2, show a banner asking the user to restart the app. A "Restart now" button calls `app.relaunch()` + `app.exit()` via IPC. On macOS/Linux, this also picks up any rc-file changes the install script made (e.g. additions to `~/.zshrc` that only take effect in a new shell).

**Files:**

- Modify: `src/shared/ipc.ts` — add `APP_RELAUNCH` channel
- Modify: `src/main/ipc.ts` — register handler
- Create: `src/renderer/ipc/app.ts` — `relaunchApp()` wrapper
- Modify: `src/renderer/components/Wizard/WizardStep2.tsx` — show banner after install

**Interfaces:**

- Consumes: nothing new from the store
- Produces:
  - `relaunchApp(): Promise<void>` in `src/renderer/ipc/app.ts`
  - WizardStep2 shows a dismissible banner when `needsRestart === true`

- [ ] **Step 1: Add `APP_RELAUNCH` to IPC channel map**

In `src/shared/ipc.ts`, add to the `IPC` object:

```typescript
APP_RELAUNCH: "app:relaunch",
```

- [ ] **Step 2: Register handler in main**

In `src/main/ipc.ts`, add near the `APP_VERSION` handler:

```typescript
ipcMain.handle(IPC.APP_RELAUNCH, () => {
  app.relaunch();
  app.exit(0);
});
```

Ensure `app` is imported (it already is via `import { ipcMain, BrowserWindow, app } from "electron"`).

- [ ] **Step 3: Create renderer IPC wrapper**

Create `src/renderer/ipc/app.ts`:

```typescript
import { IPC } from "../../shared/ipc";
import { ipcInvoke } from "./index";

export async function relaunchApp(): Promise<void> {
  await ipcInvoke<void>(IPC.APP_RELAUNCH);
}
```

- [ ] **Step 4: Write the failing test**

```typescript
// src/renderer/components/Wizard/WizardStep2.test.tsx — add test
it("shows restart banner after a successful install", async () => {
  vi.mocked(installBackend).mockResolvedValue({ success: true });
  vi.mocked(probeBackend).mockResolvedValue({ available: true, authenticated: false });
  render(<WizardStep2 missing={["gemini"]} onNext={vi.fn()} onBack={vi.fn()} />);
  await waitFor(() => screen.getByRole("button", { name: /^Install$/ }));
  fireEvent.click(screen.getByRole("button", { name: /^Install$/ }));
  expect(await screen.findByTestId("path-restart-banner")).toBeInTheDocument();
});
```

- [ ] **Step 5: Run test to verify it fails**

```
npm test -- WizardStep2.test
```

Expected: FAIL — no `path-restart-banner` exists yet.

- [ ] **Step 6: Add restart state and banner to WizardStep2**

In `src/renderer/components/Wizard/WizardStep2.tsx`, add state:

```typescript
const [needsRestart, setNeedsRestart] = useState(false);
```

In the `install()` function, after `setDone((prev) => ({ ...prev, [id]: true }))` on success, add:

```typescript
setNeedsRestart(true);
```

Add the import at the top:

```typescript
import { relaunchApp } from "../../ipc/app";
```

Add the banner just above the Continue/Back buttons:

```tsx
{needsRestart && (
  <div
    data-testid="path-restart-banner"
    className="flex items-center justify-between gap-3 px-4 py-3 bg-bubble rounded-xl border border-border text-xs"
  >
    <span className="text-text-muted">
      Restart the app so new tools are detected on PATH.
    </span>
    <button
      onClick={() => relaunchApp()}
      className="btn-sm bg-primary text-on-primary hoverable:hover:bg-primary-dark flex-shrink-0"
    >
      Restart now
    </button>
  </div>
)}
```

- [ ] **Step 7: Run test to verify it passes**

```
npm test -- WizardStep2.test
```

Expected: PASS

- [ ] **Step 8: Run full test suite**

```
npm test
```

Expected: All PASS

- [ ] **Step 9: Commit**

```bash
git add src/shared/ipc.ts src/main/ipc.ts src/renderer/ipc/app.ts src/renderer/components/Wizard/WizardStep2.tsx src/renderer/components/Wizard/WizardStep2.test.tsx
git commit -m "feat: show restart-app banner after CLI install so PATH changes take effect"
```
