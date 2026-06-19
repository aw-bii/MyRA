# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> chat flow — send a message and receive echo
- Location: tests\e2e\app.spec.ts:36:5

# Error details

```
Error: CDP endpoint http://localhost:9222/json/version did not become ready after 15000ms
```

# Test source

```ts
  1  | import { test as base, chromium } from "@playwright/test";
  2  | import type { Browser, Page } from "@playwright/test";
  3  | import { spawn, ChildProcess } from "child_process";
  4  | import path from "path";
  5  | import fs from "fs";
  6  | 
  7  | // Playwright's _electron.launch() injects --remote-debugging-port=0 as a CLI
  8  | // arg, which Electron 30+ rejects at the OS arg-parser level (before any JS
  9  | // runs). The workaround is to spawn Electron ourselves and let the main
  10 | // process call app.commandLine.appendSwitch('remote-debugging-port', '9222'),
  11 | // then connect with chromium.connectOverCDP.
  12 | 
  13 | type WorkerFixtures = {
  14 |   app: Browser;
  15 |   window: Page;
  16 | };
  17 | 
  18 | async function waitForCDP(url: string, retries = 30, delayMs = 500): Promise<void> {
  19 |   for (let i = 0; i < retries; i++) {
  20 |     try {
  21 |       const res = await fetch(url);
  22 |       if (res.ok) return;
  23 |     } catch {
  24 |       // not ready yet
  25 |     }
  26 |     await new Promise((r) => setTimeout(r, delayMs));
  27 |   }
> 28 |   throw new Error(`CDP endpoint ${url} did not become ready after ${retries * delayMs}ms`);
     |         ^ Error: CDP endpoint http://localhost:9222/json/version did not become ready after 15000ms
  29 | }
  30 | 
  31 | export const test = base.extend<{}, WorkerFixtures>({
  32 |   app: [
  33 |     async ({}, use) => {
  34 |       const electronExe = path.join(
  35 |         process.cwd(),
  36 |         "node_modules",
  37 |         "electron",
  38 |         "dist",
  39 |         "electron.exe",
  40 |       );
  41 |       const mainJs = path.join(process.cwd(), "out", "main", "index.js");
  42 | 
  43 |       // Clean up stale E2E DB so each run starts fresh
  44 |       const e2eDb = path.join(
  45 |         require("os").tmpdir(),
  46 |         "bii-e2e-test",
  47 |         "conversations.db",
  48 |       );
  49 |       if (fs.existsSync(e2eDb)) fs.rmSync(e2eDb);
  50 | 
  51 |       const child: ChildProcess = spawn(electronExe, [mainJs], {
  52 |         env: { ...process.env, E2E_TEST: "1" },
  53 |         stdio: "pipe",
  54 |       });
  55 | 
  56 |       // Wait for Electron's CDP endpoint to be available
  57 |       await waitForCDP("http://localhost:9222/json/version");
  58 | 
  59 |       const browser = await chromium.connectOverCDP("http://localhost:9222");
  60 | 
  61 |       await use(browser);
  62 | 
  63 |       browser.close().catch(() => {});
  64 |       child.kill();
  65 |       // Give Electron a moment to exit cleanly
  66 |       await new Promise((r) => setTimeout(r, 500));
  67 |     },
  68 |     { scope: "worker" },
  69 |   ],
  70 | 
  71 |   window: [
  72 |     async ({ app }, use) => {
  73 |       // connectOverCDP gives us a context with the existing pages
  74 |       let context = app.contexts()[0];
  75 |       if (!context) {
  76 |         context = await app.newContext();
  77 |       }
  78 |       let page = context.pages()[0];
  79 |       if (!page) {
  80 |         page = await context.newPage();
  81 |       }
  82 |       await page.waitForLoadState("domcontentloaded");
  83 |       await use(page);
  84 |     },
  85 |     { scope: "worker" },
  86 |   ],
  87 | });
  88 | 
  89 | export { expect } from "@playwright/test";
  90 | 
```