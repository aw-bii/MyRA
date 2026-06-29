# Phase 2 Nav Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the top toolbar entirely, move conversation controls to a BottomBar above the chat input, consolidate all secondary panels into a Settings modal, and simplify the sidebar to conversations-only.

**Architecture:** Five sequential tasks. Tasks 1–3 build isolated new components. Task 4 rewires App.tsx and ChatView to use them (the integration commit). Task 5 seeds default content at startup. Each task ends with a working, committable deliverable.

**Tech Stack:** Electron 33, React 18, TypeScript 5.3, Vitest + @testing-library/react, Tailwind CSS, better-sqlite3.

## Global Constraints

- Never use shell-string invocation for spawned processes — always `spawn(binary, argsArray)`.
- Renderer never imports `fs`, `path`, `child_process`, or `electron` directly.
- All IPC channel names come from `src/shared/ipc.ts` constants — no raw strings.
- `npm run lint` must pass before each commit.
- Tests live alongside the file under test per existing convention.

---

## Root Cause Summary (read before starting)

**Current toolbar** (`App.tsx` lines 259–397): a `<nav aria-label="Toolbar">` block containing mode toggle, BackendSwitcher, ModelSelector, pipeline template select, search button, Cron/MCP/Plugins toggles, and Personas/Pipelines/Settings panel buttons. All of this is being removed.

**Destination of each control:**

| Control | Destination |
| --- | --- |
| Mode toggle (Single/Pipeline) | BottomBar |
| BackendSwitcher | BottomBar |
| ModelSelector | BottomBar |
| Pipeline template select | BottomBar |
| Personas button | Settings modal |
| Pipelines button | Settings modal |
| Settings/Cron/MCP/Plugins buttons | Settings modal |
| Search button | Removed (ConvList already has inline search) |
| Sidebar toggle | Stays — moves to sidebar footer |

**Sidebar** currently tab-switches between ConvList, SearchPanel, CronPanel, McpPanel, PluginPanel. In Phase 2, it always shows ConvList (which already has a built-in search input). The other panels move to the Settings modal.

**ConvList** (`src/renderer/components/Sidebar/ConvList.tsx`) already has a full-text search input at lines 58–67 — no new search UI needed.

---

## File Map

| File | Change |
| --- | --- |
| `src/renderer/components/Chat/BottomBar.tsx` | Create — mode/backend/model/persona/pipeline selectors |
| `src/renderer/components/Chat/BottomBar.test.tsx` | Create — render tests |
| `src/renderer/components/Settings/SettingsModal.tsx` | Create — modal with left nav + 6 sections |
| `src/renderer/components/Settings/SettingsModal.test.tsx` | Create — render + section-switch tests |
| `src/renderer/components/Sidebar/Sidebar.tsx` | Modify — remove 5 props + panel tabs; add gear footer |
| `src/renderer/components/Sidebar/ConvList.tsx` | Modify — remove unused `searchInputRef` prop |
| `src/renderer/components/Chat/ChatView.tsx` | Modify — accept + render `bottomBar` ReactNode prop |
| `src/renderer/App.tsx` | Modify — remove toolbar + panel state; add modal state; rewire |
| `src/main/store/defaults.ts` | Create — seed personas + pipeline once |
| `src/main/index.ts` | Modify — call `seedDefaults()` after `initDb()` |

---

### Task 1: BottomBar component

**Files:**
- Create: `src/renderer/components/Chat/BottomBar.tsx`
- Create: `src/renderer/components/Chat/BottomBar.test.tsx`

**Interfaces:**
- Consumes: `BackendSwitcher` from `../BackendSwitcher`, `ModelSelector` from `../Toolbar/ModelSelector`, `usePersonas` from `../../hooks/usePersonas`, `PipelineTemplate` from `../../../shared/types`
- Produces: exported `BottomBarProps` interface and `BottomBar` component (consumed by ChatView in Task 3 and App.tsx in Task 4)

- [ ] **Step 1: Write the failing test**

Create `src/renderer/components/Chat/BottomBar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BottomBar } from "./BottomBar";

vi.mock("../../ipc", () => ({
  listModels: vi.fn().mockResolvedValue([]),
  listBackends: vi.fn().mockResolvedValue([
    { id: "claude", label: "Claude Code", available: true, authenticated: true },
  ]),
  listPersonas: vi.fn().mockResolvedValue([]),
  probeBackend: vi.fn().mockResolvedValue({ available: true, authenticated: true }),
}));

const base = {
  mode: "single" as const,
  setMode: vi.fn(),
  backend: "claude",
  setBackend: vi.fn(),
  model: "",
  setModel: vi.fn(),
  personaId: null,
  setPersonaId: vi.fn(),
  templates: [],
  selectedTemplate: null,
  onTemplateSelect: vi.fn(),
  backendRefresh: 0,
  disabled: false,
};

describe("BottomBar", () => {
  it("renders Single and Pipeline mode buttons", () => {
    render(<BottomBar {...base} />);
    expect(screen.getByRole("button", { name: /^single$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^pipeline$/i })).toBeInTheDocument();
  });

  it("shows pipeline template combobox in pipeline mode", () => {
    render(<BottomBar {...base} mode="pipeline" />);
    expect(screen.getByRole("combobox", { name: /pipeline/i })).toBeInTheDocument();
  });

  it("shows persona combobox in single mode", () => {
    render(<BottomBar {...base} />);
    expect(screen.getByRole("combobox", { name: /persona/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run src/renderer/components/Chat/BottomBar.test.tsx --reporter=verbose
```

