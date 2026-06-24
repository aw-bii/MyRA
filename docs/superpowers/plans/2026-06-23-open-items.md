# Open Items Plan — 2026-06-23

**Context:** Full audit of all 17 plan files completed. Only three items remain open across the entire project. Everything else (security tasks 1–9, researcher completion tasks 1–3, all UI critique tasks, all P0/P1/P2 tasks, app icons, window state, CI config) is confirmed done.

---

## Task 1: Upgrade xlsx to fix CVE-2023-30533

**Priority:** Security  
**Effort:** ~15 min  
**File:** `package.json`

Security-fixes plan Task 10 was never applied. `package.json` still pins `xlsx: "^0.18.5"` which has a known prototype pollution vulnerability (CVE-2023-30533). The fix is in `0.19.3+`.

- [ ] **Step 1:** Run `npm install xlsx@0.19.3`
  - If version not found: run `npm show xlsx versions --json` and pick the latest `0.19.x`
  - API surface used is `XLSX.readFile(path)` + `XLSX.utils.sheet_to_csv(sheet)` in `src/main/attachments/service.ts:66-71` — both are stable across versions

- [ ] **Step 2:** Run `npm test` — verify all 81+ tests still pass

- [ ] **Step 3:** Commit
  ```bash
  git add package.json package-lock.json
  git commit -m "fix(security): upgrade xlsx to 0.19.3+ to address CVE-2023-30533 prototype pollution"
  git push
  ```

---

## Task 2: Remove dead Sidebar props

**Priority:** Cleanup  
**Effort:** ~10 min  
**File:** `src/renderer/components/Sidebar/Sidebar.tsx`, and its caller

The interface has three props that the component body never uses:
- `onCloseCron: () => void`
- `onCloseMCP: () => void`
- `onClosePlugins: () => void`

An inline comment already marks them for removal. Find the caller and verify these callbacks are truly dead (the panel-close logic was moved into each panel itself), then delete the props from both the interface and the call site.

- [ ] **Step 1:** Find the Sidebar caller
  ```bash
  grep -rn "onCloseCron" src/
  ```

- [ ] **Step 2:** Verify the panels close themselves without using these callbacks (CronPanel, McpPanel, PluginPanel each handle their own close button internally)

- [ ] **Step 3:** Remove from `Sidebar.tsx` interface and destructured params; remove from the caller's JSX

- [ ] **Step 4:** Run `npm test` — verify tests pass; run `npm run lint` to catch any TypeScript errors

- [ ] **Step 5:** Commit
  ```bash
  git add src/renderer/components/Sidebar/Sidebar.tsx <caller-file>
  git commit -m "chore: remove dead onCloseCron/MCP/Plugins props from Sidebar"
  git push
  ```

---

## Task 3: Verify E2E tests pass end-to-end

**Priority:** Quality gate  
**Effort:** ~30 min (mostly build time)  
**Files:** `tests/e2e/`

The Playwright E2E scaffold exists (`app.spec.ts`, `fixtures.ts`, `global-setup.ts`, `global-teardown.ts`, `electron.config.ts`) and the app wires E2E_TEST=1 isolation correctly, but `npm run test:e2e` has never been confirmed to pass on this machine.

- [ ] **Step 1:** Build the app
  ```bash
  npm run build
  ```
  Verify `out/main/index.js` and `out/renderer/index.html` exist.

- [ ] **Step 2:** Run E2E tests
  ```bash
  npm run test:e2e
  ```
  Expected: 4 tests pass (wizard flow, chat flow, persona flow, history flow).

- [ ] **Step 3:** If tests fail, diagnose — common issues:
  - Wizard text changed → update `toBeVisible` selectors in `app.spec.ts`
  - Build artifacts stale → re-run `npm run build`
  - Global setup timeout → extend `timeout` in `electron.config.ts`

- [ ] **Step 4:** If fixes were needed, commit them
  ```bash
  git add tests/e2e/
  git commit -m "fix(e2e): update selectors / config so Playwright suite passes"
  git push
  ```

---

## Done

After these three tasks:
- All security findings from the 2026-06-22 audit are remediated
- Codebase is free of TODOs left by previous implementation plans
- E2E tests provide a CI-runnable end-to-end regression gate

The project is shippable.
