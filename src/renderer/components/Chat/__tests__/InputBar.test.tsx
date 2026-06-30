import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("../../ipc/attachment", () => ({
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
}));
vi.mock("../../hooks/useAttachments", () => ({
  useAttachments: () => ({
    pending: [],
    errors: [],
    ingesting: false,
    addFiles: vi.fn(),
    removeFile: vi.fn(),
    clear: vi.fn(),
  }),
}));

import { InputBar } from "../InputBar";

describe("InputBar accessibility", () => {
  it("textarea has an accessible name", () => {
    render(<InputBar onSend={vi.fn()} onAbort={vi.fn()} streaming={false} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAccessibleName();
  });
});

describe("InputBar Send/Stop", () => {
  it("shows Send button when not streaming", () => {
    render(<InputBar onSend={vi.fn()} onAbort={vi.fn()} streaming={false} />);
    expect(screen.getByRole("button", { name: /send/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /stop/i })).toBeNull();
  });

  it("shows Stop button when streaming", () => {
    render(<InputBar onSend={vi.fn()} onAbort={vi.fn()} streaming={true} />);
    expect(screen.getByRole("button", { name: /stop/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /send/i })).toBeNull();
  });
});
