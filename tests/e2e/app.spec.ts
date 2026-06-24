import { test, expect } from "./fixtures";

// Tests run sequentially in a single worker sharing one Electron instance.
// Each test builds on the state left by the previous one — this is intentional
// for a "full flow" E2E that mirrors real user behaviour.

test("wizard flow — complete all 3 steps", async ({ window }) => {
  // Step 1: wizard is visible and backend detection runs
  await expect(
    window.getByRole("heading", { name: "Setting up your tools" }),
  ).toBeVisible({ timeout: 10_000 });

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
    window.getByText("All tools are signed in"),
  ).toBeVisible({ timeout: 5_000 });

  await window.getByRole("button", { name: "Finish Setup" }).click();

  // Main app loaded — sidebar header visible (use exact match to avoid the
  // "Welcome to MyRA" empty-state heading also matching)
  await expect(
    window.getByText("MyRA", { exact: true }).first(),
  ).toBeVisible({ timeout: 5_000 });
});

test("chat flow — send a message and receive echo", async ({ window }) => {
  // The empty state is shown when mode=single and no active conversation.
  // Switch to Pipeline mode (exact: true avoids matching "Pipelines" button)
  // so that ChatView with InputBar renders even without an active conversation.
  await window.getByRole("button", { name: "Pipeline", exact: true }).click();

  // Verify ChatView is now visible (the mode toggle shows Single/Pipeline)
  await expect(window.getByPlaceholder("Message...")).toBeVisible({
    timeout: 5_000,
  });

  // Switch back to Single mode to access the BackendSwitcher, then select test
  await window.getByRole("button", { name: "Single", exact: true }).click();

  // Wait for the BackendSwitcher to be visible and the test option to appear
  const switcher = window.locator("select").first();
  await expect(switcher.locator("option[value='test']")).toHaveCount(1, {
    timeout: 10_000,
  });

  // Use page.evaluate() (bypasses Playwright actionability checks entirely)
  // and the native HTMLSelectElement setter to ensure React's synthetic event
  // system picks up the change.
  await window.evaluate(() => {
    const el = document.querySelectorAll("select")[0] as HTMLSelectElement;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )!.set!;
    nativeInputValueSetter.call(el, "test");
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // Verify the select now shows "test"
  await expect(switcher).toHaveValue("test", { timeout: 3_000 });

  // Switch to Pipeline mode to make ChatView visible (single mode with
  // no active conversation shows an empty state instead of ChatView)
  await window.getByRole("button", { name: "Pipeline", exact: true }).click();

  const input = window.getByPlaceholder("Message...");
  await expect(input).toBeVisible({ timeout: 5_000 });

  // Type a message and send
  await input.fill("hello e2e");
  await input.press("Control+Enter");

  // Echo response appears — TestAdapter echoes after 50ms.
  // We skip asserting the user bubble separately because the sidebar title
  // also contains "hello e2e" (exact match picks up both); asserting the echo
  // response is sufficient proof the full round-trip succeeded.
  await expect(window.getByText("Echo: hello e2e")).toBeVisible({
    timeout: 10_000,
  });

  // Switch back to Single mode. Now activeConvId is set (created by the send),
  // so ChatView remains visible in subsequent tests.
  await window.getByRole("button", { name: "Single", exact: true }).click();
});

test("persona flow — create a persona and assign it", async ({ window }) => {
  // Open persona panel — "Personas" is exact button text in the toolbar
  await window.getByRole("button", { name: "Personas", exact: true }).click();

  // The PersonaPanel heading is an h3 — wait for it to confirm panel is open
  await expect(
    window.locator("h3").filter({ hasText: "Personas" }),
  ).toBeVisible({ timeout: 3_000 });

  // Open new persona form — scope to the w-72 panel to avoid the sidebar's
  // "+ New" button also matching
  await window
    .locator(".w-72")
    .getByRole("button", { name: "+ New", exact: true })
    .first()
    .click();

  // Fill in name and system prompt
  await window.getByPlaceholder("e.g. Code Reviewer").fill("E2E Persona");
  await window
    .getByPlaceholder("You are a helpful assistant that...")
    .fill("You are a test assistant.");

  // Save
  await window.getByRole("button", { name: "Save", exact: true }).click();

  // Persona appears in the list
  await expect(window.getByText("E2E Persona")).toBeVisible({ timeout: 3_000 });

  // Select the persona by clicking the item (the div with role="button")
  // Use the locator that targets the persona list item, not the Edit button
  await window
    .locator(".w-72")
    .getByText("E2E Persona", { exact: true })
    .click();

  // Send a message with persona active — ChatView is visible because test 2
  // created a conversation (activeConvId is set after test 2)
  const input = window.getByPlaceholder("Message...");
  await expect(input).toBeVisible({ timeout: 5_000 });
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
  // (same Electron session — DB persists across tests in this worker).
  // ConvList renders conversation titles as buttons.
  const sidebar = window.locator(".w-64");
  const convItems = sidebar
    .locator("button")
    .filter({ hasText: /hello e2e|persona test/i });
  await expect(convItems.first()).toBeVisible({ timeout: 5_000 });
});
