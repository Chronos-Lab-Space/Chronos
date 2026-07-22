/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_DEBUG?: string;
  readonly VITE_MOCK_ACCESS_REQUESTS?: string;
  /** Playwright only — never set in production builds */
  readonly VITE_E2E_AUTH?: string;
  /** Optional Sentry DSN for client error monitoring */
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
