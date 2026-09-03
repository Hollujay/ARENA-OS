import type { ModelRequest, ModelResponse } from "@domain/index";
import type { ModelAdapter } from "./types";
import { pickModelForTaskKind } from "./types";

interface ClaudeResponse {
  content?: Array<{ text?: string }>;
}

// Anthropic Claude adapter. Key is read server-side only.
export class ClaudeAdapter implements ModelAdapter {
  provider = "claude" as const;
  private key = process.env.ANTHROPIC_API_KEY || "";
  isAvailable() {
    return !!this.key;
  }

  async complete(req: ModelRequest): Promise<ModelResponse> {
    const start = Date.now();
    const model = pickModelForTaskKind(req.taskKind, "claude");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: req.maxTokens ?? 1024,
        temperature: req.temperature ?? 0.3,
        system: req.system,
        messages: [{ role: "user", content: req.prompt }],
      }),
    });
    if (!res.ok) throw new Error(`claude ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as ClaudeResponse;
    const text = data.content?.map((c) => c.text ?? "").join("") ?? "";
    let json: ModelResponse["json"];
    if (req.structured) {
      try {
        json = JSON.parse(text);
      } catch {
        /* ignore */
      }
    }
    return {
      provider: "claude",
      model,
      text,
      json,
      usageUsd: 0,
      latencyMs: Date.now() - start,
    };
  }
}
