import * as StellarSdk from "@stellar/stellar-sdk";

// Stellar wallet helper. Reads the secret key ONLY server-side. Never returns
// the secret to callers; only the public key, balance, and transaction history.
//
// Horizon's balance-line and operation-record types are real discriminated
// unions (native vs issued-asset balances; payment vs manage_data vs ...
// operations) that vary by a runtime `asset_type`/`type` tag. Narrowing
// each read against the full union is more machinery than the two fields
// this file actually touches justify — these two minimal interfaces
// describe just those fields, cast through `unknown` rather than `any`.
interface HorizonBalanceLike {
  asset_type: string;
  balance: string;
}
interface HorizonOperationLike {
  amount?: string;
  asset_type?: string;
  asset_code?: string;
  from?: string;
  to?: string;
}
const SECRET = process.env.STELLAR_SECRET_KEY || "";
const NETWORK = (process.env.STELLAR_NETWORK as "testnet" | "mainnet") || "testnet";
const HORIZON = process.env.STELLAR_HORIZON_URL || (NETWORK === "testnet"
  ? "https://horizon-testnet.stellar.org"
  : "https://horizon.stellar.org");

export function isStellarConfigured(): boolean {
  return !!SECRET;
}

export function publicKey(): string {
  if (!SECRET) return "GABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 (mock)";
  try {
    return StellarSdk.Keypair.fromSecret(SECRET).publicKey();
  } catch {
    return "GINVALID";
  }
}

export function server() {
  return new StellarSdk.Horizon.Server(HORIZON);
}

export function networkPassphrase(): string {
  return NETWORK === "testnet" ? StellarSdk.Networks.TESTNET : StellarSdk.Networks.PUBLIC;
}

export interface WalletState {
  configured: boolean;
  network: string;
  publicKey: string;
  balanceXlm?: number;
  sequenceNumber?: string;
  subentryCount?: number;
}

export async function walletState(): Promise<WalletState> {
  const pk = publicKey();
  if (!SECRET) {
    return { configured: false, network: NETWORK, publicKey: pk };
  }
  try {
    const account = await server().loadAccount(pk);
    const bal = (account.balances as unknown as HorizonBalanceLike[]).find((b) => b.asset_type === "native");
    return {
      configured: true,
      network: NETWORK,
      publicKey: pk,
      balanceXlm: Number(bal?.balance ?? 0),
      sequenceNumber: account.sequenceNumber(),
      subentryCount: account.subentry_count,
    };
  } catch {
    return { configured: true, network: NETWORK, publicKey: pk };
  }
}

export interface StellarTxHistoryItem {
  id: string;
  hash: string;
  type: string;
  amount?: string;
  asset?: string;
  from?: string;
  to?: string;
  memo?: string;
  createdAt: string;
  successful: boolean;
  ledger?: number;
}

export async function transactionHistory(limit = 20): Promise<StellarTxHistoryItem[]> {
  const pk = publicKey();
  if (!SECRET) {
    // Return mock transaction history
    return [
      {
        id: "tx_mock_001",
        hash: "mock_tx_hash_001",
        type: "manage_data",
        memo: "arena-receipt-anchor",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        successful: true,
        ledger: 100001,
      },
      {
        id: "tx_mock_002",
        hash: "mock_tx_hash_002",
        type: "payment",
        amount: "0.25",
        asset: "XLM",
        from: pk,
        to: "GARECIPENT...",
        memo: "x402-api-payment",
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        successful: true,
        ledger: 100000,
      },
    ];
  }

  try {
    const txs = await server()
      .transactions()
      .forAccount(pk)
      .limit(limit)
      .order("desc")
      .call();

    const results: StellarTxHistoryItem[] = [];
    for (const tx of txs.records) {
      // Get operations for each transaction
      const ops = await server()
        .operations()
        .forTransaction(tx.hash)
        .call();

      for (const op of ops.records) {
        const opFields = op as unknown as HorizonOperationLike;
        results.push({
          id: op.id,
          hash: tx.hash,
          type: op.type,
          amount: opFields.amount,
          asset: opFields.asset_type === "native" ? "XLM" : opFields.asset_code,
          from: opFields.from,
          to: opFields.to,
          memo: tx.memo,
          createdAt: tx.created_at,
          successful: tx.successful,
          ledger: Number(tx.ledger),
        });
      }
    }

    return results;
  } catch {
    return [];
  }
}

export interface TxConfirmation {
  confirmed: boolean;
  hash: string;
  ledger?: number;
  createdAt?: string;
  successful?: boolean;
  error?: string;
}

export async function confirmTransaction(txHash: string): Promise<TxConfirmation> {
  if (!SECRET) {
    // Mock confirmation
    return {
      confirmed: true,
      hash: txHash,
      ledger: 100001,
      createdAt: new Date().toISOString(),
      successful: true,
    };
  }

  try {
    const tx = await server().transactions().transaction(txHash).call();
    return {
      confirmed: true,
      hash: tx.hash,
      ledger: Number(tx.ledger),
      createdAt: tx.created_at,
      successful: tx.successful,
    };
  } catch (e) {
    return {
      confirmed: false,
      hash: txHash,
      error: (e as Error).message,
    };
  }
}

export async function submitPayment(to: string, amountXlm: number, memo?: string): Promise<{ txHash: string; success: boolean; error?: string }> {
  if (!SECRET) {
    return {
      txHash: "mock_payment_" + Date.now(),
      success: true,
    };
  }

  try {
    const kp = StellarSdk.Keypair.fromSecret(SECRET);
    const account = await server().loadAccount(kp.publicKey());

    const txBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: networkPassphrase(),
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: to,
          asset: StellarSdk.Asset.native(),
          amount: amountXlm.toFixed(7),
        }),
      )
      .setTimeout(30);

    if (memo) {
      txBuilder.addMemo(StellarSdk.Memo.text(memo));
    }

    const tx = txBuilder.build();
    tx.sign(kp);

    const result = await server().submitTransaction(tx);
    return { txHash: result.hash, success: true };
  } catch (e) {
    return { txHash: "", success: false, error: (e as Error).message };
  }
}
