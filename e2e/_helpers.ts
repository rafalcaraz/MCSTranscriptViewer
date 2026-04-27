// Shared helpers for all e2e specs. Anything that touches the Power Apps
// player shell, MSAL bounces, sign-in modals, or iframe-vs-page locator
// resolution should live here so we don't duplicate fixes across files.

import { expect, FrameLocator, Page } from "@playwright/test";
import { APP_URL } from "./appUrl";

// MSAL occasionally bounces to the account chooser mid-suite (silent SSO
// blip / token refresh). Click the first tile.
export async function dismissAccountPickerIfPresent(page: Page) {
  const onLogin = /login\.microsoftonline\.com|login\.microsoft\.com/.test(
    page.url()
  );
  if (!onLogin) return;
  await page
    .locator(
      '[data-test-id="account-tile"], [data-test-id="accountTile"], div[role="button"][data-test-id*="account"], .table-row, [aria-label*="@"]'
    )
    .first()
    .click({ timeout: 5_000 })
    .catch(() => {});
}

// Power Apps player sometimes shows "Sign in required" mid-session even
// though MSAL is fine (connector consent refresh). Click the button.
export async function dismissPowerAppsSignInModal(page: Page) {
  const modal = page.getByText("Sign in required", { exact: false }).first();
  if (!(await modal.isVisible().catch(() => false))) return;
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .first()
    .click({ timeout: 5_000 })
    .catch(() => {});
  await page.waitForTimeout(2_000);
}

// Load the deployed app and wait until the React app is actually mounted.
// Returns the FrameLocator for the iframe so caller queries find elements
// inside the Power Apps player iframe (page.title() can stay "Power Apps"
// indefinitely under headless+parallel load).
export async function loadApp(page: Page): Promise<FrameLocator> {
  await page.goto(APP_URL);
  for (let i = 0; i < 3; i++) {
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await dismissAccountPickerIfPresent(page);
    await dismissPowerAppsSignInModal(page);
    if (/apps\.powerapps\.com\/play/.test(page.url())) break;
    await page.waitForTimeout(2_000);
  }
  await dismissPowerAppsSignInModal(page);

  const frame = page.frameLocator("iframe").first();
  // 1) Wait for our React app to mount inside the iframe.
  await expect(
    frame.getByRole("button", { name: "Transcripts", exact: true })
  ).toBeVisible({ timeout: 90_000 });

  // 2) Wait for the Power Apps player splash + Fluent overlay to fully
  //    disappear. They sit on TOP of our iframe content and silently
  //    intercept clicks even though our buttons are "visible". This is
  //    the #1 source of flake in headless+parallel runs.
  await waitForPlayerOverlaysToClear(page);

  return frame;
}

// Wait for the Power Apps player splash screen and Fluent dark overlay
// to be removed from the DOM (or hidden). Both intercept pointer events
// and cause "element is visible, enabled and stable" → click timeout.
export async function waitForPlayerOverlaysToClear(
  page: Page,
  timeoutMs = 60_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const blocked = await page
      .evaluate(() => {
        const splash = document.getElementById("playerSplashScreen");
        if (
          splash &&
          splash.offsetParent !== null &&
          splash.classList.contains("show-app-splash")
        ) {
          return "splash";
        }
        const overlay = document.querySelector(
          "#fluent-default-layer-host .ms-Overlay--dark"
        );
        if (overlay) return "fluent-overlay";
        return null;
      })
      .catch(() => null);
    if (!blocked) return;
    await page.waitForTimeout(500);
  }
  // Don't throw — caller's next click will retry; we just wanted to give
  // overlays a chance to clear before pointer events start firing.
}

// Read the "{N} shown (of {M} loaded) — more available" header text into
// structured fields. Works on both Transcripts and Browse via Flows lists.
export async function readListStats(scope: FrameLocator) {
  const text =
    (await scope.locator(".list-header span").first().textContent()) ?? "";
  const shownMatch = /(\d+)\s+shown/.exec(text);
  const loadedMatch = /of\s+(\d+)\s+loaded/.exec(text);
  return {
    shown: shownMatch ? Number(shownMatch[1]) : 0,
    loaded: loadedMatch
      ? Number(loadedMatch[1])
      : shownMatch
        ? Number(shownMatch[1])
        : 0,
    hasMore: /more available/.test(text),
    raw: text,
  };
}
