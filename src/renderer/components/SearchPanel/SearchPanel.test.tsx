import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SearchPanel } from "./SearchPanel";
import type { SearchResult } from "../../../shared/types";

vi.mock("../../ipc", () => ({
  searchConversations: vi.fn(),
}));

import { searchConversations } from "../../ipc";

describe("SearchPanel", () => {
  const mockOnSelect = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders search input", () => {
    render(<SearchPanel onSelect={mockOnSelect} onClose={mockOnClose} />);
    expect(screen.getByPlaceholderText("Search messages...")).toBeTruthy();
  });

  it("shows prompt when query is empty", () => {
    render(<SearchPanel onSelect={mockOnSelect} onClose={mockOnClose} />);
    expect(screen.getByText(/Type to search/i)).toBeTruthy();
  });

  it("calls searchConversations on input change", async () => {
    vi.mocked(searchConversations).mockResolvedValue([]);
    render(<SearchPanel onSelect={mockOnSelect} onClose={mockOnClose} />);
    const input = screen.getByPlaceholderText("Search messages...");
    fireEvent.change(input, { target: { value: "hello" } });
    await waitFor(() => {
      expect(searchConversations).toHaveBeenCalledWith("hello");
    });
  });

  it("displays search results", async () => {
    const results: SearchResult[] = [
      {
        message: {
          id: "m1",
          conversationId: "c1",
          role: "user",
          content: "Hello world",
          backend: "claude",
          stepIndex: null,
          createdAt: 1000,
        },
        conversationTitle: "Test Chat",
        snippet: "Hello world snippet",
        rank: 0.5,
      },
    ];
    vi.mocked(searchConversations).mockResolvedValue(results);
    render(<SearchPanel onSelect={mockOnSelect} onClose={mockOnClose} />);
    const input = screen.getByPlaceholderText("Search messages...");
    fireEvent.change(input, { target: { value: "hello" } });
    await waitFor(() => {
      expect(screen.getByText("Test Chat")).toBeTruthy();
      expect(screen.getByText("Hello world snippet")).toBeTruthy();
    });
  });

  it("shows no results when no matches", async () => {
    vi.mocked(searchConversations).mockResolvedValue([]);
    render(<SearchPanel onSelect={mockOnSelect} onClose={mockOnClose} />);
    const input = screen.getByPlaceholderText("Search messages...");
    fireEvent.change(input, { target: { value: "xyznonexistent" } });
    await waitFor(() => {
      expect(screen.getByText(/No results/i)).toBeTruthy();
    });
  });

  it("calls onSelect with conversationId on result click", async () => {
    const results: SearchResult[] = [
      {
        message: {
          id: "m1",
          conversationId: "c1",
          role: "user",
          content: "Hello world",
          backend: "claude",
          stepIndex: null,
          createdAt: 1000,
        },
        conversationTitle: "Test Chat",
        snippet: "Hello world snippet",
        rank: 0.5,
      },
    ];
    vi.mocked(searchConversations).mockResolvedValue(results);
    render(<SearchPanel onSelect={mockOnSelect} onClose={mockOnClose} />);
    const input = screen.getByPlaceholderText("Search messages...");
    fireEvent.change(input, { target: { value: "hello" } });
    await waitFor(() => {
      expect(screen.getByText("Test Chat")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("Test Chat"));
    expect(mockOnSelect).toHaveBeenCalledWith("c1");
  });

  it("calls onClose when X button clicked", () => {
    render(<SearchPanel onSelect={mockOnSelect} onClose={mockOnClose} />);
    const closeBtn = screen.getByLabelText("Close search");
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
