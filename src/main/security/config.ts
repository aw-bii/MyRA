const DEFAULT_DIRS = [
  process.cwd(),
  process.env.HOME || process.env.USERPROFILE || "",
].filter(Boolean) as string[];
const DEFAULT_TIMEOUT_MS = 30_000;

let allowedDirectories = new Set<string>(DEFAULT_DIRS);
let writeApprovalTimeoutMs = DEFAULT_TIMEOUT_MS;

export const SecurityConfig = {
  getAllowedDirectories(): string[] {
    return Array.from(allowedDirectories).filter(Boolean);
  },

  addAllowedDirectory(dir: string): void {
    if (dir) allowedDirectories.add(dir);
  },

  removeAllowedDirectory(dir: string): void {
    allowedDirectories.delete(dir);
  },

  setAllowedDirectories(dirs: string[]): void {
    allowedDirectories = new Set(dirs.filter(Boolean));
  },

  getWriteApprovalTimeoutMs(): number {
    return writeApprovalTimeoutMs;
  },

  setWriteApprovalTimeoutMs(ms: number): void {
    writeApprovalTimeoutMs = ms > 0 ? ms : DEFAULT_TIMEOUT_MS;
  },

  reset(): void {
    allowedDirectories = new Set(DEFAULT_DIRS);
    writeApprovalTimeoutMs = DEFAULT_TIMEOUT_MS;
  },
};
