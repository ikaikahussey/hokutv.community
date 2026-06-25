/**
 * Slugify a business / tenant name into a DNS-safe subdomain label.
 * Shared by the CMS, directory, and the acquisition engine so a provisional
 * tenant and a claimed tenant resolve to the same subdomain shape.
 */
export function slugify(input: string, maxLength = 40): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, maxLength)
    .replace(/-$/, "");
}
