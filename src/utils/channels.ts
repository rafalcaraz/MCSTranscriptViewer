/**
 * Human-friendly labels and emoji icons for the channelId values we
 * commonly see in Copilot Studio transcripts. Used by the transcript list
 * row badge and (future) detail header to give users a fast visual cue
 * about how a session was delivered (chat widget, Teams, voice call,
 * autonomous, etc.).
 *
 * Channel IDs reference: TRANSCRIPT-PATTERNS.md §9, §15.10, §15.11.
 */

export interface ChannelInfo {
  /** Channel id as it appears on activities. */
  id: string;
  /** Short emoji (1 grapheme) shown in row badges. */
  emoji: string;
  /** Short human label, e.g. "Voice", "LCW". */
  label: string;
  /** Long-form tooltip explanation. */
  description: string;
}

const CHANNEL_INFO: Record<string, ChannelInfo> = {
  lcw: {
    id: "lcw",
    emoji: "💬",
    label: "LCW",
    description: "D365 Live Chat Widget — embedded web chat handed off through Omnichannel.",
  },
  conversationconductor: {
    id: "conversationconductor",
    emoji: "📞",
    label: "Voice",
    description: "D365 Voice Channel — phone call delivered through Microsoft's Nuance IVR stack.",
  },
  "pva-studio": {
    id: "pva-studio",
    emoji: "🛠️",
    label: "Studio",
    description: "Copilot Studio test/preview canvas inside the maker portal.",
  },
  "pva-autonomous": {
    id: "pva-autonomous",
    emoji: "🤖",
    label: "Autonomous",
    description: "Copilot Studio autonomous agent — first-party D365 agent invoked without a user UI.",
  },
  msteams: {
    id: "msteams",
    emoji: "👥",
    label: "Teams",
    description: "Microsoft Teams channel.",
  },
  directline: {
    id: "directline",
    emoji: "🔌",
    label: "Direct Line",
    description: "Bot Framework Direct Line — custom or programmatic embed.",
  },
  emulator: {
    id: "emulator",
    emoji: "🧪",
    label: "Emulator",
    description: "Bot Framework Emulator — local development.",
  },
};

/**
 * Look up channel display info. Unknown channels return a neutral fallback
 * with the raw id so unfamiliar channels still render visibly.
 */
export function getChannelInfo(channelId: string | undefined): ChannelInfo | undefined {
  if (!channelId) return undefined;
  const known = CHANNEL_INFO[channelId];
  if (known) return known;
  return {
    id: channelId,
    emoji: "📨",
    label: channelId,
    description: `Unrecognized channel id: ${channelId}`,
  };
}
