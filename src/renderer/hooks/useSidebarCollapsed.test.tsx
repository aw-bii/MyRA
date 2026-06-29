import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSidebarCollapsed } from "./useSidebarCollapsed";

const KEY = "myra:sidebar-collapsed";

beforeEach(() => localStorage.clear());

describe("useSidebarCollapsed", () => {
  it("defaults to expanded (false) when localStorage is empty", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current[0]).toBe(false);
  });

  it("reads true from localStorage", () => {
    localStorage.setItem(KEY, "true");
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current[0]).toBe(true);
  });

  it("treats garbage localStorage value as false", () => {
    localStorage.setItem(KEY, "yes-please");
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current[0]).toBe(false);
  });

  it("toggle flips false → true and writes to localStorage", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem(KEY)).toBe("true");
  });

  it("toggle flips true → false and writes to localStorage", () => {
    localStorage.setItem(KEY, "true");
    const { result } = renderHook(() => useSidebarCollapsed());
    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
    expect(localStorage.getItem(KEY)).toBe("false");
  });
});
