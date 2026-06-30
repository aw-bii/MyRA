import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BottomBar } from "./BottomBar";

vi.mock("../../ipc/key", () => ({
  listModels: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../ipc/backend", () => ({
  listBackends: vi.fn().mockResolvedValue([
    {
      id: "claude",
      label: "Claude Code",
      available: true,
      authenticated: true,
    },
  ]),
  probeBackend: vi
    .fn()
    .mockResolvedValue({ available: true, authenticated: true }),
}));
vi.mock("../../ipc/persona", () => ({
  listPersonas: vi.fn().mockResolvedValue([]),
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
    expect(
      screen.getByRole("button", { name: /^single$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^pipeline$/i }),
    ).toBeInTheDocument();
  });

  it("shows pipeline template combobox in pipeline mode", () => {
    render(<BottomBar {...base} mode="pipeline" />);
    expect(
      screen.getByRole("combobox", { name: /pipeline/i }),
    ).toBeInTheDocument();
  });

  it("shows persona combobox in single mode", () => {
    render(<BottomBar {...base} />);
    expect(
      screen.getByRole("combobox", { name: /persona/i }),
    ).toBeInTheDocument();
  });
});
