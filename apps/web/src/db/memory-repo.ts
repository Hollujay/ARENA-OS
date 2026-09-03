import type {
  AgentRun,
  AgentApiAssignment,
  AgentSlot,
  ApiKey,
  AuditEvent,
  ChatConversation,
  ChatMessage,
  CustomApi,
  CustomApiEndpoint,
  ExhibitionProject,
  Integration,
  Memory,
  Mission,
  ModelProviderConfig,
  Payment,
  PlatformConnection,
  Project,
  Receipt,
  StellarTransaction,
  ToolRun,
  Workspace,
} from "@domain/index";
import { AGENT_REGISTRY } from "@domain/index";
import type {
  ActivityFilter,
  ActivityItem,
  Repository,
} from "./repository";
import { newAudit } from "@domain/index";
import { nowIso, shortId, uuid } from "@core/ids";

// ---------------------------------------------------------------------------
// In-memory repository. Used when ARENA_DB_DRIVER=memory (the default).
// Seeds a single-developer workspace with demonstrative data so the app
// runs end-to-end with zero external dependencies.
// ---------------------------------------------------------------------------

class MemoryRepository implements Repository {
  private workspace: Workspace;
  private projects: Project[] = [];
  private missions: Mission[] = [];
  private integrations: Integration[] = [];
  private payments: Payment[] = [];
  private stellarTx: StellarTransaction[] = [];
  private receipts = new Map<string, Receipt>();
  private audit: AuditEvent[] = [];
  private memories: Memory[] = [];
  private apiKeys: ApiKey[] = [];
  private modelProviders: ModelProviderConfig[] = [];
  private agentRuns: AgentRun[] = [];
  private toolRuns: ToolRun[] = [];
  private customApis: CustomApi[] = [];
  private customApiEndpoints: CustomApiEndpoint[] = [];
  private agentSlots: AgentSlot[] = [];
  private agentApiAssignments: AgentApiAssignment[] = [];
  private chatConversations: ChatConversation[] = [];
  private chatMessages: ChatMessage[] = [];
  private platformConnections: PlatformConnection[] = [];
  private exhibitionProjects: ExhibitionProject[] = [];

  constructor(seedEmail: string) {
    this.workspace = {
      id: "ws_seed",
      name: "Arena Workspace",
      ownerEmail: seedEmail,
      createdAt: nowIso(),
    };
    this.seed();
  }

