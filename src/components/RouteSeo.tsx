import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { canonicalFor, pageMetaFor } from "@/seo/site";

function setMeta(selector: string, attr: string, key: string, value: string | null) {
  let el = document.head.querySelector<HTMLMetaElement | HTMLLinkElement>(selector);
  if (value === null) { el?.remove(); return; }
  if (!el) {
    el = document.createElement(selector.startsWith("link") ? "link" : "meta") as HTMLMetaElement | HTMLLinkElement;
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute(selector.startsWith("link") ? "href" : "content", value);
}

/**
 * Keeps <title>, description, robots and canonical in step with the page
 * when moving around inside the app (the first load already has them from
 * the static HTML — see vite.config.ts). Pages not listed in src/seo/site.ts
 * (dashboard, admin, unknown URLs) are marked noindex.
 */
export function RouteSeo() {
  const { pathname } = useLocation();
  useEffect(() => {
    const meta = pageMetaFor(pathname);
    document.title = meta.title;
    setMeta('meta[name="description"]', "name", "description", meta.description);
    setMeta('meta[name="robots"]', "name", "robots", meta.index ? "index, follow, max-image-preview:large" : "noindex, follow");
    setMeta('link[rel="canonical"]', "rel", "canonical", meta.index ? canonicalFor(pathname) : null);
  }, [pathname]);
  return null;
}
