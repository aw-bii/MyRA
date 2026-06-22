import { test as base, chromium } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

// Playwright's _electron.launch() injects --remote-debugging-port=0 as a CLI
// arg, which Electron 30+ rejects at the OS arg-parser level (before any JS
// runs). The workaround: global-setup.ts spawns Electron with ELECTRON_RUN_AS_NODE
// unset and E2E_TEST=1, which causes main/index.ts to call
// app.commandLine.appendSwitch("remote-debugging-port", "9222").
// Tests connect to the already-running Electron via chromium.connectOverCDP.

type WorkerFixtures = {
  app: Browser;
  window: Page;
};

export const test = base.extend<Record<string, never>, WorkerFixtures>({
  app: [
    async ({}, use) => {
      const browser = await chromium.connectOverCDP("http://localhost:9222");
      await use(browser);
      // Do NOT close the browser here — global-teardown.ts kills the process.
    },
    { scope: "worker" },
  ],

  window: [
    async ({ app }, use) => {
      // connectOverCDP with Electron exposes each BrowserWindow as a separate
      // BrowserContext. Get the first context that has a page.
      let page: Page | null = null;
      for (let i = 0; i < 20; i++) {
        for (const ctx of app.contexts()) {
          const pages = ctx.pages();
          if (pages.length > 0) {
            page = pages[0];
            break;
          }
        }
        if (page) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      if (!page) throw new Error("No Electron window page found via CDP");
      await page.waitForLoadState("domcontentloaded");
      await use(page);
    },
    { scope: "worker" },
  ],
});

export { expect } from "@playwright/test";
