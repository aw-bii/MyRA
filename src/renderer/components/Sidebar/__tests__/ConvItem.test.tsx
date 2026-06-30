import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("enters rename mode after 600ms touch hold", () => {
    render(
      <ConvItem
        conversation={conv}
        active={false}
        onClick={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /Test Conv/i });
    fireEvent.touchStart(btn);
    act(() => {
      vi.advanceTimersByTime(650);
    });
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
      />,
    );
    const btn = screen.getByRole("button", { name: /Test Conv/i });
    fireEvent.touchStart(btn);
    fireEvent.touchEnd(btn);
    act(() => {
      vi.advanceTimersByTime(650);
    });
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

describe("ConvItem keyboard rename", () => {
  it("pressing F2 on the button enters rename mode", () => {
    const conv = {
      id: "c1",
      title: "My Conv",
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
        onClick={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /My Conv/i });
    btn.focus();
    fireEvent.keyDown(btn, { key: "F2" });
    expect(screen.getByRole("textbox")).toBeTruthy();
  });
});

const baseConv = {
  id: "conv-1",
  title: "Test Conversation",
  backend: "claude",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  pipelineTemplateId: null,
  personaId: null,
};

describe("ConvItem delete confirmation", () => {
  it("shows confirm state on first delete click, does not call onDelete", async () => {
    const onDelete = vi.fn();
    render(
      <ConvItem
        conversation={baseConv}
        active={false}
        onClick={vi.fn()}
        onDelete={onDelete}
        onRename={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /delete conversation/i }),
    );
    expect(
      screen.getByRole("button", { name: /confirm delete/i }),
    ).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("calls onDelete after confirmation click", async () => {
    const onDelete = vi.fn();
    render(
      <ConvItem
        conversation={baseConv}
        active={false}
        onClick={vi.fn()}
        onDelete={onDelete}
        onRename={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /delete conversation/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /confirm delete/i }),
    );
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith("conv-1");
  });

  it("resets confirm state when conversation id changes", async () => {
    const onDelete = vi.fn();
    const { rerender } = render(
      <ConvItem
        conversation={baseConv}
        active={false}
        onClick={vi.fn()}
        onDelete={onDelete}
        onRename={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /delete conversation/i }),
    );
    rerender(
      <ConvItem
        conversation={{ ...baseConv, id: "conv-2" }}
        active={false}
        onClick={vi.fn()}
        onDelete={onDelete}
        onRename={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /confirm delete/i }),
    ).toBeNull();
  });
});
