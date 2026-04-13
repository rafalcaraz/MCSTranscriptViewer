import { useMemo } from "react";
import type { ParsedTranscript } from "../../types/transcript";
import { formatDuration } from "../../utils/parseTranscript";
import { useBotLookup, useUserDisplayNames } from "../../hooks/useLookups";

const outcomeBadgeClass: Record<string, string> = {
  Resolved: "badge-success",
  Abandoned: "badge-warning",
  Escalated: "badge-danger",
};

interface GeneralInfoProps {
  transcript: ParsedTranscript;
}

export function GeneralInfo({ transcript }: GeneralInfoProps) {
  const { getDisplayName } = useBotLookup();

  const userIds = useMemo(
    () => transcript.userAadObjectId ? [transcript.userAadObjectId] : [],
    [transcript.userAadObjectId]
  );
  const { getDisplayName: getUserName } = useUserDisplayNames(userIds);

  const stats = [
    { label: "Agent", value: getDisplayName(transcript.metadata.botName, transcript.metadata.botId) || "—" },
    { label: "User", value: getUserName(transcript.userAadObjectId) },
    { label: "Turns", value: String(transcript.turnCount) },
    {
      label: "Duration",
      value: transcript.totalDurationSeconds != null
        ? formatDuration(transcript.totalDurationSeconds)
        : "—",
    },
    {
      label: "Conversation Start",
      value: new Date(transcript.conversationstarttime).toLocaleString(),
    },
    { label: "Channel", value: transcript.channelId ?? "—" },
    { label: "Tools Available", value: String(transcript.availableTools.length) },
    { label: "Plan Steps", value: String(transcript.planSteps.length) },
  ];

  return (
    <div className="general-info">
      <div className="general-info-header">
        <h2>General Information</h2>
        <span className={`badge ${outcomeBadgeClass[transcript.globalOutcome ?? ""] ?? "badge-info"}`}>
          {transcript.globalOutcome ?? "Unknown"}
          {transcript.globalOutcomeReason ? ` (${transcript.globalOutcomeReason})` : ""}
        </span>
      </div>
      <div className="general-info-grid">
        {stats.map((s) => (
          <div key={s.label} className="stat-item">
            <label>{s.label}</label>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>
      {transcript.triggerInfo && (
        <div className="trigger-info">
          <div className="trigger-info-label">⚡ Flow Trigger</div>
          <div className="trigger-info-grid">
            <span className="trigger-chip">🔗 {transcript.triggerInfo.triggerDisplayName || "Unknown trigger"}</span>
            <span className="trigger-chip">📎 {transcript.triggerInfo.connectorDisplayName || "Unknown connector"}</span>
            {transcript.triggerInfo.flowRunId && (
              <span className="trigger-chip" style={{ fontFamily: "monospace", fontSize: 11 }}>
                🔄 Run: {transcript.triggerInfo.flowRunId.slice(0, 20)}…
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
