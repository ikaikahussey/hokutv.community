import type {
  AcqConfig,
  AcqRepo,
  BatchResult,
  Business,
  MailClient,
  PlacesClient,
  ScreenshotFn,
} from "./types";
import { buildBackHtml, buildFrontHtml } from "./postcard";

/**
 * Acquisition pipeline: discover (licensed Places) → generate a PRIVATE
 * provisional site → screenshot → mail a compliant claim-invite postcard.
 *
 * All external services are injected so the pipeline is unit-tested with mocks
 * (Phase A gate). Guardrails enforced here are minimal and counsel-review-
 * pending — see COUNSEL.md.
 */
export interface AcqDeps {
  places: PlacesClient;
  mail: MailClient;
  screenshot: ScreenshotFn;
  repo: AcqRepo;
  config: AcqConfig;
}

/** A business is mailable only with a complete street address. */
export function hasMailableAddress(b: Business): boolean {
  const a = b.address;
  return Boolean(a && a.line1 && a.city && a.state && a.zip);
}

function qrUrl(claimUrl: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    claimUrl
  )}`;
}

async function processOne(deps: AcqDeps, b: Business): Promise<BatchResult> {
  // Guardrail: licensed data only — skip a business with no mailable address.
  if (!hasMailableAddress(b)) {
    return { name: b.name, skipped: "no_mailable_address" };
  }

  // Guardrail: suppression + dedupe BEFORE any site generation or send.
  if ((await deps.repo.isSuppressed(b)) || (await deps.repo.isSeen(b.placeId))) {
    return { name: b.name, skipped: "suppressed_or_seen" };
  }

  // Generate a PRIVATE provisional site (noindex, unlisted, unpublished).
  const site = await deps.repo.createProvisionalSite(b);
  await deps.repo.recordProspect({
    placeId: b.placeId,
    tenantId: site.tenantId,
    businessName: b.name,
    mailAddress: b.address,
    claimToken: site.claimToken,
  });

  const screenshotUrl = await deps.screenshot(site.previewUrl, site.tenantId);

  const claimUrl = `${deps.config.claimBaseUrl}/${site.claimToken}`;
  const { id: postcardId } = await deps.mail.sendPostcard({
    to: { name: b.name, ...b.address },
    from: deps.config.fromAddress,
    frontHtml: buildFrontHtml(b.name, screenshotUrl),
    backHtml: buildBackHtml(b.name, claimUrl, qrUrl(claimUrl), deps.config.fromAddress),
  });
  await deps.repo.markPostcardSent(site.claimToken, postcardId);

  return { name: b.name, tenantId: site.tenantId, postcardId, status: "sent" };
}

export async function runBatch(
  deps: AcqDeps,
  query: string,
  location: string
): Promise<BatchResult[]> {
  const found = await deps.places.search(query, location);
  const results: BatchResult[] = [];
  for (const b of found.slice(0, deps.config.maxPerBatch)) {
    try {
      results.push(await processOne(deps, b));
    } catch (e) {
      results.push({ name: b.name, error: e instanceof Error ? e.message : "error" });
    }
  }
  return results;
}
