import { describe, expect, it, vi } from "vitest";
import { controlledCopyBatchStatusDiscrepancies, controlledCopyRecallScan } from "../breadcrumbs.config";
import { ROUTES } from "@/app/routes.constants";

const labels = (items: { label: string }[]) => items.map((item) => item.label);

describe("Controlled Copy sub-screen breadcrumbs", () => {
  it.each([
    ["Batch Status Discrepancies", controlledCopyBatchStatusDiscrepancies],
    ["Recall by Scan", controlledCopyRecallScan],
  ])("%s sits under Controlled Copies > All Controlled Copies, like the other Controlled Copy screens", (title, build) => {
    const navigate = vi.fn();
    const items = build(navigate);

    expect(labels(items).slice(-3)).toEqual(["Controlled Copies", "All Controlled Copies", title]);
    expect(items[items.length - 1].isActive).toBe(true);
    // All Controlled Copies leads back to the list.
    items.find((item) => item.label === "All Controlled Copies")?.onClick?.();
    expect(navigate).toHaveBeenCalledWith(ROUTES.DOCUMENTS.CONTROLLED_COPIES.ALL);
  });
});
