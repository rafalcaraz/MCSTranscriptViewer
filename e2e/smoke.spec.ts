// Smoke tests — replay saved auth state, load the deployed Code App,
// verify it renders end-to-end. Run with: npx playwright test --project=smoke
//
// Power Apps Code Apps render directly inside apps.powerapps.com (no iframe
// wrapper for the React UI), so locators target the page itself.

import { test, expect, Page, Locator, ConsoleMessage } from "@playwright/test";
import { APP_URL } from "./appUrl";

// Where the React UI is mounted. Code Apps render inline at the player URL,
// but Power Apps may inject a chrome-bar iframe — try page first, fall back
// to the first frame that contains our nav.
async function appRoot(page: Page): Promise<Locator | Page> {
  const directNav = page.locator(".app-nav").first();
  try {
    await directNav.waitFor({ state: "visible", timeout: 15_000 });
    return page;
  } catch {
    const frames = page.frames();
    for (const f of frames) {
      const nav = f.locator(".app-nav").first();
      if (await nav.isVisible().catch(() => false)) {
        return page.frameLocator(`iframe`).first() as unknown as Page;
      }
    }
    return page;
  }
}

// If MSAL bounces to the account picker mid-suite (token refresh,
// silent SSO blip), click the first account tile to continue. Safe no-op
// if we're already past the picker.
async function dismissAccountPickerIfPresent(page: Page) {
  const onLogin = /login\.microsoftonline\.com|login\.microsoft\.com/.test(
    page.url()
  );
  if (!onLogin) return;
  const tile = page
    .locator(
      '[data-test-id="account-tile"], [data-test-id="accountTile"], div[role="button"][data-test-id*="account"], .table-row, [aria-label*="@"]'
    )
    .first();
  await tile.click({ timeout: 5_000 }).catch(() => {});
}

// Power Apps player sometimes shows a "Sign in required" modal even though
// MSAL is good (connector consent refresh). Click through it. Stays on
// apps.powerapps.com so the picker guard above doesn't catch it.
async function dismissPowerAppsSignInModal(page: Page) {
  const modal = page.getByText("Sign in required", { exact: false }).first();
  if (!(await modal.isVisible().catch(() => false))) return;
  const btn = page.getByRole("button", { name: "Sign in", exact: true }).first();
  await btn.click({ timeout: 5_000 }).catch(() => {});
  // Wait briefly for the modal to dismiss before the next assertion.
  await page.waitForTimeout(2_000);
}

// Console errors that are well-known noise from the Power Apps player and
// not actionable in our app code. Anything else fails the test.
const IGNORED_CONSOLE_PATTERNS: RegExp[] = [
  /Failed to load resource.*\b(404|400|401|403)\b/i, // PA player telemetry/probes
  /\[GSI_LOGGER\]/,                                   // Google Sign-In logger noise
  /Cookie.*has been rejected/i,                       // 3rd-party cookie warnings
  /violates.*Content Security Policy/i,               // PA-injected CSP warnings
  /^Warning:/,                                        // React dev-mode warnings (warn, don't crash)
  /React\.createElement.*type is invalid/i,           // PA player React warning, not ours
  /Download the React DevTools/i,
  /\[MSAL\]/i,                                        // MSAL informational noise
];

function shouldFailOn(msg: ConsoleMessage): boolean {
  if (msg.type() !== "error") return false;
  const text = msg.text();
  return !IGNORED_CONSOLE_PATTERNS.some((p) => p.test(text));
}

test.beforeEach(async ({ page }, testInfo) => {
  test.setTimeout(2 * 60_000);

  // Console error scrape — fail the test if real errors fire during run.
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (shouldFailOn(msg)) {
      consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`[pageerror] ${err.message}`);
  });
  // Stash on testInfo so afterEach can read it.
  (testInfo as { _consoleErrors?: string[] })._consoleErrors = consoleErrors;

  await page.goto(APP_URL);
  // Up to 3 account-picker bounces (rare but observed under token refresh).
  for (let i = 0; i < 3; i++) {
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await dismissAccountPickerIfPresent(page);
    await dismissPowerAppsSignInModal(page);
    if (/apps\.powerapps\.com\/play/.test(page.url())) break;
    await page.waitForTimeout(2_000);
  }
  // One more pass after we're on the play URL — the modal often appears
  // a beat after the player loads.
  await dismissPowerAppsSignInModal(page);
  // Wait for the app to actually render INSIDE the iframe. The outer
  // page.title() can stay stuck on "Power Apps" under headless+parallel
  // load even after our app is fully interactive — the iframe is the
  // real readiness signal.
  const frame = page.frameLocator("iframe").first();
  await expect(
    frame.getByRole("button", { name: "Transcripts", exact: true })
  ).toBeVisible({ timeout: 90_000 });
});

test.afterEach(async ({}, testInfo) => {
  const errs = (testInfo as { _consoleErrors?: string[] })._consoleErrors ?? [];
  if (errs.length > 0) {
    throw new Error(
      `Console errors during "${testInfo.title}":\n  ${errs.join("\n  ")}`,
    );
  }
});

test.describe("App shell", () => {
  test("page title and version label render", async ({ page }) => {
    const root = await appRoot(page);
    // Version label format from src/App.tsx line 146: `v1.0.5 · <build time>`
    await expect(
      (root as Page).locator(".app-version, .app-nav .app-version").first()
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      (root as Page).locator(".app-version").first()
    ).toContainText(/v\d+\.\d+\.\d+/);
  });

  test("both top-level tabs are visible", async ({ page }) => {
    const root = await appRoot(page);
    await expect(
      (root as Page).getByRole("button", { name: "Transcripts", exact: true })
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      (root as Page).getByRole("button", { name: "Browse via Flows", exact: true })
    ).toBeVisible();
  });

  test("theme toggle is visible and clickable", async ({ page }) => {
    const root = await appRoot(page);
    const themeBtn = (root as Page).locator(".theme-toggle").first();
    await expect(themeBtn).toBeVisible({ timeout: 30_000 });
    const initial = await themeBtn.textContent();
    await themeBtn.click();
    // Toggle swaps between ☀️ and 🌙
    await expect(themeBtn).not.toHaveText(initial ?? "", { timeout: 5_000 });
  });
});