Expected: FAIL — "Cannot find module './BottomBar'"

- [ ] **Step 3: Implement BottomBar**

Create `src/renderer/components/Chat/BottomBar.tsx`:

```tsx
import { BackendSwitcher } from "../BackendSwitcher";
import { ModelSelector } from "../Toolbar/ModelSelector";
import { usePersonas } from "../../hooks/usePersonas";
import type { PipelineTemplate } from "../../../shared/types";

export interface BottomBarProps {
  mode: "single" | "pipeline";
  setMode: (m: "single" | "pipeline") => void;
  backend: string;
  setBackend: (b: string) => void;
  model: string;
  setModel: (m: string) => void;
  personaId: string | null;
  setPersonaId: (id: string | null) => void;
  templates: PipelineTemplate[];
  selectedTemplate: PipelineTemplate | null;
  onTemplateSelect: (t: PipelineTemplate | null) => void;
  backendRefresh: number;
  disabled?: boolean;
}

export function BottomBar({
  mode, setMode, backend, setBackend, model, setModel,
  personaId, setPersonaId, templates, selectedTemplate,
  onTemplateSelect, backendRefresh, disabled,
}: BottomBarProps) {
  const { personas } = usePersonas();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-t border-border overflow-x-auto flex-shrink-0">
      {/* Mode toggle */}
      <div className="flex rounded-md border border-border-strong overflow-hidden text-xs flex-shrink-0">
        <button
          onClick={() => { setMode("single"); onTemplateSelect(null); }}
          disabled={disabled}
          aria-pressed={mode === "single"}
          className={`px-3 py-1 transition-transform duration-100 ease-press active:scale-95 ${
            mode === "single" ? "bg-primary text-on-primary" : "hoverable:hover:bg-bubble"
          }`}
        >
          Single
        </button>
        <button
          onClick={() => setMode("pipeline")}
          disabled={disabled}
          aria-pressed={mode === "pipeline"}
          className={`px-3 py-1 transition-transform duration-100 ease-press active:scale-95 ${
            mode === "pipeline" ? "bg-primary text-on-primary" : "hoverable:hover:bg-bubble"
          }`}
        >
          Pipeline
        </button>
      </div>

      {mode === "single" && (
        <>
          <div className="flex-shrink-0">
            <BackendSwitcher value={backend} onChange={setBackend} refreshTrigger={backendRefresh} />
          </div>
          <div className="flex-shrink-0">
            <ModelSelector provider={backend} value={model} onChange={setModel} />
          </div>
          <select
            aria-label="Persona"
            value={personaId ?? ""}
            onChange={(e) => setPersonaId(e.target.value || null)}
            disabled={disabled}
            className="text-xs border rounded px-2 py-1 bg-surface border-border-strong flex-shrink-0"
          >
            <option value="">No persona</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </>
      )}

      {mode === "pipeline" && (
        <select
          aria-label="Pipeline template"
          value={selectedTemplate?.id ?? ""}
          onChange={(e) => {
            const t = templates.find((x) => x.id === e.target.value);
            onTemplateSelect(t ?? null);
          }}
          disabled={disabled}
          className="text-xs border rounded px-2 py-1 bg-surface border-border-strong flex-shrink-0"
        >
          <option value="">Select pipeline…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npx vitest run src/renderer/components/Chat/BottomBar.test.tsx --reporter=verbose
```

Expected: 3 passing

- [ ] **Step 5: Lint**

```
npm run lint
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Chat/BottomBar.tsx src/renderer/components/Chat/BottomBar.test.tsx
git commit -m "feat(ui): add BottomBar with mode/backend/persona/model selectors"
```

---

### Task 2: SettingsModal

**Files:**
- Create: `src/renderer/components/Settings/SettingsModal.tsx`
- Create: `src/renderer/components/Settings/SettingsModal.test.tsx`

**Interfaces:**
- Consumes: `SettingsPanel` from `./SettingsPanel`, `PersonaPanel` from `../Personas/PersonaPanel`, `PipelinePanel` from `../Pipelines/PipelinePanel`, `CronPanel` from `../Sidebar/CronPanel`, `McpPanel` from `../Sidebar/McpPanel`, `PluginPanel` from `../Sidebar/PluginPanel`
- Produces: exported `SettingsSection` type and `SettingsModal` component (consumed by App.tsx in Task 4)

- [ ] **Step 1: Write the failing test**

