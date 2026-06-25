/**
 * Control plane root (app.hoku.com). Reached only via the host rewrite
 * "/" → "/app". Auth, admin, CMS, and ad-buying live here in later phases.
 */
export default function AppHomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
        app.hoku.com
      </span>
      <h1 className="font-heading text-3xl font-bold text-ink">HOKU Admin</h1>
      <p className="text-ink/70">
        Sign in to manage your site, theme, and ads. (Auth lands in Phase 2.)
      </p>
    </main>
  );
}
