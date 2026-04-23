import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowseEnvironmentsWorkspace, type EnvOption } from "./BrowseEnvironmentsWorkspace";
import { friendlyAuthError } from "../../utils/authErrors";
import "./MultiEnvPanel.css";

const LS_CLIENT_ID = "multiEnv.clientId";
const LS_TENANT_ID = "multiEnv.tenantId";
const LS_SELECTED_ENV = "multiEnv.selectedEnvUrl";

const GLOBAL_DISCO_URL = "https://globaldisco.crm.dynamics.com/api/discovery/v2.0/Instances";
const GLOBAL_DISCO_SCOPE = "https://globaldisco.crm.dynamics.com/.default";

const POPUP_TIMEOUT_MS = 5 * 60 * 1000;

type DiscoveryInstance = {
  ApiUrl: string;
  Url: string;
  FriendlyName: string;
  EnvironmentId: string;
  TenantId: string;
  Region: string;
  UrlName: string;
  UniqueName: string;
};

type Status =
  | { kind: "idle" }
  | { kind: "signing-in" }
  | { kind: "loading-envs" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

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
  | { type: "error"; message: string };

type EnvTokenCacheEntry = { token: string; expiresAt: number };

function randomChannelId(): string {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return "multiEnv.auth." + Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function MultiEnvPanel() {
  const [clientId, setClientId] = useState<string>(() => localStorage.getItem(LS_CLIENT_ID) ?? "");
  const [tenantId, setTenantId] = useState<string>(() => localStorage.getItem(LS_TENANT_ID) ?? "organizations");
  const [accessToken, setAccessToken] = useState<string>("");
  const [authedTenantId, setAuthedTenantId] = useState<string>("");
  const [authedClientId, setAuthedClientId] = useState<string>("");
  const refreshTokenRef = useRef<string>("");
  const envTokenCache = useRef<Map<string, EnvTokenCacheEntry>>(new Map());
  const [envs, setEnvs] = useState<DiscoveryInstance[]>([]);
  const [selectedEnvUrl, setSelectedEnvUrl] = useState<string>(() => localStorage.getItem(LS_SELECTED_ENV) ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [configCollapsed, setConfigCollapsed] = useState<boolean>(() => !!localStorage.getItem(LS_CLIENT_ID));
  const cleanupRef = useRef<(() => void) | null>(null);

  const redirectUri = useMemo(() => {
    if (typeof window === "undefined") return "";
    // Auth flow lives inside the same index.html (the Code App host only
    // serves the entry HTML at the prefixed asset path), so the registered
    // redirect URI IS the current page's full URL — origin + pathname.
    return window.location.origin + window.location.pathname;
  }, []);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const persistConfig = () => {
    localStorage.setItem(LS_CLIENT_ID, clientId.trim());
    localStorage.setItem(LS_TENANT_ID, tenantId.trim() || "organizations");
  };

  const signIn = async () => {
    const cid = clientId.trim();
    if (!cid) {
      setStatus({ kind: "error", message: "Enter a Client ID first." });
      return;
    }
    persistConfig();
    setStatus({ kind: "signing-in" });

    try {
      const d = document as Document & { hasStorageAccess?: () => Promise<boolean>; requestStorageAccess?: () => Promise<void> };
      if (d.hasStorageAccess && d.requestStorageAccess) {
        const has = await d.hasStorageAccess();
        if (!has) {
          await d.requestStorageAccess().catch(() => undefined);
        }
      }
    } catch { /* ignore */ }

    const channelId = randomChannelId();
    const tid = tenantId.trim() || "organizations";
    // Open the popup at our own index.html (only HTML the Code App host
    // serves) with ?auth=start; main.tsx will detect it and run the flow
    // instead of mounting React.
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("auth", "start");
    url.searchParams.set("clientId", cid);
    url.searchParams.set("tenantId", tid);
    url.searchParams.set("scope", GLOBAL_DISCO_SCOPE);
    url.searchParams.set("channelId", channelId);

    const channel = new BroadcastChannel(channelId);
    let timeoutId: number | null = null;
    let popup: Window | null = null;
    let pollId: number | null = null;
    let resolved = false;

    const handle = (msg: AuthMessage) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      try { popup?.close(); } catch { /* ignore */ }
      if (msg.type === "token") {
        setAccessToken(msg.accessToken);
        refreshTokenRef.current = msg.refreshToken ?? "";
        setAuthedTenantId(msg.tenantId);
        setAuthedClientId(msg.clientId);
        envTokenCache.current.clear();
        setConfigCollapsed(true);
        void loadEnvs(msg.accessToken);
      } else {
        setStatus({ kind: "error", message: msg.message });
      }
    };

    const onWindowMessage = (ev: MessageEvent) => {
      const data = ev.data as (AuthMessage & { channelId?: string }) | undefined;
      if (!data || typeof data !== "object") return;
      if (data.channelId !== channelId) return;
      if (data.type !== "token" && data.type !== "error") return;
      handle(data);
    };

    const cleanup = () => {
      try { channel.close(); } catch { /* ignore */ }
      window.removeEventListener("message", onWindowMessage);
      if (timeoutId !== null) clearTimeout(timeoutId);
      if (pollId !== null) clearInterval(pollId);
      cleanupRef.current = null;
    };
    cleanupRef.current = cleanup;

    channel.onmessage = (ev: MessageEvent<AuthMessage>) => handle(ev.data);
    window.addEventListener("message", onWindowMessage);

    timeoutId = window.setTimeout(() => {
      if (resolved) return;
      cleanup();
      setStatus({ kind: "error", message: "Sign-in timed out. Close the popup and try again." });
    }, POPUP_TIMEOUT_MS);

    popup = window.open(url.toString(), "multiEnvAuth", "width=520,height=720");
    if (!popup) {
      cleanup();
      setStatus({ kind: "error", message: "Popup was blocked. Allow popups for this site and try again." });
      return;
    }

    pollId = window.setInterval(() => {
      if (popup && popup.closed) {
        if (pollId !== null) { clearInterval(pollId); pollId = null; }
        setTimeout(() => {
          if (resolved) return;
          cleanup();
          setStatus((s) => (s.kind === "signing-in" ? { kind: "error", message: "Popup closed before the parent could receive the token." } : s));
        }, 3000);
      }
    }, 500);
  };

  const loadEnvs = async (token: string) => {
    setStatus({ kind: "loading-envs" });
    try {
      const resp = await fetch(GLOBAL_DISCO_URL, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!resp.ok) {
        throw new Error(`Discovery returned ${resp.status} ${resp.statusText}`);
      }
      const json = (await resp.json()) as { value: DiscoveryInstance[] };
      const sorted = [...json.value].sort((a, b) => a.FriendlyName.localeCompare(b.FriendlyName));
      setEnvs(sorted);
      setStatus({ kind: "ready" });
    } catch (e: unknown) {
      const err = e as { message?: string };
      setStatus({ kind: "error", message: `Discovery failed: ${err.message ?? String(e)}` });
    }
  };

  /** Reset to pre-signed-in state. Used both internally on auth-expired and when
   *  the user signs in again with a different account. Keeps the saved Client ID /
   *  Tenant ID so the user doesn't have to re-paste their app reg config. */
  const resetSession = useCallback((statusMessage?: string) => {
    setAccessToken("");
    refreshTokenRef.current = "";
    envTokenCache.current.clear();
    setAuthedTenantId("");
    setAuthedClientId("");
    setEnvs([]);
    setSelectedEnvUrl("");
    localStorage.removeItem(LS_SELECTED_ENV);
    setStatus(statusMessage ? { kind: "error", message: statusMessage } : { kind: "idle" });
  }, []);

  // Returns an env-scoped access token, refreshing via the captured refresh_token
  // when needed. Cached per env so successive Web API calls don't re-hit /token.
  // If the refresh token is rejected (expired, revoked, consent withdrawn), the
  // session is automatically reset and the user is prompted to sign in again.
  const getEnvToken = useCallback(async (envApiUrl: string): Promise<string> => {
    const cached = envTokenCache.current.get(envApiUrl);
    // Refresh 60s before expiry to avoid races.
    if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;

    const refreshToken = refreshTokenRef.current;
    if (!refreshToken || !authedTenantId || !authedClientId) {
      const msg = "Your session expired. Click Sign in to continue.";
      resetSession(msg);
      throw new Error(msg);
    }

    const scope = `${envApiUrl.replace(/\/$/, "")}/.default`;
    const body = new URLSearchParams();
    body.set("client_id", authedClientId);
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", refreshToken);
    body.set("scope", `${scope} offline_access`);

    const resp = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(authedTenantId)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const json = (await resp.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!resp.ok || !json.access_token) {
      const friendly = friendlyAuthError(json.error, json.error_description);
      // Only reset the whole session if the refresh token itself is unrecoverable
      // (revoked, expired, consent withdrawn). Other failures — e.g., a specific
      // env's scope is denied in a different tenant, network blips, transient AAD
      // errors — must NOT log the user out, because their session for other envs
      // is still valid. Those bubble up as inline errors at the call site.
      const unrecoverableCodes = new Set([
        "invalid_grant",        // refresh token rejected / expired / revoked
        "interaction_required", // user must re-authenticate
        "consent_required",     // consent withdrawn or new scope requires consent
        "login_required",       // session terminated server-side
      ]);
      const errCode = (json.error || "").trim();
      if (unrecoverableCodes.has(errCode)) {
        resetSession(`Your session expired. Sign in again to continue. (${friendly})`);
      }
      throw new Error(`Token refresh failed: ${friendly}`);
    }
    if (json.refresh_token) refreshTokenRef.current = json.refresh_token;
    const expiresAt = Date.now() + (json.expires_in ?? 3600) * 1000;
    envTokenCache.current.set(envApiUrl, { token: json.access_token, expiresAt });
    return json.access_token;
  }, [authedTenantId, authedClientId, resetSession]);

  const envOptions: EnvOption[] = useMemo(
    () => envs.map((e) => ({
      apiUrl: e.ApiUrl,
      friendlyName: e.FriendlyName,
      region: e.Region,
      urlName: e.UrlName,
      uniqueName: e.UniqueName,
    })),
    [envs],
  );

  const handleSelectEnv = (url: string) => {
    setSelectedEnvUrl(url);
    if (url) localStorage.setItem(LS_SELECTED_ENV, url);
    else localStorage.removeItem(LS_SELECTED_ENV);
  };

  return (
    <div className="multi-env-panel">
      <div className="me-narrow">
        <header className="me-header">
        <h2>Browse Environments (preview)</h2>
        <p className="me-sub">
          Sign in with an Entra App Registration to discover Dataverse environments you have access to — including across tenants. Pick one, then explore its agents and transcripts. Read-only — your normal &quot;This Environment&quot; tab is unaffected.
        </p>
        <p className="me-sub" style={{ marginTop: 4 }}>
          First time? See <a href="https://github.com/rafalcaraz/MCSTranscriptViewer/blob/main/my-app/docs/MULTI-ENV-SETUP.md" target="_blank" rel="noreferrer">docs/MULTI-ENV-SETUP.md</a> for the app-registration steps.
        </p>
      </header>

      <section className="me-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>Configuration</h3>
          <button className="me-btn ghost" onClick={() => setConfigCollapsed((v) => !v)}>
            {configCollapsed ? "Show" : "Hide"}
          </button>
        </div>
        {!configCollapsed && (
          <>
            <div className="me-field">
              <label>App Registration Client ID</label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <div className="me-field">
              <label>Tenant ID (or &quot;organizations&quot; / &quot;common&quot;)</label>
              <input
                type="text"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="organizations"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <div className="me-field">
              <label>Redirect URI (register as a SPA platform)</label>
              <input type="text" value={redirectUri} readOnly />
            </div>
            <div className="me-hint">
              Required API permissions: <code>Dynamics CRM &gt; user_impersonation</code> (delegated). Admin consent recommended.
              The redirect URI must be registered under <strong>Single-page application</strong> (not Web).
              In Power Apps Player this URI includes the resource/asset path prefix — copy the value above exactly as shown.
            </div>
          </>
        )}
      </section>

      <section className="me-card">
        <h3>Sign in</h3>
        {!accessToken ? (
          <button className="me-btn primary" onClick={signIn} disabled={status.kind === "signing-in"}>
            {status.kind === "signing-in" ? "Signing in…" : "Sign in with Microsoft"}
          </button>
        ) : (
          <div className="me-account">
            <div>
              Signed in to tenant <code>{authedTenantId}</code>.
              {status.kind === "loading-envs" && " Loading environments…"}
            </div>
            <div className="me-sub" style={{ marginTop: 4 }}>
              To switch accounts or refresh your session, just close and reopen the app — your refresh token is held in memory only.
            </div>
          </div>
        )}
      </section>

      {status.kind === "error" && (
        <section className="me-card error">
          <strong>Error:</strong> {status.message}
        </section>
      )}
      </div>

      {accessToken && envs.length > 0 && (
        <BrowseEnvironmentsWorkspace
          envs={envOptions}
          selectedEnvUrl={selectedEnvUrl}
          onSelectEnv={handleSelectEnv}
          getEnvToken={getEnvToken}
        />
      )}
    </div>
  );
}
