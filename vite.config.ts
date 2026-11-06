import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { renderHead } from "./src/seo/head";
import { PAGES } from "./src/seo/site";

// SEO: every public page gets its own static HTML with the right title,
// description, canonical and structured data (from src/seo/site.ts), so
// search engines see them without running JavaScript.
//   dist/index.html            → "/" (homepage)
//   dist/<page>/index.html     → each other page in PAGES (e.g. /terms)
//   dist/app.html              → everything else (dashboard, admin, unknown
//                                URLs): same app, marked noindex. vercel.json
//                                sends unmatched URLs here.
const SEO_BLOCK = /<!--seo-start-->[\s\S]*?<!--seo-end-->/;
function seoPages(): Plugin {
  let outDir = "dist";
  return {
    name: "envo-seo-pages",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    transformIndexHtml(html) {
      return html.replace("<!--seo-head-->", `<!--seo-start-->\n    ${renderHead("/")}\n    <!--seo-end-->`);
    },
    closeBundle() {
      const indexFile = path.join(outDir, "index.html");
      if (!fs.existsSync(indexFile)) return;
      const html = fs.readFileSync(indexFile, "utf8");
      const withHead = (route: string | null) => html.replace(SEO_BLOCK, `<!--seo-start-->\n    ${renderHead(route)}\n    <!--seo-end-->`);
      for (const route of Object.keys(PAGES)) {
        if (route === "/") continue;
        const dir = path.join(outDir, route.replace(/^\//, ""));
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "index.html"), withHead(route));
      }
      fs.writeFileSync(path.join(outDir, "app.html"), withHead(null));
    },
  };
}

// https://vitejs.dev/config/
import { loadEnv } from "vite";

// A production build must never carry a local API URL (that is how the live
// site once ended up calling a laptop). Checked against every env source Vite
// would read for this mode, and fails the build instead of shipping it.
export default defineConfig(({ mode }) => {
  if (mode === "production") {
    const api = loadEnv(mode, process.cwd(), "VITE_").VITE_API_URL || process.env.VITE_API_URL || "";
    if (/localhost|127\.0\.0\.1/.test(api)) throw new Error(`Refusing production build: VITE_API_URL=${api}`);
  }
  return ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), seoPages(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
});
