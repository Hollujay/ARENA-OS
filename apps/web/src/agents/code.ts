import type { Json } from "@core/types";
import type { AgentContext } from "./runtime";
import { toolCtx } from "./runtime";

interface ModifyFilesOutput {
  files?: number;
}
interface CreatePrOutput {
  url?: string;
}

// Code Agent (spec §12). Implements the fix: branch, modify, commit, PR.
export async function code(ctx: AgentContext): Promise<string> {
  const task = ctx.mission.tasks.find((t) => t.type === "code");
  if (task) task.status = "running";

  const branch = `fix/${ctx.mission.id.toLowerCase()}`;
  await ctx.tools.execute("github.create_branch", { branch }, toolCtx(ctx, "code"));
  const modRes = await ctx.tools.execute(
    "github.modify_files",
    { branch, files: [{ path: "src/auth.ts", change: "add input validation" }] },
    toolCtx(ctx, "code"),
  );
  await ctx.tools.execute(
    "github.create_commit",
    { branch, message: "fix: address issue with validated auth path" },
    toolCtx(ctx, "code"),
  );
  const prRes = await ctx.tools.execute(
    "github.create_pr",
    { branch, title: ctx.mission.title, body: "Automated fix from Arena OS." },
    toolCtx(ctx, "code"),
  );

  const impl = await ctx.model.code(
    `Implement a minimal, tested fix for mission: ${ctx.mission.title}`,
    "You are the Code Agent. Write safe, minimal changes.",
  );

  if (task) {
    task.status = "done";
    task.result = { branch, pr: prRes.output, impl: impl.text } as unknown as Json;
    task.updatedAt = new Date().toISOString();
  }
  ctx.mission.filesChanged += (modRes.output as unknown as ModifyFilesOutput)?.files ?? 1;
  ctx.mission.toolsUsed = Array.from(new Set([...ctx.mission.toolsUsed, "github.create_branch", "github.modify_files", "github.create_commit", "github.create_pr"]));
  ctx.mission.modelsUsed = Array.from(new Set([...ctx.mission.modelsUsed, impl.provider]));
  ctx.mission.costUsd += impl.usageUsd;
  await ctx.repo.saveMission(ctx.mission);
  return `Code changes committed on ${branch}. PR: ${(prRes.output as unknown as CreatePrOutput)?.url ?? "n/a"}. ${impl.text}`;
}
