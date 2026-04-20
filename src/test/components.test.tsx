import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { parseTranscript } from "../utils/parseTranscript";
import {
  basicMcpTranscript,
  pvaStudioReactionsTranscript,
  knowledgeTranscript,
  advancedEventsTranscript,
  multiAgentTranscript,
} from "./fixtures/transcripts";

// Mock the Power Apps SDK (not available in test environment)
vi.mock("@microsoft/power-apps/data", () => ({
  getClient: () => ({}),
}));

// Mock all generated services
vi.mock("../generated/services/ConversationtranscriptsService", () => ({
  ConversationtranscriptsService: { getAll: vi.fn(), get: vi.fn() },
}));
vi.mock("../generated/services/AadusersService", () => ({
  AadusersService: { getAll: vi.fn() },
}));
vi.mock("../generated/services/BotsService", () => ({
  BotsService: { getAll: vi.fn() },
}));

// Mock react-markdown (renders children as plain text in tests)
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));
vi.mock("remark-gfm", () => ({
  default: () => {},
}));

// Mock the hooks that components call internally
vi.mock("../hooks/useLookups", () => ({
  useBotLookup: () => ({
    getDisplayName: (schema: string) => schema,
    ready: true,
    accessibleBots: [],
    accessibleBotIds: [],
  }),
  useUserDisplayNames: () => ({
    getDisplayName: (id: string | undefined) => id ?? "Anonymous",
  }),
  useAadUserSearch: () => ({
    results: [],
    loading: false,
    search: vi.fn(),
  }),
}));

// ── MessageTimeline ───────────────────────────────────────────────────

describe("MessageTimeline", () => {
  async function renderTimeline(transcript: ReturnType<typeof parseTranscript>) {
    const { MessageTimeline } = await import("../components/TranscriptDetail/MessageTimeline");
    return render(
      <MessageTimeline
        messages={transcript.messages}
        reactions={transcript.reactions}
        activeMessageId={null}
        onMessageSelect={vi.fn()}
        onOpenTranscript={vi.fn()}
      />
    );
  }

  it("renders the panel title", async () => {
    const transcript = parseTranscript(basicMcpTranscript);
    await renderTimeline(transcript);
    expect(screen.getByText("Message Timeline")).toBeDefined();
  });

  it("renders all messages", async () => {
    const transcript = parseTranscript(basicMcpTranscript);
    await renderTimeline(transcript);
    expect(screen.getByText("What campaigns are active?")).toBeDefined();
    expect(screen.getByText(/Hello, how can I help/)).toBeDefined();
  });

  it("shows reaction badge on message", async () => {
    const transcript = parseTranscript(pvaStudioReactionsTranscript);
    await renderTimeline(transcript);
    expect(screen.getByText("👍")).toBeDefined();
    expect(screen.getByText("👎")).toBeDefined();
  });

  it("shows redacted content indicator", async () => {
    const transcript = parseTranscript(knowledgeTranscript);
    await renderTimeline(transcript);
    expect(screen.getByText(/not stored in transcript/)).toBeDefined();
  });

  it("shows search input", async () => {
    const transcript = parseTranscript(basicMcpTranscript);
    await renderTimeline(transcript);
    expect(screen.getByPlaceholderText("Search messages...")).toBeDefined();
  });

  it("shows orphan reactions section when present", async () => {
    // teamsReactionsTranscript has orphan reactions
    const { teamsReactionsTranscript } = await import("./fixtures/transcripts");
    const transcript = parseTranscript(teamsReactionsTranscript);
    await renderTimeline(transcript);
    expect(screen.getByText(/Reactions to prior sessions/)).toBeDefined();
  });
});

// ── DebugPanel ────────────────────────────────────────────────────────

describe("DebugPanel", () => {
  async function renderDebug(transcript: ReturnType<typeof parseTranscript>) {
    const { DebugPanel } = await import("../components/TranscriptDetail/DebugPanel");
    return render(
      <DebugPanel
        planSteps={transcript.planSteps}
        availableTools={transcript.availableTools}
        mcpServerInit={transcript.mcpServerInit}
        knowledgeSearches={transcript.knowledgeSearches}
        knowledgeResponses={transcript.knowledgeResponses}
        knowledgeTrace={transcript.knowledgeTrace}
        advancedEvents={transcript.advancedEvents}
        activeMessageId={null}
        onStepSelect={vi.fn()}
      />
    );
  }

  it("renders the panel title", async () => {
    const transcript = parseTranscript(basicMcpTranscript);
    await renderDebug(transcript);
    expect(screen.getByText("Debug")).toBeDefined();
  });

  it("renders plan steps", async () => {
    const transcript = parseTranscript(basicMcpTranscript);
    await renderDebug(transcript);
    expect(screen.getByText(/list_interactions/)).toBeDefined();
  });

  it("shows Basic/Advanced toggle", async () => {
    const transcript = parseTranscript(basicMcpTranscript);
    await renderDebug(transcript);
    expect(screen.getByText(/Basic/)).toBeDefined();
  });

  it("shows advanced event count badge when events exist", async () => {
    const transcript = parseTranscript(advancedEventsTranscript);
    await renderDebug(transcript);
    // Badge shows count of advanced events
    const badge = screen.queryByText(String(transcript.advancedEvents.length));
    expect(badge).toBeDefined();
  });

  it("toggles to advanced mode and shows events", async () => {
    const transcript = parseTranscript(advancedEventsTranscript);
    await renderDebug(transcript);
    const toggle = screen.getByText(/Basic/);
    fireEvent.click(toggle);
    expect(screen.getByText(/Advanced/)).toBeDefined();
    // Advanced events should now be visible — check for escalation label
    expect(screen.getByText(/Escalation requested/)).toBeDefined();
  });

  it("hides advanced events in basic mode", async () => {
    const transcript = parseTranscript(advancedEventsTranscript);
    await renderDebug(transcript);
    // In basic mode, error details shouldn't be visible
    expect(screen.queryByText(/FlowActionBadRequest/)).toBeNull();
  });

  it("shows search input", async () => {
    const transcript = parseTranscript(basicMcpTranscript);
    await renderDebug(transcript);
    expect(screen.getByPlaceholderText("Search debug events...")).toBeDefined();
  });
});