Create `src/renderer/components/Settings/SettingsModal.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SettingsModal } from "./SettingsModal";

vi.mock("../../ipc", () => ({
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue(undefined),
  getAppVersion: vi.fn().mockResolvedValue("0.2.1"),
  storeKey: vi.fn().mockResolvedValue(undefined),
  deleteKey: vi.fn().mockResolvedValue(undefined),
  hasKey: vi.fn().mockResolvedValue(false),
  probeBackend: vi.fn().mockResolvedValue({ available: false, authenticated: false }),
  getProxySettings: vi.fn().mockResolvedValue({ httpProxy: "", httpsProxy: "", noProxy: "" }),
  setProxySettings: vi.fn().mockResolvedValue(undefined),
  listPersonas: vi.fn().mockResolvedValue([]),
  savePersona: vi.fn().mockResolvedValue({ id: "1", name: "Test" }),
  deletePersona: vi.fn().mockResolvedValue(undefined),
  listPipelines: vi.fn().mockResolvedValue([]),
  savePipeline: vi.fn().mockResolvedValue({ id: "1", name: "Test" }),
  deletePipeline: vi.fn().mockResolvedValue(undefined),
  listBackends: vi.fn().mockResolvedValue([]),
  listMcpServers: vi.fn().mockResolvedValue([]),
  addMcpServer: vi.fn().mockResolvedValue(undefined),
  removeMcpServer: vi.fn().mockResolvedValue(undefined),
  toggleMcpServer: vi.fn().mockResolvedValue(undefined),
  listMcpTools: vi.fn().mockResolvedValue([]),
  listCronJobs: vi.fn().mockResolvedValue([]),
  createCronJob: vi.fn().mockResolvedValue(undefined),
  updateCronJob: vi.fn().mockResolvedValue(undefined),
  deleteCronJob: vi.fn().mockResolvedValue(undefined),
  toggleCronJob: vi.fn().mockResolvedValue(undefined),
  listPlugins: vi.fn().mockResolvedValue([]),
  togglePlugin: vi.fn().mockResolvedValue(undefined),
  getDefaultModel: vi.fn().mockResolvedValue(""),
  setDefaultModel: vi.fn().mockResolvedValue(undefined),
  listModels: vi.fn().mockResolvedValue([]),
}));

const base = {
  open: true,
  section: "settings" as const,
  onClose: vi.fn(),
  onSectionChange: vi.fn(),
  onReRunWizard: vi.fn(),
  activePersonaId: null,
  onPersonaSelect: vi.fn(),
  activeTemplateId: null,
  onTemplateSelect: vi.fn(),
};

describe("SettingsModal", () => {
  it("renders when open=true", () => {
    render(<SettingsModal {...base} />);
    expect(screen.getByRole("dialog", { name: /settings/i })).toBeInTheDocument();
  });

  it("does not render when open=false", () => {
    render(<SettingsModal {...base} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onSectionChange when Personas nav item clicked", () => {
    const onSectionChange = vi.fn();
    render(<SettingsModal {...base} onSectionChange={onSectionChange} />);
    fireEvent.click(screen.getByRole("button", { name: /^personas$/i }));
    expect(onSectionChange).toHaveBeenCalledWith("personas");
  });

  it("calls onClose when backdrop clicked", () => {
    const onClose = vi.fn();
    render(<SettingsModal {...base} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("settings-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when ✕ button clicked", () => {
    const onClose = vi.fn();
    render(<SettingsModal {...base} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close settings/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run src/renderer/components/Settings/SettingsModal.test.tsx --reporter=verbose
```

Expected: FAIL — "Cannot find module './SettingsModal'"

- [ ] **Step 3: Implement SettingsModal**

Create `src/renderer/components/Settings/SettingsModal.tsx`:

```tsx
import { SettingsPanel } from "./SettingsPanel";
import { PersonaPanel } from "../Personas/PersonaPanel";
import { PipelinePanel } from "../Pipelines/PipelinePanel";
import { CronPanel } from "../Sidebar/CronPanel";
import { McpPanel } from "../Sidebar/McpPanel";
import { PluginPanel } from "../Sidebar/PluginPanel";
import type { PipelineTemplate } from "../../../shared/types";

export type SettingsSection =
  | "settings"
  | "personas"
  | "pipelines"
  | "mcp"
  | "cron"
  | "plugins";

const NAV_ITEMS: { id: SettingsSection; label: string }[] = [
  { id: "settings", label: "Settings" },
  { id: "personas", label: "Personas" },
  { id: "pipelines", label: "Pipelines" },
  { id: "mcp", label: "MCP Servers" },
  { id: "cron", label: "Cron Jobs" },
  { id: "plugins", label: "Plugins" },
];

interface Props {
  open: boolean;
  section: SettingsSection;
  onClose: () => void;
  onSectionChange: (s: SettingsSection) => void;
  onReRunWizard: () => void;
  activePersonaId: string | null;
  onPersonaSelect: (id: string | null) => void;
  activeTemplateId: string | null;
  onTemplateSelect: (t: PipelineTemplate) => void;
}

export function SettingsModal({
  open, section, onClose, onSectionChange, onReRunWizard,
  activePersonaId, onPersonaSelect, activeTemplateId, onTemplateSelect,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="settings-backdrop"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Settings"
        aria-modal="true"
        className="relative bg-surface rounded-xl shadow-2xl flex overflow-hidden"
        style={{ width: "min(760px, 95vw)", height: "min(560px, 90vh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close settings"
          className="absolute top-3 right-3 btn-sm border border-border-strong hoverable:hover:bg-bubble z-10"
        >
          ✕
        </button>

        {/* Left nav */}
        <nav className="w-36 flex-shrink-0 border-r border-border bg-surface-subtle flex flex-col py-3">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`text-left px-4 py-2 text-xs transition-colors ${
                section === item.id
                  ? "bg-primary-ghost text-primary font-medium"
                  : "text-text-muted hoverable:hover:text-text-base hoverable:hover:bg-bubble"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Section content */}
        <div className="flex-1 overflow-hidden">
          {section === "settings" && (
            <SettingsPanel onClose={onClose} onReRunWizard={onReRunWizard} />
          )}
          {section === "personas" && (
            <PersonaPanel
              activePersonaId={activePersonaId}
              onSelect={onPersonaSelect}
              onClose={() => onSectionChange("settings")}
            />
          )}
          {section === "pipelines" && (
            <PipelinePanel
              activeTemplateId={activeTemplateId}
              onSelect={onTemplateSelect}
              onClose={() => onSectionChange("settings")}
            />
          )}
          {section === "mcp" && <McpPanel />}
          {section === "cron" && <CronPanel />}
          {section === "plugins" && <PluginPanel />}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npx vitest run src/renderer/components/Settings/SettingsModal.test.tsx --reporter=verbose
