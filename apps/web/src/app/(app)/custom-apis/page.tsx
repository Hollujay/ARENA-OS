import { getRepository } from "@db/index";
import { PageHeader, Stat } from "@/components/ui";
import { CustomApisManager } from "@/components/custom-apis-manager";
import type { CustomApi } from "@domain/index";

export const dynamic = "force-dynamic";

export default async function CustomApisPage() {
  const repo = getRepository();
  const ws = await repo.ensureSeedWorkspace();
  const apis = await repo.listCustomApis(ws.id);
  const slots = await repo.listAgentSlots();
  const assignments = await repo.listAgentApiAssignments();

  // Enrich APIs with assignment info
  const enrichedApis = await Promise.all(
    apis.map(async (api) => {
      const endpoints = await repo.listCustomApiEndpoints(api.id);
      const apiAssignments = assignments.filter((a) => a.customApiId === api.id);
      const agentSlot = apiAssignments[0] ? await repo.getAgentSlot(apiAssignments[0].agentId) : null;
      return {
        ...api,
        endpoints,
        assignedAgent: agentSlot?.name || null,
        assignedAgentId: agentSlot?.id || null,
        assignmentCount: apiAssignments.length,
      };
    }),
  );

  // Enrich slots with API counts
  const enrichedSlots = slots.map((slot) => ({
    ...slot,
    apiCount: assignments.filter((a) => a.agentId === slot.id).length,
    apis: assignments
      .filter((a) => a.agentId === slot.id)
      .map((a) => apis.find((api) => api.id === a.customApiId))
      .filter((api): api is CustomApi => api !== undefined)
      .map((api) => ({ id: api.id, name: api.name })),
  }));

  const activeApis = apis.filter((a) => a.status === "active").length;
  const customAgents = slots.filter((s) => s.isCustom).length;

  return (
    <div className="bg-arena-grid min-h-screen">
      <PageHeader
        title="Custom APIs"
        subtitle="Register any external API, assign it to an agent, and call it through the Tool Gateway."
      />
      <div className="px-6 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Registered APIs" value={apis.length} tone="blue" />
          <Stat label="Active" value={activeApis} tone="green" />
          <Stat label="Agent Slots" value={slots.length} tone="violet" />
          <Stat label="Custom Agents" value={customAgents} tone="cyan" />
        </div>

        <CustomApisManager
          apis={enrichedApis}
          agentSlots={enrichedSlots}
          assignments={assignments}
          workspaceId={ws.id}
        />
      </div>
    </div>
  );
}
