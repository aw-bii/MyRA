import { test as base, chromium } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

// Playwright's _electron.launch() injects --remote-debugging-port=0 as a CLI
// arg, which Electron 30+ rejects at the OS arg-parser level (before any JS
// runs). The workaround is to spawn Electron ourselves and let the main
// process call app.commandLine.appendSwitch('remote-debugging-port', '9222'),
// then connect with chromium.connectOverCDP.

type WorkerFixtures = {
  app: Browser;
  window: Page;
};

async function waitForCDP(url: string, retries = 30, delayMs = 500): Promise<void> {
  for (let i = 0; i < retries; i++) {
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

export const test = base.extend<{}, WorkerFixtures>({
  app: [
    async ({}, use) => {
      const electronExe = path.join(
        process.cwd(),
        "node_modules",
        "electron",
        "dist",
        "electron.exe",
      );
      const mainJs = path.join(process.cwd(), "out", "main", "index.js");

      // Clean up stale E2E DB so each run starts fresh
      const e2eDb = path.join(
        require("os").tmpdir(),
        "bii-e2e-test",
        "conversations.db",
      );
      if (fs.existsSync(e2eDb)) fs.rmSync(e2eDb);

      const child: ChildProcess = spawn(electronExe, [mainJs], {
        env: { ...process.env, E2E_TEST: "1" },
        stdio: "pipe",
      });

      // Wait for Electron's CDP endpoint to be available
      await waitForCDP("http://localhost:9222/json/version");

      const browser = await chromium.connectOverCDP("http://localhost:9222");

      await use(browser);

      browser.close().catch(() => {});
      child.kill();
      // Give Electron a moment to exit cleanly
      await new Promise((r) => setTimeout(r, 500));
    },
    { scope: "worker" },
  ],

  window: [
    async ({ app }, use) => {
      // connectOverCDP gives us a context with the existing pages
      let context = app.contexts()[0];
      if (!context) {
        context = await app.newContext();
      }
      let page = context.pages()[0];
      if (!page) {
        page = await context.newPage();
      }
      await page.waitForLoadState("domcontentloaded");
      await use(page);
    },
    { scope: "worker" },
  ],
});

export { expect } from "@playwright/test";
