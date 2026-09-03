import { getRepository } from "@db/index";
import { Panel, PanelHeader, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const repo = getRepository();
  const payments = await repo.listPayments();
  const total = payments.reduce((s, p) => s + p.amountXlm, 0);

  return (
    <div className="min-h-screen">
      <div className="px-6 py-5 space-y-4">
        <div>
          <span className="arena-label">PAYMENTS</span>
          <p className="text-[11px] text-arena-secondary mt-0.5">
            x402 payments · policy enforcement · Stellar settlement
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <StatBlock label="TOTAL SPENT" value={`${total.toFixed(2)} NGN`} tone="green" />
          <StatBlock label="TRANSACTIONS" value={`${payments.length}`} />
          <StatBlock label="POLICY" value="ACTIVE" tone="green" />
          <StatBlock label="PENDING" value={`${payments.filter(p => p.status === "pending").length}`} />
        </div>

        {/* Transaction history */}
        <Panel>
          <PanelHeader title="TRANSACTION HISTORY" subtitle="All x402 settlements" />
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-arena-border">
                  <th className="px-4 py-2 text-left font-mono text-[9px] tracking-[0.08em] uppercase text-arena-muted">
                    TIME
                  </th>
                  <th className="px-4 py-2 text-left font-mono text-[9px] tracking-[0.08em] uppercase text-arena-muted">
                    SERVICE
                  </th>
                  <th className="px-4 py-2 text-left font-mono text-[9px] tracking-[0.08em] uppercase text-arena-muted">
                    PURPOSE
                  </th>
                  <th className="px-4 py-2 text-right font-mono text-[9px] tracking-[0.08em] uppercase text-arena-muted">
                    AMOUNT
                  </th>
                  <th className="px-4 py-2 text-left font-mono text-[9px] tracking-[0.08em] uppercase text-arena-muted">
                    NETWORK
                  </th>
                  <th className="px-4 py-2 text-left font-mono text-[9px] tracking-[0.08em] uppercase text-arena-muted">
                    STATUS
                  </th>
                  <th className="px-4 py-2 text-left font-mono text-[9px] tracking-[0.08em] uppercase text-arena-muted">
                    TX
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-arena-border/30">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2 font-mono text-[10px] text-arena-muted">
                      {new Date(p.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2 text-arena-text">
                      {p.service}
                    </td>
                    <td className="px-4 py-2 text-arena-secondary truncate max-w-[200px]">
                      {p.purpose}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-[11px] text-arena-green">
                      {p.amountXlm.toFixed(2)} XLM
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone="green">{p.network}</Badge>
                    </td>
                    <td className="px-4 py-2">
                      <Badge
                        tone={
                          p.status === "settled"
                            ? "green"
                            : p.status === "denied"
                              ? "red"
                              : p.status === "pending"
                                ? "amber"
                                : "default"
                        }
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 font-mono text-[9px] text-arena-muted truncate max-w-[120px]">
                      {p.txHash || "—"}
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
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
