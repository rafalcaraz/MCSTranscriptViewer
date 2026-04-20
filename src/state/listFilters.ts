import type { ContentSearchOptions } from "../hooks/useTranscripts";

/** All list page filter state — lifted to App so it persists when navigating to detail view and back. */
export interface ListFilterState {
  dateFrom: string;
  dateTo: string;
  serverSearchInput: string;
  serverSearch: string;
  clientSearch: string;
  clientSearchIn: ContentSearchOptions["searchIn"];
  outcomeFilter: string;
  agentFilter: string;
  selectedBotIds: string[];
  userSearchQuery: string;
  /** Resolved AAD Object ID of the user selected via "Find by User" — applies a strict participant filter, separate from content text search. */
  participantAadId: string;
  feedbackFilter: "" | "any" | "likes" | "dislikes";
  transcriptTypeFilter: "" | "chat" | "autonomous" | "evaluation" | "design";
  minTurns: string;
  /** When true, hides transcripts that look like the child-agent side of a connected-agent invocation
   *  (their botName appears as a child in some other loaded transcript's connectedAgentInvocations). */
  hideConnectedAgentSessions: boolean;
}

export const INITIAL_FILTER_STATE: ListFilterState = {
  dateFrom: "",
  dateTo: "",
  serverSearchInput: "",
  serverSearch: "",
  clientSearch: "",
  clientSearchIn: "all",
  outcomeFilter: "",
  agentFilter: "",
  selectedBotIds: [],
  userSearchQuery: "",
  participantAadId: "",
  feedbackFilter: "",
  transcriptTypeFilter: "",
  minTurns: "",
  hideConnectedAgentSessions: true,
};
