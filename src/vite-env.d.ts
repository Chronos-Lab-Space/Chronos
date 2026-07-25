/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  /** Publishable (sb_publishable_...) or legacy anon JWT key */
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Optional alias for the new publishable key naming */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_DEBUG?: string;

  /** Playwright only — never set in production builds */
  readonly VITE_E2E_AUTH?: string;
  /** Optional Sentry DSN for client error monitoring */
  readonly VITE_SENTRY_DSN?: string;

  /**
   * Platform AI provider: noop (default) | ollama
   * Keep unset/noop for deterministic public beta sims.
   */
  readonly VITE_AI_PROVIDER?: string;
  readonly VITE_OLLAMA_URL?: string;
  readonly VITE_OLLAMA_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
