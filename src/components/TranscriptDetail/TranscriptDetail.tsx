import { useState, useMemo } from "react";
import type { ParsedTranscript, TranscriptType } from "../../types/transcript";
import { GeneralInfo } from "./GeneralInfo";
import { MessageTimeline } from "./MessageTimeline";
import { DebugPanel } from "./DebugPanel";
import { OmnichannelContextPanel } from "./OmnichannelContextPanel";
import { AuthenticatedVisitorPanel } from "./AuthenticatedVisitorPanel";
import { VoiceContextPanel } from "./VoiceContextPanel";
import { exportTranscriptPDF, exportTranscriptHTML } from "../../utils/exportTranscript";
import { useBotLookup, useUserDisplayNames } from "../../hooks/useLookups";
import { findChildTranscript, findParentTranscript } from "../../utils/findRelatedTranscripts";
import { buildRecordWebApiUrl } from "../../utils/dataverseEnvUrl";

const TYPE_BADGE: Record<TranscriptType, { icon: string; label: string }> = {
  chat: { icon: "💬", label: "Chat" },
  autonomous: { icon: "⚡", label: "Autonomous Run" },
  evaluation: { icon: "🧪", label: "Evaluation" },
  design: { icon: "🛠️", label: "Design Mode" },
};

interface TranscriptDetailProps {
  transcript: ParsedTranscript;
  onBack: () => void;
  onOpenTranscript?: (transcriptId: string) => void;
  /** All transcripts currently loaded in the list — used to resolve cross-transcript navigation
   *  (parent ↔ child connected-agent links). Pass empty/omit to disable navigation. */
  allLoadedTranscripts?: ParsedTranscript[];
}

export function TranscriptDetail({ transcript, onBack, onOpenTranscript, allLoadedTranscripts = [] }: TranscriptDetailProps) {
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const transcriptId = transcript.conversationtranscriptid;
  const webApiUrl = buildRecordWebApiUrl("conversationtranscripts", transcriptId);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(transcriptId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be blocked in some hosting contexts
    }
  };

  // Resolve display names for export
  const { getDisplayName: getBotName } = useBotLookup();
  const userIds = useMemo(
    () => transcript.userAadObjectId ? [transcript.userAadObjectId] : [],
    [transcript.userAadObjectId]
  );
  const { getDisplayName: getUserName } = useUserDisplayNames(userIds);

  const agentDisplayName = getBotName(transcript.metadata.botName, transcript.metadata.botId) || undefined;
  const userDisplayName = getUserName(transcript.userAadObjectId) || undefined;

  // Cross-transcript matching for connected-agent navigation.
  // - parentMatch: this transcript IS the child side; show "Open parent" link in the header.
  // - childLookup: this transcript IS the parent; per-invocation lookup powers the "View child's side" link.
  const parentMatch = useMemo(
    () => findParentTranscript(transcript, allLoadedTranscripts),
    [transcript, allLoadedTranscripts]
  );
  const childLookup = useMemo(() => {
    const map = new Map<string, ParsedTranscript>();
    for (const inv of transcript.connectedAgentInvocations) {
      const key = `${inv.childSchemaName}__${inv.startTimestamp}`;
      const match = findChildTranscript(transcript, inv, allLoadedTranscripts);
      if (match) map.set(key, match);
    }
    return map;
  }, [transcript, allLoadedTranscripts]);

  // Click a message → highlight linked plan steps
  const handleMessageSelect = (messageId: string) => {
    setActiveMessageId((prev) => (prev === messageId ? null : messageId));
  };

  // Click a plan step → highlight linked message
  const handleStepSelect = (replyToId: string | undefined) => {
    if (!replyToId) return;
    setActiveMessageId((prev) => (prev === replyToId ? null : replyToId));
  };

  return (
    <div className="detail-root">
      <div className="detail-topbar">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <strong>Transcript Review</strong>
        <span className={`type-badge ${transcript.transcriptType}`}>
          {TYPE_BADGE[transcript.transcriptType].icon} {TYPE_BADGE[transcript.transcriptType].label}
        </span>
        <span className="conversation-id">
          {webApiUrl ? (
            <a
              href={webApiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="conversation-id-link"
              title={`Open in Dataverse Web API: ${webApiUrl}`}
            >
              {transcriptId}
            </a>
          ) : (
            <span title="Open any transcript once to enable the Web API link">{transcriptId}</span>
          )}
          <button
            type="button"
            className="copy-id-btn"
            onClick={handleCopyId}
            title="Copy transcript ID to clipboard"
            aria-label="Copy transcript ID"
          >
            {copied ? "✓" : "📋"}
          </button>
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="export-btn"
            onClick={() => exportTranscriptPDF(transcript, agentDisplayName, userDisplayName)}
            title="Export conversation as PDF (opens print dialog)"
          >
            📥 Export PDF
          </button>
          <button
            className="back-btn"
            style={{ fontSize: 12 }}
            onClick={() => exportTranscriptHTML(transcript, agentDisplayName, userDisplayName)}
            title="Export conversation as HTML file"
          >
            📄 HTML
          </button>
          {activeMessageId && (
            <button
              className="back-btn"
              style={{ fontSize: 12 }}
              onClick={() => setActiveMessageId(null)}
            >
              ✕ Clear Selection
            </button>
          )}
        </div>
      </div>

      {parentMatch && onOpenTranscript && (
        <div className="connected-agent-banner">
          <span className="connected-agent-banner-icon">🔗</span>
          <span>
            This is a <strong>connected agent session</strong> — the child-side view of a conversation
            invoked by <strong>{parentMatch.invocation.parentDisplayName}</strong>.
          </span>
          <button
            className="connected-agent-banner-link"
            onClick={() => onOpenTranscript(parentMatch.parent.conversationtranscriptid)}
            title="Switch to the parent agent's transcript"
          >
            Open parent conversation ↑
          </button>
        </div>
      )}

      <GeneralInfo transcript={transcript} />

      {(transcript.omnichannelContext || transcript.authenticatedVisitor || transcript.voiceContext) && (
        <div className="omni-row">
          {transcript.voiceContext && (
            <VoiceContextPanel context={transcript.voiceContext} />
          )}
          {transcript.omnichannelContext && (
            <OmnichannelContextPanel context={transcript.omnichannelContext} />
          )}
          {transcript.authenticatedVisitor && (
            <AuthenticatedVisitorPanel visitor={transcript.authenticatedVisitor} />
          )}
        </div>
      )}

      <div className="detail-panels">
        <DebugPanel
          planSteps={transcript.planSteps}
          availableTools={transcript.availableTools}
          mcpServerInit={transcript.mcpServerInit}
          knowledgeSearches={transcript.knowledgeSearches}
          knowledgeResponses={transcript.knowledgeResponses}
          knowledgeTrace={transcript.knowledgeTrace}
          advancedEvents={transcript.advancedEvents}
          connectedAgentInvocations={transcript.connectedAgentInvocations}
          parentAgentDisplayName={transcript.parentAgentDisplayName}
          activeMessageId={activeMessageId}
          onStepSelect={handleStepSelect}
          childTranscriptLookup={childLookup}
          onOpenTranscript={onOpenTranscript}
        />
        <MessageTimeline
          messages={transcript.messages}
          reactions={transcript.reactions}
          handoffs={transcript.handoffs}
          activeMessageId={activeMessageId}
          onMessageSelect={handleMessageSelect}
          onOpenTranscript={onOpenTranscript}
        />
      </div>
    </div>
  );
}
