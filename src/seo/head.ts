// Builds the SEO part of a page's <head> as an HTML string. Used at build
// time by vite.config.ts so search engines get the right title, description,
// canonical and structured data in the HTML itself, before any JavaScript.
// Keep free of browser-only imports.
import { BUSINESS, HERO_IMAGE, canonicalFor, faqJsonLd, localBusinessJsonLd, pageMetaFor, websiteJsonLd, PRIVATE_PAGE, type PageMeta } from "./site";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// JSON inside <script> only needs "</" broken up.
const jsonLd = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data).replace(/<\//g, "<\\/")}</script>`;

export function renderHead(path: string | null): string {
  // path null = the shell served for private / unknown URLs (never indexed).
  const meta: PageMeta = path === null ? PRIVATE_PAGE : pageMetaFor(path);
  const canonical = path === null ? null : canonicalFor(path);
  const isHome = path === "/";
  const lines = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<meta name="robots" content="${meta.index ? "index, follow, max-image-preview:large" : "noindex, follow"}" />`,
  ];
  if (canonical && meta.index) lines.push(`<link rel="canonical" href="${canonical}" />`);
  if (meta.index) {
    lines.push(
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="${esc(BUSINESS.name)}" />`,
      `<meta property="og:locale" content="en_SG" />`,
      `<meta property="og:url" content="${canonical}" />`,
      `<meta property="og:title" content="${esc(meta.title)}" />`,
      `<meta property="og:description" content="${esc(meta.description)}" />`,
      `<meta property="og:image" content="${BUSINESS.image}" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${esc(meta.title)}" />`,
      `<meta name="twitter:description" content="${esc(meta.description)}" />`,
      `<meta name="twitter:image" content="${BUSINESS.image}" />`,
    );
  }
  if (isHome) {
    // Start downloading the hero photo straight away rather than after the
    // JavaScript runs — it's the largest thing on the homepage.
    lines.push(`<link rel="preload" as="image" href="${HERO_IMAGE.src}" imagesrcset="${HERO_IMAGE.srcSet}" imagesizes="${HERO_IMAGE.sizes}" fetchpriority="high" />`);
    // Structured data belongs on the page that shows it: the homepage has
    // the address, hours and FAQ.
    lines.push(jsonLd(localBusinessJsonLd()), jsonLd(websiteJsonLd()), jsonLd(faqJsonLd()));
  }
  return lines.join("\n    ");
}
