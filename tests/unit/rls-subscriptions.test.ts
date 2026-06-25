import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { newTestDb, type TestDb } from "../helpers/pg";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TA = "11111111-1111-1111-1111-111111111111";
const TB = "22222222-2222-2222-2222-222222222222";

let db: TestDb;

beforeAll(async () => {
  db = await newTestDb(async (d) => {
    await d.exec(`
      insert into auth.users (id, email) values ('${A}','a@a.com');
      insert into public.tenants (id, subdomain) values ('${TA}','acme'),('${TB}','globex');
      insert into public.users (id, tenant_id, email, role) values ('${A}','${TA}','a@a.com','owner');
      insert into public.subscriptions (tenant_id, plan, status) values
        ('${TA}','paid','active'), ('${TB}','paid','active');
    `);
  });
});

afterAll(async () => {
  await db.close();
});

describe("RLS: subscriptions scoped to tenant", () => {
  it("a member sees only their own subscription", async () => {
    const rows = await db.withRole({ role: "authenticated", sub: A }, (q) =>
      q<{ tenant_id: string }>("select tenant_id from public.subscriptions")
    );
    expect(rows.map((r) => r.tenant_id)).toEqual([TA]);
  });
});
