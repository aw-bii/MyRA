import path from "path";

interface SafePathResult {
  allowed: boolean;
  resolvedPath: string;
  reason?: string;
}

const TRAVERSAL_PATTERNS = [
  /\.\.(\/|\\)/,
  /%2e%2e/i,
  /%5c/i,
  /\u2025/,
  /\u2025\u2025/,
  /\.\.\u2215/,
  /\u2215\.\./,
];

function normalizeSlashes(p: string): string {
  return p.replace(/\\/g, "/");
}

export const PathSecurity = {
  isPathTraversal(input: string): boolean {
    const normalized = normalizeSlashes(input);
    if (path.isAbsolute(normalized)) return true;
    for (const re of TRAVERSAL_PATTERNS) {
      if (re.test(normalized)) return true;
    }
    return false;
  },

  resolveSafePath(
    targetPath: string,
    allowedDirectories: string[],
    baseDir?: string,
  ): SafePathResult {
    const resolved = baseDir
      ? path.resolve(baseDir, targetPath)
      : path.resolve(targetPath);
    const normalized = normalizeSlashes(resolved);

    for (const dir of allowedDirectories) {
      const normalizedDir = normalizeSlashes(path.resolve(dir));
      if (
        normalized.startsWith(
          normalizedDir.endsWith("/") ? normalizedDir : normalizedDir + "/",
        ) ||
        normalized === normalizedDir
      ) {
        return { allowed: true, resolvedPath: resolved };
      }
    }

    return {
      allowed: false,
      resolvedPath: resolved,
      reason: `Path "${resolved}" is outside allowed directories: ${allowedDirectories.join(", ")}`,
    };
  },
};
