import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/services/api/reportTemplates", () => ({
  reportTemplatesApi: { list: mocks.list },
  reportError: (e: unknown) => String((e as Error).message),
}));

import { openPermissionHoldersReport } from "../openPermissionHoldersReport";

describe("the export of Access Explorer goes through Reports", () => {
  const navigate = vi.fn();
  const notify = vi.fn();
  beforeEach(() => {
    navigate.mockReset();
    notify.mockReset();
    mocks.list.mockReset();
  });

  it("opens the run page of the Permission Holders template with the permission filled in", async () => {
    mocks.list.mockResolvedValue({ data: [{ code: "RPT.0042", sourceCode: "PERMISSION_HOLDERS" }] });
    await openPermissionHoldersReport(navigate, notify, "training.paper.verify");
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ sourceCode: "PERMISSION_HOLDERS" }), false);
    expect(navigate).toHaveBeenCalledWith("/report/templates/RPT.0042/run?filter.permission=training.paper.verify");
    expect(notify).not.toHaveBeenCalled();
  });

  it("opens it without a filter from the list of permissions", async () => {
    mocks.list.mockResolvedValue({ data: [{ code: "RPT.0042", sourceCode: "PERMISSION_HOLDERS" }] });
    await openPermissionHoldersReport(navigate, notify);
    expect(navigate).toHaveBeenCalledWith("/report/templates/RPT.0042/run");
  });

  it("says so and opens the Report Library when no template of that type is available to the person", async () => {
    mocks.list.mockResolvedValue({ data: [{ code: "RPT.0001", sourceCode: "DOCUMENT_STATUS" }] });
    await openPermissionHoldersReport(navigate, notify, "x.y");
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "info" }));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(String(navigate.mock.calls[0][0])).toContain("/report/templates");
    expect(String(navigate.mock.calls[0][0])).not.toContain("/run");
  });

  it("shows the error of the server and goes nowhere", async () => {
    mocks.list.mockRejectedValue(new Error("REPORT_SCOPE_DENIED"));
    await openPermissionHoldersReport(navigate, notify, "x.y");
    expect(notify).toHaveBeenCalledWith({ type: "error", message: "REPORT_SCOPE_DENIED" });
    expect(navigate).not.toHaveBeenCalled();
  });
});
