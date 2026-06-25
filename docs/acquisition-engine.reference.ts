/**
 * HOKU Acquisition Engine
 * -----------------------
 * Pipeline: discover local businesses (Google Places API) -> generate a PRIVATE
 * provisional HOKU subsite -> screenshot it -> mail a compliant solicitation
 * postcard inviting the owner to claim and control the site.
 *
 * GUARDRAILS ENFORCED IN CODE (see HOKU-acquisition-module.md for rationale):
 *  - Licensed Places API only. No Maps UI scraping.
 *  - Provisional sites are noindex, unlisted, on a provisional preview host,
 *    and never published until claimed.
 *  - Suppression list honored before any contact.
 *  - Postcard is a marketing offer, not a bill (template carries disclaimers).
 *  - Claim requires code possession + ownership verification (handled in the
 *    claim UI, not here).
 *
 * This is an implementation skeleton for the HOKU stack (Supabase + Stripe +
 * Vercel). External calls are real library shapes; wire keys via env. Not legal
 * advice — confirm mailing/trademark posture with counsel.
 */

import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CFG = {
  placesKey: process.env.GOOGLE_PLACES_API_KEY!,
  lobKey: process.env.LOB_API_KEY!,
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  tenantBaseDomain: process.env.TENANT_BASE_DOMAIN ?? "hokusites.com",
  // Provisional, clearly-unofficial host. NOT the live tenant subdomain.
  provisionalHost: process.env.PROVISIONAL_HOST ?? "preview.hoku.com",
  claimBaseUrl: process.env.CLAIM_BASE_URL ?? "https://hoku.com/claim",
  fromAddress: {
    name: "HOKU Local Sites",
    line1: process.env.HOKU_RETURN_LINE1!, // physical address required on mail
    city: process.env.HOKU_RETURN_CITY!,
    state: process.env.HOKU_RETURN_STATE!,
    zip: process.env.HOKU_RETURN_ZIP!,
  },
  maxPerBatch: Number(process.env.MAX_PER_BATCH ?? 50),
  perCallDelayMs: 250, // polite rate limiting
};

const db = createClient(CFG.supabaseUrl, CFG.supabaseServiceKey);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Business {
  placeId: string;
  name: string;
  category: string;
  phone?: string;
  email?: string; // Places rarely returns email; may be enriched separately
  website?: string;
  address: { line1: string; city: string; state: string; zip: string };
  photoRef?: string;
  primaryColor?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Stage 1 — Discover (licensed Places API; Text Search)
// ---------------------------------------------------------------------------
async function discover(query: string, location: string): Promise<Business[]> {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/textsearch/json"
  );
  url.searchParams.set("query", `${query} in ${location}`);
  url.searchParams.set("key", CFG.placesKey);

  const res = await fetch(url).then((r) => r.json());
  const out: Business[] = [];

  for (const p of (res.results ?? []).slice(0, CFG.maxPerBatch)) {
    await sleep(CFG.perCallDelayMs);
    const details = await placeDetails(p.place_id);
    if (!details) continue;
    out.push(details);
  }
  return out;
}

async function placeDetails(placeId: string): Promise<Business | null> {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/details/json"
  );
  url.searchParams.set("place_id", placeId);
  url.searchParams.set(
    "fields",
    "name,types,formatted_phone_number,website,address_components,photos"
  );
  url.searchParams.set("key", CFG.placesKey);

  const r = await fetch(url).then((x) => x.json());
  const d = r.result;
  if (!d) return null;

  const addr = parseAddress(d.address_components ?? []);
  if (!addr) return null; // no mailable address -> skip

  return {
    placeId,
    name: d.name,
    category: (d.types?.[0] ?? "business").replace(/_/g, " "),
    phone: d.formatted_phone_number,
    website: d.website,
    address: addr,
    photoRef: d.photos?.[0]?.photo_reference,
  };
}

function parseAddress(components: any[]): Business["address"] | null {
  const get = (t: string) =>
    components.find((c) => c.types.includes(t))?.long_name;
  const line1 = [get("street_number"), get("route")].filter(Boolean).join(" ");
  const city = get("locality") ?? get("sublocality");
  const state = get("administrative_area_level_1");
  const zip = get("postal_code");
  if (!line1 || !city || !state || !zip) return null;
  return { line1, city, state, zip };
}

// ---------------------------------------------------------------------------
// Guardrail — suppression + dedupe
// ---------------------------------------------------------------------------
async function isSuppressedOrSeen(b: Business): Promise<boolean> {
  const { data: sup } = await db
    .from("acq_suppression")
    .select("id")
    .or(`place_id.eq.${b.placeId},zip.eq.${b.address.zip}`)
    .limit(1);
  if (sup && sup.length) return true;

  const { data: seen } = await db
    .from("acq_prospects")
    .select("id")
    .eq("place_id", b.placeId)
    .limit(1);
  return !!(seen && seen.length);
}

