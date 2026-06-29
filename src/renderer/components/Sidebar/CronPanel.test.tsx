import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CronPanel } from "./CronPanel";

vi.mock("../../ipc/cron", () => ({
  getCronJobs: vi.fn(),
  createCronJob: vi.fn(),
  toggleCronJob: vi.fn(),
  deleteCronJob: vi.fn(),
  getCronJobLogs: vi.fn(),
  runCronJobNow: vi.fn(),
}));

import {
  getCronJobs,
  createCronJob,
  toggleCronJob,
  deleteCronJob,
  getCronJobLogs,
} from "../../ipc/cron";

describe("CronPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when no jobs", async () => {
    vi.mocked(getCronJobs).mockResolvedValue([]);
    render(<CronPanel />);
    await waitFor(() => {
      expect(screen.getByText(/No scheduled jobs/i)).toBeTruthy();
    });
  });

  it("renders job list from store", async () => {
    vi.mocked(getCronJobs).mockResolvedValue([
      {
        id: "j1",
        name: "Daily Report",
        cronExpression: "0 9 * * 1-5",
        prompt: "report",
        backend: "claude",
        conversationId: null,
        status: "active",
        lastRunAt: null,
        nextRunAt: null,
        createdAt: 1000,
        updatedAt: 1000,
        runCount: 0,
        lastError: null,
      },
    ]);
    render(<CronPanel />);
    await waitFor(() => {
      expect(screen.getByText("Daily Report")).toBeTruthy();
      expect(screen.getByText("0 9 * * 1-5")).toBeTruthy();
    });
  });

  it("shows create form when +New clicked", async () => {
    vi.mocked(getCronJobs).mockResolvedValue([]);
    render(<CronPanel />);
    await waitFor(() => {
      expect(screen.getByText("+ New")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("+ New"));
    expect(screen.getByPlaceholderText("e.g., Daily standup")).toBeTruthy();
    expect(screen.getByPlaceholderText("e.g., 0 9 * * 1-5")).toBeTruthy();
    expect(screen.getByText("Create Job")).toBeTruthy();
  });

  it("creates a job via IPC", async () => {
    vi.mocked(getCronJobs).mockResolvedValue([]);
    vi.mocked(createCronJob).mockResolvedValue({
      id: "j2",
      name: "Test Job",
      cronExpression: "* * * * *",
      prompt: "test",
      backend: "claude",
      conversationId: null,
      status: "active",
      lastRunAt: null,
      nextRunAt: null,
      createdAt: 2000,
      updatedAt: 2000,
      runCount: 0,
      lastError: null,
    });
    render(<CronPanel />);
    await waitFor(() => {
      expect(screen.getByText("+ New")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("+ New"));
    fireEvent.change(screen.getByPlaceholderText("e.g., Daily standup"), {
      target: { value: "Test Job" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g., 0 9 * * 1-5"), {
      target: { value: "* * * * *" },
    });
    fireEvent.change(screen.getByPlaceholderText("Message to execute"), {
      target: { value: "test" },
    });
    fireEvent.click(screen.getByText("Create Job"));
    await waitFor(() => {
      expect(createCronJob).toHaveBeenCalledWith({
        name: "Test Job",
        cronExpression: "* * * * *",
        prompt: "test",
        backend: "claude",
      });
    });
  });

  it("toggles a job", async () => {
    vi.mocked(getCronJobs).mockResolvedValue([
      {
        id: "j1",
        name: "Job",
        cronExpression: "* * * * *",
        prompt: "p",
        backend: "claude",
        conversationId: null,
        status: "active",
        lastRunAt: null,
        nextRunAt: null,
        createdAt: 1000,
        updatedAt: 1000,
        runCount: 0,
        lastError: null,
      },
    ]);
    vi.mocked(toggleCronJob).mockResolvedValue({
      id: "j1",
      name: "Job",
      cronExpression: "* * * * *",
      prompt: "p",
      backend: "claude",
      conversationId: null,
      status: "paused",
      lastRunAt: null,
      nextRunAt: null,
      createdAt: 1000,
      updatedAt: 2000,
      runCount: 0,
      lastError: null,
    });
    render(<CronPanel />);
    await waitFor(() => {
      expect(screen.getByText("Pause")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("Pause"));
    await waitFor(() => {
      expect(toggleCronJob).toHaveBeenCalledWith("j1");
    });
  });

  it("deletes a job", async () => {
    vi.mocked(getCronJobs).mockResolvedValue([
      {
        id: "j1",
        name: "Job",
        cronExpression: "* * * * *",
        prompt: "p",
        backend: "claude",
        conversationId: null,
        status: "active",
        lastRunAt: null,
        nextRunAt: null,
        createdAt: 1000,
        updatedAt: 1000,
        runCount: 0,
        lastError: null,
      },
    ]);
    render(<CronPanel />);
    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() => {
      expect(deleteCronJob).toHaveBeenCalledWith("j1");
    });
  });

  it("shows job logs when Logs clicked", async () => {
    vi.mocked(getCronJobs).mockResolvedValue([
      {
        id: "j1",
        name: "Job",
        cronExpression: "* * * * *",
        prompt: "p",
        backend: "claude",
        conversationId: null,
        status: "active",
        lastRunAt: null,
        nextRunAt: null,
        createdAt: 1000,
        updatedAt: 1000,
        runCount: 0,
        lastError: null,
      },
    ]);
    vi.mocked(getCronJobLogs).mockResolvedValue([
      {
        id: "l1",
        cronJobId: "j1",
        startedAt: 5000,
        finishedAt: 6000,
        success: true,
        conversationId: "c1",
        error: null,
      },
    ]);
    render(<CronPanel />);
    await waitFor(() => {
      expect(screen.getByText("Logs")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("Logs"));
    await waitFor(() => {
      expect(getCronJobLogs).toHaveBeenCalledWith("j1");
    });
  });
});
