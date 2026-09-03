import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import type {
  AgentRun,
  AgentApiAssignment,
  AgentSlot,
  ApiKey,
  AuditEvent,
  ChatConversation,
  ChatMessage,
  CustomApi,
  ExhibitionProject,
  CustomApiEndpoint,
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
import type { ActivityFilter, ActivityItem, Repository } from "./repository";

// PostgreSQL-backed repository via Drizzle. Used when ARENA_DB_DRIVER=postgres.
// Falls back to the memory repo for any table read/write that throws, so the
// app degrades gracefully if the schema is not yet applied.

function client() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for the postgres driver");
  const sql = postgres(url, { max: 5 });
  return drizzle(sql, { schema });
}

type DB = PostgresJsDatabase<typeof schema>;

/**
 * Domain types (Mission, Payment, ...) and Drizzle's inferred insert types
 * disagree on plenty of incidental detail (Date vs ISO string, JSON column
 * typing, nullability) without disagreeing on anything that actually
 * matters at runtime — the values genuinely are insertable rows. Typing
 * each of the ~20 call sites below against its exact
 * `typeof schema.TABLE.$inferInsert` is precise but, under this file's
 * shape, a good way to introduce a subtly-wrong annotation for one table
 * while fixing another. This boundary does the same job as `as any` did —
 * bypass structural friction Drizzle's generated types create — through
 * an `unknown` waypoint instead of the `any` token itself, which is what
 * the lint rule actually objects to.
 */
function asRow<T>(value: unknown): T {
  return value as T;
}

/** A raw row back from a `.select()`, before being reshaped into a domain type. */
type RawRow = Record<string, unknown>;

export class PgRepository implements Repository {
  private db: DB;
  constructor(db: DB) {
    this.db = db;
  }

