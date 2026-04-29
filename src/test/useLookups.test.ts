import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Mock SDK + generated services BEFORE importing useLookups
vi.mock("@microsoft/power-apps/data", () => ({ getClient: () => ({}) }));

const aadGetAll = vi.fn();
vi.mock("../generated/services/AadusersService", () => ({
  AadusersService: { getAll: (...args: unknown[]) => aadGetAll(...args) },
}));

const userProfileV2 = vi.fn();
const searchUserV2 = vi.fn();
vi.mock("../generated/services/Office365UsersService", () => ({
  Office365UsersService: {
    UserProfile_V2: (...args: unknown[]) => userProfileV2(...args),
    SearchUserV2: (...args: unknown[]) => searchUserV2(...args),
  },
}));

vi.mock("../generated/services/BotsService", () => ({
  BotsService: { getAll: vi.fn() },
}));

vi.mock("../utils/rbacDebug", () => ({ rbacLog: vi.fn() }));

import {
  useUserDisplayNames,
  useAadUserSearch,
  setAdhocMode,
  __resetUserDisplayCacheForTests,
} from "../hooks/useLookups";

const ID_A = "11111111-1111-1111-1111-111111111111";
const ID_B = "22222222-2222-2222-2222-222222222222";

describe("useUserDisplayNames — adhoc fallback", () => {
  beforeEach(() => {
    __resetUserDisplayCacheForTests();
    aadGetAll.mockReset();
    userProfileV2.mockReset();
    searchUserV2.mockReset();
    sessionStorage.clear();
  });

  it("aadusers row found → no Graph call, name cached", async () => {
    aadGetAll.mockResolvedValue({ data: [{ aaduserid: ID_A, id: ID_A, displayname: "Alice", mail: "a@x" }] });

    const { result } = renderHook(() => useUserDisplayNames([ID_A]));
    await waitFor(() => expect(result.current.getDisplayName(ID_A)).toBe("Alice"));

    expect(aadGetAll).toHaveBeenCalledTimes(1);
    expect(userProfileV2).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(`udn:v1:${ID_A}`)).toContain("Alice");
  });

  it("aadusers 0 rows + non-eager → flips adhoc, does NOT call Graph from list render", async () => {
    aadGetAll.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useUserDisplayNames([ID_A]));
    await waitFor(() => expect(result.current.getDisplayName(ID_A)).toBe(ID_A));

    expect(aadGetAll).toHaveBeenCalledTimes(1);
    expect(userProfileV2).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("udn:adhoc:v1")).toBe("1");
  });

  it("aadusers 0 rows + eager → falls back to Graph, caches displayName", async () => {
    aadGetAll.mockResolvedValue({ data: [] });
    userProfileV2.mockResolvedValue({ data: { displayName: "Bob", mail: "b@x" } });

    const { result } = renderHook(() => useUserDisplayNames([ID_A], { eager: true }));
    await waitFor(() => expect(result.current.getDisplayName(ID_A)).toBe("Bob"));

    expect(userProfileV2).toHaveBeenCalledWith(ID_A, "displayName,mail");
    expect(sessionStorage.getItem(`udn:v1:${ID_A}`)).toContain("Bob");
  });

  it("subsequent ids after adhoc flip skip aadusers entirely", async () => {
    // First lookup flips adhoc
    aadGetAll.mockResolvedValueOnce({ data: [] });
    userProfileV2.mockResolvedValueOnce({ data: { displayName: "Alice" } });
    const first = renderHook(() => useUserDisplayNames([ID_A], { eager: true }));
    await waitFor(() => expect(first.result.current.getDisplayName(ID_A)).toBe("Alice"));

    aadGetAll.mockClear();
    userProfileV2.mockReset();
    userProfileV2.mockResolvedValueOnce({ data: { displayName: "Carol" } });

    const second = renderHook(() => useUserDisplayNames([ID_B], { eager: true }));
    await waitFor(() => expect(second.result.current.getDisplayName(ID_B)).toBe("Carol"));

    expect(aadGetAll).not.toHaveBeenCalled();
    expect(userProfileV2).toHaveBeenCalledTimes(1);
  });

  it("sessionStorage hit short-circuits both services", async () => {
    sessionStorage.setItem(`udn:v1:${ID_A}`, JSON.stringify({ name: "Cached User", ts: 1 }));

    const { result } = renderHook(() => useUserDisplayNames([ID_A]));
    await waitFor(() => expect(result.current.getDisplayName(ID_A)).toBe("Cached User"));

    expect(aadGetAll).not.toHaveBeenCalled();
    expect(userProfileV2).not.toHaveBeenCalled();
  });

  it("adhoc flag persists across hook mounts within session", async () => {
    sessionStorage.setItem("udn:adhoc:v1", "1");
    // re-import to pick up the persisted flag at module-load time
    vi.resetModules();
    const mod = await import("../hooks/useLookups");

    aadGetAll.mockClear();
    const { result } = renderHook(() => mod.useUserDisplayNames([ID_A]));
    // adhoc + non-eager → cache miss returns raw id and no service calls
    await act(async () => { await Promise.resolve(); });
    expect(result.current.getDisplayName(ID_A)).toBe(ID_A);
    expect(aadGetAll).not.toHaveBeenCalled();
  });

  it("eager Graph failure falls back to raw id (does not throw)", async () => {
    aadGetAll.mockResolvedValue({ data: [] });
    userProfileV2.mockRejectedValue(new Error("Graph 403"));

    const { result } = renderHook(() => useUserDisplayNames([ID_A], { eager: true }));
    await waitFor(() => expect(result.current.getDisplayName(ID_A)).toBe(ID_A));
  });

  it("regression: list-render in adhoc mode does NOT poison cache → later eager call still triggers Graph", async () => {
    // First (list-style) render in adhoc mode resolves N ids without Graph.
    aadGetAll.mockResolvedValueOnce({ data: [] }); // flips adhoc on id A
    aadGetAll.mockResolvedValueOnce({ data: [] }); // already adhoc → won't be called
    const list = renderHook(() => useUserDisplayNames([ID_A, ID_B]));
    await waitFor(() => expect(list.result.current.getDisplayName(ID_A)).toBe(ID_A));
    expect(list.result.current.getDisplayName(ID_B)).toBe(ID_B);

    // Verify no sessionStorage entries written for the unresolved ids
    expect(sessionStorage.getItem(`udn:v1:${ID_A}`)).toBeNull();
    expect(sessionStorage.getItem(`udn:v1:${ID_B}`)).toBeNull();

    // Now detail opens → eager call MUST hit Graph (not short-circuit on
    // a poisoned cache entry).
    userProfileV2.mockResolvedValueOnce({ data: { displayName: "Bob" } });
    const detail = renderHook(() => useUserDisplayNames([ID_A], { eager: true }));
    await waitFor(() => expect(detail.result.current.getDisplayName(ID_A)).toBe("Bob"));
    expect(userProfileV2).toHaveBeenCalledTimes(1);

    // Re-render the list → resolved name now visible from L1 cache
    const list2 = renderHook(() => useUserDisplayNames([ID_A, ID_B]));
    expect(list2.result.current.getDisplayName(ID_A)).toBe("Bob");
    expect(list2.result.current.getDisplayName(ID_B)).toBe(ID_B);
  });
});

