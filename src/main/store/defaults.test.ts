import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the store module before importing defaults
vi.mock("./index", () => ({
  ConvStore: {
    getSetting: vi.fn(),
    setSetting: vi.fn(),
    createPersona: vi.fn(),
    createPipelineTemplate: vi.fn(),
  },
}));

import { seedDefaults } from "./defaults";
import { ConvStore } from "./index";

describe("seedDefaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seeds personas and pipeline when not yet seeded", () => {
    (ConvStore.getSetting as ReturnType<typeof vi.fn>).mockReturnValue(
      undefined,
    );
    seedDefaults();
    expect(ConvStore.createPersona).toHaveBeenCalledTimes(5);
    expect(ConvStore.createPipelineTemplate).toHaveBeenCalledTimes(3);
    expect(ConvStore.setSetting).toHaveBeenCalledWith(
      "defaults_seeded_v2",
      "true",
    );

    // Verify Coder persona args
    expect(ConvStore.createPersona).toHaveBeenNthCalledWith(1, {
      name: "Coder",
      systemPrompt:
        "You are an expert software engineer. Be concise, use code blocks, prefer working solutions over explanations.",
      isDefault: true,
    });

    // Verify Explainer persona args
    expect(ConvStore.createPersona).toHaveBeenNthCalledWith(2, {
      name: "Explainer",
      systemPrompt:
        "You are a patient teacher. Explain concepts clearly using plain language and examples. Avoid jargon.",
      isDefault: false,
    });

    // Verify pipeline template args
    expect(ConvStore.createPipelineTemplate).toHaveBeenCalledWith(
      "Draft → Review",
      [
        { stepOrder: 0, backendId: "claude", personaId: null },
        { stepOrder: 1, backendId: "claude", personaId: null },
      ],
    );
  });

  it("does nothing when already seeded", () => {
    (ConvStore.getSetting as ReturnType<typeof vi.fn>).mockReturnValue("true");
    seedDefaults();
    expect(ConvStore.createPersona).not.toHaveBeenCalled();
    expect(ConvStore.createPipelineTemplate).not.toHaveBeenCalled();
    expect(ConvStore.setSetting).not.toHaveBeenCalled();
  });

  it("re-seeds when only the v1 key is set", () => {
    const getSetting = vi.fn((key: string) => {
      if (key === "defaults_seeded") return "true";
      if (key === "defaults_seeded_v2") return undefined;
      return undefined;
    });
    (ConvStore.getSetting as ReturnType<typeof vi.fn>).mockImplementation(
      getSetting,
    );

    seedDefaults();

    // Should call setSetting with v2 key to mark seeding as complete
    expect(ConvStore.setSetting).toHaveBeenCalledWith(
      "defaults_seeded_v2",
      "true",
    );

    // Should have created new personas including Researcher and Summariser
    expect(ConvStore.createPersona).toHaveBeenCalled();
    const personaCalls = (ConvStore.createPersona as ReturnType<typeof vi.fn>)
      .mock.calls;
    const personaNames = personaCalls.map((call) => call[0].name);
    expect(personaNames).toContain("Researcher");
    expect(personaNames).toContain("Summariser");
  });

  it("does not re-seed if v2 key is already set", () => {
    (ConvStore.getSetting as ReturnType<typeof vi.fn>).mockReturnValue("true");
    seedDefaults();
    expect(ConvStore.createPersona).not.toHaveBeenCalled();
    expect(ConvStore.createPipelineTemplate).not.toHaveBeenCalled();
    expect(ConvStore.setSetting).not.toHaveBeenCalled();
  });
});
