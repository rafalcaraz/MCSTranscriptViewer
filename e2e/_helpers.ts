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
  // Install a recurring kill loop BEFORE navigation. The Power Apps player
  // splash + its Fluent dark backdrop overlay (#fluent-default-layer-host
  // .ms-Overlay--dark, often aria-hidden=true) sit on TOP of our iframe and
  // silently intercept every click. Polling once isn't enough — the overlay
  // is re-injected on a timer. We nuke it every 250ms for the life of the page.
  await installPlayerOverlayKiller(page);

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
  // Wait for our React app to mount inside the iframe.
  await expect(
    frame.getByRole("button", { name: "Transcripts", exact: true })
  ).toBeVisible({ timeout: 90_000 });

  // One immediate kill in case any overlay snuck in between init and now.
  await killPlayerOverlaysNow(page);

  return frame;
}

// Install a setInterval in the page that REMOVES the player splash + dark
// Fluent backdrop every 250ms. addInitScript runs BEFORE every navigation,
// so it survives the goto. This is more reliable than waiting for the
// overlay to "go away" — Power Apps re-injects it after various lifecycle
// events (validate flow, MSAL refresh, dialog close).
//
// Belt-and-suspenders: we also inject a stylesheet that disables pointer
// events on the entire splash + Fluent layer host. CSS can't be defeated
// by Power Apps re-rendering — it just keeps applying.
export async function installPlayerOverlayKiller(page: Page): Promise<void> {
  await page
    .addInitScript(() => {
      const installCss = () => {
        if (document.getElementById("__pwOverlayKillerCss")) return;
        if (!document.head) return;
        const style = document.createElement("style");
        style.id = "__pwOverlayKillerCss";
        style.textContent = `
          /* Kill the Power Apps player splash entirely. */
          #playerSplashScreen,
          .player-splash-screen,
          .show-app-splash {
            pointer-events: none !important;
            display: none !important;
            visibility: hidden !important;
          }
          /* Fluent layer host hosts modals + dark backdrops that intercept
             clicks targeted at our iframe. We never need to interact with
             anything inside it during e2e — let the events fall through. */
          #fluent-default-layer-host,
          #fluent-default-layer-host *,
          .ms-Overlay,
          .ms-Overlay--dark,
          .ms-Modal,
          .ms-Modal.is-open,
          .ms-Dialog {
            pointer-events: none !important;
          }
        `;
        document.head.appendChild(style);
      };
      const kill = () => {
        installCss();
        const splash = document.getElementById("playerSplashScreen");
        if (splash) {
          splash.classList.remove("show-app-splash");
          (splash as HTMLElement).style.display = "none";
          (splash as HTMLElement).style.pointerEvents = "none";
        }
        document
          .querySelectorAll(".player-splash-screen")
          .forEach((el) => {
            (el as HTMLElement).style.display = "none";
            (el as HTMLElement).style.pointerEvents = "none";
          });
        document
          .querySelectorAll(
            "#fluent-default-layer-host .ms-Overlay, " +
              "#fluent-default-layer-host .ms-Modal, " +
              "#fluent-default-layer-host .ms-Dialog"
          )
          .forEach((el) => {
            (el as HTMLElement).style.pointerEvents = "none";
          });
      };
      kill();
      // Re-run as soon as <head> exists if it didn't on first try.
      if (!document.head) {
        document.addEventListener("DOMContentLoaded", kill, { once: true });
      }
      // @ts-expect-error window typing
      if (window.__pwOverlayKiller) return;
      // @ts-expect-error window typing
      window.__pwOverlayKiller = setInterval(kill, 250);
    })
    .catch(() => {});
}

// One-shot kill — useful right before a critical click.
export async function killPlayerOverlaysNow(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      const splash = document.getElementById("playerSplashScreen");
      if (splash) {
        splash.classList.remove("show-app-splash");
        (splash as HTMLElement).style.display = "none";
        (splash as HTMLElement).style.pointerEvents = "none";
      }
      document.querySelectorAll(".player-splash-screen").forEach((el) => {
        (el as HTMLElement).style.display = "none";
        (el as HTMLElement).style.pointerEvents = "none";
      });
      document
        .querySelectorAll(
          "#fluent-default-layer-host .ms-Overlay, " +
            "#fluent-default-layer-host .ms-Modal, " +
            "#fluent-default-layer-host .ms-Dialog"
        )
        .forEach((el) => {
          (el as HTMLElement).style.pointerEvents = "none";
        });
    })
    .catch(() => {});
}

// Back-compat alias — older specs may import waitForPlayerOverlaysToClear.
// Now just calls the active killer + a brief delay.
export async function waitForPlayerOverlaysToClear(
  page: Page,
  _timeoutMs = 60_000
): Promise<void> {
  await installPlayerOverlayKiller(page);
  await killPlayerOverlaysNow(page);
}

// Read the "{N} shown (of {M} loaded) — more available" header text into
// structured fields. Works on both Transcripts and Browse via Flows lists.
// Returns zeros if the list-header isn't rendered (e.g., limited persona
// with no visible transcripts).
export async function readListStats(scope: FrameLocator) {
  const header = scope.locator(".list-header span").first();
  const exists = await header.count().catch(() => 0);
  if (!exists) {
    return { shown: 0, loaded: 0, hasMore: false, raw: "" };
  }
  const text = await header.textContent({ timeout: 5_000 }).catch(() => "") ?? "";
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