  private seed() {
    this.projects.push(
      {
        id: "proj_receiptor",
        workspaceId: this.workspace.id,
        name: "Receiptor",
        repository: "ARENA-AI-OS/receiptor",
        integrations: ["github", "supabase", "railway", "stellar"],
        environment: "development",
        budgetXlm: 5,
      },
      {
        id: "proj_arena",
        workspaceId: this.workspace.id,
        name: "Arena OS",
        repository: "ARENA-AI-OS/ARENA-OS",
        integrations: ["github", "railway", "stellar"],
        environment: "development",
        budgetXlm: 5,
      },
    );

    this.integrations.push(
      { id: "int_gh", workspaceId: this.workspace.id, type: "github", name: "GitHub", connected: true, meta: { user: "arena-dev" } },
      { id: "int_sb", workspaceId: this.workspace.id, type: "supabase", name: "Supabase", connected: true, meta: {} },
      { id: "int_rw", workspaceId: this.workspace.id, type: "railway", name: "Railway", connected: false, meta: {} },
      { id: "int_st", workspaceId: this.workspace.id, type: "stellar", name: "Stellar Testnet", connected: false, meta: {} },
    );

    this.modelProviders.push(
      { provider: "openai", label: "OpenAI", connected: false, models: ["gpt-4o", "gpt-4o-mini"] },
      { provider: "gemini", label: "Google Gemini", connected: false, models: ["gemini-1.5-pro", "gemini-1.5-flash"] },
      { provider: "claude", label: "Anthropic Claude", connected: false, models: ["claude-3-5-sonnet", "claude-3-haiku"] },
      { provider: "mock", label: "Mock Model (offline)", connected: true, models: ["mock-reason"] },
    );

    const sampleMission: Mission = {
      id: shortId("AOS"),
      title: "Fix GitHub issue #42",
      description: "Investigate failing auth test and ship a preview deployment.",
      status: "verified",
      phaseOrder: ["planning", "research", "coding", "testing", "deployment", "verification"],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      workspaceId: this.workspace.id,
      projectId: "proj_receiptor",
      tasks: [],
      agents: ["commander", "research", "code", "qa", "deployment", "stellar"],
      modelsUsed: ["claude", "gemini", "openai"],
      toolsUsed: ["github.read_issue", "terminal.run", "railway.deploy_preview", "stellar.anchor_receipt"],
      costUsd: 0.38,
      paymentsXlm: 0,
      filesChanged: 4,
      testsPassed: 12,
      testsFailed: 0,
      deploymentUrl: "https://receiptor-preview.railway.app",
      verificationStatus: "verified",
      finalResult: "Issue analyzed, code changed, tests passed, preview deployed and verified.",
      receiptHash: "sha256:9f2c...ab01",
      stellarTx: "a1b2c3...",
    };
    this.missions.push(sampleMission);

    const seedAudit = [
      newAudit({ actor: "commander", action: "created mission", missionId: sampleMission.id }),
      newAudit({ actor: "research", action: "inspected repository", missionId: sampleMission.id }),
      newAudit({ actor: "code", action: "modified auth.ts and 3 files", missionId: sampleMission.id }),
      newAudit({ actor: "qa", action: "test suite passed", missionId: sampleMission.id }),
      newAudit({ actor: "deployment", action: "preview deployed", missionId: sampleMission.id }),
      newAudit({ actor: "user", action: "approved payment", missionId: sampleMission.id }),
      newAudit({ actor: "stellar", action: "receipt anchored on Soroban", missionId: sampleMission.id }),
    ];
    this.audit.push(...seedAudit);

    this.payments.push({
      id: shortId("PAY"),
      missionId: sampleMission.id,
      service: "Repo Analyzer API",
      purpose: "Repository analysis",
      amountXlm: 200, // NGN, despite the field name — see @bmoni/x402's docstring
      asset: "CNGN",
      network: "testnet",
      wallet: "0x0000000000000000000000000000000000dEaD",
      recipient: "0x0000000000000000000000000000000000bEEf",
      status: "settled",
      txHash: "proposal_demo_001",
      receiptHash: sampleMission.receiptHash,
      createdAt: nowIso(),
      settledAt: nowIso(),
    });

    this.stellarTx.push({
      id: shortId("STX"),
      missionId: sampleMission.id,
      kind: "receipt_anchor",
      txHash: "tx_demo_001",
      network: "testnet",
      status: "confirmed",
      receiptHash: sampleMission.receiptHash,
      createdAt: nowIso(),
    });

    this.receipts.set(sampleMission.receiptHash ?? "r", {
      hash: sampleMission.receiptHash ?? "r",
      missionDigest: "digest:" + sampleMission.id,
      submitter: "GABCDEFG...",
      timestamp: nowIso(),
      status: "verified",
      paymentReference: this.payments[0].id,
      anchorTx: this.stellarTx[0].txHash,
    });

    this.apiKeys.push({
      id: "key_live",
      workspaceId: this.workspace.id,
      name: "Production Agent",
      environment: "live",
      prefix: "aos_live_••••••••••••",
      scopes: ["missions:write", "tools:execute"],
      createdAt: nowIso(),
      lastUsedAt: nowIso(),
      revoked: false,
    });

    this.memories.push({
      id: uuid(),
      scope: "project",
      scopeId: "proj_receiptor",
      source: "code-agent",
      content: "Auth uses JWT stored in httpOnly cookie; refresh rotation every 15m.",
      confidence: 0.9,
      createdAt: nowIso(),
    });

    // Seed the six built-in agent slots
    for (const [role, spec] of Object.entries(AGENT_REGISTRY)) {
      this.agentSlots.push({
        id: `slot_${role}`,
        name: spec.name,
        description: spec.description,
        role,
        isCustom: false,
        modelPreference: "auto",
        budget: 5,
        timeoutMs: 120000,
        retryLimit: 2,
        status: "active",
        defaultCapabilities: spec.defaultCapabilities,
        createdAt: nowIso(),
      });
    }
  }

  async getWorkspace(id: string) {
    return this.workspace.id === id ? this.workspace : undefined;
  }
  async ensureSeedWorkspace() {
    return this.workspace;
  }

  async listProjects(workspaceId: string) {
    return this.projects.filter((p) => p.workspaceId === workspaceId);
  }
  async getProject(id: string) {
    return this.projects.find((p) => p.id === id);
  }
  async createProject(p: Project) {
    this.projects.push(p);
    return p;
  }

