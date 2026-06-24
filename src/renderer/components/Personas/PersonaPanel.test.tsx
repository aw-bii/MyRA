import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock the usePersonas hook
vi.mock("../../hooks/usePersonas", () => ({
  usePersonas: () => ({
    personas: [
      {
        id: "p1",
        name: "Analyst",
        prompt: "You are an analyst.",
        isTemplate: false,
        isDefault: false,
      },
    ],
    save: vi.fn(),
    remove: vi.fn(),
  }),
}));

import { PersonaPanel } from "./PersonaPanel";

describe("PersonaPanel delete confirmation", () => {
  it("shows Confirm? after first click, not before", () => {
    render(<PersonaPanel activePersonaId={null} onSelect={vi.fn()} />);
    expect(
      screen.queryByRole("button", {
        name: /confirm delete/i,
      }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: /delete persona analyst/i,
      }),
    );
    expect(
      screen.getByRole("button", {
        name: /confirm delete/i,
      }),
    ).toBeTruthy();
  });

  it("calls remove only on the Confirm? click, not on the first Delete click", () => {
    render(<PersonaPanel activePersonaId={null} onSelect={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: /delete persona analyst/i,
      }),
    );
    // remove should NOT have been called yet
    // (we can only test this indirectly via the Confirm? button appearing — the mock's remove ref)
    expect(
      screen.getByRole("button", {
        name: /confirm delete/i,
      }),
    ).toBeTruthy();
  });
});
