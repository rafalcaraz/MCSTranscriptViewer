// Dedicated MSAL popup redirect page.
//
// Why we need this (and why it must call handleRedirectPromise):
// - login.microsoftonline.com sets Cross-Origin-Opener-Policy: same-origin
// - That severs the parent window's JS reference to the popup after cross-origin nav
// - So parent's loginPopup() polling on popup.location.href fails forever
// - MSAL.js v3+ falls back to BroadcastChannel — popup must actively broadcast result
// - handleRedirectPromise() is what triggers that broadcast
//
// Both this page and the parent app must instantiate PCA with the SAME clientId so
// the BroadcastChannel name matches. clientId is read from localStorage (set by parent).
import { PublicClientApplication } from "@azure/msal-browser";

async function complete() {
  console.log("[auth-redirect] popup landed at", window.location.href);
  const clientId = localStorage.getItem("multiEnv.clientId") ?? "";
  const tenantId = localStorage.getItem("multiEnv.tenantId") || "organizations";
  if (!clientId) {
    console.warn("[auth-redirect] no clientId in localStorage; nothing to do");
    return;
  }
  try {
    const pca = new PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        // Redirect URI must match exactly what was sent in /authorize.
        redirectUri: window.location.origin + "/auth-redirect.html",
      },
      cache: { cacheLocation: "localStorage" },
    });
    await pca.initialize();
    // This parses the URL hash, posts the response on a BroadcastChannel keyed to
    // clientId, and (when MSAL detects this is a popup) closes the window.
    const result = await pca.handleRedirectPromise();
    console.log("[auth-redirect] handleRedirectPromise resolved", result);
  } catch (e) {
    console.error("[auth-redirect] handleRedirectPromise failed", e);
  }
  // Fallback: if MSAL didn't close the window after a brief delay, close it ourselves.
  setTimeout(() => {
    try { window.close(); } catch { /* ignore */ }
  }, 2000);
}

void complete();
