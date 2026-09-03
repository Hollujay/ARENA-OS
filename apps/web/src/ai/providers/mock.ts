import type { ModelRequest, ModelResponse } from "@domain/index";
import type { ModelAdapter } from "./types";
import { pickModelForTaskKind } from "./types";

// Offline adapter. Used when no provider key is configured and as a safe
// fallback. Produces deterministic, structured output so the orchestration
// flow (plan -> code -> qa -> deploy -> receipt) can be demonstrated with
// zero external dependencies. This is clearly isolated from production code.
export class MockAdapter implements ModelAdapter {
  provider = "mock" as const;
  isAvailable() {
    return true;
  }

  async complete(req: ModelRequest): Promise<ModelResponse> {
    const start = Date.now();
    const kind = req.taskKind ?? "any";
    const text = mockFor(kind, req.prompt);
    const json = req.structured ? { plan: mockPlan(req.prompt), kind } : undefined;
    return {
      provider: "mock",
      model: pickModelForTaskKind(kind, "mock"),
      text,
      json,
      usageUsd: 0,
      latencyMs: Date.now() - start,
    };
  }
}

function mockPlan(_prompt: string): string[] {
  return [
    "Read the GitHub issue and reproduce the failure.",
    "Inspect the affected module and locate the root cause.",
    "Implement a minimal, tested fix on a new branch.",
    "Run the test suite and verify it passes.",
    "Open a pull request and request a preview deployment.",
  ];
}

function mockFor(kind: string, prompt: string): string {
  switch (kind) {
    case "research":
      return `[Research] Analyzed request: "${truncate(prompt)}". Likely root cause is input validation missing on the auth path. Recommended approach: add schema validation and a regression test.`;
    case "code":
      return `[Code] Implemented fix for: "${truncate(prompt)}". Created branch fix/issue, modified auth.ts, added validation, committed changes.`;
    case "reasoning":
      return `[Reasoning] Considered trade-offs and selected the lowest-risk implementation.`;
    case "simple":
      return `[Simple] Acknowledged: "${truncate(prompt)}".`;
    default:
      return `[Mock] Processed: "${truncate(prompt)}".`;
  }
}

function truncate(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
