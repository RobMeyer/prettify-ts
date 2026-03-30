/// <reference types="vitest/config" />
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    typecheck: {
      enabled: true,
      include: ["src/__tests__/**/*.test-d.ts"],
    },
    include: ["src/__tests__/**/*.test.ts", "plugin/__tests__/**/*.test.ts"],
  },
});
