import {
  pgTable,
  text,
  jsonb,
  timestamp,
  integer,
  real,
  boolean,
} from "drizzle-orm/pg-core";
import type { Json } from "@core/types";

// ---------------------------------------------------------------------------
// Drizzle schema for PostgreSQL. Mirrors the domain model in src/domain.
// Raw SQL equivalent: see src/db/schema.sql
// ---------------------------------------------------------------------------

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerEmail: text("owner_email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  repository: text("repository"),
  integrations: jsonb("integrations").$type<Json[]>(),
  environment: text("environment").notNull().default("development"),
  budgetXlm: real("budget_xlm").notNull().default(5),
});

export const missions = pgTable("missions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull(),
  phaseOrder: jsonb("phase_order").$type<Json[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  workspaceId: text("workspace_id").notNull(),
  projectId: text("project_id"),
  tasks: jsonb("tasks").$type<Json[]>(),
  agents: jsonb("agents").$type<Json[]>(),
  modelsUsed: jsonb("models_used").$type<string[]>(),
  toolsUsed: jsonb("tools_used").$type<string[]>(),
  costUsd: real("cost_usd").notNull().default(0),
  paymentsXlm: real("payments_xlm").notNull().default(0),
  filesChanged: integer("files_changed").notNull().default(0),
  testsPassed: integer("tests_passed").notNull().default(0),
  testsFailed: integer("tests_failed").notNull().default(0),
  deploymentUrl: text("deployment_url"),
  verificationStatus: text("verification_status").notNull().default("unverified"),
  finalResult: text("final_result"),
  receiptHash: text("receipt_hash"),
  stellarTx: text("stellar_tx"),
});

export const integrations = pgTable("integrations", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  connected: boolean("connected").notNull().default(false),
  meta: jsonb("meta").$type<Json>(),
});

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  missionId: text("mission_id"),
  service: text("service").notNull(),
  purpose: text("purpose").notNull(),
  amountXlm: real("amount_xlm").notNull(),
  asset: text("asset").notNull(),
  network: text("network").notNull(),
  wallet: text("wallet").notNull(),
  recipient: text("recipient").notNull(),
  status: text("status").notNull(),
  txHash: text("tx_hash"),
  receiptHash: text("receipt_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  settledAt: timestamp("settled_at", { withTimezone: true }),
});

export const stellarTransactions = pgTable("stellar_transactions", {
  id: text("id").primaryKey(),
  missionId: text("mission_id"),
  kind: text("kind").notNull(),
  txHash: text("tx_hash").notNull(),
  network: text("network").notNull(),
  status: text("status").notNull(),
  amountXlm: real("amount_xlm"),
  receiptHash: text("receipt_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const receipts = pgTable("receipts", {
  hash: text("hash").primaryKey(),
  missionDigest: text("mission_digest").notNull(),
  submitter: text("submitter").notNull(),
  timestamp: text("timestamp").notNull(),
  status: text("status").notNull(),
  paymentReference: text("payment_reference"),
  anchorTx: text("anchor_tx"),
});

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  missionId: text("mission_id"),
  detail: jsonb("detail").$type<Json>(),
});

export const memories = pgTable("memories", {
  id: text("id").primaryKey(),
  scope: text("scope").notNull(),
  scopeId: text("scope_id").notNull(),
  source: text("source").notNull(),
  content: text("content").notNull(),
  confidence: real("confidence").notNull().default(0.5),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  environment: text("environment").notNull(),
  prefix: text("prefix").notNull(),
  scopes: jsonb("scopes").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revoked: boolean("revoked").notNull().default(false),
});

export const modelProviders = pgTable("model_providers", {
  provider: text("provider").primaryKey(),
  label: text("label").notNull(),
  connected: boolean("connected").notNull().default(false),
  models: jsonb("models").$type<string[]>(),
});

