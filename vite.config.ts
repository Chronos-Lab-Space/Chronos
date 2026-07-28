import path from "path";
import { fileURLToPath } from "url";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type PluginOption } from "vite";

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
 *   realtime. http: stays blocked. Sentry ingest is covered by https:.
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

function productionCsp(): PluginOption {
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

/**
 * Split long-lived vendor code into content-hashed chunks so a change to
 * app code doesn't invalidate the framework or the Supabase SDK in browser
 * caches (and vice-versa). Sentry is already dynamically imported, so it
 * splits on its own; these are the two large always-loaded dependencies.
 */
function vendorChunk(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;
  if (/[\\/]node_modules[\\/]@supabase[\\/]/.test(id)) return "vendor-supabase";
  if (
    /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)
  )
    return "vendor-react";
  return undefined;
}

function nonEmpty(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // loadEnv with "" prefix so we can read SENTRY_* (no VITE_ required for build secrets).
  const env = loadEnv(mode, process.cwd(), "");

  const sentryAuthToken = nonEmpty(env.SENTRY_AUTH_TOKEN ?? process.env.SENTRY_AUTH_TOKEN);
  const sentryOrg = nonEmpty(env.SENTRY_ORG ?? process.env.SENTRY_ORG);
  const sentryProject = nonEmpty(env.SENTRY_PROJECT ?? process.env.SENTRY_PROJECT);
  const sentryRelease = nonEmpty(
    env.VITE_SENTRY_RELEASE ?? process.env.VITE_SENTRY_RELEASE ?? process.env.GITHUB_SHA
  );
  // Optional regional API host. Leave unset so the auth token's embedded host
  // wins (tokens from sentry.io refuse us.sentry.io and vice versa).
  // Only set SENTRY_URL if you intentionally use EU/self-hosted.
  const sentryUrl = nonEmpty(env.SENTRY_URL ?? process.env.SENTRY_URL);

  const uploadSourceMaps = Boolean(sentryAuthToken && sentryOrg && sentryProject);

  const plugins: PluginOption[] = [react(), tailwindcss(), productionCsp()];

  // Sentry Vite plugin last — creates release + uploads maps only when fully configured.
  // Local/CI builds without SENTRY_AUTH_TOKEN stay offline-safe (no maps published).
  if (uploadSourceMaps) {
    if (sentryUrl) process.env.SENTRY_URL = sentryUrl;
    plugins.push(
      sentryVitePlugin({
        org: sentryOrg,
        project: sentryProject,
        authToken: sentryAuthToken,
        ...(sentryUrl ? { url: sentryUrl } : {}),
        release: sentryRelease
          ? {
              name: sentryRelease,
            }
          : undefined,
        sourcemaps: {
          filesToDeleteAfterUpload: ["./dist/**/*.map"],
        },
        // Silent when token missing is N/A — we gate the whole plugin.
        telemetry: false,
      })
    );
  }

  return {
    base: "/",
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    build: {
      // Hidden maps only when we will upload + delete them. Never ship .map on GH Pages.
      sourcemap: uploadSourceMaps ? "hidden" : false,
      rollupOptions: {
        output: {
          manualChunks: vendorChunk,
        },
      },
    },
    // Bake release into the client when provided (matches source map release).
    define: sentryRelease
      ? {
          "import.meta.env.VITE_SENTRY_RELEASE": JSON.stringify(sentryRelease),
        }
      : undefined,
  };
});