describe("useAadUserSearch — adhoc fallback", () => {
  beforeEach(() => {
    __resetUserDisplayCacheForTests();
    aadGetAll.mockReset();
    userProfileV2.mockReset();
    searchUserV2.mockReset();
    sessionStorage.clear();
  });

  it("normal mode → queries aadusers, NOT Graph", async () => {
    aadGetAll.mockResolvedValue({
      data: [{ aaduserid: ID_A, id: ID_A, displayname: "Alice", mail: "a@x", userprincipalname: "a@x" }],
    });

    const { result } = renderHook(() => useAadUserSearch());
    await act(async () => { result.current.search("ali"); });
    await waitFor(() => expect(result.current.results.length).toBe(1));

    expect(aadGetAll).toHaveBeenCalledTimes(1);
    expect(searchUserV2).not.toHaveBeenCalled();
    expect(result.current.results[0].displayname).toBe("Alice");
  });

  it("adhoc mode → calls SearchUserV2 and maps Graph User → AadUser", async () => {
    setAdhocMode(true);
    searchUserV2.mockResolvedValue({
      data: {
        value: [
          { Id: ID_A, DisplayName: "Bob", Mail: "b@x", UserPrincipalName: "b@x", JobTitle: "Engineer" },
          { Id: ID_B, DisplayName: "Carol", Mail: "c@x", UserPrincipalName: "c@x" },
        ],
      },
    });

    const { result } = renderHook(() => useAadUserSearch());
    await act(async () => { result.current.search("b"); });  // 1 char → no call
    expect(searchUserV2).not.toHaveBeenCalled();

    await act(async () => { result.current.search("bo"); });
    await waitFor(() => expect(result.current.results.length).toBe(2));

    expect(searchUserV2).toHaveBeenCalledWith("bo", 10);
    expect(aadGetAll).not.toHaveBeenCalled();
    expect(result.current.results[0]).toMatchObject({
      objectId: ID_A,
      displayname: "Bob",
      mail: "b@x",
      jobtitle: "Engineer",
    });
  });

  it("adhoc mode → stale Graph response is discarded by reqId guard", async () => {
    setAdhocMode(true);

    let resolveFirst!: (v: unknown) => void;
    let resolveSecond!: (v: unknown) => void;
    searchUserV2.mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }));
    searchUserV2.mockImplementationOnce(() => new Promise((r) => { resolveSecond = r; }));

    const { result } = renderHook(() => useAadUserSearch());
    await act(async () => { result.current.search("al"); });
    await act(async () => { result.current.search("ali"); });

    // Resolve the SECOND request first (most recent), then the stale first.
    await act(async () => {
      resolveSecond({ data: { value: [{ Id: ID_B, DisplayName: "Latest" }] } });
      await Promise.resolve();
      resolveFirst({ data: { value: [{ Id: ID_A, DisplayName: "Stale" }] } });
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0].displayname).toBe("Latest");
  });

  it("under 2 chars → no service calls in either mode", async () => {
    const { result } = renderHook(() => useAadUserSearch());
    await act(async () => { result.current.search("a"); });
    await act(async () => { result.current.search(""); });
    expect(aadGetAll).not.toHaveBeenCalled();
    expect(searchUserV2).not.toHaveBeenCalled();
  });
});
