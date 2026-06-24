import { BaseHttpAdapter } from "./http-base-adapter";
import type { MessageChunk, Attachment } from "../../shared/types";

export class ClaudeApiAdapter extends BaseHttpAdapter {
  id = "claude-api";

  getDefaultModel(): string {
    return "claude-sonnet-4-20250514";
  }

  getBaseUrl(): string {
    return "https://api.anthropic.com/v1/messages";
  }

  getApiKeyHeader(key: string): Record<string, string> {
    return {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    };
  }

  buildRequestBody(params: {
    message: string;
    persona?: string;
    attachments?: Attachment[];
    model: string;
  }): object {
    const messages: any[] = [];
    const content: any[] = [{ type: "text", text: params.message }];

    if (params.attachments?.length) {
      for (const att of params.attachments) {
        if (att.mimeType?.startsWith("image/")) {
          content.push({
            type: "image",
            source: {
              type: "base64",
              media_type: att.mimeType,
              data: att.data,
            },
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
    const body: any = {
      model: params.model,
      max_tokens: 4096,
      messages,
      stream: true,
    };
    if (params.persona) {
      body.system = params.persona;
    }
    return body;
  }

  parseChunk(raw: unknown): MessageChunk | null {
    const data = raw as any;
    if (data?.type === "content_block_delta" && data.delta?.text) {
      return { type: "text", content: data.delta.text };
    }
    return null;
  }

  async listModels(): Promise<string[]> {
    return [
      "claude-sonnet-4-20250514",
      "claude-sonnet-4",
      "claude-haiku-3-5-20241022",
      "claude-opus-4-20250514",
    ];
  }
}
