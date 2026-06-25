import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { newTestDb, type TestDb } from "../helpers/pg";

let db: TestDb;

beforeAll(async () => {
  db = await newTestDb(async (d) => {
    await d.exec(`
      insert into public.tenants (subdomain, category, is_published, is_listed) values
        ('listed-pub', 'coffee', true,  true),
        ('unlisted-pub', 'coffee', true,  false),
        ('listed-draft', 'coffee', false, true);
    `);
  });
});

afterAll(async () => {
  await db.close();
});

const subs = (rows: { subdomain: string }[]) => rows.map((r) => r.subdomain).sort();

describe("RLS: directory public visibility", () => {
  it("anon can read published tenants but never unpublished", async () => {
    const rows = await db.withRole({ role: "anon" }, (q) =>
      q<{ subdomain: string }>("select subdomain from public.tenants")
    );
    expect(subs(rows)).toEqual(["listed-pub", "unlisted-pub"]);
    expect(subs(rows)).not.toContain("listed-draft");
  });

  it("the directory query returns only published AND listed", async () => {
    const rows = await db.withRole({ role: "anon" }, (q) =>
      q<{ subdomain: string }>(
        "select subdomain from public.tenants where is_published and is_listed"
      )
    );
    expect(subs(rows)).toEqual(["listed-pub"]);
  });

  it("unlisting removes a tenant from the directory", async () => {
    // Mutate as the privileged (service/superuser) context, then re-read as anon.
    await db.exec(
      "update public.tenants set is_listed = false where subdomain = 'listed-pub'"
    );
    const rows = await db.withRole({ role: "anon" }, (q) =>
      q<{ subdomain: string }>(
        "select subdomain from public.tenants where is_published and is_listed"
      )
    );
    expect(rows).toHaveLength(0);
  });
});
