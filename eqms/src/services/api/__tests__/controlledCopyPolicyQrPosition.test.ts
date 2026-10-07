import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
const put = vi.fn();
vi.mock("../client", () => ({ api: { post: (...a: unknown[]) => post(...a), put: (...a: unknown[]) => put(...a), get: vi.fn() } }));

import { controlledCopyPolicyApi } from "../controlledCopyPolicy";

const marking = { qrCodeEnabled: true, qrCodePosition: "BOTTOM_RIGHT", qrCodeSizeMm: 20 } as never;

describe("QR code position in policy requests", () => {
  beforeEach(() => {
    post.mockReset().mockResolvedValue({ data: {} });
    put.mockReset().mockResolvedValue({ data: {} });
  });

  it("sends the dragged position and no reset flag", async () => {
    await controlledCopyPolicyApi.previewMarking({ scenario: "ISSUED", layout: "portrait", pageKind: "COVER", marking: { ...(marking as object), qrCodeX: 0.4, qrCodeY: 0.6 } } as never);

    const sent = post.mock.calls[0][1].marking;
    expect(sent.qrCodeX).toBe(0.4);
    expect(sent.qrCodeY).toBe(0.6);
    expect(sent.qrCodeResetPosition).toBeUndefined();
  });

  it("says explicitly that there is no position, so the server returns the code to its corner", async () => {
    await controlledCopyPolicyApi.savePolicy({ marking: { ...(marking as object), qrCodeX: null, qrCodeY: null } } as never);

    const sent = put.mock.calls[0][1].marking;
    expect(sent.qrCodeResetPosition).toBe(true);
    expect(sent).not.toHaveProperty("qrCodeX");
  });
});
