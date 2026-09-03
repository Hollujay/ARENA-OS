import type { ModelProvider, ModelRequest, ModelResponse, ModelTaskKind } from "@domain/index";
import { MockAdapter } from "./providers/mock";
import { OpenAIAdapter } from "./providers/openai";
import { GeminiAdapter } from "./providers/gemini";
import { ClaudeAdapter } from "./providers/claude";
import type { ModelAdapter } from "./providers/types";
import { rankProviders, type ModelStrategy } from "./model-router";

// Central Model Gateway. Routes a request to the best available provider,
// honoring the user's authorized providers, and fails over safely. The AI
// models never receive raw credentials — keys stay inside the adapters.
export class ModelGateway {
  private adapters: Record<ModelProvider, ModelAdapter>;
  constructor() {
    this.adapters = {
      openai: new OpenAIAdapter(),
      gemini: new GeminiAdapter(),
      claude: new ClaudeAdapter(),
      mock: new MockAdapter(),
    };
  }

  availableProviders(): ModelProvider[] {
    return (Object.keys(this.adapters) as ModelProvider[]).filter((p) => this.adapters[p].isAvailable());
  }

  async complete(
    req: ModelRequest,
    opts?: { strategy?: ModelStrategy; forceProvider?: ModelProvider },
  ): Promise<ModelResponse> {
    const available = this.availableProviders();
    let ranking: ModelProvider[];
    if (opts?.forceProvider) {
      ranking = [opts.forceProvider, "mock"];
    } else {
      ranking = rankProviders(req.taskKind, available, opts?.strategy);
    }

    let lastError = "";
    for (const provider of ranking) {
      const adapter = this.adapters[provider];
      if (!adapter.isAvailable()) continue;
      try {
        const res = await adapter.complete(req);
        return res;
      } catch (e) {
        lastError = (e as Error).message;
        // try next provider in ranking (failover)
      }
    }
    // Final safety net: mock always works offline. Was silently swallowing
    // lastError before — worth knowing why every real provider failed.
    if (lastError) console.warn(`[model-gateway] all providers failed, falling back to mock. Last error: ${lastError}`);
    return this.adapters.mock.complete(req);
  }

  // Convenience helpers per task kind.
  research(prompt: string, system?: string) {
    return this.complete({ prompt, system, taskKind: "research" as ModelTaskKind });
  }
  code(prompt: string, system?: string) {
    return this.complete({ prompt, system, taskKind: "code" as ModelTaskKind });
  }
  reason(prompt: string, system?: string) {
    return this.complete({ prompt, system, taskKind: "reasoning" as ModelTaskKind });
  }
}

// Singleton gateway for the running server.
let gateway: ModelGateway | null = null;
export function getModelGateway(): ModelGateway {
  if (!gateway) gateway = new ModelGateway();
  return gateway;
}
