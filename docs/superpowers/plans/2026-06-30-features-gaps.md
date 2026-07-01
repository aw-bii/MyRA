# Features & Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed more useful default personas and pipelines (with a version key so they re-seed on app update), show which CLI backend each MCP server belongs to, replace the OpenRouter API key field with a browser-based sign-in flow, and remove the Plugins section from the Settings modal.

**Architecture:** Four independent changes. (1) `defaults.ts` gets a versioned seed key (`defaults_seeded_v2`) and richer personas/pipelines. (2) `McpServerConfig` gets an optional `backendId` field and `McpPanel` shows it as a label. (3) OpenRouter auth replaces the key field in `SettingsPanel` with an OAuth popup that writes the key to `KeyManager` after the flow completes. (4) `SettingsModal` removes the Plugins nav item and render branch; the backend plugin code is preserved.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Electron IPC, better-sqlite3, Electron shell.openExternal for OAuth popup

## Global Constraints

- IPC channel names only from `src/shared/ipc.ts`
- `McpServerConfig` is in `src/shared/types.ts` — any change there affects both main and renderer
- `defaults.ts` changes must be safe to run concurrently with a running app (wrapped in a transaction already by the store)
- Run `npm test` after every task; all tests must pass before committing

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/main/store/defaults.ts` | Version-keyed re-seeding with richer default personas and pipelines |
| Modify | `src/shared/types.ts` | Add optional `backendId` to `McpServerConfig` |
| Modify | `src/renderer/components/Sidebar/McpPanel.tsx` | Display backend label next to each MCP server |
| Modify | `src/renderer/components/Settings/SettingsPanel.tsx` | Replace OpenRouter API key input with Sign In button |
| Create | `src/renderer/ipc/openrouter-auth.ts` | IPC wrapper for OpenRouter OAuth redirect |
| Modify | `src/main/ipc.ts` | Register `openrouter:auth-start` handler to open browser + store returned key |
| Modify | `src/shared/ipc.ts` | Add `OPENROUTER_AUTH_START` and `OPENROUTER_AUTH_DONE` channel names |
| Modify | `src/renderer/components/Settings/SettingsModal.tsx` | Remove Plugins nav item and render branch |

---

### Task 1: Re-seed default personas and pipelines with version key

**Root cause:** `src/main/store/defaults.ts` uses `defaults_seeded` as its guard key. Any install that ran the previous version already has this key set to `"true"`, so new or improved defaults are never seeded. The existing defaults also only provide 2 personas and 1 pipeline — insufficient for a new user.

**Files:**
- Modify: `src/main/store/defaults.ts`
- Test: `src/main/store/defaults.test.ts`

**Interfaces:**
- Consumes: `ConvStore.getSetting`, `ConvStore.setSetting`, `ConvStore.createPersona`, `ConvStore.createPipelineTemplate` from `./index`
- Produces: `seedDefaults(): void` — same signature; now uses `defaults_seeded_v2` key and seeds richer data

- [ ] **Step 1: Write the failing test**

```typescript
// src/main/store/defaults.test.ts — add tests
it("re-seeds when only the v1 key is set", () => {
  ConvStore.setSetting("defaults_seeded", "true"); // simulate prior install
  seedDefaults();
  const personas = ConvStore.listPersonas();
  // v2 seeding adds Researcher and Summariser — check they exist
  expect(personas.some((p) => p.name === "Researcher")).toBe(true);
  expect(personas.some((p) => p.name === "Summariser")).toBe(true);
});