  async listMissions(workspaceId: string) {
    return this.missions
      .filter((m) => m.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async getMission(id: string) {
    return this.missions.find((m) => m.id === id);
  }
  async saveMission(m: Mission) {
    const idx = this.missions.findIndex((x) => x.id === m.id);
    if (idx >= 0) this.missions[idx] = m;
    else this.missions.push(m);
    return m;
  }

  async listIntegrations(workspaceId: string) {
    return this.integrations.filter((i) => i.workspaceId === workspaceId);
  }
  async upsertIntegration(i: Integration) {
    const idx = this.integrations.findIndex((x) => x.id === i.id);
    if (idx >= 0) this.integrations[idx] = i;
    else this.integrations.push(i);
    return i;
  }

  async listPayments() {
    return [...this.payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async savePayment(p: Payment) {
    const idx = this.payments.findIndex((x) => x.id === p.id);
    if (idx >= 0) this.payments[idx] = p;
    else this.payments.push(p);
    return p;
  }

  async listStellarTx() {
    return [...this.stellarTx].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async saveStellarTx(t: StellarTransaction) {
    this.stellarTx.push(t);
    return t;
  }
  async saveReceipt(r: Receipt) {
    this.receipts.set(r.hash, r);
    return r;
  }
  async getReceipt(hash: string) {
    return this.receipts.get(hash);
  }

  async listAudit(missionId?: string) {
    return this.audit
      .filter((a) => !missionId || a.missionId === missionId)
      .sort((a, b) => b.at.localeCompare(a.at));
  }
  async appendAudit(e: AuditEvent) {
    this.audit.push(e);
    return e;
  }

  async listMemories(scope: Memory["scope"], scopeId: string) {
    return this.memories.filter((m) => m.scope === scope && m.scopeId === scopeId);
  }
  async saveMemory(m: Memory) {
    this.memories.push(m);
    return m;
  }

  async listApiKeys(workspaceId: string) {
    return this.apiKeys.filter((k) => k.workspaceId === workspaceId);
  }
  async createApiKey(k: ApiKey) {
    this.apiKeys.push(k);
    return k;
  }

  async listModelProviders() {
    return this.modelProviders;
  }
  async upsertModelProvider(p: ModelProviderConfig) {
    const idx = this.modelProviders.findIndex((x) => x.provider === p.provider);
    if (idx >= 0) this.modelProviders[idx] = p;
    else this.modelProviders.push(p);
    return p;
  }

  async saveAgentRun(r: AgentRun) {
    this.agentRuns.push(r);
    return r;
  }
  async saveToolRun(r: ToolRun) {
    this.toolRuns.push(r);
    return r;
  }

  // ── Custom API Registry ──────────────────────────────────────────────
  async listCustomApis(workspaceId: string) {
    return this.customApis.filter((a) => a.workspaceId === workspaceId);
  }
  async getCustomApi(id: string) {
    return this.customApis.find((a) => a.id === id);
  }
  async saveCustomApi(api: CustomApi) {
    const idx = this.customApis.findIndex((a) => a.id === api.id);
    if (idx >= 0) this.customApis[idx] = api;
    else this.customApis.push(api);
    return api;
  }
  async deleteCustomApi(id: string) {
    this.customApis = this.customApis.filter((a) => a.id !== id);
    this.customApiEndpoints = this.customApiEndpoints.filter((e) => e.customApiId !== id);
    this.agentApiAssignments = this.agentApiAssignments.filter((a) => a.customApiId !== id);
  }

  async listCustomApiEndpoints(apiId: string) {
    return this.customApiEndpoints.filter((e) => e.customApiId === apiId);
  }
  async saveCustomApiEndpoint(ep: CustomApiEndpoint) {
    const idx = this.customApiEndpoints.findIndex((e) => e.id === ep.id);
    if (idx >= 0) this.customApiEndpoints[idx] = ep;
    else this.customApiEndpoints.push(ep);
    return ep;
  }
  async deleteCustomApiEndpoint(id: string) {
    this.customApiEndpoints = this.customApiEndpoints.filter((e) => e.id !== id);
  }

  // ── Agent Slots ──────────────────────────────────────────────────────
  async listAgentSlots() {
    return [...this.agentSlots];
  }
  async getAgentSlot(id: string) {
    return this.agentSlots.find((s) => s.id === id);
  }
  async saveAgentSlot(slot: AgentSlot) {
    const idx = this.agentSlots.findIndex((s) => s.id === slot.id);
    if (idx >= 0) this.agentSlots[idx] = slot;
    else this.agentSlots.push(slot);
    return slot;
  }
  async deleteAgentSlot(id: string) {
    this.agentSlots = this.agentSlots.filter((s) => s.id !== id);
  }

  // ── Agent-API Assignments ────────────────────────────────────────────
  async listAgentApiAssignments(agentId?: string) {
    if (agentId) return this.agentApiAssignments.filter((a) => a.agentId === agentId);
    return [...this.agentApiAssignments];
  }
  async getAgentApiAssignment(id: string) {
    return this.agentApiAssignments.find((a) => a.id === id);
  }
  async saveAgentApiAssignment(a: AgentApiAssignment) {
    const idx = this.agentApiAssignments.findIndex((x) => x.id === a.id);
    if (idx >= 0) this.agentApiAssignments[idx] = a;
    else this.agentApiAssignments.push(a);
    return a;
  }
  async deleteAgentApiAssignment(id: string) {
    this.agentApiAssignments = this.agentApiAssignments.filter((a) => a.id !== id);
  }

  // ── Activity ─────────────────────────────────────────────────────────
  async listActivity(filter?: ActivityFilter): Promise<ActivityItem[]> {
    const items: ActivityItem[] = [];
    for (const a of this.audit) {
      if (filter?.mission && a.missionId !== filter.mission) continue;
      items.push({ id: a.id, at: a.at, kind: "audit", actor: a.actor, action: a.action, missionId: a.missionId, detail: a.detail });
    }
    for (const t of this.toolRuns) {
      if (filter?.mission && t.missionId !== filter.mission) continue;
      if (filter?.tool && t.tool !== filter.tool) continue;
      items.push({ id: t.id, at: t.startedAt, kind: "tool", actor: t.tool, action: `tool:${t.status}`, missionId: t.missionId, detail: t });
    }
    for (const p of this.payments) {
      if (filter?.mission && p.missionId !== filter.mission) continue;
      if (filter?.payment === false) continue;
      items.push({ id: p.id, at: p.createdAt, kind: "payment", actor: "bmoni", action: `payment:${p.status}`, missionId: p.missionId, detail: p });
    }
    for (const s of this.stellarTx) {
      if (filter?.mission && s.missionId !== filter.mission) continue;
      if (filter?.stellar === false) continue;
      items.push({ id: s.id, at: s.createdAt, kind: "stellar", actor: "stellar", action: `stellar:${s.status}`, missionId: s.missionId, detail: s });
    }
    return items.sort((a, b) => b.at.localeCompare(a.at));
  }

  // ── Chat Conversations ──────────────────────────────────────────────────
  async listChatConversations(workspaceId: string): Promise<ChatConversation[]> {
    return this.chatConversations.filter((c) => c.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async getChatConversation(id: string): Promise<ChatConversation | undefined> {
    return this.chatConversations.find((c) => c.id === id);
  }
  async saveChatConversation(c: ChatConversation): Promise<ChatConversation> {
    const idx = this.chatConversations.findIndex((x) => x.id === c.id);
    if (idx >= 0) this.chatConversations[idx] = c; else this.chatConversations.push(c);
    return c;
  }
  async deleteChatConversation(id: string): Promise<void> {
    this.chatConversations = this.chatConversations.filter((c) => c.id !== id);
    this.chatMessages = this.chatMessages.filter((m) => m.conversationId !== id);
  }

  // ── Chat Messages ───────────────────────────────────────────────────────
  async listChatMessages(conversationId: string): Promise<ChatMessage[]> {
    return this.chatMessages.filter((m) => m.conversationId === conversationId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async saveChatMessage(m: ChatMessage): Promise<ChatMessage> {
    this.chatMessages.push(m);
    return m;
  }

  // ── Platform Connections ─────────────────────────────────────────────────
  async listPlatformConnections(workspaceId: string): Promise<PlatformConnection[]> {
    return this.platformConnections.filter((p) => p.workspaceId === workspaceId);
  }
  async getPlatformConnection(id: string): Promise<PlatformConnection | undefined> {
    return this.platformConnections.find((p) => p.id === id);
  }
  async savePlatformConnection(p: PlatformConnection): Promise<PlatformConnection> {
    const idx = this.platformConnections.findIndex((x) => x.id === p.id);
    if (idx >= 0) this.platformConnections[idx] = p; else this.platformConnections.push(p);
    return p;
  }
  async deletePlatformConnection(id: string): Promise<void> {
    this.platformConnections = this.platformConnections.filter((p) => p.id !== id);
  }

  // ── Exhibition Projects ──────────────────────────────────────────────────
  async listExhibitionProjects(workspaceId: string, featuredOnly?: boolean): Promise<ExhibitionProject[]> {
    let items = this.exhibitionProjects.filter((p) => p.workspaceId === workspaceId);
    if (featuredOnly) items = items.filter((p) => p.featured);
    return items.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  async getExhibitionProject(id: string): Promise<ExhibitionProject | undefined> {
    return this.exhibitionProjects.find((p) => p.id === id);
  }
  async saveExhibitionProject(p: ExhibitionProject): Promise<ExhibitionProject> {
    const idx = this.exhibitionProjects.findIndex((x) => x.id === p.id);
    if (idx >= 0) this.exhibitionProjects[idx] = p; else this.exhibitionProjects.push(p);
    return p;
  }
  async deleteExhibitionProject(id: string): Promise<void> {
    this.exhibitionProjects = this.exhibitionProjects.filter((p) => p.id !== id);
  }
}

let instance: Repository | null = null;

export function getMemoryRepository(seedEmail: string): Repository {
  if (!instance) instance = new MemoryRepository(seedEmail);
  return instance;
}