export const agentRuns = pgTable("agent_runs", {
  id: text("id").primaryKey(),
  missionId: text("mission_id").notNull(),
  role: text("role").notNull(),
  model: text("model"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  status: text("status").notNull(),
  summary: text("summary"),
});

export const toolRuns = pgTable("tool_runs", {
  id: text("id").primaryKey(),
  missionId: text("mission_id"),
  tool: text("tool").notNull(),
  input: jsonb("input").$type<Json>(),
  output: jsonb("output").$type<Json>(),
  status: text("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  error: text("error"),
});

// ---------------------------------------------------------------------------
// Prompt 2 additions: tasks table, jobs queue table, verification checks
// ---------------------------------------------------------------------------

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  missionId: text("mission_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  agentRole: text("agent_role").notNull(),
  status: text("status").notNull().default("pending"),
  dependsOn: jsonb("depends_on").$type<string[]>().default([]),
  result: jsonb("result").$type<Json>(),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  missionId: text("mission_id").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<Json>(),
  status: text("status").notNull().default("pending"),
  priority: integer("priority").notNull().default(0),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const verificationChecks = pgTable("verification_checks", {
  id: text("id").primaryKey(),
  missionId: text("mission_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

// ---------------------------------------------------------------------------
// Prompt 7: Custom API Registry
// ---------------------------------------------------------------------------

export const customApis = pgTable("custom_apis", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  baseUrl: text("base_url").notNull(),
  authType: text("auth_type").notNull().default("none"),
  credentialReference: text("credential_reference").notNull().default(""),
  requestConfig: jsonb("request_config").$type<Json>().default({}),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  createdBy: text("created_by").notNull(),
});

export const customApiEndpoints = pgTable("custom_api_endpoints", {
  id: text("id").primaryKey(),
  customApiId: text("custom_api_id").notNull(),
  name: text("name").notNull(),
  method: text("method").notNull().default("GET"),
  path: text("path").notNull(),
  description: text("description").notNull(),
  paramSchema: jsonb("param_schema").$type<Json>(),
  costXlm: real("cost_xlm").default(0),
});

export const agentSlots = pgTable("agent_slots", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  role: text("role").notNull(),
  isCustom: boolean("is_custom").notNull().default(false),
  modelPreference: text("model_preference").notNull().default("auto"),
  budget: real("budget").notNull().default(5),
  timeoutMs: integer("timeout_ms").notNull().default(120000),
  retryLimit: integer("retry_limit").notNull().default(2),
  status: text("status").notNull().default("active"),
  defaultCapabilities: jsonb("default_capabilities").$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const agentApiAssignments = pgTable("agent_api_assignments", {
  id: text("id").primaryKey(),
  customApiId: text("custom_api_id").notNull(),
  agentId: text("agent_id").notNull(),
  grantedCapabilities: jsonb("granted_capabilities").$type<string[]>().default(["can_call"]),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull(),
  assignedBy: text("assigned_by").notNull(),
});

// ---------------------------------------------------------------------------
// Prompt 8A: Chat conversations + platform connections
// ---------------------------------------------------------------------------

export const chatConversations = pgTable("chat_conversations", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  projectId: text("project_id"),
  title: text("title").notNull(),
  modelProvider: text("model_provider").notNull().default("mock"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  missionId: text("mission_id"),
});

export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  model: text("model"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const platformConnections = pgTable("platform_connections", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  platform: text("platform").notNull(),
  label: text("label").notNull(),
  status: text("status").notNull().default("disconnected"),
  credentialReference: text("credential_reference").notNull().default(""),
  scopes: jsonb("scopes").$type<Json[]>(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  lastTestAt: timestamp("last_test_at", { withTimezone: true }),
  lastTestOk: boolean("last_test_ok"),
  network: text("network"),
  meta: jsonb("meta").$type<Json>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

// ---------------------------------------------------------------------------
// Prompt 8B: Exhibition projects (public portfolio)
// ---------------------------------------------------------------------------

export const exhibitionProjects = pgTable("exhibition_projects", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  missionId: text("mission_id"),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  techStack: jsonb("tech_stack").$type<string[]>().default([]),
  repoUrl: text("repo_url"),
  liveUrl: text("live_url"),
  screenshotUrl: text("screenshot_url"),
  arenaInvolvement: text("arena_involvement"),
  category: text("category").notNull().default("other"),
  featured: boolean("featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  receiptHash: text("receipt_hash"),
  stellarTx: text("stellar_tx"),
  meta: jsonb("meta").$type<Json>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});
