import "server-only";
import { ethers } from "ethers";
import * as bmoni from "./client";

/**
 * BMONI-backed operator wallet. Mirrors ../stellar/wallet.ts's interface
 * (isStellarConfigured -> isBmoniConfigured, publicKey -> operatorAddress,
 * submitPayment, transactionHistory, confirmTransaction) so @bmoni/x402
 * is a drop-in replacement for @stellar/x402's settlement calls.
 *
 * CUSTODY NOTE: this reads a raw EOA private key from
 * BMONI_OPERATOR_PRIVATE_KEY, server-side only, never returned to
 * callers — same shape as STELLAR_SECRET_KEY before it. This is
 * necessary, not incidental: the payment.request tool settles
 * autonomously, on an agent's behalf, with no human present to enter a
 * PIN for each transaction (unlike apps/oracle-web's wallet-client.ts,
 * which is deliberately PIN-gated because a human approves each Oracle
 * transaction). A server-held signing key is the correct tradeoff for
 * *this* use case — autonomous, policy-gated, budget-capped spending —
 * not a shortcut taken for convenience. Rotate this key if it's ever
 * exposed; nothing regenerates it automatically.
 */

const OPERATOR_PRIVATE_KEY = process.env.BMONI_OPERATOR_PRIVATE_KEY || "";
const OPERATOR_USER_ID = process.env.BMONI_OPERATOR_USER_ID || "";
const OPERATOR_SMART_WALLET_ID = process.env.BMONI_OPERATOR_SMART_WALLET_ID || "";

export function isBmoniConfigured(): boolean {
  return !!(OPERATOR_PRIVATE_KEY && OPERATOR_USER_ID && OPERATOR_SMART_WALLET_ID);
}

export function operatorAddress(): string {
  if (!OPERATOR_PRIVATE_KEY) return "0x0000000000000000000000000000000000000 (mock)";
  try {
    return new ethers.Wallet(OPERATOR_PRIVATE_KEY).address;
  } catch {
    return "0xINVALID";
  }
}

export interface WalletState {
  configured: boolean;
  network: string;
  publicKey: string;
  balanceNgn?: number;
}

export async function walletState(): Promise<WalletState> {
  const addr = operatorAddress();
  if (!isBmoniConfigured()) {
    return { configured: false, network: "base-sepolia", publicKey: addr };
  }
  try {
    const { balances } = await bmoni.listBalances(OPERATOR_USER_ID);
    const ngn = balances.find((b) => b.currency === "NGN" || b.currency === "CNGN");
    return { configured: true, network: "base-sepolia", publicKey: addr, balanceNgn: ngn ? Number(ngn.balance) : 0 };
  } catch {
    return { configured: true, network: "base-sepolia", publicKey: addr };
  }
}

export interface BmoniTxHistoryItem {
  id: string;
  hash: string;
  type: string;
  amount?: string;
  asset?: string;
  to?: string;
  memo?: string;
  createdAt: string;
  successful: boolean;
}

/**
 * BMONI's API has no general "transaction history" endpoint scoped to an
 * arbitrary wallet the way Horizon does — only per-smart-wallet proposal
 * history (GET .../smart-wallets/{id}/transactions, used in
 * apps/oracle-web). Not wired here: the payment tool doesn't currently
 * need it, and adding it means threading a smartWalletId lookup through
 * every caller for a feature nothing uses yet. Returns empty rather than
 * a silently-wrong mock list.
 */
export async function transactionHistory(_limit = 20): Promise<BmoniTxHistoryItem[]> {
  return [];
}

export interface TxConfirmation {
  confirmed: boolean;
  hash: string;
  successful?: boolean;
  error?: string;
}

export async function confirmTransaction(proposalId: string): Promise<TxConfirmation> {
  if (!isBmoniConfigured()) {
    return { confirmed: true, hash: proposalId, successful: true };
  }
  try {
    const { proposal } = await bmoni.getProposal(OPERATOR_USER_ID, proposalId);
    return {
      confirmed: proposal.status === "COMPLETED",
      hash: proposalId,
      successful: proposal.status === "COMPLETED",
    };
  } catch (e) {
    return { confirmed: false, hash: proposalId, error: (e as Error).message };
  }
}

/**
 * Full propose -> approve -> sign -> submit cycle in one call, using the
 * server-held operator key. `to` must be a 0x-prefixed EVM address;
 * `amountNgn` settles in cNGN (BMONI's only rail verified live against
 * their sandbox — see apps/oracle-web/README's Live findings).
 */
export async function submitPayment(
  to: string,
  amountNgn: number,
  memo?: string,
): Promise<{ txHash: string; success: boolean; error?: string }> {
  if (!isBmoniConfigured()) {
    return { txHash: "mock_payment_" + Date.now(), success: true };
  }

  try {
    const { proposal } = await bmoni.createTransferProposal(OPERATOR_USER_ID, OPERATOR_SMART_WALLET_ID, {
      toAddress: to,
      amount: amountNgn.toFixed(2),
      currency: "CNGN",
      description: memo ?? "Arena OS payment",
    });

    await bmoni.approveProposal(OPERATOR_USER_ID, proposal.id);

    const payload = await bmoni.getSignPayload(OPERATOR_USER_ID, proposal.id);
    const wallet = new ethers.Wallet(OPERATOR_PRIVATE_KEY);
    // Raw digest, NO EIP-191 prefix — signingKey.sign(), not signMessage().
    // Mixing these two up is BMONI's most common integration failure; see
    // apps/oracle-web/src/lib/wallet-client.ts for the full explanation.
    const signature = wallet.signingKey.sign(payload.signingPayloadHash).serialized;

    await bmoni.submitProposalSignature(OPERATOR_USER_ID, proposal.id, signature);

    return { txHash: proposal.id, success: true };
  } catch (e) {
    return { txHash: "", success: false, error: (e as Error).message };
  }
}
