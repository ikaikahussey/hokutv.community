import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { newTestDb, type TestDb } from "../helpers/pg";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

let db: TestDb;

beforeAll(async () => {
  db = await newTestDb(async (d) => {
    await d.exec(`
      insert into auth.users (id, email) values ('${A}','a@a.com'),('${B}','b@b.com');
      insert into public.tenants (id, subdomain, plan) values
        ('${TENANT_A}','acme','paid'), ('${TENANT_B}','globex','paid');
      insert into public.users (id, tenant_id, email, role) values
        ('${A}','${TENANT_A}','a@a.com','owner'),
        ('${B}','${TENANT_B}','b@b.com','owner');
      insert into public.domains (tenant_id, hostname) values
        ('${TENANT_A}','acme.com'), ('${TENANT_B}','globex.com');
    `);
  });
});

afterAll(async () => {
  await db.close();
});

describe("RLS: domains scoped to tenant", () => {
  it("owner A sees only their domain", async () => {
    const rows = await db.withRole({ role: "authenticated", sub: A }, (q) =>
      q<{ hostname: string }>("select hostname from public.domains")
    );
    expect(rows.map((r) => r.hostname)).toEqual(["acme.com"]);
  });

  it("owner A can add a domain to their own tenant", async () => {
    const rows = await db.withRole({ role: "authenticated", sub: A }, (q) =>
      q(
        "insert into public.domains (tenant_id, hostname) values ($1,'acme.io') returning id",
        [TENANT_A]
      )
    );
    expect(rows).toHaveLength(1);
  });

  it("owner A cannot add a domain to another tenant", async () => {
    await expect(
      db.withRole({ role: "authenticated", sub: A }, (q) =>
        q(
          "insert into public.domains (tenant_id, hostname) values ($1,'evil.com') returning id",
          [TENANT_B]
        )
      )
    ).rejects.toThrow(/row-level security|violates/i);
  });
});
