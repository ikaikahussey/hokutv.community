import { createSupabasePublicClient, isSupabaseConfigured } from "@/lib/supabase/public";

/**
 * Public directory (Phase 6). Lists tenants that are BOTH published and listed,
 * grouped by category, with search + pagination. Pure filter/group/paginate
 * helpers are unit-tested; the DB visibility (only published+listed) is enforced
 * by RLS and tested in rls-directory.
 */
export interface DirectoryItem {
  subdomain: string;
  category: string;
  is_published: boolean;
  is_listed: boolean;
}

export interface DirectoryQuery {
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface DirectoryResult {
  groups: { category: string; items: DirectoryItem[] }[];
  total: number;
  page: number;
  pageSize: number;
  categories: string[];
}

/** Pure: keep only listed+published, apply category/search, sort. */
export function filterDirectory(
  items: DirectoryItem[],
  { category, search }: Pick<DirectoryQuery, "category" | "search"> = {}
): DirectoryItem[] {
  const q = search?.trim().toLowerCase();
  return items
    .filter((t) => t.is_published && t.is_listed)
    .filter((t) => (category ? t.category === category : true))
    .filter((t) =>
      q ? t.subdomain.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) : true
    )
    .sort((a, b) => a.subdomain.localeCompare(b.subdomain));
}

export function groupByCategory(
  items: DirectoryItem[]
): { category: string; items: DirectoryItem[] }[] {
  const map = new Map<string, DirectoryItem[]>();
  for (const it of items) {
    const list = map.get(it.category) ?? [];
    list.push(it);
    map.set(it.category, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, list]) => ({ category, items: list }));
}

export function buildDirectory(
  all: DirectoryItem[],
  query: DirectoryQuery
): DirectoryResult {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.max(1, query.pageSize ?? 24);
  const filtered = filterDirectory(all, query);
  const start = (page - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);
  const categories = [
    ...new Set(
      all.filter((t) => t.is_published && t.is_listed).map((t) => t.category)
    ),
  ].sort();
  return {
    groups: groupByCategory(pageItems),
    total: filtered.length,
    page,
    pageSize,
    categories,
  };
}

const DEMO: DirectoryItem[] = [
  { subdomain: "kalihi-coffee", category: "coffee", is_published: true, is_listed: true },
  { subdomain: "north-shore-surf", category: "surf", is_published: true, is_listed: true },
  { subdomain: "manoa-plumbing", category: "plumbing", is_published: true, is_listed: true },
  { subdomain: "diamond-head-yoga", category: "fitness", is_published: true, is_listed: true },
  { subdomain: "hidden-cafe", category: "coffee", is_published: true, is_listed: false }, // unlisted
  { subdomain: "draft-only", category: "coffee", is_published: false, is_listed: true }, // unpublished
];

export async function listDirectory(query: DirectoryQuery): Promise<DirectoryResult> {
  if (!isSupabaseConfigured()) {
    return buildDirectory(DEMO, query);
  }
  const supabase = createSupabasePublicClient();
  const { data } = await supabase
    .from("tenants")
    .select("subdomain, category, is_published, is_listed")
    .eq("is_published", true)
    .eq("is_listed", true);
  const items = (data ?? []) as DirectoryItem[];
  return buildDirectory(items, query);
}
