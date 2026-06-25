import type { Targeting, ServeContext } from "./types";

/** Great-circle distance in km between two lat/lng points. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Does a campaign's targeting match the serving context? Category must match
 * (an unknown context category fails a category-targeted campaign); geo must be
 * within the radius (an unknown location fails a geo-targeted campaign). An
 * untargeted campaign matches everything.
 */
export function matchesTargeting(t: Targeting, ctx: ServeContext): boolean {
  if (t.category) {
    if (!ctx.category || ctx.category !== t.category) return false;
  }
  if (t.geo) {
    if (ctx.lat == null || ctx.lng == null) return false;
    const dist = haversineKm(
      { lat: t.geo.lat, lng: t.geo.lng },
      { lat: ctx.lat, lng: ctx.lng }
    );
    if (dist > t.geo.radiusKm) return false;
  }
  return true;
}