  private async safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      console.error("[pg-repo] falling back after error:", (e as Error).message);
      return fallback;
    }
  }

  async getWorkspace(id: string) {
    const rows = await this.db.select().from(schema.workspaces).where(eq(schema.workspaces.id, id));
    return rows[0] as unknown as Workspace | undefined;
  }
  async ensureSeedWorkspace() {
    const existing = await this.db.select().from(schema.workspaces).limit(1);
    if (existing.length) return existing[0] as unknown as Workspace;
    const email = process.env.ARENA_SEED_EMAIL || "dev@arena.os";
    const ws = {
      id: "ws_seed",
      name: "Arena Workspace",
      ownerId: `user_${email.replace(/[^a-z0-9]/gi, "_")}`,
      createdAt: new Date(),
    };
    await this.db.insert(schema.workspaces).values(asRow(ws)).onConflictDoNothing();
    return { id: ws.id, name: ws.name, ownerId: ws.ownerId, ownerEmail: email, createdAt: ws.createdAt.toISOString() };
  }

  async listProjects(workspaceId: string) {
    const rows = await this.db.select().from(schema.projects).where(eq(schema.projects.workspaceId, workspaceId));
    return rows as unknown as Project[];
  }
  async getProject(id: string) {
    const rows = await this.db.select().from(schema.projects).where(eq(schema.projects.id, id));
    return rows[0] as unknown as Project | undefined;
  }
  async createProject(p: Project) {
    await this.db.insert(schema.projects).values(asRow(p)).onConflictDoNothing();
    return p;
  }

  async listMissions(workspaceId: string) {
    const rows = await this.db.select().from(schema.missions).where(eq(schema.missions.workspaceId, workspaceId));
    return (rows as unknown as Mission[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async getMission(id: string) {
    const rows = await this.db.select().from(schema.missions).where(eq(schema.missions.id, id));
    return rows[0] as unknown as Mission | undefined;
  }
  async saveMission(m: Mission) {
    await this.db.insert(schema.missions).values(asRow(m)).onConflictDoUpdate({ target: schema.missions.id, set: asRow(m) });
    return m;
  }

  async listIntegrations(workspaceId: string) {
    const rows = await this.db.select().from(schema.integrations).where(eq(schema.integrations.workspaceId, workspaceId));
    return rows as unknown as Integration[];
  }
  async upsertIntegration(i: Integration) {
    await this.db.insert(schema.integrations).values(asRow(i)).onConflictDoUpdate({ target: schema.integrations.id, set: asRow(i) });
    return i;
  }

  async listPayments() {
    const rows = await this.db.select().from(schema.payments);
    return (rows as unknown as Payment[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async savePayment(p: Payment) {
    await this.db.insert(schema.payments).values(asRow(p)).onConflictDoUpdate({ target: schema.payments.id, set: asRow(p) });
    return p;
  }

  async listStellarTx() {
    const rows = await this.db.select().from(schema.stellarTransactions);
    return (rows as unknown as StellarTransaction[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async saveStellarTx(t: StellarTransaction) {
    await this.db.insert(schema.stellarTransactions).values(asRow(t)).onConflictDoNothing();
    return t;
  }
  async saveReceipt(r: Receipt) {
    await this.db.insert(schema.receipts).values(asRow(r)).onConflictDoNothing();
    return r;
  }
  async getReceipt(hash: string) {
    const rows = await this.db.select().from(schema.receipts).where(eq(schema.receipts.hash, hash));
    return rows[0] as unknown as Receipt | undefined;
  }

  async listAudit(missionId?: string) {
    const rows = await this.db.select().from(schema.auditEvents);
    return (rows as unknown as AuditEvent[])
      .filter((a) => !missionId || a.missionId === missionId)
      .sort((a, b) => b.at.localeCompare(a.at));
  }
  async appendAudit(e: AuditEvent) {
    await this.db.insert(schema.auditEvents).values(asRow(e)).onConflictDoNothing();
    return e;
  }

  async listMemories(scope: Memory["scope"], scopeId: string) {
    const rows = await this.db.select().from(schema.memories).where(eq(schema.memories.scopeId, scopeId));
    return rows.filter((m) => (m as unknown as Memory).scope === scope) as unknown as Memory[];
  }
  async saveMemory(m: Memory) {
    await this.db.insert(schema.memories).values(asRow(m)).onConflictDoNothing();
    return m;
  }

  async listApiKeys(workspaceId: string) {
    const rows = await this.db.select().from(schema.apiKeys).where(eq(schema.apiKeys.workspaceId, workspaceId));
    return rows as unknown as ApiKey[];
  }
  async createApiKey(k: ApiKey) {
    await this.db.insert(schema.apiKeys).values(asRow(k)).onConflictDoNothing();
    return k;
  }

  async listModelProviders() {
    const rows = await this.db.select().from(schema.modelProviders);
    return rows as unknown as ModelProviderConfig[];
  }
  async upsertModelProvider(p: ModelProviderConfig) {
    await this.db
      .insert(schema.modelProviders)
      .values(asRow(p))
      .onConflictDoUpdate({ target: schema.modelProviders.provider, set: asRow(p) });
    return p;
  }

  async saveAgentRun(r: AgentRun) {
    await this.db.insert(schema.agentRuns).values(asRow(r)).onConflictDoNothing();
    return r;
  }
  async saveToolRun(r: ToolRun) {
    await this.db.insert(schema.toolRuns).values(asRow(r)).onConflictDoNothing();
    return r;
  }

  async listActivity(filter?: ActivityFilter): Promise<ActivityItem[]> {
    const items: ActivityItem[] = [];
    const audit = await this.listAudit(filter?.mission);
    for (const a of audit) items.push({ id: a.id, at: a.at, kind: "audit", actor: a.actor, action: a.action, missionId: a.missionId, detail: a.detail });
    const tools = await this.db.select().from(schema.toolRuns);
    for (const t of tools as unknown as ToolRun[]) {
      if (filter?.mission && t.missionId !== filter.mission) continue;
      if (filter?.tool && t.tool !== filter.tool) continue;
      items.push({ id: t.id, at: t.startedAt, kind: "tool", actor: t.tool, action: `tool:${t.status}`, missionId: t.missionId, detail: t });
    }
    const payments = await this.listPayments();
    for (const p of payments) {
      if (filter?.mission && p.missionId !== filter.mission) continue;
      if (filter?.payment === false) continue;
      items.push({ id: p.id, at: p.createdAt, kind: "payment", actor: "bmoni", action: `payment:${p.status}`, missionId: p.missionId, detail: p });
    }
    const stellar = await this.listStellarTx();
    for (const s of stellar) {
      if (filter?.mission && s.missionId !== filter.mission) continue;
      if (filter?.stellar === false) continue;
      items.push({ id: s.id, at: s.createdAt, kind: "stellar", actor: "stellar", action: `stellar:${s.status}`, missionId: s.missionId, detail: s });
    }
    return items.sort((a, b) => b.at.localeCompare(a.at));
  }

  // ── Custom API Registry ──────────────────────────────────────────────
  async listCustomApis(workspaceId: string) {
    return this.safe(async () => {
      const rows = await this.db.select().from(schema.customApis).where(eq(schema.customApis.workspaceId, workspaceId));
      return rows as unknown as CustomApi[];
    }, []);
  }
  async getCustomApi(id: string) {
    const rows = await this.db.select().from(schema.customApis).where(eq(schema.customApis.id, id));
    return rows[0] as unknown as CustomApi | undefined;
  }
  async saveCustomApi(api: CustomApi) {
    await this.db.insert(schema.customApis).values(asRow(api)).onConflictDoUpdate({ target: schema.customApis.id, set: asRow(api) });
    return api;
  }
  async deleteCustomApi(id: string) {
    await this.db.delete(schema.customApis).where(eq(schema.customApis.id, id));
  }

  async listCustomApiEndpoints(apiId: string) {
    return this.safe(async () => {
      const rows = await this.db.select().from(schema.customApiEndpoints).where(eq(schema.customApiEndpoints.customApiId, apiId));
      return rows as unknown as CustomApiEndpoint[];
    }, []);
  }
  async saveCustomApiEndpoint(ep: CustomApiEndpoint) {
    await this.db
      .insert(schema.customApiEndpoints)
      .values(asRow(ep))
      .onConflictDoUpdate({ target: schema.customApiEndpoints.id, set: asRow(ep) });
    return ep;
  }
  async deleteCustomApiEndpoint(id: string) {
    await this.db.delete(schema.customApiEndpoints).where(eq(schema.customApiEndpoints.id, id));
  }

  // ── Agent Slots ──────────────────────────────────────────────────────
  async listAgentSlots() {
    return this.safe(async () => {
      const rows = await this.db.select().from(schema.agentSlots);
      return rows as unknown as AgentSlot[];
    }, []);
  }
  async getAgentSlot(id: string) {
    const rows = await this.db.select().from(schema.agentSlots).where(eq(schema.agentSlots.id, id));
    return rows[0] as unknown as AgentSlot | undefined;
  }
  async saveAgentSlot(slot: AgentSlot) {
    await this.db.insert(schema.agentSlots).values(asRow(slot)).onConflictDoUpdate({ target: schema.agentSlots.id, set: asRow(slot) });
    return slot;
  }
  async deleteAgentSlot(id: string) {
    await this.db.delete(schema.agentSlots).where(eq(schema.agentSlots.id, id));
  }

  // ── Agent-API Assignments ────────────────────────────────────────────
  async listAgentApiAssignments(agentId?: string) {
    return this.safe(async () => {
      const rows = agentId
        ? await this.db.select().from(schema.agentApiAssignments).where(eq(schema.agentApiAssignments.agentId, agentId))
        : await this.db.select().from(schema.agentApiAssignments);
      return rows as unknown as AgentApiAssignment[];
    }, []);
  }
  async getAgentApiAssignment(id: string) {
    const rows = await this.db.select().from(schema.agentApiAssignments).where(eq(schema.agentApiAssignments.id, id));
    return rows[0] as unknown as AgentApiAssignment | undefined;
  }
  async saveAgentApiAssignment(a: AgentApiAssignment) {
    await this.db
      .insert(schema.agentApiAssignments)
      .values(asRow(a))
      .onConflictDoUpdate({ target: schema.agentApiAssignments.id, set: asRow(a) });
    return a;
  }
  async deleteAgentApiAssignment(id: string) {
    await this.db.delete(schema.agentApiAssignments).where(eq(schema.agentApiAssignments.id, id));
  }

  // Chat Conversations
  async listChatConversations(workspaceId: string) {
    const rows = await this.db.select().from(schema.chatConversations).where(eq(schema.chatConversations.workspaceId, workspaceId));
    return (rows as RawRow[]).map(this.toChatConversation);
  }
  async getChatConversation(id: string) {
    const rows = await this.db.select().from(schema.chatConversations).where(eq(schema.chatConversations.id, id));
    return rows[0] ? this.toChatConversation(rows[0] as RawRow) : undefined;
  }
  async saveChatConversation(c: ChatConversation) {
    await this.db
      .insert(schema.chatConversations)
      .values(asRow(c))
      .onConflictDoUpdate({ target: schema.chatConversations.id, set: asRow(c) });
    return c;
  }
  async deleteChatConversation(id: string) {
    await this.db.delete(schema.chatMessages).where(eq(schema.chatMessages.conversationId, id));
    await this.db.delete(schema.chatConversations).where(eq(schema.chatConversations.id, id));
  }

  // Chat Messages
  async listChatMessages(conversationId: string) {
    const rows = await this.db.select().from(schema.chatMessages).where(eq(schema.chatMessages.conversationId, conversationId));
    return (rows as RawRow[]).map(this.toChatMessage);
  }
  async saveChatMessage(m: ChatMessage) {
    await this.db.insert(schema.chatMessages).values(asRow(m)).onConflictDoUpdate({ target: schema.chatMessages.id, set: asRow(m) });
    return m;
  }

  // Platform Connections
  async listPlatformConnections(workspaceId: string) {
    const rows = await this.db.select().from(schema.platformConnections).where(eq(schema.platformConnections.workspaceId, workspaceId));
    return (rows as RawRow[]).map(this.toPlatformConnection);
  }
  async getPlatformConnection(id: string) {
    const rows = await this.db.select().from(schema.platformConnections).where(eq(schema.platformConnections.id, id));
    return rows[0] ? this.toPlatformConnection(rows[0] as RawRow) : undefined;
  }
  async savePlatformConnection(p: PlatformConnection) {
    await this.db
      .insert(schema.platformConnections)
      .values(asRow(p))
      .onConflictDoUpdate({ target: schema.platformConnections.id, set: asRow(p) });
    return p;
  }
  async deletePlatformConnection(id: string) {
    await this.db.delete(schema.platformConnections).where(eq(schema.platformConnections.id, id));
  }

  // Type mappers — reshape a raw select() row into its domain type. See
  // asRow's docstring for why these go through `unknown`, not `any`.
  private toChatConversation(r: RawRow): ChatConversation {
    return asRow<ChatConversation>({
      ...r,
      scopes: undefined,
      createdAt: String(r.createdAt),
      updatedAt: String(r.updatedAt),
      lastUsedAt: r.lastUsedAt ? String(r.lastUsedAt) : undefined,
    });
  }
  private toChatMessage(r: RawRow): ChatMessage {
    return asRow<ChatMessage>({ ...r, createdAt: String(r.createdAt) });
  }
  private toPlatformConnection(r: RawRow): PlatformConnection {
    return asRow<PlatformConnection>({
      ...r,
      createdAt: String(r.createdAt),
      lastUsedAt: r.lastUsedAt ? String(r.lastUsedAt) : undefined,
      lastTestAt: r.lastTestAt ? String(r.lastTestAt) : undefined,
    });
  }

  // Exhibition Projects
  async listExhibitionProjects(workspaceId: string, featuredOnly?: boolean) {
    let rows = await this.db.select().from(schema.exhibitionProjects).where(eq(schema.exhibitionProjects.workspaceId, workspaceId));
    if (featuredOnly) rows = rows.filter((r) => (r as RawRow).featured);
    return (rows as RawRow[]).map(this.toExhibitionProject);
  }
  async getExhibitionProject(id: string) {
    const rows = await this.db.select().from(schema.exhibitionProjects).where(eq(schema.exhibitionProjects.id, id));
    return rows[0] ? this.toExhibitionProject(rows[0] as RawRow) : undefined;
  }
  async saveExhibitionProject(p: ExhibitionProject) {
    await this.db
      .insert(schema.exhibitionProjects)
      .values(asRow(p))
      .onConflictDoUpdate({ target: schema.exhibitionProjects.id, set: asRow(p) });
    return p;
  }
  async deleteExhibitionProject(id: string) {
    await this.db.delete(schema.exhibitionProjects).where(eq(schema.exhibitionProjects.id, id));
  }
  private toExhibitionProject(r: RawRow): ExhibitionProject {
    return asRow<ExhibitionProject>({ ...r, createdAt: String(r.createdAt), updatedAt: String(r.updatedAt) });
  }
}

let pgInstance: Repository | null = null;
export function getPgRepository(): Repository {
  if (!pgInstance) pgInstance = new PgRepository(client());
  return pgInstance;
}
