import type { JSX } from "react";
import type {
  Block,
  BlockType,
  ContactBlock,
  GalleryBlock,
  HeroBlock,
  HoursBlock,
  MapBlock,
  ServicesBlock,
} from "./types";

/**
 * Declarative block registry + renderer. Each block type maps to a label (for
 * the editor) and a pure render function (for the tenant site). All styling is
 * via brand tokens (bg-brand-*, text-ink, …) so a theme change re-skins every
 * block without touching this file (build-prompt §5.4).
 */

function Section({
  heading,
  children,
}: {
  heading?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-10">
      {heading ? (
        <h2 className="font-heading text-2xl font-semibold text-ink">{heading}</h2>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Hero({ block }: { block: HeroBlock }) {
  return (
    <header className="bg-brand-600 px-6 py-16 text-center text-brand-foreground">
      <h1 className="font-heading text-4xl font-bold">{block.heading}</h1>
      {block.subheading ? (
        <p className="mx-auto mt-3 max-w-xl text-brand-foreground/90">
          {block.subheading}
        </p>
      ) : null}
      {block.cta ? (
        <a
          href={block.cta.href}
          className="mt-6 inline-block rounded-md bg-brand-foreground px-5 py-2.5 font-medium text-brand-700"
        >
          {block.cta.label}
        </a>
      ) : null}
    </header>
  );
}

function Services({ block }: { block: ServicesBlock }) {
  return (
    <Section heading={block.heading ?? "Services"}>
      <ul className="grid gap-4 sm:grid-cols-2">
        {block.items.map((it, i) => (
          <li key={i} className="rounded-lg border border-brand-100 p-4">
            <p className="font-medium text-ink">{it.name}</p>
            {it.description ? (
              <p className="mt-1 text-sm text-ink/70">{it.description}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Hours({ block }: { block: HoursBlock }) {
  return (
    <Section heading={block.heading ?? "Hours"}>
      <table className="w-full text-left text-sm">
        <tbody>
          {block.rows.map((r, i) => (
            <tr key={i} className="border-b border-brand-50">
              <th scope="row" className="py-2 font-medium text-ink">
                {r.day}
              </th>
              <td className="py-2 text-ink/70">{r.hours}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {block.note ? <p className="mt-3 text-sm text-ink/60">{block.note}</p> : null}
    </Section>
  );
}

function Gallery({ block }: { block: GalleryBlock }) {
  return (
    <Section heading={block.heading ?? "Gallery"}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {block.images.map((img, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={img.src}
            alt={img.alt ?? ""}
            className="h-32 w-full rounded-md object-cover"
          />
        ))}
      </div>
    </Section>
  );
}

function Contact({ block }: { block: ContactBlock }) {
  return (
    <Section heading={block.heading ?? "Contact"}>
      <ul className="space-y-1 text-ink/80">
        {block.phone ? <li>Phone: {block.phone}</li> : null}
        {block.email ? <li>Email: {block.email}</li> : null}
        {block.address ? <li>Address: {block.address}</li> : null}
      </ul>
    </Section>
  );
}

function MapBlockView({ block }: { block: MapBlock }) {
  return (
    <Section heading={block.heading ?? "Find us"}>
      <p className="text-ink/70">{block.query}</p>
    </Section>
  );
}

/** Human labels for the editor's "add block" menu. */
export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "Hero",
  services: "Services",
  hours: "Hours",
  gallery: "Gallery",
  contact: "Contact",
  map: "Map",
};

export function renderBlock(block: Block): JSX.Element {
  switch (block.type) {
    case "hero":
      return <Hero key={block.id} block={block} />;
    case "services":
      return <Services key={block.id} block={block} />;
    case "hours":
      return <Hours key={block.id} block={block} />;
    case "gallery":
      return <Gallery key={block.id} block={block} />;
    case "contact":
      return <Contact key={block.id} block={block} />;
    case "map":
      return <MapBlockView key={block.id} block={block} />;
  }
}

export function renderBlocks(blocks: Block[]): JSX.Element {
  return (
    <>
      {blocks.map((b) => renderBlock(b))}
    </>
  );
}
