// One-time interactive login. Run headed:
//   npx playwright test --project=setup --headed                 # → e2e/.auth/admin.json (default)
//   $env:AUTH_USER="limited"; npx playwright test --project=setup --headed
//
// Sign in with the chosen account. Once "MCS Conversation Viewer" loads,
// state for that user is saved to e2e/.auth/<AUTH_USER>.json and replayed
// by smoke/stress runs that pass the same AUTH_USER.

import { test as setup, expect } from "@playwright/test";
import { APP_URL } from "./appUrl";

const AUTH_USER = process.env.AUTH_USER ?? "admin";
const STATE_PATH = `e2e/.auth/${AUTH_USER}.json`;

setup(`authenticate as ${AUTH_USER}`, async ({ page }) => {
  setup.setTimeout(5 * 60_000);

  await page.goto(APP_URL);

  await expect(page).toHaveTitle(/MCS Conversation Viewer/i, {
    timeout: 4 * 60_000,
  });

  await page.context().storageState({ path: STATE_PATH });
  console.log(`\n✓ Saved auth state for "${AUTH_USER}" to ${STATE_PATH}`);
});
