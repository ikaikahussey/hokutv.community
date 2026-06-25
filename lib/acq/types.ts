export interface MailAddress {
  line1: string;
  city: string;
  state: string;
  zip: string;
}

export interface Business {
  placeId: string;
  name: string;
  category: string;
  phone?: string;
  website?: string;
  address: MailAddress;
  photoRef?: string;
  primaryColor?: string;
}

export interface FromAddress {
  name: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
}

export interface AcqConfig {
  provisionalHost: string;
  claimBaseUrl: string;
  fromAddress: FromAddress;
  maxPerBatch: number;
}

/** Discovery via the licensed Places API (no Maps scraping). */
export interface PlacesClient {
  search(query: string, location: string): Promise<Business[]>;
}

export interface PostcardInput {
  to: MailAddress & { name: string };
  from: FromAddress;
  frontHtml: string;
  backHtml: string;
}

export interface MailClient {
  sendPostcard(input: PostcardInput): Promise<{ id: string }>;
}

export type ScreenshotFn = (previewUrl: string, tenantId: string) => Promise<string>;

export interface ProvisionalSite {
  tenantId: string;
  subdomain: string;
  previewUrl: string;
  claimToken: string;
}

/** Persistence boundary — implemented over Supabase (service role) in prod. */
export interface AcqRepo {
  isSuppressed(business: Business): Promise<boolean>;
  isSeen(placeId: string): Promise<boolean>;
  /** Create a PRIVATE provisional tenant (noindex, unlisted, unpublished). */
  createProvisionalSite(business: Business): Promise<ProvisionalSite>;
  recordProspect(input: {
    placeId: string;
    tenantId: string;
    businessName: string;
    mailAddress: MailAddress;
    claimToken: string;
  }): Promise<void>;
  markPostcardSent(claimToken: string, postcardId: string): Promise<void>;
}

export interface BatchResult {
  name: string;
  status?: "sent";
  tenantId?: string;
  postcardId?: string;
  skipped?: "suppressed_or_seen" | "no_mailable_address";
  error?: string;
}
