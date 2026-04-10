import { useState } from "react";
import type { Reaction } from "../../types/transcript";
import { formatTimestamp } from "../../utils/parseTranscript";
import { ConversationtranscriptsService } from "../../generated/services/ConversationtranscriptsService";

interface OrphanReactionItemProps {
  reaction: Reaction;
  onOpenTranscript?: (transcriptId: string) => void;
}

interface LookupResult {
  found: boolean;
  transcriptId?: string;
  transcriptStartTime?: string;
  botMessageText?: string;
}

export function OrphanReactionItem({ reaction: r, onOpenTranscript }: OrphanReactionItemProps) {
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<LookupResult | null>(null);

  const handleLookup = async () => {
    setLookupState("loading");
    try {
      // Search for the replyToId in transcript content
      const searchResult = await ConversationtranscriptsService.getAll({
        select: [
          "conversationtranscriptid",
          "conversationstarttime",
          "content",
        ],
        filter: `contains(content,'${r.replyToId}')`,
        maxPageSize: 1,
      });

      const records = searchResult.data ?? [];
      if (records.length > 0) {
        const rec = records[0];
        // Parse the content to find the actual bot message
        let botMessageText = "";
        try {
          const content = JSON.parse(rec.content) as {
            activities: { id?: string; type: string; text?: string; from: { role: number } }[];
          };
          const botMsg = content.activities.find(
            (a) => a.id === r.replyToId && a.type === "message"
          );
          if (botMsg?.text) {
            // Truncate long messages
            botMessageText = botMsg.text.length > 200
              ? botMsg.text.slice(0, 200) + "..."
              : botMsg.text;
          }
        } catch {
          // ignore parse errors
        }

        setResult({
          found: true,
          transcriptId: rec.conversationtranscriptid,
          transcriptStartTime: rec.conversationstarttime,
          botMessageText,
        });
      } else {
        setResult({ found: false });
      }
    } catch (err) {
      console.error("[OrphanLookup] Error:", err);
      setResult({ found: false });
    }
    setLookupState("done");
  };

  return (
    <div className="orphan-reaction-item">
      <div className="orphan-reaction-row">
        <span className={`reaction-badge ${r.reaction}`}>
          {r.reaction === "like" ? "👍" : "👎"}
        </span>
        <span className="orphan-reaction-text">
          {r.feedbackText || (r.reaction === "like" ? "Thumbs up" : "Thumbs down")}
        </span>
        <span className="msg-timestamp">{formatTimestamp(r.timestamp)}</span>
      </div>

      {lookupState === "idle" && (
        <button className="lookup-btn" onClick={handleLookup}>
          🔍 Find original message
        </button>
      )}

      {lookupState === "loading" && (
        <div className="lookup-result loading">Searching transcripts...</div>
      )}

      {lookupState === "done" && result && (
        <div className={`lookup-result ${result.found ? "found" : "not-found"}`}>
          {result.found ? (
            <>
              <div className="lookup-found">
                📍 Found in transcript from {new Date(result.transcriptStartTime!).toLocaleString()}
              </div>
              {result.botMessageText && (
                <div className="lookup-message">
                  Bot said: "{result.botMessageText}"
                </div>
              )}
              {onOpenTranscript && result.transcriptId && (
                <button
                  className="lookup-open-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTranscript(result.transcriptId!);
                  }}
                >
                  Open transcript →
                </button>
              )}
            </>
          ) : (
            <div className="lookup-not-found">
              ⚠️ Original message not found (may be in an older or deleted transcript)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
