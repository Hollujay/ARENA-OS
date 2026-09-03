import "server-only";

/**
 * Server-only client for the BMONI Embedded REST API — the money-movement
 * rail behind Arena's payment tool (@bmoni/x402, @bmoni/wallet), replacing
 * the previous Stellar/x402 settlement path.
 *
 * Scoped to what payment settlement needs: an already-provisioned operator
 * smart wallet (BMONI_OPERATOR_USER_ID / BMONI_OPERATOR_SMART_WALLET_ID),
 * balance reads, and the propose -> approve -> sign -> submit flow. This
 * does NOT implement the onboarding lifecycle (user creation, KYC, rail
 * activation) — provisioning the operator wallet is a one-time setup step
 * outside this app, the same way STELLAR_SECRET_KEY assumed an
 * already-funded Stellar account rather than the app creating one.
 *
 * Every shape here matches apps/oracle-web/src/lib/bmoni.ts, which was
 * built by exercising these same endpoints live against BMONI's sandbox —
 * see that file's comments for the specific doc-vs-live discrepancies
 * this is based on. Written fresh for this app rather than imported from
 * oracle-web, matching this monorepo's per-app isolation.
 */

const BASE_URL = process.env.BMONI_BASE_URL ?? "https://embedded-dev.bmoni.com";
const API_KEY = process.env.BMONI_API_KEY;

export class BmoniError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`BMONI API error ${status}: ${typeof body === "object" ? JSON.stringify(body) : String(body)}`);
    this.status = status;
    this.body = body;
  }
}

function requireApiKey(): string {
  if (!API_KEY) throw new Error("BMONI_API_KEY is not set.");
  return API_KEY;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "x-api-key": requireApiKey(),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new BmoniError(res.status, json ?? text);
  return json as T;
}

export interface WalletBalance {
  smartWalletId: string;
  currency: string;
  balance: string;
  error: string | null;
}

export function listBalances(userId: string) {
  return request<{ smartAccountAddress: string; balances: WalletBalance[] }>(
    "GET",
    `/v1/users/${userId}/smart-wallets/account/balances`,
  );
}

export interface Proposal {
  id: string;
  status: string;
  amount: string;
  currency: string;
  [key: string]: unknown;
}

export function createTransferProposal(
  userId: string,
  smartWalletId: string,
  proposal: { toAddress: string; amount: string; currency: string; description?: string },
) {
  return request<{ proposal: Proposal }>(
    "POST",
    `/v1/users/${userId}/smart-wallets/${smartWalletId}/proposals`,
    { proposal: { type: "TRANSFER", ...proposal } },
  );
}

/** Live-verified to work despite being absent from BMONI's own published OpenAPI spec — see oracle-web's README. */
export function approveProposal(userId: string, proposalId: string) {
  return request<{ proposal: Proposal }>(
    "POST",
    `/v1/users/${userId}/smart-wallets/proposals/${proposalId}/approve`,
  );
}

export interface SignPayload {
  signingPayloadHash: string;
  proposalStatus: string;
}

export function getSignPayload(userId: string, proposalId: string) {
  return request<SignPayload>("GET", `/v1/users/${userId}/smart-wallets/proposals/${proposalId}/sign-payload`);
}

export function submitProposalSignature(userId: string, proposalId: string, signature: string) {
  return request<{ proposal: Proposal }>(
    "POST",
    `/v1/users/${userId}/smart-wallets/proposals/${proposalId}/sign`,
    { signature },
  );
}

export function getProposal(userId: string, proposalId: string) {
  return request<{ proposal: Proposal }>("GET", `/v1/users/${userId}/smart-wallets/proposals/${proposalId}`);
}
