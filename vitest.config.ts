import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    // supabase/functions/_shared holds the runtime-agnostic parts of the
    // Edge Function (upstream request shaping and response parsing). The
    // function itself is Deno-only and unreachable from here, but that
    // logic is the part most likely to break against a new provider, so
    // it is kept dependency-free and tested with everything else.
    include: ["src/**/*.test.{ts,tsx}", "supabase/functions/_shared/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html", "lcov"],
      include: [
        "src/application/chronos/**/*.ts",
        "src/application/simulation/**/*.ts",
        "src/application/workspace/**/*.ts",
        "src/domain/chronos/**/*.ts",
        "src/domain/workspace/**/*.ts",
        "src/infrastructure/repositories/**/*.ts",
        "src/presentation/components/**/*.tsx",
      ],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**"],
    },
  },
});
