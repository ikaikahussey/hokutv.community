import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { newTestDb, type TestDb } from "../helpers/pg";
import { selectAd } from "@/lib/ads/pacing";
import { rollupEvents, type AdEvent } from "@/lib/ads/rollups";
import type { Campaign } from "@/lib/ads/types";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SEED = path.join(ROOT, "supabase", "seed.sql");

/**
 * Validates supabase/seed.sql against the REAL schema (all migrations applied in
 * PGlite) and proves the Definition-of-Done §11 deliverables: a themed published
 * tenant with a directory entry, plus one LIVE ad serving on a SECOND tenant's
 * site. Also asserts the seed is idempotent (re-runnable).
 */
const B = "22222222-2222-2222-2222-222222222222"; // north-shore-surf (host)

describe("supabase/seed.sql", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await newTestDb();
    const sql = readFileSync(SEED, "utf8");
    await db.exec(sql);
    await db.exec(sql); // idempotency: second apply must not error
  });
  afterAll(async () => {
    await db.close();
  });

  it("seeds two published, listed tenants (directory entries)", async () => {
    const rows = await db.query<{ subdomain: string }>(
      "select subdomain from public.tenants where is_published and is_listed order by subdomain"
    );
    expect(rows.map((r) => r.subdomain)).toEqual(["kalihi-coffee", "north-shore-surf"]);
  });

  it("each tenant has a published, themed home page", async () => {
    const rows = await db.query<{ status: string; theme: Record<string, string> }>(
      `select p.status, t.theme from public.pages p
         join public.tenants t on t.id = p.tenant_id
        where p.slug = 'home'`
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.status === "published")).toBe(true);
    expect(rows.every((r) => typeof r.theme.primary === "string")).toBe(true);
  });

  it("a live ad serves on the second tenant's site (host opted in)", async () => {
    // Host B is opted in to the sidebar slot.
    const part = await db.query<{ enabled: boolean }>(
      "select enabled from public.ad_participation where tenant_id = $1 and slot_type = 'sidebar'",
      [B]
    );
    expect(part[0]?.enabled).toBe(true);

    // Replicate the serving path: active campaign + approved creative.
    const camps = await db.query<{
      id: string;
      tenant_id: string;
      creative_id: string;
      status: string;
      budget_cents: number;
      spend_cents: number;
      targeting_json: Record<string, unknown>;
    }>(
      `select c.id, c.tenant_id, c.creative_id, c.status, c.budget_cents, c.spend_cents, c.targeting_json
         from public.ad_campaigns c
         join public.ad_creatives cr on cr.id = c.creative_id and cr.status = 'approved'
        where c.status in ('approved','active')`
    );
    const candidates: Campaign[] = camps.map((c) => ({
      id: c.id,
      tenant_id: c.tenant_id,
      creative_id: c.creative_id,
      status: c.status as Campaign["status"],
      budget_cents: c.budget_cents,
      spend_cents: c.spend_cents,
      targeting: c.targeting_json as Campaign["targeting"],
    }));
    const chosen = selectAd(candidates, { slot: "sidebar", category: "fitness", hostTenantId: B });
    expect(chosen).not.toBeNull();
    // The advertiser is tenant A, serving on host B — a cross-tenant network ad.
    expect(chosen!.tenant_id).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("the seeded impression rolls up against the host tenant", async () => {
    const events = await db.query<AdEvent>(
      `select campaign_id, host_tenant_id, type, created_at::text as created_at
         from public.ad_events`
    );
    expect(events.length).toBeGreaterThanOrEqual(1);
    const rollups = rollupEvents(events);
    expect(rollups[0].host_tenant_id).toBe(B);
    expect(rollups[0].impressions).toBe(1);
  });
});
