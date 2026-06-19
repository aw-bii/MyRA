import { test, expect } from "./fixtures";

// Tests run sequentially in a single worker sharing one Electron instance.
// Each test builds on the state left by the previous one — this is intentional
// for a "full flow" E2E that mirrors real user behaviour.

test("wizard flow — complete all 3 steps", async ({ window }) => {
  // Step 1: wizard is visible and backend detection runs
  await expect(window.getByText("Detecting AI backends")).toBeVisible({
    timeout: 10_000,
  });

  // Wait for probe to finish (Next button becomes enabled)
  const nextBtn = window.getByRole("button", { name: "Next" });
  await expect(nextBtn).toBeEnabled({ timeout: 10_000 });
  await nextBtn.click();

  // Step 2: optional installs — click Continue to skip
  const continueBtn = window.getByRole("button", { name: /next|continue/i });
  await expect(continueBtn).toBeVisible({ timeout: 5_000 });
  await continueBtn.click();

  // Step 3: auth check — all available backends authenticated
  await expect(
    window.getByText("All available backends are authenticated"),
  ).toBeVisible({ timeout: 5_000 });

  await window.getByRole("button", { name: "Finish Setup" }).click();

  // Main app loaded — sidebar header visible
  await expect(window.getByText("BII Agent Harness")).toBeVisible({
    timeout: 5_000,
  });
});

test("chat flow — send a message and receive echo", async ({ window }) => {
  // Select the test backend from the BackendSwitcher
  const switcher = window.locator("select").first();
  await switcher.selectOption("test");

  // Type a message and send
  const input = window.getByPlaceholder("Message...");
  await input.fill("hello e2e");
  await input.press("Control+Enter");

  // User bubble appears
  await expect(window.getByText("hello e2e")).toBeVisible({ timeout: 5_000 });

  // Echo response appears
  await expect(window.getByText("Echo: hello e2e")).toBeVisible({
    timeout: 10_000,
  });
});

test("persona flow — create a persona and assign it", async ({ window }) => {
  // Open persona panel
  await window.getByRole("button", { name: "Personas" }).click();
  await expect(window.getByText("Personas")).toBeVisible({ timeout: 3_000 });

  // Open new persona form
  await window.getByRole("button", { name: "+ New" }).click();

  // Fill in name and system prompt
  await window.getByPlaceholder("Name").fill("E2E Persona");
  await window.getByPlaceholder("System prompt...").fill("You are a test assistant.");

  // Save
  await window.getByRole("button", { name: "Save" }).click();

  // Persona appears in the list
  await expect(window.getByText("E2E Persona")).toBeVisible({ timeout: 3_000 });

  // Select the persona
  await window.getByText("E2E Persona").click();

  // Send a message with persona active
  const input = window.getByPlaceholder("Message...");
  await input.fill("persona test");
  await input.press("Control+Enter");

  await expect(window.getByText("Echo: persona test")).toBeVisible({
    timeout: 10_000,
  });
});

test("history flow — conversations from earlier tests appear in sidebar", async ({
  window,
}) => {
  // The sidebar should list conversations created in the chat and persona tests
  // (same Electron session — DB persists across tests in this worker)
  const sidebar = window.locator(".w-64");
  const convItems = sidebar.locator("button").filter({ hasText: /hello e2e|persona test/i });
  await expect(convItems.first()).toBeVisible({ timeout: 5_000 });
});
