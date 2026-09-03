import type { Json } from "@core/types";
import type { AgentContext } from "./runtime";
import { toolCtx } from "./runtime";

interface TestRunOutput {
  passed?: number;
  failed?: number;
}

// QA Agent (spec §12). Runs the test suite and verifies requirements.
export async function qa(ctx: AgentContext): Promise<string> {
  const task = ctx.mission.tasks.find((t) => t.type === "qa");
  if (task) task.status = "running";

  const testRes = await ctx.tools.execute("terminal.run", { command: "npm test" }, toolCtx(ctx, "qa"));
  const checksRes = await ctx.tools.execute("github.read_checks", { ref: "fix/branch" }, toolCtx(ctx, "qa"));

  const testOutput = testRes.output as unknown as TestRunOutput;
  const passed = testOutput?.passed ?? 0;
  const failed = testOutput?.failed ?? 0;

  if (task) {
    task.status = failed === 0 ? "done" : "failed";
    task.result = { tests: testRes.output, checks: checksRes.output } as unknown as Json;
    task.updatedAt = new Date().toISOString();
  }
  ctx.mission.testsPassed += passed;
  ctx.mission.testsFailed += failed;
  ctx.mission.toolsUsed = Array.from(new Set([...ctx.mission.toolsUsed, "terminal.run", "github.read_checks"]));
  await ctx.repo.saveMission(ctx.mission);

  if (failed > 0) {
    ctx.mission.status = "failed";
    return `Tests failed (${failed} failing). QA blocked the mission.`;
  }
  return `QA passed: ${passed} tests green.`;
}
