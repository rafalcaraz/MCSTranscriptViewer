// Same-page auth bootstrap.
//
// Why this file exists separately from auth-redirect.html:
// In Power Apps Player, the Code App host only serves the registered
// `buildEntryPoint` (index.html) at the prefixed asset path — auxiliary HTML
// files like a separate auth-redirect.html return RouteNotFound. So we fold
// the popup-side OAuth dance into index.html itself: main.tsx checks for
// the `?auth=start` query (Phase A) or a `#code=` / `#error=` hash
// (Phase B/C) BEFORE mounting React, runs the flow, and skips mounting.
//
// State machine (mirrors the old auth-redirect.html):
//   Phase A  (search has ?auth=start):    generate PKCE, stash, redirect to AAD.
//   Phase B  (hash has #code=...):        exchange code, broadcast, close window.
//   Phase C  (hash has #error=...):       broadcast error, close window.
//   No match:                              return false; main.tsx mounts React.

import { generateCodeChallenge, generateCodeVerifier, generateRandomString } from "./utils/pkce";
import { friendlyAuthError } from "./utils/authErrors";

const SS_KEY = "multiEnv.auth.pending";

type PendingAuth = {
  clientId: string;
  tenantId: string;
  scope: string;
  channelId: string;
  codeVerifier: string;
  state: string;
  redirectUri: string;
};

type AuthMessage =
  | {
      type: "token";
      accessToken: string;
      refreshToken?: string;
      expiresIn: number;
      scope: string;
      tokenType: string;
      tenantId: string;
      clientId: string;
    }
  | { type: "error"; message: string; code?: string };

function broadcast(channelId: string, msg: AuthMessage): void {
  // Fan out across every channel because Chrome's storage partitioning means
  // we don't know which one the iframe parent can hear (see auth-redirect.ts
  // history for full reasoning).
  const wire = { ...msg, channelId };
  console.log("[authBootstrap] broadcasting", { type: msg.type, channelId, hasOpener: !!window.opener });
  try {
    const ch = new BroadcastChannel(channelId);
    ch.postMessage(msg);
    setTimeout(() => ch.close(), 100);
  } catch (e) {
    console.error("[authBootstrap] BroadcastChannel failed", e);
  }
  try {
    window.opener?.postMessage(wire, "*");
  } catch (e) {
    console.warn("[authBootstrap] opener.postMessage failed", e);
  }
  try {
    (window.opener?.opener as Window | undefined)?.postMessage(wire, "*");
  } catch { /* ignore */ }
}

function closeSelfSoon(delayMs = 250): void {
  setTimeout(() => {
    try { window.close(); } catch { /* ignore */ }
  }, delayMs);
}

function showStatusInRoot(text: string): void {
  // We never mounted React in this window — write a friendly message into the
  // existing #root div so the user sees something while the popup is alive.
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<div style="font-family: sans-serif; padding: 24px; color: #ddd;">${text}</div>`;
  } else {
    document.body.textContent = text;
  }
}

function parseHashParams(hash: string): URLSearchParams {
  return new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
}

async function startPhase(): Promise<void> {
  const search = new URLSearchParams(window.location.search);
  const clientId = (search.get("clientId") || "").trim();
  const tenantId = (search.get("tenantId") || "organizations").trim();
  const scope = (search.get("scope") || "").trim();
  const channelId = (search.get("channelId") || "").trim();

  if (!clientId || !scope || !channelId) {
    console.error("[authBootstrap] start phase missing params", { clientId, scope, channelId });
    showStatusInRoot("Missing required params (clientId, scope, channelId).");
    return;
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(32);
  // Strip query/hash so the redirect_uri exactly matches what's registered.
  const redirectUri = window.location.origin + window.location.pathname;

  const pending: PendingAuth = { clientId, tenantId, scope, channelId, codeVerifier, state, redirectUri };
  sessionStorage.setItem(SS_KEY, JSON.stringify(pending));

  const authorize = new URL(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/authorize`);
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_mode", "fragment");
  authorize.searchParams.set("scope", `${scope} offline_access openid profile`);
  authorize.searchParams.set("code_challenge", codeChallenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("prompt", "select_account");

  console.log("[authBootstrap] phase A -> redirecting to AAD");
  showStatusInRoot("Redirecting to Microsoft sign-in…");
  window.location.replace(authorize.toString());
}

