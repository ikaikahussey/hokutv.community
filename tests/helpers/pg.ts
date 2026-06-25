/**
 * In-process Postgres for tests (PGlite / WASM) — no Docker required.
 *
 * Boots a real Postgres, installs a Supabase-compatible `auth` shim
 * (auth.uid()/auth.role() reading the `request.jwt.claims` GUC, plus the
 * anon/authenticated/service_role roles and an auth.users table), then applies
 * the project's actual SQL migrations. This lets RLS policies be exercised
 * exactly as Postgres enforces them — the genuine Phase 2 isolation gate.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");

const AUTH_SHIM = `
  -- Roles Supabase provides; service_role bypasses RLS.
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema if not exists auth;
  create table auth.users (id uuid primary key, email text);
  grant usage on schema auth to anon, authenticated, service_role;

  -- Mirror Supabase's auth.uid()/auth.role(): read the JWT claims GUC the
  -- request context sets. Tests set this GUC via withRole() below.
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid
  $$;
  create or replace function auth.role() returns text language sql stable as $$
    select coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', 'anon')
  $$;
`;

export type Role = "anon" | "authenticated" | "service_role";

export interface TestDb {
  /** Run raw multi-statement SQL as the default superuser (bypasses RLS). */
  exec(sql: string): Promise<void>;
  /** Parametrized query as the default superuser (bypasses RLS). */
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]>;
  /**
   * Run `fn` inside a transaction with the given Postgres role and JWT subject,
   * so RLS applies exactly as it would for that user. Rolled back afterwards so
   * tests stay independent.
   */
  withRole<T>(
    opts: { role: Role; sub?: string; jwtRole?: string },
    fn: (q: <R = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<R[]>) => Promise<T>
  ): Promise<T>;
  close(): Promise<void>;
}

export async function newTestDb(seed?: (db: TestDb) => Promise<void>): Promise<TestDb> {
  const pg = new PGlite();
  await pg.exec(AUTH_SHIM);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    await pg.exec(readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"));
  }

  const db: TestDb = {
    async exec(sql) {
      await pg.exec(sql);
    },
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const res = await pg.query<T>(sql, params);
      return res.rows;
    },
    async withRole(opts, fn) {
      await pg.exec("begin");
      try {
        const claims = JSON.stringify({
          sub: opts.sub ?? null,
          role: opts.jwtRole ?? opts.role,
        });
        await pg.query("select set_config('request.jwt.claims', $1, true)", [claims]);
        await pg.exec(`set local role ${opts.role}`);
        const q = async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
          const res = await pg.query<R>(sql, params);
          return res.rows;
        };
        return await fn(q);
      } finally {
        await pg.exec("rollback");
      }
    },
    async close() {
      await pg.close();
    },
  };

  if (seed) await seed(db);
  return db;
}
