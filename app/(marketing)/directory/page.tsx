import { listDirectory } from "@/lib/directory/queries";

const TENANT_BASE = process.env.TENANT_BASE_DOMAIN ?? "hokusites.com";

function tenantUrl(subdomain: string): string {
  return `https://${subdomain}.${TENANT_BASE}`;
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = sp.page ? Number(sp.page) : 1;
  const result = await listDirectory({
    category: sp.category,
    search: sp.q,
    page,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.category) params.set("category", sp.category);
    params.set("page", String(p));
    return `/directory?${params.toString()}`;
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-12" data-testid="directory">
      <h1 className="font-heading text-3xl font-bold text-ink">
        Local business directory
      </h1>

      <form action="/directory" method="get" className="mt-6 flex gap-2">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search businesses…"
          className="flex-1 rounded-md border border-brand-200 px-3 py-2"
        />
        <button className="rounded-md bg-brand-600 px-4 py-2 font-medium text-brand-foreground">
          Search
        </button>
      </form>

      {result.categories.length ? (
        <nav className="mt-4 flex flex-wrap gap-2 text-sm">
          <a
            href="/directory"
            className="rounded-full border border-brand-200 px-3 py-1 text-brand-700"
          >
            All
          </a>
          {result.categories.map((c) => (
            <a
              key={c}
              href={`/directory?category=${encodeURIComponent(c)}`}
              className="rounded-full border border-brand-200 px-3 py-1 text-brand-700"
            >
              {c}
            </a>
          ))}
        </nav>
      ) : null}

      {result.total === 0 ? (
        <p className="mt-10 text-ink/60">No businesses found.</p>
      ) : (
        result.groups.map((group) => (
          <section key={group.category} className="mt-8">
            <h2 className="font-heading text-xl font-semibold capitalize text-ink">
              {group.category}
            </h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {group.items.map((t) => (
                <li key={t.subdomain}>
                  <a
                    href={tenantUrl(t.subdomain)}
                    className="block rounded-lg border border-brand-100 p-4 hover:bg-brand-50"
                  >
                    <span className="font-medium text-ink">{t.subdomain}</span>
                    <span className="block text-sm text-ink/60">{t.category}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {totalPages > 1 ? (
        <nav className="mt-10 flex justify-between text-sm">
          {page > 1 ? <a href={pageHref(page - 1)}>← Previous</a> : <span />}
          <span className="text-ink/60">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? <a href={pageHref(page + 1)}>Next →</a> : <span />}
        </nav>
      ) : null}
    </main>
  );
}
