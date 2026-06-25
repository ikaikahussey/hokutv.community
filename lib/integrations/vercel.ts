/**
 * Vercel Domains API client (Phase 5). Adding a domain to the project triggers
 * automatic SSL issuance; we poll status for verification. The interface is
 * injectable so the flow is testable without hitting Vercel.
 */
export interface VercelDnsRecord {
  type: string; // e.g. "A", "CNAME", "TXT"
  name: string; // host/record name
  value: string;
}

export interface VercelAddResult {
  id: string;
  verified: boolean;
  verification: VercelDnsRecord[];
}

export type SslStatus = "pending" | "verifying" | "active" | "error";

export interface VercelDomainStatus {
  verified: boolean;
  sslStatus: SslStatus;
  verification: VercelDnsRecord[];
}

export interface VercelDomainsClient {
  addDomain(hostname: string): Promise<VercelAddResult>;
  getDomainStatus(hostname: string): Promise<VercelDomainStatus>;
}

/** Real client. Not exercised in the sandbox (no token); shape matches the API. */
export function createVercelClient(
  env: Record<string, string | undefined> = process.env
): VercelDomainsClient {
  const token = env.VERCEL_TOKEN ?? "";
  const projectId = env.VERCEL_PROJECT_ID ?? "";
  const teamQuery = env.VERCEL_TEAM_ID ? `?teamId=${env.VERCEL_TEAM_ID}` : "";
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  return {
    async addDomain(hostname) {
      const res = await fetch(
        `https://api.vercel.com/v10/projects/${projectId}/domains${teamQuery}`,
        { method: "POST", headers, body: JSON.stringify({ name: hostname }) }
      ).then((r) => r.json());
      return {
        id: res.id ?? res.name ?? hostname,
        verified: Boolean(res.verified),
        verification: (res.verification ?? []) as VercelDnsRecord[],
      };
    },
    async getDomainStatus(hostname) {
      const res = await fetch(
        `https://api.vercel.com/v9/projects/${projectId}/domains/${hostname}${teamQuery}`,
        { headers }
      ).then((r) => r.json());
      const verified = Boolean(res.verified);
      return {
        verified,
        sslStatus: verified ? "active" : "verifying",
        verification: (res.verification ?? []) as VercelDnsRecord[],
      };
    },
  };
}
