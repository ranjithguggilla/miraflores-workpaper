import { defineConfig } from "@playwright/test";
/** E2E runs against an imported + seeded database (npm run db:import && npm run db:seed). */
export default defineConfig({
  testDir: "tests",
  testMatch: /.*\.spec\.ts/,
  timeout: 30_000,
  retries: 0,
  workers: 1,            // one shared database: run serially so tests do not interleave writes
  fullyParallel: false,
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:3000", trace: "retain-on-failure" },
  webServer: { command: "npm start", port: 3000, reuseExistingServer: true, timeout: 60_000 },
});
