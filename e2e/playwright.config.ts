import { defineConfig, devices } from "@playwright/test";

/**
 * Screenshot checks of the playground. They need only the playground, no app stack.
 * Run with `bun run e2e`.
 */
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  outputDir: "../.e2e-output",
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5181", ...devices["Desktop Chrome"] },
  webServer: {
    command: "bunx vite --config playground/vite.config.ts --port 5181 --strictPort",
    cwd: "..",
    url: "http://localhost:5181",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