// ── GeneralInfo ───────────────────────────────────────────────────────

describe("GeneralInfo", () => {
  async function renderInfo(transcript: ReturnType<typeof parseTranscript>) {
    const { GeneralInfo } = await import("../components/TranscriptDetail/GeneralInfo");
    return render(<GeneralInfo transcript={transcript} />);
  }

  it("shows agent name", async () => {
    const transcript = parseTranscript(basicMcpTranscript);
    await renderInfo(transcript);
    expect(screen.getByText("msftcsa_testbot")).toBeDefined();
  });

  it("shows outcome badge", async () => {
    const transcript = parseTranscript(basicMcpTranscript);
    await renderInfo(transcript);
    expect(screen.getByText(/Abandoned/)).toBeDefined();
  });

  it("shows turn count", async () => {
    const transcript = parseTranscript(basicMcpTranscript);
    await renderInfo(transcript);
    expect(screen.getByText("4")).toBeDefined();
  });

  it("shows channel", async () => {
    const transcript = parseTranscript(basicMcpTranscript);
    await renderInfo(transcript);
    expect(screen.getByText("pva-studio")).toBeDefined();
  });
});

// ── AdaptiveCardRenderer ──────────────────────────────────────────────

describe("AdaptiveCardRenderer", () => {
  async function renderCard(contentType: string, content: Record<string, unknown>) {
    const { AdaptiveCardRenderer } = await import("../components/TranscriptDetail/AdaptiveCardRenderer");
    return render(<AdaptiveCardRenderer contentType={contentType} content={content} />);
  }

  it("renders adaptive card text blocks", async () => {
    await renderCard("application/vnd.microsoft.card.adaptive", {
      type: "AdaptiveCard",
      version: "1.3",
      body: [
        { type: "TextBlock", text: "Connect to continue", size: "medium", weight: "bolder" },
        { type: "TextBlock", text: "Allow access to proceed." },
      ],
    });
    expect(screen.getByText("Connect to continue")).toBeDefined();
    expect(screen.getByText("Allow access to proceed.")).toBeDefined();
  });

  it("renders action buttons", async () => {
    await renderCard("application/vnd.microsoft.card.adaptive", {
      type: "AdaptiveCard",
      version: "1.3",
      body: [],
      actions: [{ type: "Action.Submit", title: "Allow" }],
    });
    expect(screen.getByText("Allow")).toBeDefined();
  });

  it("renders OAuth card indicator", async () => {
    await renderCard("application/vnd.microsoft.card.oauth", {
      tokenExchangeResource: { id: "test", uri: "test" },
      buttons: [],
    });
    expect(screen.getByText("Authentication Required")).toBeDefined();
  });
});

// ── TranscriptDetail ──────────────────────────────────────────────────

describe("TranscriptDetail", () => {
  async function renderDetail(transcript: ReturnType<typeof parseTranscript>) {
    const { TranscriptDetail } = await import("../components/TranscriptDetail/TranscriptDetail");
    return render(
      <TranscriptDetail
        transcript={transcript}
        onBack={vi.fn()}
        onOpenTranscript={vi.fn()}
      />
    );
  }

  it("shows back button", async () => {
    const transcript = parseTranscript(basicMcpTranscript);
    await renderDetail(transcript);
    expect(screen.getByText("← Back")).toBeDefined();
  });

  it("shows export button", async () => {
    const transcript = parseTranscript(basicMcpTranscript);
    await renderDetail(transcript);
    expect(screen.getByText(/Export/)).toBeDefined();
  });

  it("shows conversation ID", async () => {
    const transcript = parseTranscript(basicMcpTranscript);
    await renderDetail(transcript);
    expect(screen.getByText("test-basic-001")).toBeDefined();
  });

  it("renders both panels", async () => {
    const transcript = parseTranscript(basicMcpTranscript);
    await renderDetail(transcript);
    expect(screen.getByText("Debug")).toBeDefined();
    expect(screen.getByText("Message Timeline")).toBeDefined();
  });

  it("does NOT render agent badges for single-agent transcripts", async () => {
    const transcript = parseTranscript(basicMcpTranscript);
    await renderDetail(transcript);
    expect(screen.queryByText(/Connected Agents \(/)).toBeNull();
    expect(document.querySelector(".agent-badge")).toBeNull();
  });

  it("renders connected-agent group, child badge and child-bubble accent for multi-agent transcripts", async () => {
    const transcript = parseTranscript(multiAgentTranscript);
    await renderDetail(transcript);

    // Routing summary in the activity panel
    expect(screen.getByText(/Connected Agents \(2 routings\)/)).toBeDefined();

    // Both child agent names appear in some form somewhere in the page
    expect(screen.getAllByText("Help Desk Agent").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cybersecurity").length).toBeGreaterThan(0);

    // Routing thoughts surfaced
    expect(screen.getByText(/Routing to Help-Desk-Agent/)).toBeDefined();
    expect(screen.getByText(/Cybersecurity specialist/)).toBeDefined();

    // Child-bubble accent applied to the child messages
    const childBubbles = document.querySelectorAll(".msg-bubble.bot.from-child");
    expect(childBubbles.length).toBe(2);
  });
});
