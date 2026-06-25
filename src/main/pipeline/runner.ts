import { AdapterManager, securityMiddleware } from "../adapters/manager";
import { BrowserWindow } from "electron";
import { IPC } from "../../shared/ipc";
import type { PipelineChunk } from "../../shared/types";

interface ResolvedStep {
  adapterId: string;
  persona?: string;
}

export class PipelineRunner {
  private abortMap = new Map<string, () => void>();

  async run(params: {
    conversationId: string;
    userMessage: string;
    steps: ResolvedStep[];
    onChunk: (chunk: PipelineChunk) => void;
    onStepDone: (stepIndex: number) => void;
  }): Promise<void> {
    let aborted = false;
    this.abortMap.set(params.conversationId, () => {
      aborted = true;
    });

    let currentInput = params.userMessage;

    try {
      for (let i = 0; i < params.steps.length; i++) {
        if (aborted) break;
        const win = BrowserWindow.getAllWindows()[0] ?? null;
        const step = params.steps[i];
        const adapter = AdapterManager.get(step.adapterId);
        if (!adapter) throw new Error(`Adapter not found: ${step.adapterId}`);

        let accumulated = "";
        let stepCompleted = false;
        for await (const chunk of securityMiddleware(
          adapter.send(currentInput, step.persona),
          adapter.id,
          (evt) => {
            win?.webContents.send(IPC.SECURITY_EVENT, evt);
          },
        )) {
          if (aborted) {
            adapter.abort();
            break;
          }
          params.onChunk({ ...chunk, stepIndex: i });
          if (chunk.type === "text") accumulated += chunk.content;
          if (chunk.type === "done") {
            stepCompleted = true;
            break;
          }
        }

        if (!aborted && stepCompleted) {
          params.onStepDone(i);
          currentInput = accumulated;
        }
      }
    } finally {
      this.abortMap.delete(params.conversationId);
    }
  }

  abort(conversationId: string): void {
    const fn = this.abortMap.get(conversationId);
    if (fn) fn();
  }
}

export const pipelineRunner = new PipelineRunner();
