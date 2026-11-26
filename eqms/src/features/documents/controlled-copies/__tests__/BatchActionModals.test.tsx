import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setCatalogLanguage, tr } from "@/i18n/catalog";
import { DistributeBatchResultModal } from "../components/DistributeBatchResultModal";
import { BATCH_ACTION_COPY } from "../components/batchActionCopy";

afterEach(cleanup);

describe("Controlled Copy batch dialogs", () => {
  it("has a Vietnamese sentence for every action", () => {
    setCatalogLanguage("vi");
    for (const sentences of Object.values(BATCH_ACTION_COPY)) {
      for (const english of Object.values(sentences)) expect(tr(english), english).not.toBe(english);
    }
  });

  it("writes the result of a cancellation in Vietnamese", () => {
    setCatalogLanguage("vi");
    render(<DistributeBatchResultModal isOpen total={3} succeeded={3} failed={0} skipped={0} failedItems={[]} isRetrying={false} onRetryAllFailed={() => undefined} onClose={() => undefined} actionLabel="Cancellation" />);

    expect(screen.getByText("Kết quả huỷ")).toBeTruthy();
    expect(screen.getByText("Đã huỷ xong")).toBeTruthy();
    expect(screen.queryByText(/Cancellation/)).toBeNull();
  });
});
