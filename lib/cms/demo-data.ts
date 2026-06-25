import type { Page } from "./types";
import { slugify } from "@/lib/utils/slug";

/**
 * Local/demo content used when no live Supabase project is configured (the
 * build sandbox, and `npm run dev` before you wire Supabase). It lets the
 * tenant route render real block content end-to-end. With Supabase configured,
 * `getPublishedHomePage` queries the DB instead and this is never used.
 */
function titleCase(s: string): string {
  return s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

export function demoHomePage(subdomain: string): Page {
  const name = titleCase(subdomain) || "Your Business";
  return {
    id: `demo-${subdomain}`,
    tenant_id: `demo-${subdomain}`,
    slug: "home",
    title: name,
    status: "published",
    body_json: {
      blocks: [
        {
          id: "hero",
          type: "hero",
          heading: name,
          subheading: `${slugify(subdomain)}.hokusites.com`,
          cta: { label: "Get in touch", href: "#contact" },
        },
        {
          id: "services",
          type: "services",
          heading: "What we do",
          items: [
            { name: "Service one", description: "A short description." },
            { name: "Service two", description: "Another offering." },
          ],
        },
        {
          id: "hours",
          type: "hours",
          heading: "Hours",
          rows: [
            { day: "Mon–Fri", hours: "9:00–17:00" },
            { day: "Sat", hours: "10:00–14:00" },
            { day: "Sun", hours: "Closed" },
          ],
        },
        {
          id: "contact",
          type: "contact",
          heading: "Contact",
          phone: "(808) 555-0100",
          address: "Honolulu, HI",
        },
      ],
    },
  };
}
