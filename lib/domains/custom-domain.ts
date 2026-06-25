import type {
  VercelDnsRecord,
  VercelDomainsClient,
  SslStatus,
} from "@/lib/integrations/vercel";

/**
 * Custom-domain flow (Phase 5). The paid-plan gate, hostname validation, and
 * persistence are isolated behind injected deps so the whole flow is unit
 * tested with a mocked Vercel client + in-memory repo.
 */
export class PlanGateError extends Error {
  constructor(message = "Custom domains require the paid plan") {
    super(message);
    this.name = "PlanGateError";
  }
}

/** The plan gate from build-prompt §5/Phase 5: only paid tenants proceed. */
export function assertCanAddCustomDomain(plan: string): void {
  if (plan !== "paid") throw new PlanGateError();
}

/** Normalize + validate a user-entered hostname. Throws on an invalid domain. */
export function normalizeHostname(input: string): string {
  const host = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
    .replace(/:\d+$/, "");
  // Basic FQDN check: labels of letters/digits/hyphens, a dotted TLD.
  if (!/^(?=.{1,253}$)([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/.test(host)) {
    throw new Error(`Invalid domain: ${input}`);
  }
  return host;
}

export interface DomainRecord {
  id?: string;
  tenant_id: string;
  hostname: string;
  vercel_domain_id?: string | null;
  ssl_status: SslStatus;
  verification: VercelDnsRecord[];
}

export interface DomainsRepo {
  insertDomain(rec: Omit<DomainRecord, "id">): Promise<DomainRecord>;
  updateStatus(
    hostname: string,
    patch: { ssl_status: SslStatus; verification?: VercelDnsRecord[] }
  ): Promise<DomainRecord | null>;
  setTenantCustomDomain(tenantId: string, hostname: string | null): Promise<void>;
}

export interface AddCustomDomainResult {
  record: DomainRecord;
  dns: VercelDnsRecord[];
}

export async function addCustomDomain(opts: {
  plan: string;
  tenantId: string;
  hostname: string;
  vercel: VercelDomainsClient;
  repo: DomainsRepo;
}): Promise<AddCustomDomainResult> {
  assertCanAddCustomDomain(opts.plan); // gate BEFORE any external call
  const hostname = normalizeHostname(opts.hostname);

  const added = await opts.vercel.addDomain(hostname);
  const ssl: SslStatus = added.verified ? "active" : "verifying";

  const record = await opts.repo.insertDomain({
    tenant_id: opts.tenantId,
    hostname,
    vercel_domain_id: added.id,
    ssl_status: ssl,
    verification: added.verification,
  });

  // Only route a domain that's fully verified + SSL-active.
  if (added.verified) {
    await opts.repo.setTenantCustomDomain(opts.tenantId, hostname);
  }

  return { record, dns: added.verification };
}

/** Poll Vercel and update local state; promote to routing when active. */
export async function refreshDomainStatus(opts: {
  tenantId: string;
  hostname: string;
  vercel: VercelDomainsClient;
  repo: DomainsRepo;
}): Promise<DomainRecord | null> {
  const hostname = normalizeHostname(opts.hostname);
  const status = await opts.vercel.getDomainStatus(hostname);
  const record = await opts.repo.updateStatus(hostname, {
    ssl_status: status.sslStatus,
    verification: status.verification,
  });
  if (status.sslStatus === "active") {
    await opts.repo.setTenantCustomDomain(opts.tenantId, hostname);
  }
  return record;
}

/** Human, copy-paste DNS setup lines for the admin UI. */
export function dnsInstructions(dns: VercelDnsRecord[]): string[] {
  return dns.map((r) => `${r.type}  ${r.name}  →  ${r.value}`);
}
