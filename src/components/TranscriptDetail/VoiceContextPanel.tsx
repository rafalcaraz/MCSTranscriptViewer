import { useState } from "react";
import type { VoiceContext } from "../../types/transcript";

interface VoiceContextPanelProps {
  context: VoiceContext;
}

/**
 * Card that surfaces D365 Voice Channel session context — the IVR + telephony
 * state for a phone call routed through Microsoft's Nuance speech stack to a
 * Copilot Studio agent. Mirrors OmnichannelContextPanel for visual consistency
 * and reuses the same `omni-panel` CSS class names so dark/light themes apply
 * uniformly.
 *
 * Phone numbers are PII; render them in a code element with the value as the
 * tooltip so they aren't picked up by accidental selection of surrounding text.
 */
export function VoiceContextPanel({ context }: VoiceContextPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const summary = [
    context.channelSpecifier,
    context.locale,
    context.endConversationReason,
  ]
    .filter(Boolean)
    .join(" · ");

  const primaryVoice = context.voices
    ? Object.values(context.voices).find((v) => v.voiceName)?.voiceName
    : undefined;

  return (
    <div className="omni-panel" role="region" aria-label="D365 Voice Channel context">
      <button
        type="button"
        className="omni-panel-header"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <span className="omni-panel-icon" aria-hidden="true">📞</span>
        <span className="omni-panel-title">
          <strong>D365 Voice</strong> session
        </span>
        {summary && <span className="omni-panel-summary">{summary}</span>}
        <span className="handoff-callout-chevron">{collapsed ? "▸" : "▾"}</span>
      </button>
      {!collapsed && (
        <div className="omni-panel-body">
          <dl className="omni-panel-fields">
            {context.organizationPhone && (
              <>
                <dt>Organization</dt>
                <dd><code>{context.organizationPhone}</code></dd>
              </>
            )}
            {context.customerPhone && (
              <>
                <dt>Caller</dt>
                <dd>
                  <code title="Caller phone number — PII">{context.customerPhone}</code>
                </dd>
              </>
            )}
            {context.liveWorkItemId && (
              <>
                <dt>Work item</dt>
                <dd><code>{context.liveWorkItemId}</code></dd>
              </>
            )}
            {context.sessionId && (
              <>
                <dt>Session</dt>
                <dd><code>{context.sessionId}</code></dd>
              </>
            )}
            {context.locale && (
              <>
                <dt>Locale</dt>
                <dd>{context.locale}</dd>
              </>
            )}
            {primaryVoice && (
              <>
                <dt>TTS voice</dt>
                <dd><code>{primaryVoice}</code></dd>
              </>
            )}
            {context.nuanceSessionId && (
              <>
                <dt>Nuance session</dt>
                <dd><code>{context.nuanceSessionId}</code></dd>
              </>
            )}
            {context.endConversationReason && (
              <>
                <dt>Ended</dt>
                <dd>{context.endConversationReason}</dd>
              </>
            )}
          </dl>
          <button
            type="button"
            className="omni-panel-raw-toggle"
            onClick={() => setShowRaw((s) => !s)}
          >
            {showRaw ? "Hide" : "Show"} raw payload
          </button>
          {showRaw && (
            <pre className="handoff-callout-json">
              {JSON.stringify({ value: context.raw, channelData: context.rawChannelData }, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