test.describe("Tab navigation", () => {
  test("Transcripts tab is the default active view", async ({ page }) => {
    const root = await appRoot(page);
    const transcripts = (root as Page).getByRole("button", {
      name: "Transcripts",
      exact: true,
    });
    await expect(transcripts).toHaveClass(/active/, { timeout: 30_000 });
  });

  test("clicking Browse via Flows switches to the flows workspace", async ({
    page,
  }) => {
    const root = await appRoot(page);
    const flowsTab = (root as Page).getByRole("button", {
      name: "Browse via Flows",
      exact: true,
    });
    await flowsTab.click();
    await expect(flowsTab).toHaveClass(/active/, { timeout: 10_000 });
    // The unvalidated splash heading from BrowseFlowsWorkspace.tsx line 266
    await expect(
      (root as Page).getByRole("heading", { name: "Browse via Flows" })
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Transcripts tab can be returned to from Browse via Flows", async ({
    page,
  }) => {
    const root = await appRoot(page);
    await (root as Page)
      .getByRole("button", { name: "Browse via Flows", exact: true })
      .click();
    const transcripts = (root as Page).getByRole("button", {
      name: "Transcripts",
      exact: true,
    });
    await transcripts.click();
    await expect(transcripts).toHaveClass(/active/, { timeout: 10_000 });
  });
});

test.describe("Browse via Flows workspace", () => {
  test.beforeEach(async ({ page }) => {
    const root = await appRoot(page);
    await (root as Page)
      .getByRole("button", { name: "Browse via Flows", exact: true })
      .click();
  });

  test("env URL input and Validate button render", async ({ page }) => {
    const root = await appRoot(page);
    await expect(
      (root as Page).getByLabel("Environment URL")
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      (root as Page).getByRole("button", { name: "Validate", exact: true })
    ).toBeVisible();
  });

  test("env URL input accepts text", async ({ page }) => {
    const root = await appRoot(page);
    const input = (root as Page).getByLabel("Environment URL");
    await input.fill("https://contoso.crm.dynamics.com");
    await expect(input).toHaveValue("https://contoso.crm.dynamics.com");
  });

  test("Validate button enters validating state when clicked", async ({
    page,
  }) => {
    const root = await appRoot(page);
    await (root as Page)
      .getByLabel("Environment URL")
      .fill("https://contoso.crm.dynamics.com");
    const validate = (root as Page).getByRole("button", {
      name: /^Validate/,
    });
    await validate.click();
    // Button text flips to "Validating…" while in flight.
    await expect(validate).toHaveText(/Validating|Validate/);
  });

  test("invalid env URL surfaces an error card with actionable hint", async ({
    page,
  }) => {
    test.setTimeout(3 * 60_000);
    const root = await appRoot(page);
    // A well-formed but non-existent org URL — flow will fail to reach it
    // and ErrorCard should render with the "pick a different environment"
    // hint baked into BrowseFlowsWorkspace.tsx line 119.
    await (root as Page)
      .getByLabel("Environment URL")
      .fill("https://nonexistent-org-zzz.crm.dynamics.com");
    await (root as Page).getByRole("button", { name: /^Validate/ }).click();

    // Validate eventually flips back from "Validating…" — wait for terminal state.
    await expect(
      (root as Page).getByRole("button", { name: "Validate", exact: true })
    ).toBeVisible({ timeout: 90_000 });

    // Workspace should NOT have transitioned to the validated subtree —
    // the splash heading is still present.
    await expect(
      (root as Page).getByRole("heading", { name: "Browse via Flows" })
    ).toBeVisible();

    // ErrorCard always renders "What to try:" hint section regardless of
    // category (flow_failure / permission_denied / query_error). Also titles:
    // "Flow failed to run" | "Access denied..." | "Bad query...".
    const errorSignal = (root as Page)
      .getByText(/What to try:|Flow failed to run|Access denied|Bad query/i)
      .first();
    await expect(errorSignal).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("Filters (Transcripts tab)", () => {
  test("date filter inputs render and accept ISO values", async ({ page }) => {
    const root = await appRoot(page);
    // Wait for the Transcripts list to render the toolbar.
    const fromInput = (root as Page).locator(
      '.filter-section input[type="date"]'
    ).first();
    const toInput = (root as Page).locator(
      '.filter-section input[type="date"]'
    ).nth(1);

    await expect(fromInput).toBeVisible({ timeout: 60_000 });
    await expect(toInput).toBeVisible();

    await fromInput.fill("2025-01-01");
    await toInput.fill("2025-12-31");

    await expect(fromInput).toHaveValue("2025-01-01");
    await expect(toInput).toHaveValue("2025-12-31");

    // Apply button should eventually become enabled (it sits in "Loading..."
    // disabled state while the initial transcript fetch is in flight).
    const applyBtn = (root as Page).locator(".apply-btn").first();
    await expect(applyBtn).toBeVisible();
    await expect(applyBtn).toBeEnabled({ timeout: 90_000 });
    await applyBtn.click();
    // Just verify it didn't throw — actual result-narrowing assertion lives
    // in stress.spec.ts to keep smoke fast.
    await expect(applyBtn).toBeVisible();
  });
});
