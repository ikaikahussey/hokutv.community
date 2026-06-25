/**
 * Host participation (build-prompt §8 — "per-tenant opt-in/out per slot; default
 * opt-in"). A tenant chooses which ad slots may run on their site. Pure logic so
 * the default-opt-in and toggle behavior is unit-testable.
 */
export interface SlotConfig {
  id: string;
  label: string;
}

export interface ParticipationRow {
  slotId: string;
  enabled: boolean;
}

export const AD_SLOTS: SlotConfig[] = [
  { id: "sidebar", label: "Sidebar" },
  { id: "footer", label: "Footer" },
  { id: "inline", label: "In-content" },
];

/**
 * Resolve effective participation for every slot. Missing rows default to
 * enabled (opt-in by default); an explicit row overrides.
 */
export function effectiveParticipation(
  saved: ParticipationRow[],
  slots: SlotConfig[] = AD_SLOTS
): ParticipationRow[] {
  const byId = new Map(saved.map((r) => [r.slotId, r.enabled]));
  return slots.map((s) => ({
    slotId: s.id,
    enabled: byId.has(s.id) ? byId.get(s.id)! : true,
  }));
}

export function toggleSlot(
  rows: ParticipationRow[],
  slotId: string
): ParticipationRow[] {
  return rows.map((r) =>
    r.slotId === slotId ? { ...r, enabled: !r.enabled } : r
  );
}

export function isSlotEnabled(rows: ParticipationRow[], slotId: string): boolean {
  const row = rows.find((r) => r.slotId === slotId);
  return row ? row.enabled : true; // default opt-in
}
