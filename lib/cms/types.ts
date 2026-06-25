/**
 * CMS content model (build-prompt §5.4 "content is data, not code").
 *
 * A page is a list of typed blocks stored as `body_json`. Blocks are a
 * discriminated union so the registry, renderer, and editor stay declarative
 * and type-safe. Templates render against brand tokens — never hardcoded colors.
 */

export type BlockType =
  | "hero"
  | "services"
  | "hours"
  | "gallery"
  | "contact"
  | "map";

interface BaseBlock {
  id: string;
}

export interface HeroBlock extends BaseBlock {
  type: "hero";
  heading: string;
  subheading?: string;
  cta?: { label: string; href: string };
}

export interface ServicesBlock extends BaseBlock {
  type: "services";
  heading?: string;
  items: { name: string; description?: string }[];
}

export interface HoursBlock extends BaseBlock {
  type: "hours";
  heading?: string;
  rows: { day: string; hours: string }[];
  note?: string;
}

export interface GalleryBlock extends BaseBlock {
  type: "gallery";
  heading?: string;
  images: { src: string; alt?: string }[];
}

export interface ContactBlock extends BaseBlock {
  type: "contact";
  heading?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface MapBlock extends BaseBlock {
  type: "map";
  heading?: string;
  query: string;
}

export type Block =
  | HeroBlock
  | ServicesBlock
  | HoursBlock
  | GalleryBlock
  | ContactBlock
  | MapBlock;

export interface PageDoc {
  blocks: Block[];
}

export type PageStatus = "draft" | "provisional" | "published";

export interface Page {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  status: PageStatus;
  body_json: PageDoc;
  updated_at?: string;
}
