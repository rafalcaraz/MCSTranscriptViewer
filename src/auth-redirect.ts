// Manual OAuth 2.0 Authorization Code + PKCE flow.
//
// Why not MSAL.js loginPopup?
// - When this app runs inside the Power Apps player iframe (apps.powerapps.com
//   embedding localhost:5173), Chrome's storage partitioning gives the iframe
//   a different localStorage partition than the popup it spawns. MSAL.js relies
//   on shared storage between parent and popup to coordinate, so it never
//   completes. login.microsoftonline.com's COOP also breaks window.opener.
//
// This page runs entirely in the popup and uses two channels independent of
// the parent: its own URL (carries config in), sessionStorage (carries PKCE
// verifier across the AAD round-trip), and BroadcastChannel (delivers the
// access token to the parent at the end). The popup never reads from the
// parent's storage.
//
// State machine:
//   Phase A (search has ?start=1): generate PKCE, stash in sessionStorage,
//                                  redirect to AAD /authorize.
//   Phase B (hash has #code=...):  exchange code at /token, broadcast token,
//                                  close window.
//   Phase C (hash has #error=...): broadcast error, close window.

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
  // Send the token over EVERY plausible channel because Chrome's storage
  // partitioning means we don't know which one the iframe parent can hear:
  //   1. BroadcastChannel — works if popup and iframe share a storage partition
  //      (e.g. if Storage Access API granted, or browser doesn't partition).
  //   2. window.opener.postMessage — works if COOP didn't sever the opener
  //      (it usually does after the AAD round-trip, but try anyway).
  //   3. window.opener.opener / top — extra fallback for nested cases.
  // The wire payload includes channelId so listeners can filter to their attempt.
  const wire = { ...msg, channelId };
  console.log("[auth-redirect] broadcasting", { type: msg.type, channelId, hasOpener: !!window.opener });
  try {
    const ch = new BroadcastChannel(channelId);
    ch.postMessage(msg);
    setTimeout(() => ch.close(), 100);
  } catch (e) {
    console.error("[auth-redirect] BroadcastChannel failed", e);
  }
  try {
    window.opener?.postMessage(wire, "*");
  } catch (e) {
    console.warn("[auth-redirect] opener.postMessage failed", e);
  }
  try {
    // If the iframe's parent is reachable through a chain (rare but cheap to try).
    (window.opener?.opener as Window | undefined)?.postMessage(wire, "*");
  } catch { /* ignore */ }
}

function closeSelfSoon(delayMs = 250): void {
  setTimeout(() => {
    try { window.close(); } catch { /* ignore */ }
  }, delayMs);
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
    console.error("[auth-redirect] start phase missing params", { clientId, scope, channelId });
    document.body.textContent = "Missing required params (clientId, scope, channelId).";
    return;
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(32);
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

  console.log("[auth-redirect] phase A -> redirecting to AAD");
  window.location.replace(authorize.toString());
}

async function callbackPhase(hashParams: URLSearchParams): Promise<void> {
  const raw = sessionStorage.getItem(SS_KEY);
  if (!raw) {
    console.error("[auth-redirect] callback with no pending auth in sessionStorage");
    document.body.textContent = "No pending auth state. Close this window and try again.";
    return;
  }
  const pending = JSON.parse(raw) as PendingAuth;
  sessionStorage.removeItem(SS_KEY);

  const error = hashParams.get("error");
  if (error) {
    const desc = hashParams.get("error_description") || "";
    const friendly = friendlyAuthError(error, desc);
    console.error("[auth-redirect] AAD returned error", { error, desc });
    broadcast(pending.channelId, { type: "error", message: friendly, code: error });
    document.body.textContent = `Sign-in error: ${friendly}`;
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
      console.error("[auth-redirect] token exchange failed", friendly, json);
      broadcast(pending.channelId, { type: "error", message: friendly, code: json.error });
      document.body.textContent = `Token exchange failed: ${friendly}`;
      closeSelfSoon(1500);
      return;
    }
    console.log("[auth-redirect] token acquired, broadcasting to parent");
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
    document.body.textContent = "Sign-in complete. You can close this window.";
    closeSelfSoon(1200);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error("[auth-redirect] token request threw", e);
    broadcast(pending.channelId, { type: "error", message: msg });
    closeSelfSoon(1500);
  }
}

async function main(): Promise<void> {
  console.log("[auth-redirect] loaded at", window.location.href);
  const search = new URLSearchParams(window.location.search);
  const hashParams = parseHashParams(window.location.hash);

  if (search.get("start") === "1") {
    await startPhase();
    return;
  }
  if (hashParams.has("code") || hashParams.has("error")) {
    await callbackPhase(hashParams);
    return;
  }
  console.warn("[auth-redirect] loaded with no recognized state");
  document.body.textContent = "Auth redirect page (idle).";
}

void main();
