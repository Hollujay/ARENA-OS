import type { Json } from "@core/types";
import type { AgentContext } from "./runtime";
import { toolCtx } from "./runtime";

// Research Agent (spec §12). Inspects the repository / issue and summarizes.
export async function research(ctx: AgentContext): Promise<string> {
  // Mark research task running
  const task = ctx.mission.tasks.find((t) => t.type === "research");
  if (task) task.status = "running";

  const readIssueInput: Record<string, Json> = { issueNumber: 42 };
  if (!ctx.mission.projectId) readIssueInput.repository = "ARENA-AI-OS/ARENA-OS";

  const issueRes = await ctx.tools.execute("github.read_issue", readIssueInput, toolCtx(ctx, "research"));

  const analysis = await ctx.model.research(
    `Research the problem described by this GitHub issue: ${JSON.stringify(issueRes.output ?? {})}`,
    "You are the Research Agent. Identify the root cause and recommended approach.",
  );

  if (task) {
    task.status = "done";
    task.result = { issue: issueRes.output, analysis: analysis.text } as unknown as Json;
    task.updatedAt = new Date().toISOString();
  }
  ctx.mission.toolsUsed = Array.from(new Set([...ctx.mission.toolsUsed, "github.read_issue"]));
  ctx.mission.modelsUsed = Array.from(new Set([...ctx.mission.modelsUsed, analysis.provider]));
  ctx.mission.costUsd += analysis.usageUsd;
  await ctx.repo.saveMission(ctx.mission);
  return `Research complete. ${analysis.text}`;
}
