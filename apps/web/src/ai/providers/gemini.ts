import type { ModelRequest, ModelResponse } from "@domain/index";
import type { ModelAdapter } from "./types";
import { pickModelForTaskKind } from "./types";

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

// Google Gemini adapter. Key is read server-side only.
export class GeminiAdapter implements ModelAdapter {
  provider = "gemini" as const;
  private key = process.env.GEMINI_API_KEY || "";
  isAvailable() {
    return !!this.key;
  }

  async complete(req: ModelRequest): Promise<ModelResponse> {
    const start = Date.now();
    const model = pickModelForTaskKind(req.taskKind, "gemini");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: req.system ? { parts: [{ text: req.system }] } : undefined,
        contents: [{ role: "user", parts: [{ text: req.prompt }] }],
        generationConfig: req.structured
          ? { responseMimeType: "application/json", temperature: req.temperature ?? 0.3 }
          : { temperature: req.temperature ?? 0.3, maxOutputTokens: req.maxTokens ?? 1024 },
      }),
    });
    if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    let json: ModelResponse["json"];
    if (req.structured) {
      try {
        json = JSON.parse(text);
      } catch {
        /* ignore */
      }
    }
    return {
      provider: "gemini",
      model,
      text,
      json,
      usageUsd: 0,
      latencyMs: Date.now() - start,
    };
  }
}