// ---------------------------------------------------------------------------
// Stage 2 — Generate PRIVATE provisional site
// ---------------------------------------------------------------------------
async function generateProvisionalSite(b: Business) {
  const claimToken = crypto.randomBytes(16).toString("hex");
  const subdomain = slugify(b.name);

  // Brand tokens derived from Places photo / name. Same token shape the theming
  // and ad modules consume, so a claimed tenant flows straight into ad-buying.
  const theme = {
    logoText: b.name,
    primary: b.primaryColor ?? deriveColorFromName(b.name),
    font: "default-pairing",
    layout: "starter",
  };

  // status='provisional' => noindex, NOT listed in directory, NOT public.
  const { data: tenant, error } = await db
    .from("tenants")
    .insert({
      subdomain,
      category: b.category,
      theme,
      status: "provisional",
      is_published: false,
      is_listed: false,
    })
    .select()
    .single();
  if (error) throw error;

  await db.from("acq_prospects").insert({
    place_id: b.placeId,
    tenant_id: tenant.id,
    business_name: b.name,
    mail_address: b.address,
    claim_token: claimToken,
    status: "site_generated",
  });

  // Seed a minimal page from verified Places fields only (no AI-invented facts).
  await db.from("pages").insert({
    tenant_id: tenant.id,
    slug: "home",
    title: b.name,
    status: "provisional",
    body_json: starterBlocks(b),
  });

  const previewUrl = `https://${CFG.provisionalHost}/p/${tenant.id}`;
  return { tenantId: tenant.id, claimToken, previewUrl, subdomain };
}

function starterBlocks(b: Business) {
  return {
    blocks: [
      { type: "hero", name: b.name, category: b.category },
      { type: "contact", phone: b.phone ?? null, address: b.address },
      { type: "hours", note: "Add your hours when you claim this site" },
      { type: "preview_banner", text: "Unofficial preview — claim to take control" },
    ],
  };
}

// ---------------------------------------------------------------------------
// Stage 3 — Screenshot (Playwright)
// ---------------------------------------------------------------------------
async function screenshot(previewUrl: string, tenantId: string): Promise<string> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto(previewUrl, { waitUntil: "networkidle" });
  const buf = await page.screenshot({ type: "png" });
  await browser.close();

  const key = `acq-screenshots/${tenantId}.png`;
  await db.storage.from("media").upload(key, buf, { contentType: "image/png", upsert: true });
  const { data } = db.storage.from("media").getPublicUrl(key);
  return data.publicUrl;
}

// ---------------------------------------------------------------------------
// Stage 4 — Compliant postcard (Lob). Marketing offer, NOT a bill.
// ---------------------------------------------------------------------------
async function sendPostcard(b: Business, claimToken: string, screenshotUrl: string) {
  const claimUrl = `${CFG.claimBaseUrl}/${claimToken}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(claimUrl)}`;

  // Required compliance copy: identifies sender, states it is not a bill,
  // gives an opt-out. No "amount due", no implication of an existing account.
  const front = buildFrontHtml(b.name, screenshotUrl);
  const back = buildBackHtml(b.name, claimUrl, qr);

  const res = await fetch("https://api.lob.com/v1/postcards", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(CFG.lobKey + ":").toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      description: `HOKU claim invite — ${b.name}`,
      to: { name: b.name, address_line1: b.address.line1, address_city: b.address.city, address_state: b.address.state, address_zip: b.address.zip },
      from: { name: CFG.fromAddress.name, address_line1: CFG.fromAddress.line1, address_city: CFG.fromAddress.city, address_state: CFG.fromAddress.state, address_zip: CFG.fromAddress.zip },
      front,
      back,
      size: "6x9",
    }),
  }).then((r) => r.json());

  await db.from("acq_prospects").update({ status: "postcard_sent", postcard_id: res.id }).eq("claim_token", claimToken);
  return res.id;
}

function buildFrontHtml(name: string, img: string) {
  return `<html><body style="margin:0"><img src="${img}" style="width:100%;height:100%;object-fit:cover"/></body></html>`;
}

function buildBackHtml(name: string, claimUrl: string, qr: string) {
  // NOTE: keep this clearly an offer. Disclaimers are mandatory, not optional.
  return `<html><body style="font-family:sans-serif;padding:24px">
    <h2>${name}, we built you a website.</h2>
    <p>Scan to preview and claim it free. You control the content and your brand.</p>
    <img src="${qr}" style="width:120px"/>
    <p style="font-size:11px;color:#555;margin-top:16px">
      This is a marketing offer from ${CFG.fromAddress.name}, ${CFG.fromAddress.line1},
      ${CFG.fromAddress.city}, ${CFG.fromAddress.state} ${CFG.fromAddress.zip}.
      <b>This is not a bill.</b> You have no account and owe nothing.
      To opt out and remove your provisional listing, visit hoku.com/optout or call us.
      ${claimUrl}
    </p></body></html>`;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------
export async function runBatch(query: string, location: string) {
  const found = await discover(query, location);
  const results: any[] = [];

  for (const b of found) {
    try {
      if (await isSuppressedOrSeen(b)) { results.push({ name: b.name, skipped: "suppressed_or_seen" }); continue; }
      const site = await generateProvisionalSite(b);
      const shot = await screenshot(site.previewUrl, site.tenantId);
      const postcardId = await sendPostcard(b, site.claimToken, shot);
      results.push({ name: b.name, tenantId: site.tenantId, postcardId, status: "sent" });
    } catch (e: any) {
      results.push({ name: b.name, error: e.message });
    }
    await sleep(CFG.perCallDelayMs);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
}
function deriveColorFromName(s: string) {
  const h = crypto.createHash("md5").update(s).digest("hex");
  return `#${h.slice(0, 6)}`;
}

// CLI: ts-node acquisition-engine.ts "coffee shops" "Kalihi, Honolulu"
if (require.main === module) {
  const [, , query, location] = process.argv;
  runBatch(query ?? "restaurants", location ?? "Honolulu, HI")
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => { console.error(e); process.exit(1); });
}
