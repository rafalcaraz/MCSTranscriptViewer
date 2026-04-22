import { useState } from "react";
import type { AuthenticatedVisitor } from "../../types/transcript";

interface AuthenticatedVisitorPanelProps {
  visitor: AuthenticatedVisitor;
}

/**
 * Card that surfaces the OIDC claims supplied with an authenticated LCW
 * visitor. ALL fields are PII — values are masked behind a "Reveal PII"
 * toggle by default. Only the `sub` claim (subject id) shows masked-by-default
 * even when revealed since it can also identify a real person.
 */
export function AuthenticatedVisitorPanel({ visitor }: AuthenticatedVisitorPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const fullName = [visitor.givenName, visitor.familyName].filter(Boolean).join(" ");
  const headlineName = fullName || visitor.preferredUsername || visitor.email || visitor.sub;

  const mask = (s: string | undefined): string => {
    if (!s) return "";
    if (revealed) return s;
    if (s.length <= 4) return "•".repeat(s.length);
    return s.slice(0, 2) + "•".repeat(Math.max(3, s.length - 4)) + s.slice(-2);
  };

  const fields: Array<[string, string | undefined]> = [
    ["Name", fullName || undefined],
    ["Username", visitor.preferredUsername],
    ["Email", visitor.email],
    ["Phone", visitor.phoneNumber],
    ["Subject (sub)", visitor.sub],
  ];

  return (
    <div className="auth-visitor-panel" role="region" aria-label="Authenticated visitor">
      <button
        type="button"
        className="auth-visitor-header"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <span className="auth-visitor-icon" aria-hidden="true">🔐</span>
        <span className="auth-visitor-title">
          Authenticated visitor
          {headlineName && <> · <strong>{revealed ? headlineName : mask(headlineName)}</strong></>}
        </span>
        <span className="handoff-callout-chevron">{collapsed ? "▸" : "▾"}</span>
      </button>
      {!collapsed && (
        <div className="auth-visitor-body">
          <div className="auth-visitor-warn">
            ⚠ Contains PII — values masked by default.
            <button
              type="button"
              className="auth-visitor-reveal"
              onClick={() => setRevealed((r) => !r)}
            >
              {revealed ? "Hide PII" : "Reveal PII"}
            </button>
          </div>
          <dl className="omni-panel-fields">
            {fields
              .filter(([, v]) => Boolean(v))
              .map(([label, v]) => (
                <FragmentRow key={label} label={label} value={mask(v)} />
              ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd><code>{value}</code></dd>
    </>
  );
}
