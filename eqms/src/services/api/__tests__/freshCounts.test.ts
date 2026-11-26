import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.hoisted(() => vi.fn());
vi.mock("../client", () => ({ api: { get, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }, apiClient: {} }));

import { emitNotificationsChanged } from "@/features/notifications/events";
import { navigationApi } from "../navigation";
import { notificationApi } from "../notifications";

describe("counts that must be read from the server", () => {
  beforeEach(() => get.mockReset().mockResolvedValue({ data: { unread: 1, counts: {}, shared: {} } }));

  it("asks for the task counts outside the client's cache of GETs", async () => {
    await navigationApi.getTaskCounts();
    expect(get.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("reads the unread count again as soon as a change is announced", async () => {
    await notificationApi.getSummary();
    await notificationApi.getSummary();
    expect(get).toHaveBeenCalledTimes(1);

    emitNotificationsChanged();
    await notificationApi.getSummary();

    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[1][1].signal).toBeInstanceOf(AbortSignal);
  });
});
