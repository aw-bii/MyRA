import { BaseHttpAdapter } from "./http-base-adapter";
import type { MessageChunk, Attachment } from "../../shared/types";

export class OllamaAdapter extends BaseHttpAdapter {
  id = "ollama";

  getDefaultModel(): string {
    return "llama3.2";
  }

  getBaseUrl(): string {
    return "http://localhost:11434/api/chat";
  }

  getApiKeyHeader(): Record<string, string> {
    return {};
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch("http://localhost:11434", {
        signal: AbortSignal.timeout(3_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async checkAuth(): Promise<boolean> {
    return this.isAvailable();
  }

  buildRequestBody(params: {
    message: string;
    persona?: string;
    attachments?: Attachment[];
    model: string;
  }): object {
    const messages: any[] = [];
    if (params.persona) {
      messages.push({ role: "system", content: params.persona });
    }
    let content = params.message;
    if (params.attachments?.length) {
      const files = params.attachments
        .map((a) => `[${a.originalName ?? "file"}]`)
        .join(", ");
      content += `\n\nAttachments: ${files}`;
    }
    messages.push({ role: "user", content });
    return { model: params.model, messages, stream: true };
  }

  parseChunk(raw: unknown): MessageChunk | null {
    const data = raw as any;
    if (data?.message?.content) {
      return { type: "text", content: data.message.content };
    }
    return null;
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch("http://localhost:11434/api/tags", {
        signal: AbortSignal.timeout(3_000),
      });
      if (!res.ok) return [this.getDefaultModel()];
      const data = (await res.json()) as any;
      return (data.models ?? []).map((m: any) => m.name).sort();
    } catch {
      return [this.getDefaultModel()];
    }
  }
}
