import { ClaudeAdapter } from "./claude.adapter";
import { GeminiAdapter } from "./gemini.adapter";
import { OpencodeAdapter } from "./opencode.adapter";
import { TestAdapter } from "./test.adapter";
import type { BackendAdapter, BackendInfo } from "../../shared/types";
import { ThreatPatterns } from "../security";
import type { SecurityEvent } from "../../shared/types";

export async function* securityMiddleware(
  source: AsyncIterable<import("../../shared/types").MessageChunk>,
  backendId: string,
  onEvent: (event: SecurityEvent) => void,
): AsyncIterable<import("../../shared/types").MessageChunk> {
  for await (const chunk of source) {
    if (chunk.type === "text" && chunk.content) {
      const threat = ThreatPatterns.classify(chunk.content);
      if (threat) {
        onEvent({
          type: "injection_detected",
          severity: threat.severity,
          message: `Potential ${threat.category} detected`,
          detail: `Matched pattern: "${threat.match}" at position ${threat.index}`,
          source: backendId,
        });
      }
    }
    yield chunk;
  }
}

const registry: BackendAdapter[] = [
  new ClaudeAdapter(),
  new GeminiAdapter(),
  new OpencodeAdapter(),
];

if (process.env.E2E_TEST === "1") {
  registry.push(new TestAdapter());
}

let activeId = "claude";

export const AdapterManager = {
  getActive(): BackendAdapter {
    return registry.find((a) => a.id === activeId)!;
  },

  setActive(id: string): void {
    if (!registry.find((a) => a.id === id))
      throw new Error(`Unknown adapter: ${id}`);
    activeId = id;
  },

  get(id: string): BackendAdapter | undefined {
    return registry.find((a) => a.id === id);
  },

  async listAvailable(): Promise<BackendInfo[]> {
    return Promise.all(
      registry.map(async (a) => ({
        id: a.id,
        label: labelFor(a.id),
        available: await a.isAvailable(),
        authenticated: await a.checkAuth(),
      })),
    );
  },
};

function labelFor(id: string): string {
  return (
    { claude: "Claude Code", gemini: "Gemini CLI", opencode: "Opencode" }[id] ??
    id
  );
}
