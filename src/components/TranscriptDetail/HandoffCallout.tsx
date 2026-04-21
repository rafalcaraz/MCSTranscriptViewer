import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { HandoffEvent } from "../../types/transcript";
import { formatTimestamp } from "../../utils/parseTranscript";

interface HandoffCalloutProps {
  handoff: HandoffEvent;
}

export function HandoffCallout({ handoff }: HandoffCalloutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { provider, eventName, value, isValueString, isValueStructured, timestamp } = handoff;

  const renderBody = () => {
    if (value === null || value === undefined || value === "") {
      return <div className="handoff-callout-empty">(no context payload)</div>;
    }
    if (isValueString) {
      return (
        <div className="handoff-callout-text">
          <Markdown remarkPlugins={[remarkGfm]}>{value as string}</Markdown>
        </div>
      );
    }
    if (isValueStructured) {
      return (
        <pre className="handoff-callout-json">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }
    return <div className="handoff-callout-primitive">{String(value)}</div>;
  };

  return (
    <div className="handoff-callout" role="note" aria-label={`Handoff to ${provider}`}>
      <button
        type="button"
        className="handoff-callout-header"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <span className="handoff-callout-icon" aria-hidden="true">🚪</span>
        <span className="handoff-callout-title">
          Handoff to <strong>{provider}</strong>
        </span>
        <span className="handoff-callout-event" title={eventName}>{eventName}</span>
        <span className="handoff-callout-time">{formatTimestamp(timestamp)}</span>
        <span className="handoff-callout-chevron">{collapsed ? "▸" : "▾"}</span>
      </button>
      {!collapsed && <div className="handoff-callout-body">{renderBody()}</div>}
    </div>
  );
}
