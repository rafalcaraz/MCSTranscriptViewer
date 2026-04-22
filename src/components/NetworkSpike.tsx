import { useState } from "react";

/**
 * 🧪 NetworkSpike — diagnostic panel that fires raw `fetch()` calls from the
 * Code App against several public URLs to verify whether:
 *   1. The Power Apps host iframe CSP allows the request to leave at all.
 *   2. The destination returns CORS headers we can actually read.
 *   3. Power Platform DLP can intercept (it should NOT — DLP enforces at the
 *      connector layer, not at the browser-fetch layer).
 *
 * Tap each row to fire one test. "All" fires them in sequence.
 *
 * NOTE: This is a temporary spike behind the gear/🧪 button. Strip before
 * shipping to main.
 */

type TestStatus = "idle" | "running" | "ok" | "blocked-cors" | "blocked-csp" | "network-error" | "non-2xx";

interface TestResult {
  status: TestStatus;
  detail: string;
  durationMs?: number;
  httpStatus?: number;
}

interface SpikeTarget {
  id: string;
  label: string;
  url: string;
  mode?: RequestMode;
  note: string;
}

const TARGETS: SpikeTarget[] = [
  {
    id: "bing-default",
    label: "www.bing.com (default mode)",
    url: "https://www.bing.com/",
    note: "Non-Microsoft, no CORS — request leaves the browser but response is unreadable. Failing here = CSP blocked it.",
  },
  {
    id: "bing-nocors",
    label: "www.bing.com (no-cors mode)",
    url: "https://www.bing.com/",
    mode: "no-cors",
    note: "Same URL with no-cors. Browser allows opaque response — proves the request actually got sent over the wire.",
  },
  {
    id: "httpbin-cors",
    label: "httpbin.org/get (open CORS)",
    url: "https://httpbin.org/get",
    note: "Public CORS-enabled echo. Should succeed end-to-end if CSP allows non-Microsoft origins.",
  },
  {
    id: "github-api",
    label: "api.github.com (CORS-enabled)",
    url: "https://api.github.com/zen",
    note: "Another CORS-friendly third-party. Useful sanity check.",
  },
  {
    id: "ms-graph-anon",
    label: "graph.microsoft.com (anonymous)",
    url: "https://graph.microsoft.com/v1.0/$metadata",
    note: "Microsoft origin, no token. Will return 401 but proves CSP allows the host.",
  },
  {
    id: "ms-disco",
    label: "globaldisco.crm.dynamics.com (anonymous)",
    url: "https://globaldisco.crm.dynamics.com/api/discovery/v2.0/Instances",
    note: "Dataverse global discovery. Will 401 without token — but a 401 is the smoking gun that the request reached Microsoft, meaning Path 3 is viable.",
  },
];

export function NetworkSpike() {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [running, setRunning] = useState(false);

  async function runOne(target: SpikeTarget) {
    setResults((r) => ({ ...r, [target.id]: { status: "running", detail: "…" } }));
    const start = performance.now();
    try {
      const resp = await fetch(target.url, {
        method: "GET",
        mode: target.mode ?? "cors",
        cache: "no-store",
        credentials: "omit",
      });
      const duration = Math.round(performance.now() - start);
      // Opaque responses (no-cors) report status 0
      if (target.mode === "no-cors") {
        setResults((r) => ({
          ...r,
          [target.id]: {
            status: "ok",
            detail: `opaque response (mode=no-cors). Type=${resp.type}. Request actually went over the wire.`,
            durationMs: duration,
            httpStatus: resp.status,
          },
        }));
      } else if (resp.ok) {
        const body = await resp.text();
        setResults((r) => ({
          ...r,
          [target.id]: {
            status: "ok",
            detail: `HTTP ${resp.status} · ${body.length} bytes · first chars: ${JSON.stringify(body.slice(0, 80))}`,
            durationMs: duration,
            httpStatus: resp.status,
          },
        }));
      } else {
        setResults((r) => ({
          ...r,
          [target.id]: {
            status: "non-2xx",
            detail: `HTTP ${resp.status} ${resp.statusText} — but the request reached the server, so CSP did NOT block it.`,
            durationMs: duration,
            httpStatus: resp.status,
          },
        }));
      }
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      const message = err instanceof Error ? err.message : String(err);
      // TypeError: Failed to fetch is the catch-all for CORS-blocked, CSP-blocked, network failure
      // We can't distinguish them programmatically — devtools console is the source of truth.
      const looksLikeBlock = /failed to fetch|networkerror|blocked by/i.test(message);
      setResults((r) => ({
        ...r,
        [target.id]: {
          status: looksLikeBlock ? "blocked-cors" : "network-error",
          detail: `${message} — check devtools console: a CSP violation will show "Refused to connect", a CORS error will show "blocked by CORS policy", a DLP/network block typically shows neither and just fails.`,
          durationMs: duration,
        },
      }));
    }
  }

  async function runAll() {
    setRunning(true);
    for (const t of TARGETS) {
      await runOne(t);
    }
    setRunning(false);
  }

  if (!open) {
    return (
      <button
        className="theme-toggle"
        onClick={() => setOpen(true)}
        title="Open network/DLP spike panel"
        style={{ marginRight: 4 }}
      >
        🧪
      </button>
    );
  }

  return (
    <div className="spike-overlay" role="dialog" aria-label="Network spike">
      <div className="spike-card">
        <div className="spike-header">
          <strong>🧪 Network / DLP spike</strong>
          <span style={{ flex: 1, marginLeft: 12, fontSize: 12, opacity: 0.7 }}>
            Tests raw <code>fetch()</code> from the Code App. Open browser devtools → Console + Network for the real story.
          </span>
          <button className="spike-btn" onClick={runAll} disabled={running}>
            {running ? "Running…" : "Run all"}
          </button>
          <button className="spike-btn" onClick={() => setOpen(false)}>Close</button>
        </div>
        <div className="spike-body">
          {TARGETS.map((t) => {
            const r = results[t.id];
            const cls = r ? `spike-result spike-${r.status}` : "spike-result spike-idle";
            return (
              <div key={t.id} className={cls}>
                <div className="spike-row-top">
                  <button className="spike-btn-mini" onClick={() => runOne(t)} disabled={running}>
                    Run
                  </button>
                  <span className="spike-label">{t.label}</span>
                  <span className="spike-status">
                    {r ? r.status : "—"}
                    {r?.durationMs != null ? ` · ${r.durationMs}ms` : ""}
                  </span>
                </div>
                <div className="spike-url"><code>{t.url}</code></div>
                <div className="spike-note">{t.note}</div>
                {r && r.detail && <div className="spike-detail">{r.detail}</div>}
              </div>
            );
          })}
        </div>
        <div className="spike-footer">
          <strong>What to look for:</strong>
          <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
            <li>If <em>none</em> of the non-Microsoft fetches succeed → host iframe CSP is blocking them. Look in devtools for <code>Refused to connect</code>.</li>
            <li>If the <em>Microsoft</em> ones succeed (even with 401) but third-parties are blocked → CSP is gating by origin allowlist.</li>
            <li>If <em>everything</em> succeeds → no CSP gate, governance falls entirely on DLP / network policy / Conditional Access at the destination.</li>
            <li>To test DLP: have an admin add a DLP policy that blocks the HTTP connector for this env and re-run. <strong>Prediction:</strong> these raw fetches will keep working — DLP only enforces at the connector layer.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