async function callbackPhase(hashParams: URLSearchParams): Promise<void> {
  const raw = sessionStorage.getItem(SS_KEY);
  if (!raw) {
    console.error("[authBootstrap] callback with no pending auth in sessionStorage");
    showStatusInRoot("No pending auth state. Close this window and try again.");
    return;
  }
  const pending = JSON.parse(raw) as PendingAuth;
  sessionStorage.removeItem(SS_KEY);

  const error = hashParams.get("error");
  if (error) {
    const desc = hashParams.get("error_description") || "";
    const friendly = friendlyAuthError(error, desc);
    console.error("[authBootstrap] AAD returned error", { error, desc });
    broadcast(pending.channelId, { type: "error", message: friendly, code: error });
    showStatusInRoot(`Sign-in error: ${friendly}`);
    closeSelfSoon(1500);
    return;
  }

  const code = hashParams.get("code");
  const returnedState = hashParams.get("state");
  if (!code) {
    broadcast(pending.channelId, { type: "error", message: "No authorization code returned." });
    closeSelfSoon();
    return;
  }
  if (returnedState !== pending.state) {
    broadcast(pending.channelId, { type: "error", message: "State mismatch (possible CSRF)." });
    closeSelfSoon();
    return;
  }

  try {
    const body = new URLSearchParams();
    body.set("client_id", pending.clientId);
    body.set("grant_type", "authorization_code");
    body.set("code", code);
    body.set("redirect_uri", pending.redirectUri);
    body.set("code_verifier", pending.codeVerifier);
    body.set("scope", `${pending.scope} offline_access openid profile`);

    const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(pending.tenantId)}/oauth2/v2.0/token`;
    const resp = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const json = (await resp.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      token_type?: string;
      error?: string;
      error_description?: string;
    };
    if (!resp.ok || !json.access_token) {
      const friendly = friendlyAuthError(json.error ?? null, json.error_description ?? null);
      console.error("[authBootstrap] token exchange failed", friendly, json);
      broadcast(pending.channelId, { type: "error", message: friendly, code: json.error });
      showStatusInRoot(`Token exchange failed: ${friendly}`);
      closeSelfSoon(1500);
      return;
    }
    console.log("[authBootstrap] token acquired, broadcasting to parent");
    broadcast(pending.channelId, {
      type: "token",
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresIn: json.expires_in ?? 3600,
      scope: json.scope ?? pending.scope,
      tokenType: json.token_type ?? "Bearer",
      tenantId: pending.tenantId,
      clientId: pending.clientId,
    });
    showStatusInRoot("Sign-in complete. You can close this window.");
    closeSelfSoon(1200);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error("[authBootstrap] token request threw", e);
    broadcast(pending.channelId, { type: "error", message: msg });
    closeSelfSoon(1500);
  }
}

/**
 * Inspects the current URL. If it's an auth-flow popup (start phase or
 * AAD callback), runs the flow and returns true (caller MUST NOT mount React).
 * Otherwise returns false and the SPA boots normally.
 *
 * Detection criteria:
 *  - search contains `auth=start`  -> Phase A
 *  - hash contains `code=` or `error=` and sessionStorage has SS_KEY -> Phase B/C
 *
 * The hash check requires SS_KEY presence so a benign `#error=...` someone
 * accidentally hits in the main app doesn't hijack the boot.
 */
export function runAuthIfPending(): boolean {
  if (typeof window === "undefined") return false;
  console.log("[authBootstrap] inspect", window.location.href);
  const search = new URLSearchParams(window.location.search);
  if (search.get("auth") === "start") {
    void startPhase();
    return true;
  }
  const hashParams = parseHashParams(window.location.hash);
  if ((hashParams.has("code") || hashParams.has("error")) && sessionStorage.getItem(SS_KEY)) {
    void callbackPhase(hashParams);
    return true;
  }
  return false;
}
