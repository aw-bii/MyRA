import { describe, it, expect, vi, beforeEach } from "vitest";
import { SecurityConfig } from "./config";

describe("SecurityConfig", () => {
  beforeEach(() => {
    SecurityConfig.reset();
  });

  it("returns default allowed directories", () => {
    const dirs = SecurityConfig.getAllowedDirectories();
    expect(dirs.length).toBeGreaterThanOrEqual(1);
  });

  it("allows adding directories", () => {
    SecurityConfig.addAllowedDirectory("/custom/path");
    const dirs = SecurityConfig.getAllowedDirectories();
    expect(dirs).toContain("/custom/path");
  });

  it("deduplicates added directories", () => {
    SecurityConfig.addAllowedDirectory("/dup");
    SecurityConfig.addAllowedDirectory("/dup");
    const dirs = SecurityConfig.getAllowedDirectories();
    expect(dirs.filter((d) => d === "/dup").length).toBe(1);
  });

  it("returns write approval timeout", () => {
    expect(SecurityConfig.getWriteApprovalTimeoutMs()).toBe(30000);
  });
});
