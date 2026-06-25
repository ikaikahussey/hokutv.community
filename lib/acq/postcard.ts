import type { FromAddress } from "./types";

/**
 * Postcard templates. The back MUST read as a marketing offer, not a bill:
 * sender identity + physical address, an explicit "this is not a bill" line, and
 * an opt-out path (acquisition-module.md §5.2). These are minimal, counsel-
 * review-pending guardrails (COUNSEL.md), surfaced as helpers so they're tested.
 */
export function buildFrontHtml(name: string, screenshotUrl: string): string {
  return `<html><body style="margin:0"><img alt="${name} website preview" src="${screenshotUrl}" style="width:100%;height:100%;object-fit:cover"/></body></html>`;
}

export function buildBackHtml(
  name: string,
  claimUrl: string,
  qrUrl: string,
  from: FromAddress
): string {
  return `<html><body style="font-family:sans-serif;padding:24px">
    <h2>${name}, we built you a website.</h2>
    <p>Scan to preview and claim it free. You control the content and your brand.</p>
    <img alt="QR code to claim your site" src="${qrUrl}" style="width:120px"/>
    <p style="font-size:11px;color:#555;margin-top:16px">
      This is a marketing offer from ${from.name}, ${from.line1}, ${from.city},
      ${from.state} ${from.zip}.
      <b>This is not a bill.</b> You have no account with us and owe nothing.
      To opt out and remove your provisional listing, visit hoku.com/optout or
      call us. Claim: ${claimUrl}
    </p></body></html>`;
}

const PROHIBITED_BILLING = [
  /amount due/i,
  /balance due/i,
  /\binvoice\b/i,
  /payment due/i,
  /past due/i,
  /total due/i,
];

const REQUIRED = [/this is not a bill/i, /opt out/i, /owe nothing|no account/i];

/** Returns the list of compliance problems with a rendered postcard back. */
export function postcardComplianceIssues(backHtml: string): string[] {
  const issues: string[] = [];
  for (const re of REQUIRED) {
    if (!re.test(backHtml)) issues.push(`missing required disclosure: ${re}`);
  }
  for (const re of PROHIBITED_BILLING) {
    if (re.test(backHtml)) issues.push(`prohibited bill-like language: ${re}`);
  }
  return issues;
}
