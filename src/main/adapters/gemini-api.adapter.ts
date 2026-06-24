import { BaseHttpAdapter } from "./http-base-adapter";
import type { MessageChunk, Attachment } from "../../shared/types";

export class GeminiApiAdapter extends BaseHttpAdapter {
  id = "gemini-api";

  getDefaultModel(): string {
    return "gemini-2.0-flash";
  }

  getBaseUrl(): string {
    const model = this.currentModel ?? this.getDefaultModel();
    return `https://generativelanguage.googleapis.com/v1/models/${model}:streamGenerateContent?alt=sse`;
  }

  getApiKeyHeader(key: string): Record<string, string> {
    return { "x-goog-api-key": key };
  }

  buildRequestBody(params: {
    message: string;
    persona?: string;
    attachments?: Attachment[];
    model: string;
  }): object {
    const parts: any[] = [{ text: params.message }];
    if (params.attachments?.length) {
      for (const att of params.attachments) {
        if (att.mimeType?.startsWith("image/")) {
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.data,
            },
          });
        }
      }
    }
    const contents = [{ role: "user", parts }];
    const body: any = { contents };
    if (params.persona) {
      body.systemInstruction = { parts: [{ text: params.persona }] };
    }
    return body;
  }

  parseChunk(raw: unknown): MessageChunk | null {
    const data = raw as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      return { type: "text", content: text };
    }
    return null;
  }

  async listModels(): Promise<string[]> {
    return [
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
    ];
  }
}
