import type { AgentContext } from "./runtime";
import type { TaskType, Task, AgentRole } from "@domain/index";

// Commander Agent (spec §12). Understands intent and builds the task graph.
// Parses the AI model response into a structured plan with typed tasks,
// dependencies, and agent assignments.

interface PlannedStep {
  type: TaskType;
  title: string;
  agent: AgentRole;
  description: string;
}

// Map task types to their default agent roles
const TASK_AGENT_MAP: Record<TaskType, AgentRole> = {
  plan: "commander",
  research: "research",
  code: "code",
  qa: "qa",
  deploy: "deployment",
  stellar: "stellar",
  payment: "stellar",
  verify: "qa",
};

// Determine task type from the AI response text
function inferTaskType(step: string): TaskType {
  const lower = step.toLowerCase();
  if (lower.includes("research") || lower.includes("analyze") || lower.includes("investigate") || lower.includes("inspect")) {
    return "research";
  }
  if (lower.includes("test") || lower.includes("verify") || lower.includes("check") || lower.includes("validate")) {
    return "qa";
  }
  if (lower.includes("deploy") || lower.includes("preview") || lower.includes("release")) {
    return "deploy";
  }
  if (lower.includes("commit") || lower.includes("fix") || lower.includes("implement") || lower.includes("write") || lower.includes("modify")) {
    return "code";
  }
  if (lower.includes("receipt") || lower.includes("anchor") || lower.includes("stellar") || lower.includes("blockchain")) {
    return "stellar";
  }
  return "code"; // default
}

export async function commander(ctx: AgentContext): Promise<string> {
  // Request a structured plan from the model
  const res = await ctx.model.reason(
    `Create an execution plan for this mission: ${ctx.mission.title}. ${ctx.mission.description}

Return a JSON object with a "steps" array. Each step should have:
- title: short description of what to do
- description: more detail about the step

Example format:
{
  "steps": [
    { "title": "Analyze the issue", "description": "Read the GitHub issue and identify root cause" },
    { "title": "Implement the fix", "description": "Create a branch and make the code changes" },
    { "title": "Run tests", "description": "Execute the test suite to verify the fix" }
  ]
}`,
    "You are the Commander Agent. Break the mission into 3-7 ordered engineering steps. Return only valid JSON.",
  );

  // Parse the AI response into structured steps
  let plannedSteps: PlannedStep[] = [];

  try {
    // Try to extract JSON from the response (it might be wrapped in markdown)
    let jsonText = res.text;
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonText) as { steps?: Array<{ title: string; description?: string }> };
    if (parsed.steps && Array.isArray(parsed.steps)) {
      plannedSteps = parsed.steps.map((step) => {
        const type = inferTaskType(step.title + " " + (step.description || ""));
        return {
          type,
          title: step.title,
          agent: TASK_AGENT_MAP[type],
          description: step.description || step.title,
        };
      });
    }
  } catch {
    // If parsing fails, create a sensible default plan
    plannedSteps = [
      { type: "research", title: "Analyze the issue and repository", agent: "research", description: "Read the issue, understand the codebase" },
      { type: "code", title: "Implement the solution", agent: "code", description: "Make the necessary code changes" },
      { type: "qa", title: "Run tests and verify", agent: "qa", description: "Execute test suite to confirm the fix" },
      { type: "deploy", title: "Deploy preview", agent: "deployment", description: "Create a preview deployment" },
      { type: "stellar", title: "Anchor receipt on Stellar", agent: "stellar", description: "Record the receipt on-chain" },
    ];
  }

  // Ensure we have at least one step
  if (plannedSteps.length === 0) {
    plannedSteps = [
      { type: "research", title: "Analyze the request", agent: "research", description: "Understand what needs to be done" },
      { type: "code", title: "Implement the solution", agent: "code", description: "Write the code" },
      { type: "qa", title: "Verify the implementation", agent: "qa", description: "Run tests" },
    ];
  }

  // Build task objects with proper dependencies
  const tasks: Task[] = plannedSteps.map((step, idx) => ({
    id: `T${idx + 1}`,
    missionId: ctx.mission.id,
    type: step.type,
    title: step.title,
    agentRole: step.agent,
    status: "pending" as const,
    dependsOn: idx === 0 ? [] : [`T${idx}`],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  ctx.mission.tasks = tasks;
  ctx.mission.agents = Array.from(new Set(["commander", ...plannedSteps.map(s => s.agent)]));

  // Save the mission with the new task graph
  await ctx.repo.saveMission(ctx.mission);

  // Audit the plan creation
  await ctx.emit("commander", "commander.plan_created", {
    taskCount: tasks.length,
    steps: plannedSteps.map(s => ({ type: s.type, title: s.title, agent: s.agent })),
  });

  return `Plan created with ${tasks.length} steps: ${plannedSteps.map(s => s.title).join(", ")}.`;
}
