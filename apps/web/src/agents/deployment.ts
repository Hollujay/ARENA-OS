import type { AgentContext } from "./runtime";
import { toolCtx } from "./runtime";

// Deployment Agent (spec §12). Creates a preview deployment (production needs
// elevated approval, enforced at the permission layer).
export async function deployment(ctx: AgentContext): Promise<string> {
  const task = ctx.mission.tasks.find((t) => t.type === "deploy");
  if (task) task.status = "running";

  const res = await ctx.tools.execute(
    "railway.deploy_preview",
    { project: ctx.mission.projectId ?? "arena" },
    toolCtx(ctx, "deployment"),
  );
  const url = (res.output as unknown as { deploymentUrl?: string })?.deploymentUrl;

  if (task) {
    task.status = res.ok ? "done" : "failed";
    task.result = res.output;
    task.updatedAt = new Date().toISOString();
  }
  ctx.mission.deploymentUrl = url;
  ctx.mission.toolsUsed = Array.from(new Set([...ctx.mission.toolsUsed, "railway.deploy_preview"]));
  await ctx.repo.saveMission(ctx.mission);
  return `Preview deployed: ${url ?? "unknown"}`;
}
