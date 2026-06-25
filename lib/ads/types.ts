export interface Geo {
  lat: number;
  lng: number;
  radiusKm: number;
}

export interface Targeting {
  category?: string;
  geo?: Geo;
}

export interface ServeContext {
  slot: string;
  category?: string;
  lat?: number;
  lng?: number;
  hostTenantId?: string;
}

export type CampaignStatus =
  | "pending"
  | "approved"
  | "active"
  | "paused"
  | "completed"
  | "rejected";

export interface Campaign {
  id: string;
  tenant_id: string;
  creative_id: string;
  status: CampaignStatus;
  budget_cents: number;
  spend_cents: number;
  targeting: Targeting;
  cpm_cents?: number;
}

export interface Creative {
  id: string;
  tenant_id: string;
  headline: string;
  subtext?: string;
  cta_label: string;
  destination_url: string;
  layout_variant: string;
  brand_snapshot: Record<string, string>;
  status: "draft" | "pending" | "approved" | "rejected";
}
