// Dedicated MSAL popup redirect page. The MSAL App Registration's redirect URI must
// point to <origin>/auth-redirect.html (NOT the main app URL). When AAD redirects the
// popup window here, this script initializes MSAL and calls handleRedirectPromise(),
// which parses the URL response and signals the opener window via MSAL's built-in
// popup-completion channel. MSAL itself closes this window when done.
import { PublicClientApplication } from "@azure/msal-browser";

async function complete() {
  console.log("[auth-redirect] starting", window.location.href);
  const clientId = localStorage.getItem("multiEnv.clientId") ?? "";
  const tenantId = localStorage.getItem("multiEnv.tenantId") || "organizations";
  if (!clientId) {
    console.warn("[auth-redirect] no clientId in localStorage");
    try { window.close(); } catch { /* ignore */ }
    return;
  }
  try {
    const pca = new PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: window.location.origin + window.location.pathname,
      },
      cache: { cacheLocation: "localStorage" },
    });
    await pca.initialize();
    const result = await pca.handleRedirectPromise();
    console.log("[auth-redirect] handleRedirectPromise resolved", result);
  } catch (e) {
    console.error("[auth-redirect] failed", e);
  } finally {
    try { window.close(); } catch { /* ignore */ }
  }
}

void complete();
