import { it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CronJobForm } from "./CronJobForm";

it("renders all form fields", () => {
  render(<CronJobForm onCreate={vi.fn()} />);
  expect(screen.getByPlaceholderText("e.g., Daily standup")).toBeTruthy();
  expect(screen.getByPlaceholderText("e.g., 0 9 * * 1-5")).toBeTruthy();
  expect(screen.getByPlaceholderText("Message to execute")).toBeTruthy();
  expect(screen.getByText("Create Job")).toBeTruthy();
});

it("calls onCreate with form values when submitted", () => {
  const onCreate = vi.fn();
  render(<CronJobForm onCreate={onCreate} />);
  fireEvent.change(screen.getByPlaceholderText("e.g., Daily standup"), {
    target: { value: "My Job" },
  });
  fireEvent.change(screen.getByPlaceholderText("e.g., 0 9 * * 1-5"), {
    target: { value: "* * * * *" },
  });
  fireEvent.change(screen.getByPlaceholderText("Message to execute"), {
    target: { value: "do thing" },
  });
  fireEvent.click(screen.getByText("Create Job"));
  expect(onCreate).toHaveBeenCalledWith({
    name: "My Job",
    cronExpression: "* * * * *",
    prompt: "do thing",
    backend: "claude",
  });
});

it("does not call onCreate when fields are empty", () => {
  const onCreate = vi.fn();
  render(<CronJobForm onCreate={onCreate} />);
  fireEvent.click(screen.getByText("Create Job"));
  expect(onCreate).not.toHaveBeenCalled();
});
