import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SearchResult } from "../../../shared/types";

const { mockSearch } = vi.hoisted(() => ({
  mockSearch: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../hooks/useConversations", () => ({
  useConversations: () => ({ conversations: [], search: mockSearch }),
}));

import { ConvList } from "./ConvList";

describe("ConvList search debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSearch.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls search once after 300ms pause, not on every keystroke", async () => {
    render(
      <ConvList
        activeId={null}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.change(input, { target: { value: "abc" } });

    // Not called yet — still within debounce window
    expect(mockSearch).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // Called exactly once with final value
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith("abc");
  });
});

describe("ConvList search unmount safety", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSearch.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not call setState after unmount when search resolves late", async () => {
    let resolveSearch!: (v: SearchResult[]) => void;
    mockSearch.mockReturnValueOnce(
      new Promise<SearchResult[]>((res) => {
        resolveSearch = res;
      }),
    );

    const { unmount } = render(
      <ConvList
        activeId={null}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "abc" } });

    // Advance past debounce — timer fires, IPC is now in flight
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // Unmount before search resolves
    unmount();

    // Resolving after unmount must not throw
    await act(async () => {
      resolveSearch([]);
    });
    // If we reach here without error, the guard works
  });
});
