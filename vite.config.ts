import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Content-Security-Policy for the GitHub Pages host, which cannot serve
 * response headers (vercel.json headers never apply there). Delivered as a
 * <meta> tag injected ONLY into production builds — the dev server needs
 * inline scripts for HMR/react-refresh and must stay unrestricted.
 *
 * Notes:
 * - script-src 'self' is the load-bearing directive: it blocks injected
 *   <script> and inline handlers even if HTML escaping ever regresses.
 * - connect-src allows any https origin because the knowledge library
 *   imports user-supplied URLs from the browser; ws/wss pinned to Supabase
 *   realtime. http: stays blocked.
 * - style attr/inline needed by React inline styles and the fonts CSS.
 * - frame-ancestors is header-only (ignored in meta); framebusting for the
 *   workspace lives in src/main.tsx.
 */
const PRODUCTION_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "script-src 'self'",
  "connect-src 'self' https: wss://*.supabase.co",
  "worker-src 'self' blob:",
].join("; ");

function productionCsp(): Plugin {
  return {
    name: "chronos:production-csp",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${PRODUCTION_CSP}" />`
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss(), productionCsp()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
