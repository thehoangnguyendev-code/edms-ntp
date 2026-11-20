import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("../client", () => ({ api: { post: mocks.post, get: mocks.get, patch: vi.fn() } }));

import { controlledCopyRecallApi, RECALL_LONG_REQUEST_TIMEOUT_MS } from "../controlledCopyRecallBatches";

const file = new File(["%PDF-1.4"], "a.pdf", { type: "application/pdf" });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.post.mockResolvedValue({ data: {} });
});

describe("Recall by Scan requests that the server answers only after long work", () => {
  it("waits far longer than the 30 s default for an upload, which the server answers after its virus scan and code reading", async () => {
    await controlledCopyRecallApi.createDraft([file], undefined, "u1");
    await controlledCopyRecallApi.addFiles("b1", [file], undefined, "u2");

    expect(RECALL_LONG_REQUEST_TIMEOUT_MS).toBeGreaterThan(30000);
    expect(mocks.post.mock.calls[0][2]).toMatchObject({ timeout: RECALL_LONG_REQUEST_TIMEOUT_MS });
    expect(mocks.post.mock.calls[1][2]).toMatchObject({ timeout: RECALL_LONG_REQUEST_TIMEOUT_MS });
  });

  it("waits as long when the whole batch is committed", async () => {
    await controlledCopyRecallApi.commit("b1", { reason: "Paper received", signatureToken: "sig" });

    expect(mocks.post.mock.calls[0][2]).toMatchObject({ timeout: RECALL_LONG_REQUEST_TIMEOUT_MS });
  });

  it("leaves the quick calls on the default timeout", async () => {
    mocks.get.mockResolvedValue({ data: [] });
    await controlledCopyRecallApi.listMyDrafts();

    expect(mocks.get.mock.calls[0][1]).toBeUndefined();
  });
});
