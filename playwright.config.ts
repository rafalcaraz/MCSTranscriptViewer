import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";
import { APP_URL } from "./e2e/appUrl";

// Load e2e/.env so TEST_ENV_URL / AUTH_USER / etc. don't have to be set
// in the shell every run. Real env vars still override the file.
dotenv.config({ path: "e2e/.env" });

// Pick which saved auth file to replay. Defaults to admin.
//   $env:AUTH_USER="limited"; npx playwright test --project=smoke --headed
const AUTH_USER = process.env.AUTH_USER ?? "admin";
const STATE_PATH = `e2e/.auth/${AUTH_USER}.json`;

export default defineConfig({
  testDir: "./e2e",
  // Avoid NAS file-lock issues (EBUSY on trace.network writes) — keep
  // artifacts on the local temp drive.
  outputDir: process.env.TEMP
    ? `${process.env.TEMP}\\mcs-pw-test-results`
    : "./test-results",
  // 2 workers is the sweet spot for this suite — headless lets it parallelize
  // safely; bump higher only if you've gone fully headless and confirmed your
  // env doesn't throttle on concurrent flow calls. Override via --workers=N.
  workers: 2,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: APP_URL,
    // Power Apps player needs a real-ish viewport to render properly.
    viewport: { width: 1440, height: 900 },
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    // Default headless so you can keep working while tests run. Pass
    // `--headed` on the CLI (or use the `e2e:*:headed` scripts) to watch.
    headless: true,
  },
  projects: [
    // One-time interactive login — produces e2e/.auth/<AUTH_USER>.json.
    //   npx playwright test --project=setup --headed                  (admin)
    //   $env:AUTH_USER="limited"; npx playwright test --project=setup --headed
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { headless: false },
    },

    // ── Per-persona smoke/stress projects ────────────────────────────
    // Run all of them with `npx playwright test --headed` (skips setup since
    // it's gated on testMatch=auth.setup.ts and no project requires it).
    // Or target one: `npx playwright test --project=smoke-admin --headed`.

    {
      name: "smoke-admin",
      testMatch: /smoke\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
    },
    {
      name: "smoke-limited",
      testMatch: /smoke\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/limited.json",
      },
    },
    {
      name: "stress-admin",
      testMatch: /stress\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
    },
    {
      name: "stress-limited",
      testMatch: /stress\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/limited.json",
      },
    },

    // Backwards-compat aliases — pick persona via AUTH_USER env var.
    //   $env:AUTH_USER="limited"; npx playwright test --project=smoke --headed
    {
      name: "smoke",
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: STATE_PATH },
    },
    {
      name: "stress",
      testMatch: /stress\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: STATE_PATH },
    },

    // RBAC cross-persona suite. Projects share one rbac.spec.ts; each writes
    // its result to e2e/.rbac-results.json so the cross-check assertion can
    // compare admin vs limited.
    {
      name: "rbac-admin",
      testMatch: /rbac\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
    },
    {
      name: "rbac-limited",
      testMatch: /rbac\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/limited.json",
      },
    },
  ],
});
