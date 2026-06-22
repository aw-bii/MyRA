export interface ThreatMatch {
  category: string;
  pattern: string;
  severity: "low" | "medium" | "high" | "critical";
  match: string;
  index: number;
}

export interface PatternDef {
  category: string;
  patterns: RegExp[];
  severity: ThreatMatch["severity"];
  weight: number;
}

// ORDER MATTERS: classify() returns the first match. Sort by severity descending
// so higher-severity patterns are checked first.
const PATTERNS: PatternDef[] = [
  {
    category: "prompt_injection",
    severity: "high",
    weight: 8,
    patterns: [
      /ignore\s+(all\s+)?(previous|prior|above).*(instructions|commands|directions)/i,
      /disregard\s+(all\s+)?(previous|prior).*(instructions|commands)/i,
    ],
  },
  {
    category: "system_prompt_extraction",
    severity: "high",
    weight: 8,
    patterns: [
      /repeat\s+(everything|all|every word|the text).*(above|before|starting|from)/i,
      /output\s+(the\s+)?(initial|system|original|first).*(prompt|instruction|message)/i,
      /what\s+(is|are|was|were)\s+(your|the)\s+(initial|system|original).*(prompt|instruction)/i,
      /print\s+(your|the)\s+(system|initial|full).*(prompt|instructions)/i,
    ],
  },
  {
    category: "jailbreak",
    severity: "critical",
    weight: 10,
    patterns: [
      /DAN\s+mode/i,
      /do\s+anything\s+now\s+mode/i,
      /jailbroken/i,
      /you\s+are\s+(now|currently)\s+in\s+(a\s+)?DAN/i,
      /superior\s+(mode|state|consciousness)/i,
    ],
  },
  {
    category: "encoded_payload",
    severity: "medium",
    weight: 5,
    patterns: [
      /base64\s*[:：][A-Za-z0-9+/=]{20,}/,
      /hex\s*[:：][0-9a-fA-F]{20,}/i,
      /rot13\s*[:：]/i,
    ],
  },
  {
    category: "role_play_bypass",
    severity: "high",
    weight: 7,
    patterns: [
      /hypothetical\s+scenario.*(no\s+(rules|restrictions|limits)|unconstrained)/i,
      /role[\s-]*play.*(ignore|bypass|override).*(rules|restrictions)/i,
      /fictional\s+context.*no\s+(rules|boundaries|limits)/i,
    ],
  },
];

export const ThreatPatterns = {
  classify(input: string): ThreatMatch | null {
    if (!input) return null;
    for (const def of PATTERNS) {
      for (const re of def.patterns) {
        const match = input.match(re);
        if (match) {
          return {
            category: def.category,
            pattern: re.source,
            severity: def.severity,
            match: match[0],
            index: match.index ?? 0,
          };
        }
      }
    }
    return null;
  },

  score(input: string): number {
    if (!input) return 0;
    let total = 0;
    for (const def of PATTERNS) {
      for (const re of def.patterns) {
        const matches = input.match(re);
        if (matches) {
          total += def.weight * matches.length;
        }
      }
    }
    return total;
  },

  getPatterns(): readonly PatternDef[] {
    return PATTERNS;
  },
};
