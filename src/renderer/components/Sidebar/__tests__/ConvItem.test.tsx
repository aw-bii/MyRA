import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ConvItem } from "../ConvItem";
import type { Conversation } from "../../../../shared/types";

describe("ConvItem", () => {
  const conv: Conversation = {
    id: "c1",
    title: "Test Conversation",
    backend: "claude",
    personaId: null,
    pipelineTemplateId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it("renders conversation title", () => {
    render(
      <ConvItem
        conversation={conv}
        active={false}
        onClick={() => {}}
        onDelete={() => {}}
        onRename={() => {}}
      />,
    );
    expect(screen.getByText("Test Conversation")).toBeTruthy();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(
      <ConvItem
        conversation={conv}
        active={false}
        onClick={onClick}
        onDelete={() => {}}
        onRename={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("Test Conversation"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows delete button", () => {
    render(
      <ConvItem
        conversation={conv}
        active={false}
        onClick={() => {}}
        onDelete={() => {}}
        onRename={() => {}}
      />,
    );
    expect(screen.getByLabelText("Delete conversation")).toBeTruthy();
  });

  it("shows backend label", () => {
    render(
      <ConvItem
        conversation={conv}
        active={false}
        onClick={() => {}}
        onDelete={() => {}}
        onRename={() => {}}
      />,
    );
    expect(screen.getByText("claude")).toBeTruthy();
  });

  it("marks active conversation with aria-current", () => {
    const conv: Conversation = {
      id: "1",
      title: "Test conversation",
      backend: "claude",
      personaId: null,
      pipelineTemplateId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    render(
      <ConvItem
        conversation={conv}
        active={true}
        onClick={() => {}}
        onDelete={() => {}}
        onRename={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Test conversation/i }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("shows full title in tooltip on truncated span", () => {
    const conv: Conversation = {
      id: "1",
      title: "A very long conversation title that will definitely truncate",
      backend: "claude",
      personaId: null,
      pipelineTemplateId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    render(
      <ConvItem
        conversation={conv}
        active={false}
        onClick={() => {}}
        onDelete={() => {}}
        onRename={() => {}}
      />,
    );
    expect(
      screen.getByTitle(
        "A very long conversation title that will definitely truncate",
      ),
    ).toBeInTheDocument();
  });
});

describe("ConvItem long-press rename", () => {
  const conv = {
    id: "c1",
    title: "Test Conv",
    backend: "claude",
    personaId: null,
    pipelineTemplateId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("enters rename mode after 600ms touch hold", () => {
    render(
      <ConvItem
        conversation={conv}
        active={false}
        onClick={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
      />
    );
    const btn = screen.getByRole("button", { name: /Test Conv/i });
    fireEvent.touchStart(btn);
    act(() => { vi.advanceTimersByTime(650); });
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("does not enter rename on short tap", () => {
    render(
      <ConvItem
        conversation={conv}
        active={false}
        onClick={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
      />
    );
    const btn = screen.getByRole("button", { name: /Test Conv/i });
    fireEvent.touchStart(btn);
    fireEvent.touchEnd(btn);
    act(() => { vi.advanceTimersByTime(650); });
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
