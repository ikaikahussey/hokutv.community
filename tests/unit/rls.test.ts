import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { newTestDb, type TestDb } from "../helpers/pg";

// Fixed identities so assertions are explicit.
const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // owner of tenant A
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // owner of tenant B
const ADMIN = "dddddddd-dddd-dddd-dddd-dddddddddddd"; // platform_admin
const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

let db: TestDb;

beforeAll(async () => {
  db = await newTestDb(async (d) => {
    await d.exec(`
      insert into auth.users (id, email) values
        ('${A}', 'a@a.com'), ('${B}', 'b@b.com'), ('${ADMIN}', 'admin@hoku.com');
      insert into public.tenants (id, subdomain, category) values
        ('${TENANT_A}', 'acme', 'coffee'),
        ('${TENANT_B}', 'globex', 'plumbing');
      insert into public.users (id, tenant_id, email, role) values
        ('${A}', '${TENANT_A}', 'a@a.com', 'owner'),
        ('${B}', '${TENANT_B}', 'b@b.com', 'owner'),
        ('${ADMIN}', null, 'admin@hoku.com', 'platform_admin');
    `);
  });
});

afterAll(async () => {
  await db.close();
});

const tenantIds = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

describe("RLS tenant isolation", () => {
  it("owner A sees only tenant A", async () => {
    const rows = await db.withRole({ role: "authenticated", sub: A }, (q) =>
      q<{ id: string }>("select id from public.tenants")
    );
    expect(tenantIds(rows)).toEqual([TENANT_A]);
  });

  it("owner B sees only tenant B", async () => {
    const rows = await db.withRole({ role: "authenticated", sub: B }, (q) =>
      q<{ id: string }>("select id from public.tenants")
    );
    expect(tenantIds(rows)).toEqual([TENANT_B]);
  });

  it("owner A cannot read user B's row", async () => {
    const rows = await db.withRole({ role: "authenticated", sub: A }, (q) =>
      q<{ id: string }>("select id from public.users")
    );
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(A);
    expect(ids).not.toContain(B);
  });

  it("platform_admin sees every tenant", async () => {
    const rows = await db.withRole({ role: "authenticated", sub: ADMIN }, (q) =>
      q<{ id: string }>("select id from public.tenants")
    );
    expect(tenantIds(rows)).toEqual([TENANT_A, TENANT_B].sort());
  });

  it("anon sees no tenants (no grant + no policy)", async () => {
    const rows = await db.withRole({ role: "anon" }, (q) =>
      q("select id from public.tenants")
    );
    expect(rows).toHaveLength(0);
  });

  it("owner A cannot update tenant B (write isolation)", async () => {
    const rows = await db.withRole({ role: "authenticated", sub: A }, (q) =>
      q(
        "update public.tenants set category = 'hacked' where id = $1 returning id",
        [TENANT_B]
      )
    );
    expect(rows).toHaveLength(0); // RLS filtered the row out of the UPDATE
  });

  it("owner A can update their own tenant", async () => {
    const rows = await db.withRole({ role: "authenticated", sub: A }, (q) =>
      q(
        "update public.tenants set category = 'espresso' where id = $1 returning category",
        [TENANT_A]
      )
    );
    expect(rows).toHaveLength(1);
  });

  it("a non-admin cannot insert a tenant", async () => {
    await expect(
      db.withRole({ role: "authenticated", sub: A }, (q) =>
        q(
          "insert into public.tenants (subdomain) values ('sneaky') returning id"
        )
      )
    ).rejects.toThrow(/row-level security|violates/i);
  });
});
