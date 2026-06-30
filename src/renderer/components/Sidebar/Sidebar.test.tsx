// src/renderer/components/Sidebar/Sidebar.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Sidebar } from "./Sidebar";

vi.mock("../../ipc/conversation", () => ({
  listConversations: vi.fn().mockResolvedValue([]),
  searchConversations: vi.fn().mockResolvedValue([]),
  createConversation: vi.fn().mockResolvedValue({ id: "1", title: "Test" }),
}));

const base = {
  collapsed: false,
  activeId: null,
  onSelect: vi.fn(),
  onNew: vi.fn(),
  onDelete: vi.fn(),
  onRename: vi.fn(),
  refreshTrigger: 0,
  onOpenSettings: vi.fn(),
};

describe("Sidebar", () => {
  it("renders the settings gear button", () => {
    render(<Sidebar {...base} />);
    expect(
      screen.getByRole("button", { name: /settings/i }),
    ).toBeInTheDocument();
  });

  it("calls onOpenSettings when gear clicked", () => {
    const onOpenSettings = vi.fn();
    render(<Sidebar {...base} onOpenSettings={onOpenSettings} />);
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    expect(onOpenSettings).toHaveBeenCalled();
  });
});
