import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VerifyIntegrityModal } from "../components/VerifyIntegrityModal";

const api = vi.hoisted(() => ({ verify: vi.fn(), job: vi.fn() }));
vi.mock("@/services/api/backupRestore", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/backupRestore")>("@/services/api/backupRestore");
  return { ...actual, backupRestoreApi: api };
});

const state = (code: string) => document.querySelector(`[data-check="${code}"]`)?.getAttribute("data-state");

beforeEach(() => {
  api.verify.mockReset();
  api.job.mockReset();
  api.verify.mockResolvedValue({ jobId: "j-1" });
});
afterEach(cleanup);

const renderModal = (onFinished = vi.fn()) => render(<VerifyIntegrityModal isOpen backupNumber="BK-1" onClose={() => {}} onFinished={onFinished} />);

describe("Verify Integrity window", () => {
  it("lists every check from the start, ticks each one off as the agent finishes it, and gives the verdict only at the end", async () => {
    const steps = [{ code: "RUN_COMPLETED", ok: true, detail: "status COMPLETED" }, { code: "SET_PRESENT", ok: true, detail: "found" }];
    api.job
      .mockResolvedValueOnce({ id: "j-1", job_type: "VERIFY", status: "RUNNING", progress: 10, steps_json: JSON.stringify(steps), result_json: null })
      .mockResolvedValue({
        id: "j-1", job_type: "VERIFY", status: "DONE", progress: 100, steps_json: null,
        result_json: JSON.stringify({ verification: "VERIFIED", checks: [...steps, { code: "MANIFEST_SIGNATURE", ok: true, detail: "valid" }] }),
      });
    renderModal();
    // all the checks are shown at once, waiting
    await screen.findByText("The backup finished");
    expect(document.querySelectorAll("[data-check]").length).toBeGreaterThanOrEqual(10);
    expect(state("LEDGER_RECORDS_MANIFEST")).toBe("pending");
    // while the job still runs, the checks it has finished are ticked and the next one is being checked
    await waitFor(() => expect(state("RUN_COMPLETED")).toBe("passed"), { timeout: 3000 });
    await waitFor(() => expect(state("SET_PRESENT")).toBe("passed"), { timeout: 3000 });
    expect(screen.queryByText("This backup passed its integrity check")).toBeNull();
    expect(state("MANIFEST_UNCHANGED")).toBe("running");
    // at the end: the verdict, and a check that did not apply is marked so, not left spinning
    expect(await screen.findByText("This backup passed its integrity check", {}, { timeout: 6000 })).toBeTruthy();
    expect(state("MANIFEST_SIGNATURE")).toBe("passed");
    expect(state("OBJECTS_PRESENT")).toBe("skipped");
  });

  it("marks a failed check in red with the agent's words, and says the backup cannot be used", async () => {
    api.job.mockResolvedValue({
      id: "j-1", job_type: "VERIFY", status: "FAILED", progress: 100,
      result_json: JSON.stringify({ verification: "FAILED", checks: [{ code: "RUN_COMPLETED", ok: true, detail: "ok" }, { code: "FILES_MATCH_MANIFEST", ok: false, detail: "database/eqms.dump.gpg does not match the manifest" }] }),
    });
    renderModal();
    expect(await screen.findByText("This backup did not pass its integrity check", {}, { timeout: 5000 })).toBeTruthy();
    expect(state("FILES_MATCH_MANIFEST")).toBe("failed");
    expect(screen.getByText("database/eqms.dump.gpg does not match the manifest")).toBeTruthy();
    expect(screen.getByText(/cannot be used for a restore/)).toBeTruthy();
  });

  it("says the check did not finish when the agent reports a failure without a verdict", async () => {
    api.job.mockResolvedValue({ id: "j-1", job_type: "VERIFY", status: "FAILED", progress: 100, result_json: JSON.stringify({ errorCode: "BACKUP_NOT_FOUND" }) });
    renderModal();
    expect(await screen.findByText("The check did not finish")).toBeTruthy();
  });
});
