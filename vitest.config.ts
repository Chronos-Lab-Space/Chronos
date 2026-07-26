import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      reporter: ["text", "html", "lcov"],
      include: [
        "src/application/chronos/**/*.ts",
        "src/domain/chronos/**/*.ts",
        "src/presentation/components/**/*.tsx",
      ],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**"],
    },
  },
});
