/**
 * Ad-serving host root (ads.hoku.com). Isolated, unauthenticated zone. The real
 * serving + click-tracking endpoints arrive in Phase 8; this confirms routing.
 */
export default function AdsHomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center text-ink/70">
      <p>HOKU ad serving. Nothing to see here directly.</p>
    </main>
  );
}
