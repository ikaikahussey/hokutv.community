export default function ApexLandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
        HOKU
      </span>
      <h1 className="font-heading text-4xl font-bold tracking-tight text-ink sm:text-5xl">
        Websites for local businesses.
      </h1>
      <p className="max-w-xl text-lg text-ink/70">
        A site on your own subdomain, a no-code editor, your brand, and ads that
        run across the HOKU network — built for owners, not designers.
      </p>
      <div className="flex gap-3">
        <a
          href="https://app.hoku.com"
          className="rounded-md bg-brand-600 px-5 py-2.5 font-medium text-brand-foreground hover:bg-brand-700"
        >
          Get started
        </a>
        <a
          href="/directory"
          className="rounded-md border border-brand-200 px-5 py-2.5 font-medium text-brand-700 hover:bg-brand-50"
        >
          Browse the directory
        </a>
      </div>
    </main>
  );
}
