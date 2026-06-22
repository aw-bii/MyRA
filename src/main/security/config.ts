let allowedDirectories = new Set<string>([
  process.cwd(),
  process.env.HOME || process.env.USERPROFILE || "",
].filter(Boolean));

let writeApprovalTimeoutMs = 30_000;

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
    writeApprovalTimeoutMs = ms;
  },

  reset(): void {
    allowedDirectories = new Set([process.cwd(), process.env.HOME || process.env.USERPROFILE || ""].filter(Boolean));
    writeApprovalTimeoutMs = 30_000;
  },
};
