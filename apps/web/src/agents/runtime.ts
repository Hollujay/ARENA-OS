import type { Capability } from "@core/types";
import type { AgentRole, AuditActor, AgentSlot, Mission } from "@domain/index";
import { AGENT_REGISTRY } from "@domain/index";
import type { Repository } from "@db/repository";
import type { ToolGateway, ToolContext } from "@tools/gateway";
import type { ModelGateway } from "@ai/model-gateway";
import type { ModelStrategy } from "@ai/model-router";

// Shared context passed to every agent. Agents are isolated: they only see the
// capabilities they were granted and act through the Tool Gateway (never
// touching credentials or external services directly).
export interface AgentContext {
  mission: Mission;
  repo: Repository;
  tools: ToolGateway;
  model: ModelGateway;
  strategy?: ModelStrategy;
  // Capabilities available to this agent for this mission.
  capabilities: Capability[];
  // The agent slot this agent is running as
  agentSlot?: AgentSlot;
  emit: (actor: AuditActor, action: string, detail?: unknown) => Promise<void>;
}

export function toolCtx(ctx: AgentContext, actor: AuditActor): ToolContext {
  return {
    missionId: ctx.mission.id,
    grantedCapabilities: ctx.capabilities,
    actor,
    record: async (run, audit) => {
      await ctx.repo.saveToolRun(run);
      await ctx.repo.appendAudit(audit);
    },
  };
}

// Execute a single agent step. Supports both built-in agents and custom agent slots.
export async function runAgent(role: AgentRole | string, ctx: AgentContext): Promise<string> {
  const actor: AuditActor = (role as string) in AGENT_REGISTRY ? (role as AgentRole) : "system";
  await ctx.emit(actor, `agent.${role}.start`);

  let summary = "";

  // Check if it's a built-in agent
  if (role in AGENT_REGISTRY) {
    switch (role as AgentRole) {
      case "commander":
        summary = await commander(ctx);
        break;
      case "research":
        summary = await research(ctx);
        break;
      case "code":
        summary = await code(ctx);
        break;
      case "qa":
        summary = await qa(ctx);
        break;
      case "deployment":
        summary = await deployment(ctx);
        break;
      case "stellar":
        summary = await stellarAgent(ctx);
        break;
    }
  } else {
    // Custom agent slot — use generic execution
    summary = await customAgent(ctx, role);
  }

  await ctx.emit(actor, `agent.${role}.done`, { summary });
  return summary;
}

// Generic custom agent execution — calls assigned custom APIs and uses the model
async function customAgent(ctx: AgentContext, role: string): Promise<string> {
  const slot = ctx.agentSlot;
  const mission = ctx.mission;

  // Find assigned custom APIs for this agent
  const assignments = await ctx.repo.listAgentApiAssignments();
  const myAssignments = assignments.filter((a) => a.agentId === `slot_${role}`);

  const results: string[] = [];

  // Call each assigned custom API
  for (const assignment of myAssignments) {
    if (!assignment.grantedCapabilities.includes("can_call")) continue;

    const api = await ctx.repo.getCustomApi(assignment.customApiId);
    if (!api || api.status !== "active") continue;

    try {
      const actor: AuditActor = role in AGENT_REGISTRY ? (role as AgentRole) : "system";
      const result = await ctx.tools.execute(
        "custom_api.call",
        {
          apiId: api.id,
          params: { query: mission.description },
        },
        toolCtx(ctx, actor),
      );

      if (result.ok) {
        const data = (result.output as unknown as { data?: unknown })?.data;
        results.push(`[${api.name}] ${typeof data === "string" ? data : JSON.stringify(data).slice(0, 200)}`);
      } else {
        results.push(`[${api.name}] Error: ${result.error}`);
      }
    } catch (e) {
      results.push(`[${api.name}] Failed: ${(e as Error).message}`);
    }
  }

  // Use the model to synthesize a result
  const modelResult = await ctx.model.reason(
    `Agent ${role} completed its tasks for mission: ${mission.title}. ${results.length > 0 ? "API results: " + results.join("; ") : "No custom APIs assigned."}`,
    `You are the ${slot?.name || role} Agent. Summarize what was accomplished.`,
  );

  return `${slot?.name || role} agent: ${modelResult.text}`;
}

// --- individual agents (kept modular per spec §12) -------------------------

import { commander } from "./commander";
import { research } from "./research";
import { code } from "./code";
import { qa } from "./qa";
import { deployment } from "./deployment";
import { stellarAgent } from "./stellar-agent";
