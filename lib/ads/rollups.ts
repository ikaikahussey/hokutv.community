/**
 * Roll raw ad_events up to hourly buckets (build-prompt §8 — dashboards read
 * rollups, never raw). Pure so "rollups match raw events" is unit-testable.
 */
export interface AdEvent {
  campaign_id: string;
  host_tenant_id: string | null;
  type: "impression" | "click";
  created_at: string; // ISO
}

export interface Rollup {
  campaign_id: string;
  host_tenant_id: string | null;
  hour: string; // ISO truncated to the hour (UTC)
  impressions: number;
  clicks: number;
}

export function hourBucket(iso: string): string {
  const d = new Date(iso);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

export function rollupEvents(events: AdEvent[]): Rollup[] {
  const map = new Map<string, Rollup>();
  for (const e of events) {
    const hour = hourBucket(e.created_at);
    const key = `${e.campaign_id}|${e.host_tenant_id}|${hour}`;
    const r =
      map.get(key) ??
      {
        campaign_id: e.campaign_id,
        host_tenant_id: e.host_tenant_id,
        hour,
        impressions: 0,
        clicks: 0,
      };
    if (e.type === "impression") r.impressions += 1;
    else r.clicks += 1;
    map.set(key, r);
  }
  return [...map.values()];
}
