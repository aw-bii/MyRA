import { ConvStore } from "./index";

export function seedDefaults(): void {
  if (ConvStore.getSetting("defaults_seeded_v2")) return;

  ConvStore.createPersona({
    name: "Coder",
    systemPrompt:
      "You are an expert software engineer. Be concise, use code blocks, prefer working solutions over explanations.",
    isDefault: true,
  });

  ConvStore.createPersona({
    name: "Explainer",
    systemPrompt:
      "You are a patient teacher. Explain concepts clearly using plain language and examples. Avoid jargon.",
    isDefault: false,
  });

  ConvStore.createPersona({
    name: "Researcher",
    systemPrompt:
      "You are a thorough researcher. Cite sources, consider multiple perspectives, flag uncertainties explicitly.",
    isDefault: false,
  });

  ConvStore.createPersona({
    name: "Summariser",
    systemPrompt:
      "You produce concise summaries. Extract the key points, use bullet lists, and keep responses under 200 words unless asked otherwise.",
    isDefault: false,
  });

  ConvStore.createPersona({
    name: "Devil's Advocate",
    systemPrompt:
      "Challenge every claim. Point out flaws, edge cases, and alternative views. Be rigorous, not contrarian.",
    isDefault: false,
  });

  ConvStore.createPipelineTemplate("Draft → Review", [
    { stepOrder: 0, backendId: "claude", personaId: null },
    { stepOrder: 1, backendId: "claude", personaId: null },
  ]);

  ConvStore.createPipelineTemplate("Research → Summarise", [
    { stepOrder: 0, backendId: "claude", personaId: null },
    { stepOrder: 1, backendId: "claude", personaId: null },
  ]);

  ConvStore.createPipelineTemplate("Draft → Critique → Revise", [
    { stepOrder: 0, backendId: "claude", personaId: null },
    { stepOrder: 1, backendId: "claude", personaId: null },
    { stepOrder: 2, backendId: "claude", personaId: null },
  ]);

  ConvStore.setSetting("defaults_seeded_v2", "true");
}
