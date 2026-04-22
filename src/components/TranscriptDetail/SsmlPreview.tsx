import { useState } from "react";

interface SsmlPreviewProps {
  ssml: string;
}

/**
 * Renders a small "🔊 SSML" pill on a bot voice message that toggles to
 * reveal the raw SSML markup that was synthesized for TTS playback. Read-only:
 * does NOT play audio (D365 doesn't store the rendered .wav, so authentic
 * playback would require a re-synthesis round-trip to Azure Cognitive Services
 * Speech, which is out of scope for the viewer).
 *
 * The expanded view light-formats the XML for readability — adds line breaks
 * before opening tags so prosody/voice/speak nest visibly. Falls back to the
 * raw string if the input doesn't look like XML.
 */
export function SsmlPreview({ ssml }: SsmlPreviewProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ssml-preview">
      <button
        type="button"
        className="ssml-preview-pill"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Show the SSML markup that was synthesized for the caller"
      >
        🔊 SSML {open ? "▾" : "▸"}
      </button>
      {open && (
        <pre className="ssml-preview-body">
          {formatSsml(ssml)}
        </pre>
      )}
    </div>
  );
}

function formatSsml(ssml: string): string {
  if (!ssml.trimStart().startsWith("<")) return ssml;
  return ssml
    .replace(/></g, ">\n<")
    .replace(/^\s+|\s+$/g, "");
}
