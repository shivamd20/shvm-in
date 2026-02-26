/// <reference types="vitest" />
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["src/vani2/__tests__/integration/**/*.integration.test.ts"],
    environment: "node",
    globalSetup: ["./src/vani2/__tests__/integration/setup.ts"],
    testTimeout: 30_000,
  },
});
