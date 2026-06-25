import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { newTestDb, type TestDb } from "../helpers/pg";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TA = "11111111-1111-1111-1111-111111111111";
const TB = "22222222-2222-2222-2222-222222222222";
const CR_A = "cccccccc-cccc-cccc-cccc-ccccccccccc1";
const CR_B = "cccccccc-cccc-cccc-cccc-ccccccccccc2";

let db: TestDb;

beforeAll(async () => {
  db = await newTestDb(async (d) => {
    await d.exec(`
      insert into auth.users (id, email) values ('${A}','a@a.com');
      insert into public.tenants (id, subdomain) values ('${TA}','acme'),('${TB}','globex');
      insert into public.users (id, tenant_id, email, role) values ('${A}','${TA}','a@a.com','owner');
      insert into public.ad_creatives (id, tenant_id, headline, destination_url) values
        ('${CR_A}','${TA}','A ad','https://a.com'),
        ('${CR_B}','${TB}','B ad','https://b.com');
      insert into public.ad_campaigns (tenant_id, creative_id, package, budget_cents) values
        ('${TA}','${CR_A}','starter',5000),
        ('${TB}','${CR_B}','starter',5000);
    `);
  });
});

afterAll(async () => {
  await db.close();
});

describe("RLS: ad creatives + campaigns scoped to tenant", () => {
  it("owner A sees only their creatives and campaigns", async () => {
    const creatives = await db.withRole({ role: "authenticated", sub: A }, (q) =>
      q<{ headline: string }>("select headline from public.ad_creatives")
    );
    expect(creatives.map((c) => c.headline)).toEqual(["A ad"]);

    const campaigns = await db.withRole({ role: "authenticated", sub: A }, (q) =>
      q<{ tenant_id: string }>("select tenant_id from public.ad_campaigns")
    );
    expect(campaigns.map((c) => c.tenant_id)).toEqual([TA]);
  });

  it("owner A cannot create a campaign for another tenant", async () => {
    await expect(
      db.withRole({ role: "authenticated", sub: A }, (q) =>
        q(
          "insert into public.ad_campaigns (tenant_id, creative_id, package) values ($1,$2,'starter') returning id",
          [TB, CR_B]
        )
      )
    ).rejects.toThrow(/row-level security|violates/i);
  });

  it("authenticated users cannot read raw ad_events (service-role only)", async () => {
    await expect(
      db.withRole({ role: "authenticated", sub: A }, (q) =>
        q("select * from public.ad_events")
      )
    ).rejects.toThrow(/permission denied/i);
  });
});
