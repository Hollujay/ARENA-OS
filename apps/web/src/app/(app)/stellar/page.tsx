import { getRepository } from "@db/index";
import { walletState } from "@stellar/wallet";
import { Panel, PanelHeader, Badge, StatusDot } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function StellarPage() {
  const repo = getRepository();
  const wallet = await walletState();
  const txs = await repo.listStellarTx();

  return (
    <div className="min-h-screen">
      <div className="px-6 py-5 space-y-4">
        <div>
          <span className="arena-label">STELLAR</span>
          <p className="text-[11px] text-arena-secondary mt-0.5">
            Receipt anchoring for missions. Payment settlement moved to BMONI — see /payments.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <StatBlock label="NETWORK" value={wallet.network} />
          <StatBlock
            label="STATUS"
            value={wallet.configured ? "ACTIVE" : "MOCK"}
            tone={wallet.configured ? "green" : "amber"}
          />
          <StatBlock label="ANCHORS" value={`${txs.length}`} />
          <StatBlock
            label="BALANCE"
            value={
              wallet.balanceXlm !== undefined
                ? `${wallet.balanceXlm} XLM`
                : "—"
            }
          />
        </div>

        {/* Wallet */}
        <Panel>
          <PanelHeader
            title="WALLET"
            subtitle="Public key only — secret never exposed to browser or models"
          />
          <div className="px-4 py-3 flex items-center gap-3">
            <StatusDot tone={wallet.configured ? "green" : "amber"} />
            <span className="font-mono text-[11px] text-arena-text break-all">
              {wallet.publicKey}
            </span>
          </div>
          {!wallet.configured && (
            <div className="px-4 py-2 border-t border-arena-border/30 font-mono text-[9px] text-arena-muted">
              Set STELLAR_SECRET_KEY to enable real testnet anchoring
            </div>
          )}
        </Panel>

        {/* Transactions */}
        <Panel>
          <PanelHeader
            title="TRANSACTION HISTORY"
            subtitle="On-chain evidence for missions"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-arena-border">
                  <th className="px-4 py-2 text-left font-mono text-[9px] tracking-[0.08em] uppercase text-arena-muted">
                    TIME
                  </th>
                  <th className="px-4 py-2 text-left font-mono text-[9px] tracking-[0.08em] uppercase text-arena-muted">
                    KIND
                  </th>
                  <th className="px-4 py-2 text-left font-mono text-[9px] tracking-[0.08em] uppercase text-arena-muted">
                    NETWORK
                  </th>
                  <th className="px-4 py-2 text-left font-mono text-[9px] tracking-[0.08em] uppercase text-arena-muted">
                    STATUS
                  </th>
                  <th className="px-4 py-2 text-left font-mono text-[9px] tracking-[0.08em] uppercase text-arena-muted">
                    TX HASH
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-arena-border/30">
                {txs.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2 font-mono text-[10px] text-arena-muted">
                      {new Date(t.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2 font-mono text-[10px] text-arena-text">
                      {t.kind}
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone="green">{t.network}</Badge>
                    </td>
                    <td className="px-4 py-2">
                      <Badge
                        tone={
                          t.status === "confirmed"
                            ? "green"
                            : t.status === "failed"
                              ? "red"
                              : "amber"
                        }
                      >
                        {t.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 font-mono text-[9px] text-arena-muted break-all max-w-[200px]">
                      {t.txHash}
                    </td>
                  </tr>
                ))}
                {txs.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-arena-muted font-mono text-[10px]"
                    >
                      No transactions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "green" | "amber" | "red";
}) {
  const toneColor: Record<string, string> = {
    default: "text-arena-text",
    green: "text-arena-green",
    amber: "text-yellow-400",
    red: "text-arena-red",
  };
  return (
    <div className="bg-arena-panel border border-arena-border rounded-lg px-3 py-3">
      <div className="arena-label mb-1">{label}</div>
      <div className={`font-mono text-sm font-semibold ${toneColor[tone]}`}>
        {value}
      </div>
    </div>
  );
}
