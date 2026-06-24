import { BaseHttpAdapter } from "./http-base-adapter";
import type { MessageChunk, Attachment } from "../../shared/types";

export class OpenAIAdapter extends BaseHttpAdapter {
  id = "openai";

  getDefaultModel(): string {
    return "gpt-4o";
  }

  getBaseUrl(): string {
    return "https://api.openai.com/v1/chat/completions";
  }

  getApiKeyHeader(key: string): Record<string, string> {
    return { Authorization: `Bearer ${key}` };
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
    const content: any[] = [{ type: "text", text: params.message }];
    if (params.attachments?.length) {
      for (const att of params.attachments) {
        if (att.mimeType?.startsWith("image/")) {
          content.push({
            type: "image_url",
            image_url: { url: `data:${att.mimeType};base64,${att.data}` },
          });
        } else {
          content.push({
            type: "text",
            text: `[Attachment: ${att.originalName ?? "file"}]`,
          });
        }
      }
    }
    messages.push({ role: "user", content });
    return { model: params.model, messages, stream: true };
  }

  parseChunk(raw: unknown): MessageChunk | null {
    const data = raw as any;
    const delta = data?.choices?.[0]?.delta;
    if (delta?.content) {
      return { type: "text", content: delta.content };
    }
    return null;
  }

  async listModels(): Promise<string[]> {
    const key = (await import("../security/key-manager")).KeyManager.getKey(this.id);
    if (!key) return [this.getDefaultModel()];
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return [this.getDefaultModel()];
      const data = (await res.json()) as any;
      return (data.data ?? [])
        .map((m: any) => m.id)
        .filter((id: string) => /^(gpt|o[1-9])/.test(id))
        .sort();
    } catch {
      return [this.getDefaultModel()];
    }
  }
}
