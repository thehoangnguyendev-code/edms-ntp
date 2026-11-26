import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getTaskCounts: vi.fn() }));
vi.mock("@/services/api/navigation", () => ({ navigationApi: api }));
const server = vi.hoisted(() => ({ send: (_type: string) => {} }));
vi.mock("@/features/notifications/notificationRealtime", () => ({
  subscribeNotificationRealtime: (listener: (event: { type: string; data: string }) => void) => {
    server.send = (type) => listener({ type, data: "{}" });
    return () => undefined;
  },
}));

import { DATA_CHANGED_EVENT, navBadge, setNavTaskCounts, useNavTaskCounts, useNavTaskCountsSync } from "../navTaskCounts";
import { useWaitingForMe } from "../useWaitingForMe";

const tree = {
  id: "doc-control",
  children: [{ id: "revisions", children: [{ id: "pending-review" }, { id: "pending-approval" }] }, { id: "queue" }],
};

afterEach(() => {
  cleanup();
  act(() => setNavTaskCounts({ counts: {}, shared: {} }));
});

describe("navBadge", () => {
  it("sums everything under a group: the person's own work and the queues", () => {
    expect(navBadge(tree, { counts: { "pending-review": 2, "pending-approval": 1 }, shared: { queue: 5 } })).toBe(8);
  });

  it("gives an entry its own number, also when it is a queue", () => {
    expect(navBadge({ id: "queue" }, { counts: {}, shared: { queue: 5 } })).toBe(5);
  });

  it("takes the number the server gives for a module instead of adding the same task twice", () => {
    const module = { id: "training-management", children: [{ id: "my-tasks" }, { id: "training-activities" }] };
    expect(navBadge(module, { counts: { "training-management": 2, "my-tasks": 2, "training-activities": 1 }, shared: {} })).toBe(2);
  });

  it("shows nothing for an entry that has no number", () => {
    expect(navBadge({ id: "dictionaries" }, { counts: {}, shared: {} })).toBeUndefined();
    expect(navBadge(tree, { counts: { "pending-review": 0 }, shared: { queue: 0 } })).toBeUndefined();
  });
});

describe("useNavTaskCountsSync", () => {
  it("reads again when the page changes and removes the numbers when the read fails", async () => {
    api.getTaskCounts.mockReset().mockResolvedValueOnce({ counts: { "my-tasks": 4 }, shared: {} }).mockRejectedValueOnce(new Error("down"));
    const { result, rerender } = renderHook(({ path }) => { useNavTaskCountsSync("u1", path); return useNavTaskCounts(); }, { initialProps: { path: "/a" } });

    await waitFor(() => expect(result.current.counts["my-tasks"]).toBe(4));
    rerender({ path: "/b" });
    await waitFor(() => expect(result.current.counts["my-tasks"]).toBeUndefined());
  });
});

describe("the counts after a change", () => {
  it("are read again, once, after the person's own requests change data", async () => {
    api.getTaskCounts.mockReset().mockResolvedValueOnce({ counts: { "cc-ready": 13 }, shared: {} }).mockResolvedValue({ counts: { "cc-ready": 12 }, shared: {} });
    const { result } = renderHook(() => { useNavTaskCountsSync("u1", "/a"); return useNavTaskCounts(); });
    await waitFor(() => expect(result.current.counts["cc-ready"]).toBe(13));

    act(() => { window.dispatchEvent(new Event(DATA_CHANGED_EVENT)); window.dispatchEvent(new Event(DATA_CHANGED_EVENT)); });

    // at once, without any timer; the second request arrived while the first read ran, so one more read follows it
    expect(api.getTaskCounts).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.counts["cc-ready"]).toBe(12));
    await waitFor(() => expect(api.getTaskCounts).toHaveBeenCalledTimes(3));
  });

  it("are read the moment the server announces a change, and not for other announcements", async () => {
    api.getTaskCounts.mockReset().mockResolvedValue({ counts: {}, shared: {} });
    renderHook(() => useNavTaskCountsSync("u1", "/a"));
    await act(async () => {});
    expect(api.getTaskCounts).toHaveBeenCalledTimes(1);

    await act(async () => server.send("branding-updated"));
    expect(api.getTaskCounts).toHaveBeenCalledTimes(1);

    for (const [index, type] of ["entity-changed", "task-counts-changed", "notification-updated"].entries()) {
      await act(async () => server.send(type));
      expect(api.getTaskCounts).toHaveBeenCalledTimes(2 + index);
    }
  });
});

describe("useWaitingForMe", () => {
  const Screen = ({ onChange }: { onChange: () => void }) => {
    const waiting = useWaitingForMe("training-activities", onChange);
    return <>{waiting.node}<output>{String(waiting.params.waitingForMe)}</output></>;
  };

  it("is not drawn while nothing waits", () => {
    render(<Screen onChange={() => undefined} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("asks the server for the waiting records only while it is on, and stays when the last one is done", () => {
    const onChange = vi.fn();
    act(() => setNavTaskCounts({ counts: { "training-activities": 2 }, shared: {} }));
    render(<Screen onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Waiting for me (2)" }));
    expect(screen.getByRole("status").textContent).toBe("true");
    expect(onChange).toHaveBeenCalledTimes(1);

    act(() => setNavTaskCounts({ counts: {}, shared: {} }));
    fireEvent.click(screen.getByRole("button", { name: "Waiting for me (0)" }));
    expect(screen.getByRole("status").textContent).toBe("undefined");
  });
});
