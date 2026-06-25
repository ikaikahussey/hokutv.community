import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { newTestDb, type TestDb } from "../helpers/pg";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TENANT_A = "11111111-1111-1111-1111-111111111111"; // published
const TENANT_B = "22222222-2222-2222-2222-222222222222"; // NOT published

let db: TestDb;

beforeAll(async () => {
  db = await newTestDb(async (d) => {
    await d.exec(`
      insert into auth.users (id, email) values ('${A}', 'a@a.com');
      insert into public.tenants (id, subdomain, is_published) values
        ('${TENANT_A}', 'acme', true),
        ('${TENANT_B}', 'globex', false);
      insert into public.users (id, tenant_id, email, role) values
        ('${A}', '${TENANT_A}', 'a@a.com', 'owner');
      insert into public.pages (tenant_id, slug, title, status) values
        ('${TENANT_A}', 'home', 'A home', 'published'),
        ('${TENANT_A}', 'about', 'A about', 'draft'),
        ('${TENANT_B}', 'home', 'B home', 'published');
    `);
  });
});

afterAll(async () => {
  await db.close();
});

const slugs = (rows: { slug: string }[]) => rows.map((r) => r.slug).sort();

describe("RLS: pages public visibility + tenant CRUD", () => {
  it("anon sees only published pages of published tenants", async () => {
    const rows = await db.withRole({ role: "anon" }, (q) =>
      q<{ slug: string }>("select slug from public.pages")
    );
    // A/home only: A/about is draft; B/home's tenant is unpublished.
    expect(slugs(rows)).toEqual(["home"]);
    expect(rows).toHaveLength(1);
  });

  it("owner A sees all of tenant A's pages but none of tenant B's", async () => {
    const rows = await db.withRole({ role: "authenticated", sub: A }, (q) =>
      q<{ slug: string; tenant_id: string }>(
        "select slug, tenant_id from public.pages"
      )
    );
    expect(slugs(rows)).toEqual(["about", "home"]);
    expect(rows.every((r) => r.tenant_id === TENANT_A)).toBe(true);
  });

  it("owner A can insert a page into their own tenant", async () => {
    const rows = await db.withRole({ role: "authenticated", sub: A }, (q) =>
      q(
        "insert into public.pages (tenant_id, slug, title) values ($1,'services','S') returning id",
        [TENANT_A]
      )
    );
    expect(rows).toHaveLength(1);
  });

  it("owner A cannot insert a page into another tenant", async () => {
    await expect(
      db.withRole({ role: "authenticated", sub: A }, (q) =>
        q(
          "insert into public.pages (tenant_id, slug, title) values ($1,'evil','E') returning id",
          [TENANT_B]
        )
      )
    ).rejects.toThrow(/row-level security|violates/i);
  });

  it("owner A cannot update tenant B's page", async () => {
    const rows = await db.withRole({ role: "authenticated", sub: A }, (q) =>
      q(
        "update public.pages set title='hacked' where tenant_id=$1 returning id",
        [TENANT_B]
      )
    );
    expect(rows).toHaveLength(0);
  });
});
