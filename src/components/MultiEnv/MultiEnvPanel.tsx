import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MultiEnvWorkspace, type EnvOption } from "./MultiEnvWorkspace";
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
    return window.location.origin + "/auth-redirect.html";
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
    const url = new URL(window.location.origin + "/auth-redirect.html");
    url.searchParams.set("start", "1");
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

  const signOut = () => {
    setAccessToken("");
    refreshTokenRef.current = "";
    envTokenCache.current.clear();
    setAuthedTenantId("");
    setAuthedClientId("");
    setEnvs([]);
    setSelectedEnvUrl("");
    localStorage.removeItem(LS_SELECTED_ENV);
    setStatus({ kind: "idle" });
  };

  // Returns an env-scoped access token, refreshing via the captured refresh_token
  // when needed. Cached per env so successive Web API calls don't re-hit /token.
  const getEnvToken = useCallback(async (envApiUrl: string): Promise<string> => {
    const cached = envTokenCache.current.get(envApiUrl);
    // Refresh 60s before expiry to avoid races.
    if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;

    const refreshToken = refreshTokenRef.current;
    if (!refreshToken || !authedTenantId || !authedClientId) {
      throw new Error("Not signed in (no refresh token captured). Sign out and back in.");
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
      const msg = json.error_description || json.error || `Token endpoint returned ${resp.status}`;
      throw new Error(`Token refresh failed: ${msg}`);
    }
    if (json.refresh_token) refreshTokenRef.current = json.refresh_token;
    const expiresAt = Date.now() + (json.expires_in ?? 3600) * 1000;
    envTokenCache.current.set(envApiUrl, { token: json.access_token, expiresAt });
    return json.access_token;
  }, [authedTenantId, authedClientId]);

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
      <header className="me-header">
        <h2>Multi-Env (preview)</h2>
        <p className="me-sub">
          Sign in with an Entra App Registration to discover Dataverse environments you have access to. Pick one, then explore its agents and transcripts. Read-only — your normal Transcripts tab is unaffected.
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
            <div>Signed in.{status.kind === "loading-envs" && " Loading environments…"}</div>
            <div className="me-actions">
              <button className="me-btn" onClick={() => void loadEnvs(accessToken)} disabled={status.kind === "loading-envs"}>
                {status.kind === "loading-envs" ? "Loading…" : "Refresh environments"}
              </button>
              <button className="me-btn ghost" onClick={signOut}>Sign out</button>
            </div>
          </div>
        )}
      </section>

      {status.kind === "error" && (
        <section className="me-card error">
          <strong>Error:</strong> {status.message}
        </section>
      )}

      {accessToken && envs.length > 0 && (
        <MultiEnvWorkspace
          envs={envOptions}
          selectedEnvUrl={selectedEnvUrl}
          onSelectEnv={handleSelectEnv}
          getEnvToken={getEnvToken}
        />
      )}
    </div>
  );
}
