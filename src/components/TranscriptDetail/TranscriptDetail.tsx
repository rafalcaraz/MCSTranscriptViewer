import { useState } from "react";
import type { ParsedTranscript } from "../../types/transcript";
import { GeneralInfo } from "./GeneralInfo";
import { MessageTimeline } from "./MessageTimeline";
import { DebugPanel } from "./DebugPanel";
import { exportTranscriptHTML } from "../../utils/exportTranscript";

interface TranscriptDetailProps {
  transcript: ParsedTranscript;
  onBack: () => void;
  onOpenTranscript?: (transcriptId: string) => void;
}

export function TranscriptDetail({ transcript, onBack, onOpenTranscript }: TranscriptDetailProps) {
  // The ID of the user message currently selected for sync
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);

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
        <span className="conversation-id">{transcript.conversationtranscriptid}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="export-btn"
            onClick={() => exportTranscriptHTML(transcript)}
            title="Export conversation as HTML"
          >
            📥 Export
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
