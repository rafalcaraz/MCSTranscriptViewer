import { useEffect, useMemo, useState } from "react";
import {
  PublicClientApplication,
  type AccountInfo,
  type Configuration,
  InteractionRequiredAuthError,
} from "@azure/msal-browser";
import "./MultiEnvPanel.css";

const LS_CLIENT_ID = "multiEnv.clientId";
const LS_TENANT_ID = "multiEnv.tenantId";
const LS_SELECTED_ENV = "multiEnv.selectedEnvUrl";

const GLOBAL_DISCO_URL = "https://globaldisco.crm.dynamics.com/api/discovery/v2.0/Instances";
const GLOBAL_DISCO_SCOPE = "https://globaldisco.crm.dynamics.com/.default";

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

export function MultiEnvPanel() {
  const [clientId, setClientId] = useState<string>(() => localStorage.getItem(LS_CLIENT_ID) ?? "");
  const [tenantId, setTenantId] = useState<string>(() => localStorage.getItem(LS_TENANT_ID) ?? "organizations");
  const [pca, setPca] = useState<PublicClientApplication | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [envs, setEnvs] = useState<DiscoveryInstance[]>([]);
  const [selectedEnvUrl, setSelectedEnvUrl] = useState<string>(() => localStorage.getItem(LS_SELECTED_ENV) ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const redirectUri = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin + window.location.pathname;
  }, []);

  useEffect(() => {
    if (!clientId.trim()) {
      setPca(null);
      return;
    }
    const config: Configuration = {
      auth: {
        clientId: clientId.trim(),
        authority: `https://login.microsoftonline.com/${tenantId.trim() || "organizations"}`,
        redirectUri,
      },
      cache: {
        cacheLocation: "localStorage",
      },
    };
    const instance = new PublicClientApplication(config);
    instance
      .initialize()
      .then(() => {
        setPca(instance);
        const accts = instance.getAllAccounts();
        if (accts.length > 0) setAccount(accts[0]);
      })
      .catch((e) => setStatus({ kind: "error", message: `MSAL init failed: ${e?.message ?? e}` }));
  }, [clientId, tenantId, redirectUri]);

  const persistConfig = () => {
    localStorage.setItem(LS_CLIENT_ID, clientId.trim());
    localStorage.setItem(LS_TENANT_ID, tenantId.trim() || "organizations");
  };

  const signIn = async () => {
    if (!pca) {
      setStatus({ kind: "error", message: "Enter a Client ID first." });
      return;
    }
    persistConfig();
    setStatus({ kind: "signing-in" });
    try {
      const result = await pca.loginPopup({
        scopes: [GLOBAL_DISCO_SCOPE],
        prompt: "select_account",
      });
      setAccount(result.account);
      pca.setActiveAccount(result.account);
      await loadEnvs(pca, result.account);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setStatus({ kind: "error", message: `Sign-in failed: ${err.message ?? String(e)}` });
    }
  };

  const signOut = async () => {
    if (!pca) return;
    try {
      await pca.logoutPopup();
    } catch {
      /* ignore */
    }
    setAccount(null);
    setEnvs([]);
    setStatus({ kind: "idle" });
  };

  const loadEnvs = async (instance: PublicClientApplication, acct: AccountInfo) => {
    setStatus({ kind: "loading-envs" });
    try {
      const tokenResp = await instance
        .acquireTokenSilent({ account: acct, scopes: [GLOBAL_DISCO_SCOPE] })
        .catch(async (err) => {
          if (err instanceof InteractionRequiredAuthError) {
            return instance.acquireTokenPopup({ account: acct, scopes: [GLOBAL_DISCO_SCOPE] });
          }
          throw err;
        });
      const resp = await fetch(GLOBAL_DISCO_URL, {
        headers: { Authorization: `Bearer ${tokenResp.accessToken}`, Accept: "application/json" },
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

  const selectedEnv = envs.find((e) => e.ApiUrl === selectedEnvUrl);

  const handleSelectEnv = (url: string) => {
    setSelectedEnvUrl(url);
    localStorage.setItem(LS_SELECTED_ENV, url);
  };

  return (
    <div className="multi-env-panel">
      <header className="me-header">
        <h2>Multi-Env (preview)</h2>
        <p className="me-sub">
          Sign in with an Entra App Registration to discover Dataverse environments you have access to. This is read-only and fully additive — your normal Transcripts tab is unaffected.
        </p>
      </header>

      <section className="me-card">
        <h3>1. Configure</h3>
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
          <label>Redirect URI (register this in your App Registration)</label>
          <input type="text" value={redirectUri} readOnly />
        </div>
        <div className="me-hint">
          Required API permissions: <code>Dynamics CRM &gt; user_impersonation</code> (delegated). Admin consent recommended.
        </div>
      </section>

      <section className="me-card">
        <h3>2. Sign in</h3>
        {!account ? (
          <button className="me-btn primary" onClick={signIn} disabled={!pca || status.kind === "signing-in"}>
            {status.kind === "signing-in" ? "Signing in…" : "Sign in with Microsoft"}
          </button>
        ) : (
          <div className="me-account">
            <div>
              Signed in as <strong>{account.username}</strong>
            </div>
            <div className="me-actions">
              <button
                className="me-btn"
                onClick={() => pca && account && loadEnvs(pca, account)}
                disabled={status.kind === "loading-envs"}
              >
                {status.kind === "loading-envs" ? "Loading…" : "Refresh environments"}
              </button>
              <button className="me-btn ghost" onClick={signOut}>
                Sign out
              </button>
            </div>
          </div>
        )}
      </section>

      {status.kind === "error" && (
        <section className="me-card error">
          <strong>Error:</strong> {status.message}
        </section>
      )}

      {envs.length > 0 && (
        <section className="me-card">
          <h3>3. Pick an environment</h3>
          <div className="me-env-list">
            {envs.map((env) => (
              <button
                key={env.EnvironmentId}
                className={`me-env-item ${env.ApiUrl === selectedEnvUrl ? "selected" : ""}`}
                onClick={() => handleSelectEnv(env.ApiUrl)}
              >
                <div className="me-env-name">{env.FriendlyName}</div>
                <div className="me-env-meta">
                  <span className="me-env-region">{env.Region}</span>
                  <span className="me-env-url">{env.ApiUrl}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="me-summary">
            {envs.length} environment{envs.length === 1 ? "" : "s"} discovered.
            {selectedEnv && (
              <>
                {" "}
                Selected: <strong>{selectedEnv.FriendlyName}</strong>
              </>
            )}
          </div>
        </section>
      )}

      {selectedEnv && (
        <section className="me-card">
          <h3>4. Next steps (TBD)</h3>
          <p className="me-sub">
            Auth + discovery proven. Next milestone: query <code>{selectedEnv.ApiUrl}/api/data/v9.2/conversationtranscripts</code> with a token scoped to that env.
          </p>
        </section>
      )}
    </div>
  );
}
