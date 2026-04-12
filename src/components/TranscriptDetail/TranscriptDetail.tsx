import { useState, useMemo } from "react";
import type { ParsedTranscript, TranscriptType } from "../../types/transcript";
import { GeneralInfo } from "./GeneralInfo";
import { MessageTimeline } from "./MessageTimeline";
import { DebugPanel } from "./DebugPanel";
import { exportTranscriptPDF, exportTranscriptHTML } from "../../utils/exportTranscript";
import { useBotLookup, useUserDisplayNames } from "../../hooks/useLookups";

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
}

export function TranscriptDetail({ transcript, onBack, onOpenTranscript }: TranscriptDetailProps) {
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);

  // Resolve display names for export
  const { getDisplayName: getBotName } = useBotLookup();
  const userIds = useMemo(
    () => transcript.userAadObjectId ? [transcript.userAadObjectId] : [],
    [transcript.userAadObjectId]
  );
  const { getDisplayName: getUserName } = useUserDisplayNames(userIds);

  const agentDisplayName = getBotName(transcript.metadata.botName, transcript.metadata.botId) || undefined;
  const userDisplayName = getUserName(transcript.userAadObjectId) || undefined;

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
        <span className="conversation-id">{transcript.conversationtranscriptid}</span>
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

      <GeneralInfo transcript={transcript} />

      <div className="detail-panels">
        <DebugPanel
          planSteps={transcript.planSteps}
          availableTools={transcript.availableTools}
          mcpServerInit={transcript.mcpServerInit}
          knowledgeSearches={transcript.knowledgeSearches}
          knowledgeResponses={transcript.knowledgeResponses}
          knowledgeTrace={transcript.knowledgeTrace}
          advancedEvents={transcript.advancedEvents}
          activeMessageId={activeMessageId}
          onStepSelect={handleStepSelect}
        />
        <MessageTimeline
          messages={transcript.messages}
          reactions={transcript.reactions}
          activeMessageId={activeMessageId}
          onMessageSelect={handleMessageSelect}
          onOpenTranscript={onOpenTranscript}
        />
      </div>
    </div>
  );
}