```

Expected: 5 passing

- [ ] **Step 5: Lint**

```
npm run lint
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Settings/SettingsModal.tsx src/renderer/components/Settings/SettingsModal.test.tsx
git commit -m "feat(ui): add SettingsModal with left nav and 6 sections"
```

---

### Task 3: Sidebar simplification + ConvList cleanup

**Files:**
- Modify: `src/renderer/components/Sidebar/Sidebar.tsx`
- Modify: `src/renderer/components/Sidebar/ConvList.tsx`

**Interfaces:**
- Consumes: `ConvList`, `GearSix` from `@phosphor-icons/react`
- Produces: updated `Sidebar` props interface (consumed by App.tsx in Task 4). New props: `onOpenSettings: () => void`. Removed props: `searchInputRef`, `searchMode`, `onCloseSearch`, `showCron`, `showMCP`, `showPlugins`.

**Important:** ConvList already has a built-in search input (lines 58–67 of ConvList.tsx). No new search UI is needed — ConvList's existing search stays. The sidebar change is: remove panel tabs, always render ConvList, add gear footer.

- [ ] **Step 1: Write the failing test**

Add to `src/renderer/components/Sidebar/Sidebar.tsx` test (create if it doesn't exist):

```tsx
// src/renderer/components/Sidebar/Sidebar.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Sidebar } from "./Sidebar";

vi.mock("../../ipc", () => ({
  listConversations: vi.fn().mockResolvedValue([]),
  searchConversations: vi.fn().mockResolvedValue([]),
  createConversation: vi.fn().mockResolvedValue({ id: "1", title: "Test" }),
}));

const base = {
  collapsed: false,
  activeId: null,
  onSelect: vi.fn(),
  onNew: vi.fn(),
  onDelete: vi.fn(),
  onRename: vi.fn(),
  refreshTrigger: 0,
  onOpenSettings: vi.fn(),
};

