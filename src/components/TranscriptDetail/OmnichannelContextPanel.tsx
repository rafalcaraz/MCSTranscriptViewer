import { useState } from "react";
import type { OmnichannelContext } from "../../types/transcript";
import { buildRecordWebApiUrl } from "../../utils/dataverseEnvUrl";

interface OmnichannelContextPanelProps {
  context: OmnichannelContext;
}

/**
 * Card that surfaces the D365 Omnichannel session context attached to LCW
 * (Live Chat Widget) transcripts. Renders the human-relevant fields up
 * front (browser/device/locale + a deep link to the work item) and exposes
 * the raw msdyn_* payload behind a toggle for advanced inspection.
 */
export function OmnichannelContextPanel({ context }: OmnichannelContextPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const workItemUrl = context.liveWorkItemId
    ? buildRecordWebApiUrl("msdyn_ocliveworkitems", context.liveWorkItemId)
    : null;

  const summary = [context.browser, context.os, context.device]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="omni-panel" role="region" aria-label="D365 Omnichannel context">
      <button
        type="button"
        className="omni-panel-header"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <span className="omni-panel-icon" aria-hidden="true">🌐</span>
        <span className="omni-panel-title">
          <strong>D365 Omnichannel</strong> session
        </span>
        {summary && <span className="omni-panel-summary">{summary}</span>}
        <span className="handoff-callout-chevron">{collapsed ? "▸" : "▾"}</span>
      </button>
      {!collapsed && (
        <div className="omni-panel-body">
          <dl className="omni-panel-fields">
            {context.liveWorkItemId && (
              <>
                <dt>Work item</dt>
                <dd>
                  {workItemUrl ? (
                    <a href={workItemUrl} target="_blank" rel="noopener noreferrer" title="Open in Dataverse Web API">
                      {context.liveWorkItemId}
                    </a>
                  ) : (
                    <code>{context.liveWorkItemId}</code>
                  )}
                </dd>
              </>
            )}
            {context.sessionId && (
              <>
                <dt>Session</dt>
                <dd><code>{context.sessionId}</code></dd>
              </>
            )}
            {context.workstreamId && (
              <>
                <dt>Workstream</dt>
                <dd><code>{context.workstreamId}</code></dd>
              </>
            )}
            {context.locale && (
              <>
                <dt>Locale</dt>
                <dd>{context.locale}</dd>
              </>
            )}
            {context.linkedRecord && (
              <>
                <dt>Linked record</dt>
                <dd>
                  <code title={context.linkedRecord.recordId}>{context.linkedRecord.primaryDisplayValue}</code>
                </dd>
              </>
            )}
          </dl>
          <button
            type="button"
            className="omni-panel-raw-toggle"
            onClick={() => setShowRaw((s) => !s)}
          >
            {showRaw ? "Hide" : "Show"} raw msdyn_* payload
          </button>
          {showRaw && (
            <pre className="handoff-callout-json">
              {JSON.stringify(context.raw, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
