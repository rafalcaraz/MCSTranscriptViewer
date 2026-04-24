// React Context that lets components consume bot/user lookups from a
// pluggable source. The default-env path provides hooks backed by the Power
// Apps SDK; the Browse Environments path provides hooks backed by direct
// Web API calls against an arbitrary Dataverse env using a user-supplied OAuth
// token. This lets us keep ONE TranscriptList / TranscriptDetail UI for both
// flavors without prop-drilling lookups everywhere.
//
// Important: each provider boundary is a fresh React subtree. We rely on
// callers to remount (via `key`) when switching env so per-instance hook state
// stays consistent.
//
// Note: this file intentionally co-locates the Provider component, consumer
// hooks, types, and the default impl constant so call sites only need a single
// import. That trips react-refresh/only-export-components (HMR works best when
// a file exports ONLY components), but since we don't rely on fast-refresh of
// this lookup wiring during development, we accept the trade-off.
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, type ReactNode } from "react";
import {
  useAadUserSearch as useDefaultAadUserSearch,
  useBotLookup as useDefaultBotLookup,
  useUserDisplayNames as useDefaultUserDisplayNames,
  type AadUser,
  type BotInfo,
} from "../hooks/useLookups";

export interface BotLookupResult {
  getDisplayName: (schemaName: string, botId?: string) => string;
  ready: boolean;
  accessibleBots: BotInfo[];
  accessibleBotIds: string[];
}

export interface UserDisplayResult {
  getDisplayName: (aadObjectId: string | undefined) => string;
}

export interface UserSearchResult {
  results: AadUser[];
  loading: boolean;
  search: (query: string) => void;
}

export interface LookupsImpl {
  useBotLookup: () => BotLookupResult;
  useUserDisplayNames: (aadObjectIds: string[]) => UserDisplayResult;
  useAadUserSearch: () => UserSearchResult;
}

const LookupsContext = createContext<LookupsImpl | null>(null);

export function LookupsProvider({
  value,
  children,
}: {
  value: LookupsImpl;
  children: ReactNode;
}) {
  return <LookupsContext.Provider value={value}>{children}</LookupsContext.Provider>;
}

function useImpl(): LookupsImpl {
  const ctx = useContext(LookupsContext);
  if (!ctx) {
    throw new Error("Lookups hook used outside of <LookupsProvider>");
  }
  return ctx;
}

// Consumer hooks — components import these instead of the env-specific ones.
export function useBotLookup(): BotLookupResult {
  return useImpl().useBotLookup();
}

export function useUserDisplayNames(aadObjectIds: string[]): UserDisplayResult {
  return useImpl().useUserDisplayNames(aadObjectIds);
}

export function useAadUserSearch(): UserSearchResult {
  return useImpl().useAadUserSearch();
}

// Default-env implementation — backed by the Power Apps SDK services.
export const defaultEnvLookupsImpl: LookupsImpl = {
  useBotLookup: useDefaultBotLookup,
  useUserDisplayNames: useDefaultUserDisplayNames,
  useAadUserSearch: useDefaultAadUserSearch,
};
