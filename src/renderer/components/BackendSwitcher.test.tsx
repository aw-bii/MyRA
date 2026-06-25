import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BackendSwitcher } from "./BackendSwitcher";

vi.mock("../hooks/useBackends", () => ({
  useBackends: () => ({
    backends: [
      { id: "claude", label: "Claude Code", available: true, authenticated: true },
      { id: "gemini", label: "Gemini CLI", available: true, authenticated: false },
    ],
  }),
}));

describe("BackendSwitcher", () => {
  it("shows no warning when the selected backend is authenticated", () => {
    render(<BackendSwitcher value="claude" onChange={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a warning when the selected backend is available but not authenticated", () => {
    render(<BackendSwitcher value="gemini" onChange={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/not signed in/i);
  });
});
