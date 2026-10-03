// Single source of truth for Envo Pool's public business details and SEO
// metadata. Used by the homepage (visible hours, address, FAQ), by the
// runtime <RouteSeo> tag updater, and by the build (vite.config.ts) to write
// each page's <head> — title, description, canonical, structured data — into
// the static HTML that search engines download. Change details here only.
//
// Keep this file free of browser-only imports: vite.config.ts imports it.

export const SITE_URL = "https://envopoolsg.com";

export const BUSINESS = {
  name: "Envo Pool",
  streetAddress: "511 Guillemard Road, #B1-02A",
  building: "Grandlink Square",
  postalCode: "399849",
  locality: "Singapore",
  country: "SG",
  phone: "+65 8900 7983",
  phoneHref: "tel:+6589007983",
  latitude: 1.3162054986939,
  longitude: 103.89068747460635,
  mrt: "Paya Lebar MRT (EW8/CC9)",
  mapsUrl: "https://maps.google.com/?q=Envo+Pool+511+Guillemard+Road+Singapore+399849",
  image: `${SITE_URL}/og-image.jpg`,
  logo: `${SITE_URL}/icons/icon-512x512.png`,
};

export const OPENING_HOURS = [
  { label: "Monday – Thursday", days: ["Monday", "Tuesday", "Wednesday", "Thursday"], opens: "10:00", closes: "01:00", display: "10:00 AM – 1:00 AM" },
  { label: "Friday – Sunday", days: ["Friday", "Saturday", "Sunday"], opens: "10:00", closes: "02:00", display: "10:00 AM – 2:00 AM" },
] as const;

export const HOURS_SHORT = "Mon–Thu 10am–1am, Fri–Sun 10am–2am";

// Homepage hero photo — fixed paths in public/images so the HTML can tell
// the browser to start downloading it immediately (it's the largest thing
// on screen, so it decides how fast the page feels).
export const HERO_IMAGE = {
  src: "/images/hero-1280.webp",
  srcSet: "/images/hero-768.webp 768w, /images/hero-1280.webp 1280w, /images/hero-1920.webp 1920w",
  sizes: "100vw",
};

// Shown on the homepage and published as FAQPage structured data — the two
// must match word for word, which is why both read from here.
export const FAQ: { q: string; a: string }[] = [
  {
    q: "Where is Envo Pool located?",
    a: "Envo Pool is at 511 Guillemard Road, #B1-02A, Grandlink Square, Singapore 399849 — on the basement level, about a 4-minute walk from Paya Lebar MRT (EW8/CC9). Look for the lit ENVO POOL sign.",
  },
  {
    q: "What are your opening hours?",
    a: "We're open Monday to Thursday from 10am to 1am, and Friday to Sunday from 10am to 2am. Private members have 24/7 access.",
  },
  {
    q: "How much does it cost to play pool?",
    a: "Table rates start from $13.50 per hour per table before 5pm, and $16.80 per hour per table from 5pm. Members get discounts and free play time, and every dollar spent earns reward points.",
  },
  {
    q: "Do you have American pool tables?",
    a: "Yes. We have 10 American pool tables from Aileex and Xing Pai — the brands used at professional tournaments — with Dynasphere Palladium tournament balls, suitable for 8-ball, 9-ball and 10-ball.",
  },
  {
    q: "Do you have Chinese pool tables?",
    a: "Yes. We have 4 Chinese pool tables for Chinese 8-ball, so you can play both American pool and Chinese pool under one roof.",
  },
  {
    q: "How do I book a pool table?",
    a: "Book online at envopoolsg.com: create an account, verify with Singpass, top up your wallet by PayNow and choose your table and time. Walk-ins are welcome too, subject to table availability.",
  },
  {
    q: "Do you host pool tournaments?",
    a: "Yes. We run in-house tournaments and host pool events throughout the year for players of all levels. Upcoming tournaments are announced in the Envo Pool app and at the counter.",
  },
];

export interface PageMeta {
  title: string;
  description: string;
  /** false → <meta name="robots" content="noindex"> (e.g. login-only pages) */
  index: boolean;
}

const HOME_DESCRIPTION =
  "Envo Pool is a pool hall in Singapore at Grandlink Square, 4 minutes from Paya Lebar MRT. 10 American and 4 Chinese pool tables. Book online — open daily from 10am.";

// Public pages get their own static HTML at build time (see vite.config.ts).
export const PAGES: Record<string, PageMeta> = {
  "/": { title: "Pool Hall in Singapore | Envo Pool, Paya Lebar", description: HOME_DESCRIPTION, index: true },
  "/terms": { title: "Terms & Conditions | Envo Pool", description: "Terms and conditions for bookings, memberships, wallet top-ups and rewards at Envo Pool, a pool hall in Singapore near Paya Lebar MRT.", index: true },
  "/booking": { title: "Book a Pool Table | Envo Pool", description: "Book a pool table online at Envo Pool, Paya Lebar.", index: false },
  "/auth": { title: "Sign In | Envo Pool", description: "Sign in to your Envo Pool account.", index: false },
};

// Everything else (dashboard, admin, payment pages, unknown URLs) is private
// or not a real page — never indexed.
export const PRIVATE_PAGE: PageMeta = { title: "Envo Pool", description: HOME_DESCRIPTION, index: false };

export function pageMetaFor(pathname: string): PageMeta {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return PAGES[clean] ?? PRIVATE_PAGE;
}

export function canonicalFor(pathname: string): string {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return clean === "/" ? `${SITE_URL}/` : `${SITE_URL}${clean}`;
}

export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "SportsActivityLocation"],
    "@id": `${SITE_URL}/#business`,
    name: BUSINESS.name,
    description: "Pool hall in Singapore at Grandlink Square, Paya Lebar, with 10 American pool tables and 4 Chinese pool tables, online booking and member rewards.",
    url: `${SITE_URL}/`,
    image: BUSINESS.image,
    logo: BUSINESS.logo,
    telephone: BUSINESS.phone,
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: `${BUSINESS.streetAddress}, ${BUSINESS.building}`,
      addressLocality: BUSINESS.locality,
      postalCode: BUSINESS.postalCode,
      addressCountry: BUSINESS.country,
    },
    geo: { "@type": "GeoCoordinates", latitude: BUSINESS.latitude, longitude: BUSINESS.longitude },
    hasMap: BUSINESS.mapsUrl,
    openingHoursSpecification: OPENING_HOURS.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [...h.days],
      opens: h.opens,
      closes: h.closes,
    })),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: BUSINESS.name,
    url: `${SITE_URL}/`,
  };
}

export function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
