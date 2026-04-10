import type { ParsedTranscript } from "../../types/transcript";
import { formatDuration } from "../../utils/parseTranscript";

const outcomeBadgeClass: Record<string, string> = {
  Resolved: "badge-success",
  Abandoned: "badge-warning",
  Escalated: "badge-danger",
};

interface AnalyticsSummaryProps {
  transcripts: ParsedTranscript[];
}

export function AnalyticsSummary({ transcripts }: AnalyticsSummaryProps) {
  const totalConversations = transcripts.length;
  const totalTurns = transcripts.reduce((sum, t) => sum + t.turnCount, 0);
  const avgTurns = totalConversations > 0 ? (totalTurns / totalConversations).toFixed(1) : "0";
  const totalDuration = transcripts.reduce((sum, t) => sum + (t.totalDurationSeconds ?? 0), 0);
  const avgDuration = totalConversations > 0 ? Math.round(totalDuration / totalConversations) : 0;

  const outcomes = transcripts.reduce<Record<string, number>>((acc, t) => {
    const o = t.globalOutcome ?? "Unknown";
    acc[o] = (acc[o] ?? 0) + 1;
    return acc;
  }, {});

  const channels = transcripts.reduce<Record<string, number>>((acc, t) => {
    const c = t.channelId ?? "Unknown";
    acc[c] = (acc[c] ?? 0) + 1;
    return acc;
  }, {});

  const totalToolCalls = transcripts.reduce((sum, t) => sum + t.planSteps.length, 0);

  return (
    <div className="analytics-page">
      <h1>Analytics Summary</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="big-num">{totalConversations}</div>
          <div className="stat-label">Total Conversations</div>
        </div>
        <div className="stat-card">
          <div className="big-num">{avgTurns}</div>
          <div className="stat-label">Avg Turns / Conversation</div>
        </div>
        <div className="stat-card">
          <div className="big-num">{formatDuration(avgDuration)}</div>
          <div className="stat-label">Avg Duration</div>
        </div>
        <div className="stat-card">
          <div className="big-num">{totalToolCalls}</div>
          <div className="stat-label">Total Tool Calls</div>
        </div>
      </div>

      <div className="analytics-section">
        <h2>Outcomes</h2>
        <div className="badge-row">
          {Object.entries(outcomes).map(([outcome, count]) => (
            <span key={outcome} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className={`badge ${outcomeBadgeClass[outcome] ?? "badge-info"}`}>{outcome}</span>
              <span className="count">{count}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="analytics-section">
        <h2>Channels</h2>
        <div className="badge-row">
          {Object.entries(channels).map(([channel, count]) => (
            <span key={channel} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="badge badge-outline">{channel}</span>
              <span className="count">{count}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