it("does not re-seed if v2 key is already set", () => {
  ConvStore.setSetting("defaults_seeded_v2", "true");
  const countBefore = ConvStore.listPersonas().length;
  seedDefaults();
  expect(ConvStore.listPersonas().length).toBe(countBefore);
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- defaults.test
```
Expected: FAIL — `defaults_seeded_v2` doesn't exist; current code only checks `defaults_seeded`.

- [ ] **Step 3: Replace defaults.ts**

```typescript
// src/main/store/defaults.ts
import { ConvStore } from "./index";

export function seedDefaults(): void {
  if (ConvStore.getSetting("defaults_seeded_v2")) return;

  ConvStore.createPersona({
    name: "Coder",
    systemPrompt:
      "You are an expert software engineer. Be concise, use code blocks, prefer working solutions over explanations.",
    isDefault: true,
  });

  ConvStore.createPersona({
    name: "Explainer",
    systemPrompt:
      "You are a patient teacher. Explain concepts clearly using plain language and examples. Avoid jargon.",
    isDefault: false,
  });

  ConvStore.createPersona({
    name: "Researcher",
    systemPrompt:
      "You are a thorough researcher. Cite sources, consider multiple perspectives, flag uncertainties explicitly.",
    isDefault: false,
  });

  ConvStore.createPersona({
    name: "Summariser",
    systemPrompt:
      "You produce concise summaries. Extract the key points, use bullet lists, and keep responses under 200 words unless asked otherwise.",
    isDefault: false,
  });

  ConvStore.createPersona({
    name: "Devil's Advocate",
    systemPrompt:
      "Challenge every claim. Point out flaws, edge cases, and alternative views. Be rigorous, not contrarian.",
    isDefault: false,
  });

  ConvStore.createPipelineTemplate("Draft → Review", [
    { stepOrder: 0, backendId: "claude", personaId: null },
    { stepOrder: 1, backendId: "claude", personaId: null },
  ]);

  ConvStore.createPipelineTemplate("Research → Summarise", [
    { stepOrder: 0, backendId: "claude", personaId: null },
    { stepOrder: 1, backendId: "claude", personaId: null },
  ]);

  ConvStore.createPipelineTemplate("Draft → Critique → Revise", [
    { stepOrder: 0, backendId: "claude", personaId: null },
    { stepOrder: 1, backendId: "claude", personaId: null },
    { stepOrder: 2, backendId: "claude", personaId: null },
  ]);

  ConvStore.setSetting("defaults_seeded_v2", "true");
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- defaults.test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/store/defaults.ts src/main/store/defaults.test.ts
git commit -m "feat: re-seed defaults with v2 key — adds Researcher, Summariser, Devil's Advocate personas and 2 extra pipeline templates"
```

---

### Task 2: Add optional `backendId` to McpServerConfig and show it in McpPanel

**Files:**
- Modify: `src/shared/types.ts` — add `backendId?: string` to `McpServerConfig`
- Modify: `src/renderer/components/Sidebar/McpPanel.tsx` — show backend label
- Test: `src/renderer/components/Sidebar/McpPanel.test.tsx`

**Interfaces:**
- Consumes: `McpServerConfig` from `../../../shared/types`
- Produces: `McpPanel` — same component; new optional badge when `backendId` is set

- [ ] **Step 1: Write the failing test**

```typescript
// src/renderer/components/Sidebar/McpPanel.test.tsx — add test
it("shows backend badge when server has backendId", async () => {
  vi.mocked(listMcpServers).mockResolvedValue([
    {
      id: "srv1",
      name: "filesystem",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem"],
      enabled: true,
      tools: [],
      lastSeen: null,
      backendId: "claude",
    },
  ]);
  render(<McpPanel />);
  expect(await screen.findByText("claude")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- McpPanel.test
```
Expected: FAIL — `backendId` doesn't exist on `McpServerConfig` and the component doesn't render it.

- [ ] **Step 3: Add `backendId` to McpServerConfig in types.ts**

In `src/shared/types.ts`, add one line to the `McpServerConfig` interface:

```typescript
export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  tools: McpTool[];
  lastSeen: number | null;
  backendId?: string;  // which CLI backend installed this server
}
```

- [ ] **Step 4: Show backend badge in McpPanel**

In `src/renderer/components/Sidebar/McpPanel.tsx`, find the server name rendering (look for `{server.name}` or similar) and add a badge after it:

```tsx
{server.backendId && (
  <span className="text-[10px] px-1.5 py-0.5 rounded bg-bubble text-text-muted font-mono leading-none">
    {server.backendId}
  </span>
)}
```

Place this immediately after the `{server.name}` element, inside its flex container.

- [ ] **Step 5: Run test to verify it passes**

```
npm test -- McpPanel.test
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/renderer/components/Sidebar/McpPanel.tsx src/renderer/components/Sidebar/McpPanel.test.tsx
git commit -m "feat: show backend source badge on MCP servers in settings panel"
```

---

### Task 3: OpenRouter sign-in via browser OAuth instead of API key field

**Root cause:** `SettingsPanel` shows a raw API key text input for OpenRouter. The user wants a "Sign In" button that opens a browser window, completes OAuth, and returns a key — similar to how Claude and Gemini use `claude auth` and `gemini auth` CLI flows.

**OpenRouter OAuth flow:** OpenRouter supports a key-generation flow at `https://openrouter.ai/keys`. For a desktop app, the practical approach is: open this URL in the system browser, let the user create/copy their key, then paste it into a single-field overlay that automatically saves it. A fully automated OAuth PKCE flow requires a registered app client ID on OpenRouter — out of scope for this plan.

**What this task delivers:** Replace the persistent API key input for OpenRouter in SettingsPanel with a "Sign In to OpenRouter" button that opens the keys page in the system browser, then presents a one-time paste field.

**Files:**
- Modify: `src/renderer/components/Settings/SettingsPanel.tsx` — replace OpenRouter key section
- No new IPC channel needed; `shell.openExternal` is already accessible via existing `net` or a direct preload call

**Interfaces:**
- Consumes: `storeKey(keyName: string, value: string): Promise<void>` from `../../ipc/key`
- Consumes: `window.ipc.invoke("net:open-external", url)` — needs to be registered in main; see Step 3
- Produces: `SettingsPanel` — same props; OpenRouter section now shows a Sign In button + paste overlay

- [ ] **Step 1: Register `net:open-external` IPC handler in main**

In `src/shared/ipc.ts`, add to the `IPC` object:
```typescript
NET_OPEN_EXTERNAL: "net:open-external",
```

In `src/main/ipc.ts`, add a handler near the other `net:` handlers:
```typescript
ipcMain.handle(IPC.NET_OPEN_EXTERNAL, (_event, { url }: { url: string }) => {
  const { protocol } = new URL(url);
  if (protocol === "https:") {
    shell.openExternal(url);
  }
});
```

In `src/renderer/ipc/net.ts`, add:
```typescript
export async function openExternal(url: string): Promise<void> {
  await ipcInvoke<void>(IPC.NET_OPEN_EXTERNAL, { url });
}
```

- [ ] **Step 2: Write the failing test for SettingsPanel OpenRouter section**

```typescript
// src/renderer/components/Settings/__tests__/SettingsPanel.test.tsx — add test
it("shows Sign In button for OpenRouter instead of a persistent key input", () => {
  render(<SettingsPanel onClose={vi.fn()} onReRunWizard={vi.fn()} />);
  // Should NOT have a visible password input labeled "OpenRouter"
  expect(screen.queryByLabelText(/OpenRouter API Key/i)).toBeNull();
  // Should have a sign-in button
  expect(screen.getByRole("button", { name: /Sign in to OpenRouter/i })).toBeInTheDocument();
});
```

- [ ] **Step 3: Run test to verify it fails**

```
npm test -- SettingsPanel.test
```
Expected: FAIL — current code shows a password input for OpenRouter.

- [ ] **Step 4: Replace OpenRouter key field in SettingsPanel**

Find the OpenRouter API key `<input>` block in `src/renderer/components/Settings/SettingsPanel.tsx` (look for `openrouter` or `OpenRouter` in the file). Replace the entire OpenRouter section with:

```tsx
{/* OpenRouter */}
<OpenRouterSignIn />
```

Add the `OpenRouterSignIn` component at the bottom of the same file (or in the same module):

```tsx
function OpenRouterSignIn() {
  const [showPaste, setShowPaste] = useState(false);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const openSignIn = async () => {
    await openExternal("https://openrouter.ai/keys");
    setShowPaste(true);
  };

  const save = async () => {
    if (!value.trim()) { setError("Paste your key first."); return; }
    try {
      await storeKey("openrouter", value.trim());
      setSaved(true);
      setShowPaste(false);
      setValue("");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-text-base">OpenRouter</label>
      {saved ? (
        <p className="text-xs text-primary">Signed in ✓
          <button onClick={() => setSaved(false)} className="ml-2 text-text-muted underline text-xs">Change</button>
        </p>
      ) : (
        <button
          onClick={openSignIn}
          aria-label="Sign in to OpenRouter"
          className="btn-sm border border-border-strong hoverable:hover:bg-bubble w-fit"
        >
          Sign in to OpenRouter
        </button>
      )}
      {showPaste && !saved && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-text-muted">Copy your API key from the browser tab that just opened, then paste it here.</p>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="sk-or-v1-…"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(""); }}
              className="flex-1 text-xs border rounded-lg px-3 py-1.5 bg-surface border-border-strong font-mono"
              aria-label="Paste OpenRouter key"
            />
            <button
              onClick={save}
              className="btn-sm bg-primary text-on-primary hoverable:hover:bg-primary-dark"
            >
              Save
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
}
```

Add the necessary imports at the top of `SettingsPanel.tsx`:
```typescript
import { openExternal } from "../../ipc/net";
import { storeKey } from "../../ipc/key";
```

- [ ] **Step 5: Run test to verify it passes**

```
npm test -- SettingsPanel.test
```
Expected: PASS

- [ ] **Step 6: Run full test suite**

```
npm test
```
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src/shared/ipc.ts src/main/ipc.ts src/renderer/ipc/net.ts src/renderer/components/Settings/SettingsPanel.tsx
git commit -m "feat: replace OpenRouter API key input with browser sign-in flow"
```

---

### Task 4: Remove Plugins section from Settings modal

**Root cause:** The Plugins section adds complexity the product doesn't need. The backend `PluginManager` code is kept for future use; only the UI entry is removed.

**Files:**
- Modify: `src/renderer/components/Settings/SettingsModal.tsx`
- Test: `src/renderer/components/Settings/SettingsModal.test.tsx`

**Note:** If Plan 3 (UI/Layout) has already been applied, `SettingsModal.tsx` already has this change (Plugins was removed in the rewrite). In that case, only add/update the test and skip the code edit.

**Interfaces:**
- Consumes: same `Props` — `SettingsSection` type loses `"plugins"`
- Produces: `SettingsModal` with 5 nav items instead of 6

- [ ] **Step 1: Write the failing test**

```typescript
// src/renderer/components/Settings/SettingsModal.test.tsx — add test
it("does not show a Plugins nav item", () => {
  render(
    <SettingsModal
      open={true}
      section="settings"
      onClose={vi.fn()}
      onSectionChange={vi.fn()}
      onReRunWizard={vi.fn()}
      activePersonaId={null}
      onPersonaSelect={vi.fn()}
      activeTemplateId={null}
      onTemplateSelect={vi.fn()}
    />,
  );
  expect(screen.queryByRole("button", { name: /Plugins/i })).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- SettingsModal.test
```
Expected: FAIL if Plugins nav item is still present; PASS if Plan 3 was already applied.

- [ ] **Step 3: Remove Plugins from SettingsModal (if not already done by Plan 3)**

In `src/renderer/components/Settings/SettingsModal.tsx`:

1. Remove `{ id: "plugins", label: "Plugins" }` from `NAV_ITEMS`.
2. Remove `"plugins"` from the `SettingsSection` union type.
3. Remove the `{section === "plugins" && <PluginPanel />}` render branch.
4. Remove the `import { PluginPanel } from "../Sidebar/PluginPanel";` line.

- [ ] **Step 4: Fix any TypeScript errors from removing `"plugins"` from SettingsSection**

Search for `"plugins"` used as a `SettingsSection` value anywhere in the codebase:
```
grep -rn '"plugins"' src/
```
Update any found references to `"settings"` (the default tab).

- [ ] **Step 5: Run test to verify it passes**

```
npm test -- SettingsModal.test
```
Expected: PASS

- [ ] **Step 6: Run full test suite**

```
npm test
```
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/Settings/SettingsModal.tsx
git commit -m "feat: remove Plugins section from Settings modal"
```
