import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import type { CampaignStatus } from "@/lib/ads/types";

interface DashboardRow {
  id: string;
  package: string;
  status: CampaignStatus;
  budget_cents: number;
  spend_cents: number;
}

function demoRows(): DashboardRow[] {
  return [
    { id: "cmp_demo_growth", package: "growth", status: "active", budget_cents: 7500, spend_cents: 2310 },
    { id: "cmp_demo_starter", package: "starter", status: "pending", budget_cents: 2500, spend_cents: 0 },
  ];
}

async function getRows(): Promise<DashboardRow[]> {
  if (!isSupabaseConfigured()) return demoRows();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("ad_campaigns")
    .select("id, package, status, budget_cents, spend_cents")
    .order("created_at", { ascending: false });
  return (data as DashboardRow[] | null) ?? [];
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  approved: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  paused: "bg-brand-100 text-brand-700",
  completed: "bg-brand-100 text-brand-700",
  rejected: "bg-red-100 text-red-700",
};

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function CampaignDashboardPage() {
  const rows = await getRows();

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-ink">Your campaigns</h1>
        <Link
          href="/ads/buy"
          data-testid="buy-cta"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand-700"
        >
          + Buy an ad
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 text-ink/60">
          No campaigns yet. Create your first ad to reach customers across the HOKU
          network.
        </p>
      ) : (
        <table className="mt-6 w-full text-left text-sm" data-testid="campaign-table">
          <thead className="text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="py-2">Campaign</th>
              <th className="py-2">Package</th>
              <th className="py-2">Status</th>
              <th className="py-2">Budget</th>
              <th className="py-2">Spent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-brand-100">
                <td className="py-2 font-mono text-xs text-ink/70">{r.id}</td>
                <td className="py-2 capitalize">{r.package}</td>
                <td className="py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLE[r.status] ?? "bg-brand-50 text-ink/60"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="py-2">{dollars(r.budget_cents)}</td>
                <td className="py-2">{dollars(r.spend_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