describe("Sidebar", () => {
  it("renders the settings gear button", () => {
    render(<Sidebar {...base} />);
    expect(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument();
  });

  it("calls onOpenSettings when gear clicked", () => {
    const onOpenSettings = vi.fn();
    render(<Sidebar {...base} onOpenSettings={onOpenSettings} />);
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    expect(onOpenSettings).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run src/renderer/components/Sidebar/Sidebar.test.tsx --reporter=verbose
```

Expected: FAIL — interface mismatch or import errors

- [ ] **Step 3: Update ConvList to remove unused searchInputRef prop**

In `src/renderer/components/Sidebar/ConvList.tsx`, change the Props interface and function signature:

Remove from Props interface:
```ts
searchInputRef?: React.MutableRefObject<HTMLInputElement | null>;
```

Remove from function parameters:
```ts
searchInputRef,
```

Remove the ref callback from the input element (lines 64–66):
```tsx
ref={(el: HTMLInputElement | null) => {
  if (searchInputRef) searchInputRef.current = el;
}}
```

The `<input>` element becomes:
```tsx
<input
  className="mx-2 mb-2 px-3 py-1.5 text-sm rounded-lg border border-border-strong bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
  aria-label="Search conversations"
  placeholder="Search conversations..."
  value={query}
  onChange={(e) => handleSearch(e.target.value)}
/>
```

- [ ] **Step 4: Rewrite Sidebar.tsx**

Replace the entire contents of `src/renderer/components/Sidebar/Sidebar.tsx` with:

```tsx
import { GearSix } from "@phosphor-icons/react";
import { ConvList } from "./ConvList";

interface Props {
  collapsed: boolean;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  refreshTrigger?: number;
  onOpenSettings: () => void;
}

export function Sidebar({
  collapsed,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  refreshTrigger,
  onOpenSettings,
}: Props) {
  return (
    <aside
      className={`flex-shrink-0 flex flex-col h-full overflow-hidden transition-[width] duration-200 ease-press border-r border-border bg-surface-subtle ${
        collapsed ? "w-0" : "w-48 lg:w-64"
      }`}
      style={collapsed ? { minWidth: 0 } : undefined}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm">MyRA</span>
        <button
          onClick={onNew}
          className="btn-sm bg-primary text-on-primary hoverable:hover:bg-primary-dark"
        >
          + New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <ConvList
          activeId={activeId}
          onSelect={onSelect}
          onDelete={onDelete}
          onRename={onRename}
          refreshTrigger={refreshTrigger}
        />
      </div>
      <div className="border-t border-border p-2">
        <button
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-muted hoverable:hover:text-text-base hoverable:hover:bg-bubble rounded-lg transition-colors"
        >
          <GearSix size={14} />
          Settings
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

```
npx vitest run src/renderer/components/Sidebar/Sidebar.test.tsx --reporter=verbose
```

Expected: 2 passing

- [ ] **Step 6: Lint**

```
npm run lint
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/Sidebar/Sidebar.tsx src/renderer/components/Sidebar/ConvList.tsx src/renderer/components/Sidebar/Sidebar.test.tsx
git commit -m "feat(ui): simplify sidebar to conversations-only with settings gear footer"
```

---

### Task 4: App.tsx + ChatView rewire

**Files:**
- Modify: `src/renderer/components/Chat/ChatView.tsx`
- Modify: `src/renderer/App.tsx`

**Interfaces:**
- Consumes: `BottomBar`, `BottomBarProps` from `./BottomBar` (Task 1), `SettingsModal`, `SettingsSection` from `../Settings/SettingsModal` (Task 2), updated `Sidebar` (Task 3)
- Produces: final working app with no toolbar and all controls in their new locations

**What changes in ChatView:** Accept `bottomBar?: React.ReactNode` prop and render it between the message area and `InputBar` in both `SingleChatView` and `PipelineChatView`.

**What changes in App.tsx:**
- Remove imports: `BackendSwitcher`, `ModelSelector`, `PersonaPanel`, `PipelinePanel`, `SettingsPanel`, `GearSix`, `MagnifyingGlass`
- Add imports: `BottomBar`, `BottomBarProps`, `SettingsModal`, `SettingsSection`
- Remove state: `showPersonas`, `showPipelines`, `showSettings`, `showCron`, `showMCP`, `showPlugins`, `searchMode`, `searchInputRef`, `togglePanel`
- Remove keyboard handler for Ctrl+F
- Add state: `settingsOpen: boolean`, `settingsSection: SettingsSection`
- Remove `<nav aria-label="Toolbar">` block (lines 259–397)
- Remove PersonaPanel, PipelinePanel, SettingsPanel slide-out divs from `<main>`
- Add `<SettingsModal>` below `<SecurityDialog>`
- Update both Sidebar calls: remove 7 old props, add `onOpenSettings`
- Pass `bottomBar` prop to ChatView

- [ ] **Step 1: Update ChatView to accept and render bottomBar prop**

In `src/renderer/components/Chat/ChatView.tsx`, add `bottomBar?: React.ReactNode` to the Props interface and to both `SingleChatView` and `PipelineChatView`.

Change the Props interface:
```ts
interface Props {
  conversationId: string | null;
  backend: string;
  model?: string;
  personaId?: string;
  pipelineTemplate?: PipelineTemplate;
  onNewConversation: (id: string) => void;
  bottomBar?: React.ReactNode;
}
```

In `ChatView`, forward `bottomBar` to both branches:
```tsx
export function ChatView({
  conversationId, backend, model, personaId, pipelineTemplate, onNewConversation, bottomBar,
}: Props) {
  if (pipelineTemplate) {
    return (
      <PipelineChatView
        conversationId={conversationId}
        template={pipelineTemplate}
        onNewConversation={onNewConversation}
        bottomBar={bottomBar}
      />
    );
  }
  return (
    <SingleChatView
      conversationId={conversationId}
      backend={backend}
      model={model}
      personaId={personaId}
      onNewConversation={onNewConversation}
      bottomBar={bottomBar}
    />
  );
}
```

Add `bottomBar?: React.ReactNode` to `SingleChatView`'s Omit props type and render it above `InputBar`:

In `SingleChatView`, change the return:
```tsx
return (
  <div className="flex flex-col h-full">
    {messages.length === 0 && !streaming && (
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm animate-fade-in-up">
        Start a conversation
      </div>
    )}
    {(messages.length > 0 || streaming) && (
      <MessageList
        messages={messages}
        streaming={streaming}
        conversationId={conversationId}
      />
    )}
    {bottomBar}
    <InputBar onSend={handleSend} onAbort={abort} streaming={streaming} />
    <StreamingAnnouncer
      content={streaming ? (messages[messages.length - 1]?.content ?? "") : ""}
    />
  </div>
);
```

Add `bottomBar?: React.ReactNode` to `PipelineChatView`'s props and render it above `InputBar` similarly (after the tab panel section, before `<InputBar>`):
```tsx
{bottomBar}
<InputBar onSend={handleSend} onAbort={abort} streaming={streaming} />
```

- [ ] **Step 2: Run existing ChatView-related tests to confirm no regressions**

```
npx vitest run src/renderer/components/Chat/ --reporter=verbose
```

Expected: all existing tests pass (BottomBar tests from Task 1 also pass)

- [ ] **Step 3: Rewrite App.tsx — remove toolbar + panel state**

Open `src/renderer/App.tsx`.

**Remove these imports** (they are no longer used in App.tsx):
```ts
import { GearSix, MagnifyingGlass, List } from "@phosphor-icons/react";
// replace with:
import { List } from "@phosphor-icons/react";

// Remove:
import { BackendSwitcher } from "./components/BackendSwitcher";
// Remove:
import { ModelSelector } from "./components/Toolbar/ModelSelector";
// Remove:
import { PersonaPanel } from "./components/Personas/PersonaPanel";
// Remove:
import { PipelinePanel } from "./components/Pipelines/PipelinePanel";
// Remove:
import { SettingsPanel } from "./components/Settings/SettingsPanel";
```

**Add these imports:**
```ts
import { BottomBar } from "./components/Chat/BottomBar";
import { SettingsModal } from "./components/Settings/SettingsModal";
import type { SettingsSection } from "./components/Settings/SettingsModal";
```

**Remove these state variables** (lines 57–72 and related):
```ts
// Remove:
const [showPersonas, setShowPersonas] = useState(false);
const [showPipelines, setShowPipelines] = useState(false);
const [showSettings, setShowSettings] = useState(false);
const [searchMode, setSearchMode] = useState(false);
const [showCron, setShowCron] = useState(false);
const [showMCP, setShowMCP] = useState(false);
const [showPlugins, setShowPlugins] = useState(false);
// Remove:
const togglePanel = useCallback(...);
// Remove:
const searchInputRef = useRef<HTMLInputElement | null>(null);
```

**Add these state variables** (after `const [backendRefresh, setBackendRefresh] = useState(0);`):
```ts
const [settingsOpen, setSettingsOpen] = useState(false);
const [settingsSection, setSettingsSection] = useState<SettingsSection>("settings");
```

**Remove the Ctrl+F keyboard handler** from the `handleKeyDown` useEffect:
```ts
// Remove these lines from handleKeyDown:
if (mod && e.key === "f") {
  e.preventDefault();
  setSearchMode((v) => !v);
}
```

- [ ] **Step 4: Remove toolbar `<nav>` block from App.tsx**

Delete the entire `<nav aria-label="Toolbar">` block (currently lines 259–397) from the JSX. This includes:
- The sidebar toggle button (List icon button) — move it to the sidebar header or remove; keep `setSidebarCollapsed` wired to the `collapsed` prop on `Sidebar`
- The mode toggle buttons
- BackendSwitcher + ModelSelector
- Pipeline template select
- Search button
- Cron/MCP/Plugins buttons
- Dividers
- Personas/Pipelines/Settings panel buttons

The sidebar toggle button (`<List>`) is removed from the toolbar. In Phase 2, there is no sidebar toggle button in the toolbar (the toolbar is gone). The sidebar can be toggled via a hamburger in the sidebar header — but for now, mobile users can swipe. If desired, add a `List` icon button to the sidebar footer alongside the gear (defer to a future task).

**After removal, the `<div className="flex flex-col flex-1 min-w-0 overflow-x-hidden">` block contains:**
```tsx
<div className="flex flex-col flex-1 min-w-0 overflow-x-hidden">
  <UpdateBanner />
  {!online && (
    <div className="px-4 py-1 bg-yellow-100 dark:bg-yellow-900 ...">
      No internet connection...
    </div>
  )}
  <main id="main-content" className="flex flex-1 min-h-0">
    {/* main content — see Step 5 */}
  </main>
</div>
```

- [ ] **Step 5: Update `<main>` block — remove slide-out panels, add BottomBar to ChatView**

The current `<main>` block has: chat area div + PersonaPanel div + PipelinePanel div + SettingsPanel div. Remove the three panel slide-out divs. Update the chat area to pass `bottomBar`:

```tsx
<main id="main-content" className="flex flex-1 min-h-0">
  {!activeConvId && mode === "single" ? (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <h2 className="text-sm font-semibold mb-2">Welcome to MyRA</h2>
      <p className="text-xs text-text-muted max-w-xs mb-4">
        Claude Code is built in and ready. Create a conversation, pick a
        backend, and ask your question.
      </p>
      <button
        onClick={handleNew}
        className="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm hoverable:hover:bg-primary-dark transition-transform duration-100 ease-press active:scale-95"
      >
        New conversation
      </button>
    </div>
  ) : !activeConvId && mode === "pipeline" ? (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <h2 className="text-sm font-semibold mb-2">Pipeline mode</h2>
      <p className="text-xs text-text-muted max-w-xs">
        Select a pipeline template from the bottom bar, then type your
        first message to begin.
      </p>
    </div>
  ) : (
    <div className="flex-1 min-w-0 overflow-hidden">
      <ChatView
        conversationId={activeConvId}
        backend={backend}
        model={model}
        personaId={personaId ?? undefined}
        pipelineTemplate={activePipelineTemplate}
        onNewConversation={(id) => {
          setActiveConvId(id);
          setRefreshTrigger((n) => n + 1);
        }}
        bottomBar={
          <BottomBar
            mode={mode}
            setMode={setMode}
            backend={backend}
            setBackend={setBackend}
            model={model}
            setModel={setModel}
            personaId={personaId}
            setPersonaId={setPersonaId}
            templates={templates}
            selectedTemplate={selectedTemplate}
            onTemplateSelect={(t) => {
              setSelectedTemplate(t);
              if (t) setMode("pipeline");
            }}
            backendRefresh={backendRefresh}
          />
        }
      />
    </div>
  )}
</main>
```

- [ ] **Step 6: Update Sidebar calls in App.tsx**

Both the desktop `<Sidebar>` and the mobile `<Sidebar>` (in the drawer) currently receive: `collapsed`, `activeId`, `onSelect`, `onNew`, `onDelete`, `onRename`, `searchInputRef`, `refreshTrigger`, `searchMode`, `onCloseSearch`, `showCron`, `showMCP`, `showPlugins`.

Replace both calls with:
```tsx
<Sidebar
  collapsed={sidebarCollapsed}
  activeId={activeConvId}
  onSelect={(id) => {
    setActiveConvId(id);
  }}
  onNew={handleNew}
  onDelete={handleDelete}
  onRename={handleRename}
  refreshTrigger={refreshTrigger}
  onOpenSettings={() => {
    setSettingsOpen(true);
    setSettingsSection("settings");
  }}
/>
```

For the mobile drawer version, add `setSidebarCollapsed(true)` in `onSelect`:
```tsx
onSelect={(id) => {
  setSidebarCollapsed(true);
  setActiveConvId(id);
}}
onNew={() => { handleNew(); setSidebarCollapsed(true); }}
```

- [ ] **Step 7: Add SettingsModal to the JSX**

In the return, after `</div>` (the main flex div) and before `{securityEvents.length > 0 && <SecurityDialog ...>}`, add:

```tsx
<SettingsModal
  open={settingsOpen}
  section={settingsSection}
  onClose={() => setSettingsOpen(false)}
  onSectionChange={setSettingsSection}
  onReRunWizard={() => {
    localStorage.removeItem("wizardDone");
    setWizardDone(false);
    setSetting("wizard_done", "0");
    setSettingsOpen(false);
  }}
  activePersonaId={personaId}
  onPersonaSelect={setPersonaId}
  activeTemplateId={activePipelineTemplate?.id ?? null}
  onTemplateSelect={(t) => {
    setSelectedTemplate(t);
    setMode("pipeline");
  }}
/>
```

- [ ] **Step 8: Remove unused imports from App.tsx**

After the above changes, `GearSix`, `MagnifyingGlass`, `BackendSwitcher`, `ModelSelector`, `PersonaPanel`, `PipelinePanel`, `SettingsPanel` are no longer used in App.tsx. Remove them from the import lines at the top. Keep: `List` (used? — if removed from toolbar, remove it too), `useState`, `useEffect`, `useRef`, `useCallback`, all IPC functions used, `usePipelines`, type imports.

If the sidebar toggle button is completely removed (no `List` icon remaining), remove the `List` import from `@phosphor-icons/react`. If you add it elsewhere, keep it.

- [ ] **Step 9: Lint**

```
npm run lint
```

Fix any unused variable or import errors. Expected: 0 errors.

- [ ] **Step 10: Build**

```
npm run build
```

Expected: exits 0. No TypeScript errors.

- [ ] **Step 11: Run full test suite**

```
npm test
```

Expected: all tests pass (249+). Note any new test failures and fix them before committing.

- [ ] **Step 12: Commit**

```bash
git add src/renderer/App.tsx src/renderer/components/Chat/ChatView.tsx
git commit -m "feat(ui): remove toolbar; wire BottomBar and SettingsModal into App"
```

---

### Task 5: Default content seeding

**Files:**
- Create: `src/main/store/defaults.ts`
- Modify: `src/main/index.ts`

**Interfaces:**
- Consumes: `ConvStore` from `./store/index` (uses `ConvStore.getSetting`, `ConvStore.setSetting`, `ConvStore.savePersona`, `ConvStore.savePipelineTemplate`)
- Produces: `seedDefaults()` function (called from `src/main/index.ts`)

**Context:** `ConvStore` in `src/main/store/index.ts` is a single exported object with methods `getSetting(key)`, `setSetting(key, value)`, `savePersona(p)`, `savePipelineTemplate(t)`. Seeds run exactly once: the `settings` table key `"defaults_seeded"` gates the operation.

- [ ] **Step 1: Check ConvStore API for savePersona and savePipelineTemplate**

Before implementing, verify the exact method signatures by reading `src/main/store/index.ts` lines 108–200 for `savePersona` and lines 160–320 for pipeline methods. Confirm:
- `ConvStore.savePersona({ name, systemPrompt, isDefault })` — id is auto-generated
- `ConvStore.savePipelineTemplate({ name, steps })` where steps is `Array<{ stepOrder, backendId, personaId }>`

Use the exact shape the store expects.

- [ ] **Step 2: Write the test**

Create `src/main/store/defaults.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the store module before importing defaults
vi.mock("./index", () => ({
  ConvStore: {
    getSetting: vi.fn(),
    setSetting: vi.fn(),
    savePersona: vi.fn(),
    savePipelineTemplate: vi.fn(),
  },
}));

import { seedDefaults } from "./defaults";
import { ConvStore } from "./index";

describe("seedDefaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seeds personas and pipeline when not yet seeded", () => {
    (ConvStore.getSetting as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    seedDefaults();
    expect(ConvStore.savePersona).toHaveBeenCalledTimes(2);
    expect(ConvStore.savePipelineTemplate).toHaveBeenCalledTimes(1);
    expect(ConvStore.setSetting).toHaveBeenCalledWith("defaults_seeded", "true");
  });

  it("does nothing when already seeded", () => {
    (ConvStore.getSetting as ReturnType<typeof vi.fn>).mockReturnValue("true");
    seedDefaults();
    expect(ConvStore.savePersona).not.toHaveBeenCalled();
    expect(ConvStore.savePipelineTemplate).not.toHaveBeenCalled();
    expect(ConvStore.setSetting).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```
npx vitest run src/main/store/defaults.test.ts --reporter=verbose
```

Expected: FAIL — "Cannot find module './defaults'"

- [ ] **Step 4: Implement defaults.ts**

Create `src/main/store/defaults.ts`:

```ts
import { ConvStore } from "./index";

export function seedDefaults(): void {
  if (ConvStore.getSetting("defaults_seeded")) return;

  ConvStore.savePersona({
    name: "Coder",
    systemPrompt:
      "You are an expert software engineer. Be concise, use code blocks, prefer working solutions over explanations.",
    isDefault: true,
  });

  ConvStore.savePersona({
    name: "Explainer",
    systemPrompt:
      "You are a patient teacher. Explain concepts clearly using plain language and examples. Avoid jargon.",
    isDefault: false,
  });

  ConvStore.savePipelineTemplate({
    name: "Draft → Review",
    steps: [
      { stepOrder: 0, backendId: "claude", personaId: null },
      { stepOrder: 1, backendId: "claude", personaId: null },
    ],
  });

  ConvStore.setSetting("defaults_seeded", "true");
}
```

**Note:** If `ConvStore.savePersona` requires additional fields (e.g. `isTemplate`, `variables`, `category`, `description`) based on what you found in Step 1, pass them as `undefined` or their zero values. Do not invent fields that don't exist in the store API.

- [ ] **Step 5: Run test to verify it passes**

```
npx vitest run src/main/store/defaults.test.ts --reporter=verbose
```

Expected: 2 passing

- [ ] **Step 6: Call seedDefaults from index.ts**

In `src/main/index.ts`, add import at the top:
```ts
import { seedDefaults } from "./store/defaults";
```

In the `app.whenReady().then()` callback, call `seedDefaults()` immediately after `initDb(...)`:
```ts
app.whenReady().then(() => {
  const userDataPath = app.getPath("userData");
  initDb(`${userDataPath}/conversations.db`);
  seedDefaults(); // ← add this line
  const win = createWindow();
  // ... rest unchanged
```

- [ ] **Step 7: Lint**

```
npm run lint
```

Expected: no errors

- [ ] **Step 8: Build**

```
npm run build
```

Expected: exits 0

- [ ] **Step 9: Run full test suite**

```
npm test
```

Expected: all tests pass

- [ ] **Step 10: Commit**

```bash
git add src/main/store/defaults.ts src/main/store/defaults.test.ts src/main/index.ts
git commit -m "feat(main): seed default personas and pipeline on first launch"
```

---

## Verification Checklist

Run through the following after all tasks complete:

- [ ] No top toolbar visible after the wizard completes
- [ ] BottomBar shows below the message list — mode toggle, backend, model, persona selectors visible
- [ ] Switching backend in BottomBar takes effect on the next message sent
- [ ] Switching mode from Single to Pipeline shows the pipeline template selector
- [ ] ⚙ Settings in sidebar footer opens the modal
- [ ] Modal has left nav with: Settings, Personas, Pipelines, MCP Servers, Cron Jobs, Plugins
- [ ] Clicking each nav item shows that section's content
- [ ] Clicking backdrop or ✕ closes the modal
- [ ] Re-run Wizard in Settings modal resets wizard state
- [ ] Sidebar shows conversations with built-in search — no panel tab buttons
- [ ] On first launch (fresh DB), 2 personas (Coder, Explainer) and 1 pipeline (Draft → Review) appear in Settings > Personas and Settings > Pipelines
- [ ] On second launch, defaults are not re-seeded
- [ ] All existing tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Build passes (`npm run build`)
