import path from "path";
import { describe, it, expect } from "vitest";
import { PathSecurity } from "./path-security";

describe("PathSecurity", () => {
  describe("isPathTraversal", () => {
    it("detects simple traversal with ..", () => {
      expect(PathSecurity.isPathTraversal("../etc/passwd")).toBe(true);
    });

    it("detects double .. traversal", () => {
      expect(PathSecurity.isPathTraversal("../../etc/passwd")).toBe(true);
    });

    it("detects absolute path traversal on Unix", () => {
      expect(PathSecurity.isPathTraversal("/etc/passwd")).toBe(true);
    });

    it("detects absolute path traversal on Windows", () => {
      expect(
        PathSecurity.isPathTraversal("C:\\Windows\\system32\\config"),
      ).toBe(true);
    });

    it("detects encoded traversal %2e%2e%2f", () => {
      expect(PathSecurity.isPathTraversal("%2e%2e%2fetc%2fpasswd")).toBe(true);
    });

    it("detects unicode normalization traversal", () => {
      expect(PathSecurity.isPathTraversal("\u2025\u2025/etc/passwd")).toBe(
        true,
      );
    });

    it("allows safe relative paths", () => {
      expect(PathSecurity.isPathTraversal("data/file.txt")).toBe(false);
    });

    it("allows safe paths with dots", () => {
      expect(PathSecurity.isPathTraversal("data/file.test.txt")).toBe(false);
    });
  });

  describe("resolveSafePath", () => {
    const allowedDirs = ["/home/user/project", "/tmp/bii"];

    it("resolves path within allowed directory", () => {
      const result = PathSecurity.resolveSafePath(
        "/home/user/project/src/file.ts",
        allowedDirs,
      );
      expect(result.allowed).toBe(true);
      expect(result.resolvedPath).toBe(
        path.resolve("/home/user/project/src/file.ts"),
      );
    });

    it("rejects path outside allowed directories", () => {
      const result = PathSecurity.resolveSafePath("/etc/passwd", allowedDirs);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("outside allowed");
    });

    it("resolves relative path against base", () => {
      const result = PathSecurity.resolveSafePath(
        "src/file.ts",
        allowedDirs,
        "/home/user/project",
      );
      expect(result.allowed).toBe(true);
      expect(result.resolvedPath).toBe(
        path.resolve("/home/user/project/src/file.ts"),
      );
    });
  });
});
