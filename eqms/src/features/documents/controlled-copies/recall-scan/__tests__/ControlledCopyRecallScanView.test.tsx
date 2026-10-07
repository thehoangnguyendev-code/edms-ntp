import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { RecallBatch, RecallItem } from "@/services/api/controlledCopyRecallBatches";

const mocks = vi.hoisted(() => ({
  permissions: new Set<string>(["documents.controlled_copy.recall"]),
  navigateTo: vi.fn(),
  showToast: vi.fn(),
  api: {
    listMyDrafts: vi.fn(),
    createDraft: vi.fn(),
    addFiles: vi.fn(),
    getBatch: vi.fn(),
    listItems: vi.fn(),
    updateItem: vi.fn(),
    fetchItemFile: vi.fn(),
    commit: vi.fn(),
    discard: vi.fn(),
  },
  signed: { reason: "Annual SOP refresh", signatureToken: "sig-token" } as { reason: string; signatureToken: string },
  signError: null as unknown,
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasPermission: (code: string) => mocks.permissions.has(code) }),
}));
vi.mock("@/hooks", () => ({
  useNavigateWithLoading: () => ({ navigateTo: mocks.navigateTo }),
  useDebounce: (value: unknown) => value,
  useTableDragScroll: () => ({ scrollerRef: { current: null }, isDragging: false, dragEvents: {} }),
}));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: mocks.showToast }) }));
vi.mock("@/components/ui/page/PageHeader", () => ({
  PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));
vi.mock("@/components/ui/breadcrumb/breadcrumbs.config", () => ({ controlledCopyRecallScan: () => [] }));
vi.mock("@/components/ui/esign-modal/ESignatureModal", () => ({
  ESignatureModal: ({ onConfirm, onClose, targetDetails }: { onConfirm: (d: unknown) => Promise<void>; onClose: () => void; targetDetails?: { code?: string } }) => (
    <div role="dialog" aria-label="signature">
      <span>signing {targetDetails?.code}</span>
      <button
        onClick={() =>
          onConfirm(mocks.signed).catch((error) => {
            mocks.signError = error;
            onClose();
          })
        }
      >
        sign
      </button>
    </div>
  ),
}));
vi.mock("@/features/documents/shared/components/ScanPreviewModal", () => ({
  // Like the real modal, which stays mounted to play its closing animation: it shows only while isOpen.
  ScanPreviewModal: ({ isOpen, title, loadFile, onClose }: { isOpen: boolean; title: string; loadFile: () => Promise<Blob>; onClose: () => void }) => !isOpen ? null : (
    <div role="dialog" aria-label="scan preview">
      <span>previewing {title}</span>
      <button onClick={() => loadFile()}>load</button>
      <button onClick={onClose}>close preview</button>
    </div>
  ),
}));
vi.mock("@/services/api/controlledCopyRecallBatches", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/controlledCopyRecallBatches")>("@/services/api/controlledCopyRecallBatches");
  return { ...actual, controlledCopyRecallApi: mocks.api };
});

import { ControlledCopyRecallScanView } from "../ControlledCopyRecallScanView";

const item = (overrides: Partial<RecallItem>): RecallItem => ({
  id: "i1",
  itemNo: 1,
  fileName: "scan-1.pdf",
  contentType: "application/pdf",
  fileSize: 2048,
  sha256: "abc",
  virusStatus: "CLEAN",
  qrStatus: "DECODED",
  matchSource: "QR",
  matchStatus: "READY",
  excluded: false,
  outcome: "PENDING",
  previewAvailable: true,
  loosePage: false,
  copy: {
    id: "c1",
    number: "CC-001",
    documentNumber: "SOP.QA.0007",
    documentTitle: "Cleaning SOP",
    revisionNumber: "2.0.0",
    recipientName: "Lan Tran",
    status: "Distributed",
  },
  ...overrides,
});

const batchOf = (items: RecallItem[], overrides: Partial<RecallBatch> = {}): RecallBatch => {
  const active = items.filter((i) => !i.excluded);
  const ready = active.filter((i) => i.matchStatus === "READY").length;
  const blocked = active.filter((i) => i.matchStatus === "BLOCKED").length;
  const unmatched = active.filter((i) => i.matchStatus === "UNMATCHED").length;
  return {
    id: "b1",
    batchNumber: "RCB-2026-00001",
    status: "DRAFT",
    totalItems: items.length,
    readyItems: ready,
    blockedItems: blocked,
    unmatchedItems: unmatched,
    excludedItems: items.length - active.length,
    readyToCommit: ready > 0 && blocked === 0 && unmatched === 0,
    items,
    ...overrides,
  };
};

const pdf = (name: string) => new File(["%PDF-1.7"], name, { type: "application/pdf" });

const upload = async (files: File[]) => {
  // Files go up one at a time: the first starts the draft, the others are added to it. The mocked server answers every call with the batch the test set up.
  mocks.api.addFiles.mockImplementation(() => mocks.api.createDraft.mock.results[0]?.value);
  fireEvent.change(screen.getByTestId("recall-scan-input"), { target: { files } });
  fireEvent.click(await screen.findByRole("button", { name: "Read codes and review" }));
};

beforeEach(() => {
  // The shared table layout reads the screen width.
  window.matchMedia = ((query: string) => ({
    matches: true, media: query, addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  mocks.permissions = new Set(["documents.controlled_copy.recall"]);
  mocks.signError = null;
  mocks.navigateTo.mockReset();
  mocks.showToast.mockReset();
  Object.values(mocks.api).forEach((fn) => fn.mockReset());
  mocks.api.listMyDrafts.mockResolvedValue([]);
});

describe("Recall by Scan", () => {
  it("tells a user without the recall permission and calls nothing", () => {
    mocks.permissions = new Set();
    render(<ControlledCopyRecallScanView />);

    expect(screen.getByText(/not allowed to recall controlled copies/i)).toBeInTheDocument();
    expect(mocks.api.listMyDrafts).not.toHaveBeenCalled();
  });

  it("uploads the chosen scans and shows what was read and matched for each", async () => {
    mocks.api.createDraft.mockResolvedValue(batchOf([
      item({ id: "i1", itemNo: 1 }),
      item({ id: "i2", itemNo: 2, fileName: "blurry.pdf", qrStatus: "NOT_FOUND", matchStatus: "UNMATCHED", matchSource: null, copy: null,
        matchMessage: "No code could be read on this scan." }),
      item({ id: "i3", itemNo: 3, fileName: "old.pdf", matchStatus: "BLOCKED", matchMessage: "Controlled copy CC-OLD was already recalled.",
        copy: { id: "c3", number: "CC-OLD", recipientName: "Hoa Pham" } }),
      item({ id: "i4", itemNo: 4, fileName: "bad.pdf", virusStatus: "INFECTED", qrStatus: "NOT_ATTEMPTED", matchStatus: "BLOCKED", previewAvailable: false, copy: null,
        matchMessage: "The file was rejected by the virus scanner." }),
    ]));
    render(<ControlledCopyRecallScanView />);
    const files = [pdf("scan-1.pdf"), pdf("blurry.pdf"), pdf("old.pdf"), pdf("bad.pdf")];

    await upload(files);

    await waitFor(() => expect(mocks.api.createDraft).toHaveBeenCalledWith([files[0]], expect.any(Function)));
    expect(mocks.api.addFiles).toHaveBeenCalledTimes(3);
    expect(mocks.api.addFiles).toHaveBeenNthCalledWith(1, "b1", [files[1]], expect.any(Function));
    expect(await screen.findByText("RCB-2026-00001")).toBeInTheDocument();
    expect(screen.getByText("CC-001")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Needs a match")).toBeInTheDocument();
    expect(screen.getByText("No code found")).toBeInTheDocument();
    expect(screen.getByText("Virus found")).toBeInTheDocument();
    expect(screen.getByText(/already recalled/)).toBeInTheDocument();
    expect(screen.getByText("1 ready")).toBeInTheDocument();
    expect(screen.getByText("3 need attention")).toBeInTheDocument();
    // An infected file offers no preview and cannot be matched.
    expect(screen.queryByRole("button", { name: "Preview bad.pdf" })).toBeNull();
    // Nothing can be recalled while a scan still needs attention.
    expect(screen.getByRole("button", { name: /Recall 1 controlled copy/ })).toBeDisabled();
  });

  it("keeps at most 50 scans in one batch", () => {
    render(<ControlledCopyRecallScanView />);
    const many = Array.from({ length: 53 }, (_, i) => pdf(`s${i}.pdf`));

    fireEvent.change(screen.getByTestId("recall-scan-input"), { target: { files: many } });

    expect(screen.getByText(/50 of 50 files chosen/)).toBeInTheDocument();
    expect(mocks.showToast).toHaveBeenCalledWith(expect.objectContaining({ type: "warning", title: "Too many files" }));
  });

  it("only takes PDF scans and says so when other files are left out", () => {
    render(<ControlledCopyRecallScanView />);
    const picture = new File(["x"], "scan.jpg", { type: "image/jpeg" });

    fireEvent.change(screen.getByTestId("recall-scan-input"), { target: { files: [pdf("a.pdf"), picture] } });

    expect(screen.getByText(/1 of 50 files chosen/)).toBeInTheDocument();
    expect(mocks.showToast).toHaveBeenCalledWith(expect.objectContaining({ type: "warning", title: "Only PDF scans are accepted" }));
  });


  it("uploads one file at a time and shows the progress from 0 to 100%", async () => {
    let finishFirst: (value: RecallBatch) => void = () => undefined;
    mocks.api.createDraft.mockImplementation((_files: File[], onProgress?: (loaded: number) => void) => {
      onProgress?.(0);
      return new Promise<RecallBatch>((resolve) => {
        finishFirst = resolve;
      });
    });
    mocks.api.addFiles.mockImplementation(() => Promise.resolve(batchOf([item({ id: "i1", itemNo: 1 }), item({ id: "i2", itemNo: 2, fileName: "b.pdf" })])));
    render(<ControlledCopyRecallScanView />);
    fireEvent.change(screen.getByTestId("recall-scan-input"), { target: { files: [pdf("a.pdf"), pdf("b.pdf")] } });

    fireEvent.click(screen.getByRole("button", { name: "Read codes and review" }));

    const bar = await screen.findByRole("progressbar", { name: "Upload progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText(/File 1 of 2 · a\.pdf/)).toBeInTheDocument();
    // The second file is not sent while the first is still being processed.
    expect(mocks.api.addFiles).not.toHaveBeenCalled();

    finishFirst(batchOf([item({ id: "i1", itemNo: 1 })]));

    await waitFor(() => expect(mocks.api.addFiles).toHaveBeenCalledTimes(1));
    expect(mocks.api.addFiles).toHaveBeenCalledWith("b1", [expect.objectContaining({ name: "b.pdf" })], expect.any(Function));
    expect(await screen.findByText("RCB-2026-00001")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("stops at the first file that fails and leaves the rest chosen for a retry", async () => {
    mocks.api.createDraft.mockResolvedValue(batchOf([item({ id: "i1", itemNo: 1 })]));
    mocks.api.addFiles.mockRejectedValue(new Error("scanner down"));
    render(<ControlledCopyRecallScanView />);
    fireEvent.change(screen.getByTestId("recall-scan-input"), { target: { files: [pdf("a.pdf"), pdf("b.pdf"), pdf("c.pdf")] } });

    fireEvent.click(screen.getByRole("button", { name: "Read codes and review" }));

    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" })));
    expect(mocks.api.addFiles).toHaveBeenCalledTimes(1);
    // a.pdf is already in the draft; b.pdf and c.pdf were not sent.
    expect(await screen.findByText("RCB-2026-00001")).toBeInTheDocument();
  });

  it("searches and sorts the scans on the server, not in the browser", async () => {
    mocks.api.createDraft.mockResolvedValue(batchOf([
      item({ id: "i1", itemNo: 1, fileName: "zeta.pdf" }),
      item({ id: "i2", itemNo: 2, fileName: "alpha.pdf", copy: { id: "c2", number: "CC-002", recipientName: "Minh Le" } }),
    ]));
    mocks.api.listItems.mockResolvedValue([item({ id: "i2", itemNo: 2, fileName: "alpha.pdf", copy: { id: "c2", number: "CC-002", recipientName: "Minh Le" } })]);
    render(<ControlledCopyRecallScanView />);
    await upload([pdf("zeta.pdf"), pdf("alpha.pdf")]);
    await screen.findByText("zeta.pdf");
    // Nothing is fetched while the query is the default one.
    expect(mocks.api.listItems).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox", { name: "Search scans" }), { target: { value: "CC-002" } });

    await waitFor(() => expect(mocks.api.listItems).toHaveBeenCalledWith("b1", { search: "CC-002", sortBy: "itemNo", sortDirection: "asc" }));
    await waitFor(() => expect(screen.queryByText("zeta.pdf")).toBeNull());
    expect(screen.getByText("alpha.pdf")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 scans")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("columnheader", { name: /^Scan/ }));

    await waitFor(() => expect(mocks.api.listItems).toHaveBeenLastCalledWith("b1", { search: "CC-002", sortBy: "file", sortDirection: "asc" }));
  });

  it("excludes a scan and shows the server's recomputed batch", async () => {
    const first = batchOf([
      item({ id: "i1", itemNo: 1 }),
      item({ id: "i2", itemNo: 2, fileName: "blurry.pdf", matchStatus: "UNMATCHED", qrStatus: "NOT_FOUND", copy: null, matchSource: null }),
    ]);
    mocks.api.createDraft.mockResolvedValue(first);
    mocks.api.updateItem.mockResolvedValue(batchOf([
      item({ id: "i1", itemNo: 1 }),
      item({ id: "i2", itemNo: 2, fileName: "blurry.pdf", matchStatus: "UNMATCHED", qrStatus: "NOT_FOUND", copy: null, matchSource: null, excluded: true }),
    ]));
    render(<ControlledCopyRecallScanView />);
    await upload([pdf("a.pdf"), pdf("blurry.pdf")]);
    await screen.findByText("blurry.pdf");
    const excludeButtons = screen.getAllByRole("button", { name: /Exclude/ });
    expect(excludeButtons).toHaveLength(2);

    fireEvent.click(excludeButtons[1]);

    await waitFor(() => expect(mocks.api.updateItem).toHaveBeenCalledWith("b1", "i2", { excluded: true }));
    expect(await screen.findByText("Excluded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Recall 1 controlled copy/ })).toBeEnabled();
  });

  it("matches a scan whose code could not be read by the copy number typed in", async () => {
    mocks.api.createDraft.mockResolvedValue(batchOf([
      item({ id: "i2", itemNo: 1, fileName: "blurry.pdf", matchStatus: "UNMATCHED", qrStatus: "NOT_FOUND", copy: null, matchSource: null }),
    ]));
    mocks.api.updateItem.mockResolvedValue(batchOf([item({ id: "i2", itemNo: 1, fileName: "blurry.pdf", matchSource: "MANUAL" })]));
    render(<ControlledCopyRecallScanView />);
    await upload([pdf("blurry.pdf")]);

    fireEvent.click(await screen.findByRole("button", { name: "Match by number" }));
    fireEvent.change(screen.getByLabelText("Controlled copy number"), { target: { value: " CC-001 " } });
    fireEvent.click(screen.getByRole("button", { name: "Match" }));

    await waitFor(() => expect(mocks.api.updateItem).toHaveBeenCalledWith("b1", "i2", { copyNumber: "CC-001" }));
    expect(await screen.findByText(/matched by hand/)).toBeInTheDocument();
  });

  it("asks for the page number too when the item is a single page that could not be recognised", async () => {
    mocks.api.createDraft.mockResolvedValue(batchOf([
      item({
        id: "p1", itemNo: 2, fileName: "pile - page 4.pdf", matchStatus: "UNMATCHED", qrStatus: "NOT_FOUND", copy: null, matchSource: null,
        loosePage: true, sourceFileName: "pile.pdf", sourcePages: "page 4 of pile.pdf",
        matchMessage: "No code could be read on this page. Enter its controlled copy number and its page number.",
      }),
    ]));
    mocks.api.updateItem.mockResolvedValue(batchOf([item({ id: "p1", itemNo: 2, matchSource: "MANUAL" })]));
    render(<ControlledCopyRecallScanView />);
    await upload([pdf("pile.pdf")]);

    expect(await screen.findByText("Page not recognised")).toBeInTheDocument();
    expect(screen.getByText("page 4 of pile.pdf")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Match by number" }));
    fireEvent.change(screen.getByLabelText("Controlled copy number"), { target: { value: "CC-001" } });
    // Without the page number the page cannot be placed.
    expect(screen.getByRole("button", { name: "Place page" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Page number"), { target: { value: "x2" } });
    fireEvent.click(screen.getByRole("button", { name: "Place page" }));

    await waitFor(() => expect(mocks.api.updateItem).toHaveBeenCalledWith("b1", "p1", { copyNumber: "CC-001", pageNumber: 2 }));
  });

  it("shows which pages of a copy a split item holds", async () => {
    mocks.api.createDraft.mockResolvedValue(batchOf([
      item({ id: "g1", itemNo: 1, fileName: "pile - CC-001.pdf", pageNumbers: "1,2,3", expectedPages: 3, sourceFileName: "pile.pdf", sourcePages: "pages 3, 1, 5 of pile.pdf" }),
    ]));
    render(<ControlledCopyRecallScanView />);
    await upload([pdf("pile.pdf")]);

    expect(await screen.findByText(/Pages 1, 2, 3 of 3/)).toBeInTheDocument();
  });

  it("opens a scan in the preview modal", async () => {
    mocks.api.createDraft.mockResolvedValue(batchOf([item({ id: "i1", itemNo: 1 })]));
    render(<ControlledCopyRecallScanView />);
    await upload([pdf("scan-1.pdf")]);

    fireEvent.click(await screen.findByRole("button", { name: "Preview scan-1.pdf" }));

    expect(screen.getByText("previewing scan-1.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByText("load"));
    expect(mocks.api.fetchItemFile).toHaveBeenCalledWith("b1", "i1");
    fireEvent.click(screen.getByText("close preview"));
    expect(screen.queryByText("previewing scan-1.pdf")).toBeNull();
    // It can be opened again after being closed.
    fireEvent.click(screen.getByRole("button", { name: "Preview scan-1.pdf" }));
    expect(screen.getByText("previewing scan-1.pdf")).toBeInTheDocument();
  });

  it("will not go on to the signature until the DCO confirms the paper was physically checked", async () => {
    mocks.api.createDraft.mockResolvedValue(batchOf([item({ id: "i1", itemNo: 1 })]));
    render(<ControlledCopyRecallScanView />);
    await upload([pdf("scan-1.pdf")]);

    fireEvent.click(await screen.findByRole("button", { name: /Recall 1 controlled copy/ }));

    const proceed = screen.getByRole("button", { name: "Continue to sign" });
    expect(proceed).toBeDisabled();
    expect(screen.queryByRole("dialog", { name: "signature" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(proceed).toBeEnabled();
    expect(mocks.api.commit).not.toHaveBeenCalled();
  });

  it("recalls the reviewed list with one signature and shows the outcome", async () => {
    mocks.api.createDraft.mockResolvedValue(batchOf([item({ id: "i1", itemNo: 1 }), item({ id: "i2", itemNo: 2, fileName: "b.pdf",
      copy: { id: "c2", number: "CC-002", recipientName: "Minh Le" } })]));
    mocks.api.commit.mockResolvedValue(batchOf([
      item({ id: "i1", itemNo: 1, outcome: "RECALLED", outcomeMessage: "Recalled; scan filed as EXEC-1" }),
      item({ id: "i2", itemNo: 2, fileName: "b.pdf", outcome: "RECALLED", outcomeMessage: "Recalled; scan filed as EXEC-2" }),
    ], { status: "COMMITTED", committedByName: "Dco User" }));
    render(<ControlledCopyRecallScanView />);
    await upload([pdf("a.pdf"), pdf("b.pdf")]);

    fireEvent.click(await screen.findByRole("button", { name: /Recall 2 controlled copies/ }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continue to sign" }));
    expect(screen.getByText("signing RCB-2026-00001")).toBeInTheDocument();
    fireEvent.click(screen.getByText("sign"));

    await waitFor(() => expect(mocks.api.commit).toHaveBeenCalledTimes(1));
    expect(mocks.api.commit).toHaveBeenCalledWith("b1", { reason: "Annual SOP refresh", receivedAt: undefined, signatureToken: "sig-token" });
    expect(await screen.findByText("Committed")).toBeInTheDocument();
    expect(screen.getAllByText("Recalled")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Open Records" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Recall 2 controlled copies/ })).toBeNull();
  });

  it("sends the date the paper was received when it is not today", async () => {
    mocks.api.createDraft.mockResolvedValue(batchOf([item({ id: "i1", itemNo: 1 })]));
    mocks.api.commit.mockResolvedValue(batchOf([item({ id: "i1", itemNo: 1, outcome: "RECALLED" })], { status: "COMMITTED" }));
    render(<ControlledCopyRecallScanView />);
    await upload([pdf("a.pdf")]);

    fireEvent.click(await screen.findByRole("button", { name: /Recall 1 controlled copy/ }));
    // Pick the 1st of the previous month in the date picker (dd/MM/yyyy on screen, an ISO date in the request).
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayText = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    fireEvent.click(screen.getByText(todayText));
    fireEvent.click(await screen.findByRole("button", { name: "Previous month" }));
    fireEvent.click(await screen.findByRole("button", { name: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(target) }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continue to sign" }));
    fireEvent.click(screen.getByText("sign"));

    await waitFor(() => expect(mocks.api.commit).toHaveBeenCalledWith("b1", expect.objectContaining({ receivedAt: `${target.getFullYear()}-${pad(target.getMonth() + 1)}-01` })));
  });

  it("reloads the batch when the recall is refused, so the DCO sees which scans are no longer ready", async () => {
    const refused = new Error("Nothing was recalled. Fix or exclude these scans first: Scan 1");
    mocks.api.createDraft.mockResolvedValue(batchOf([item({ id: "i1", itemNo: 1 })]));
    mocks.api.commit.mockRejectedValue(refused);
    mocks.api.getBatch.mockResolvedValue(batchOf([item({ id: "i1", itemNo: 1, matchStatus: "BLOCKED", matchMessage: "Controlled copy CC-001 was already recalled." })]));
    render(<ControlledCopyRecallScanView />);
    await upload([pdf("a.pdf")]);

    fireEvent.click(await screen.findByRole("button", { name: /Recall 1 controlled copy/ }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continue to sign" }));
    fireEvent.click(screen.getByText("sign"));

    await waitFor(() => expect(mocks.api.getBatch).toHaveBeenCalledWith("b1"));
    expect(mocks.signError).toBe(refused);
    expect(await screen.findByText(/already recalled/)).toBeInTheDocument();
    expect(screen.queryByText("Committed")).toBeNull();
  });

  it("discards a draft only after confirmation, recalling nothing", async () => {
    mocks.api.createDraft.mockResolvedValue(batchOf([item({ id: "i1", itemNo: 1 })]));
    mocks.api.discard.mockResolvedValue(batchOf([], { status: "DISCARDED" }));
    render(<ControlledCopyRecallScanView />);
    await upload([pdf("a.pdf")]);

    fireEvent.click(await screen.findByRole("button", { name: "Discard draft" }));
    expect(mocks.api.discard).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Discard draft" }));

    await waitFor(() => expect(mocks.api.discard).toHaveBeenCalledWith("b1"));
    expect(mocks.api.commit).not.toHaveBeenCalled();
    expect(await screen.findByText(/Upload scans of returned paper copies/)).toBeInTheDocument();
  });

  it("offers to resume an open draft", async () => {
    mocks.api.listMyDrafts.mockResolvedValue([{ id: "b9", batchNumber: "RCB-2026-00009", status: "DRAFT", totalItems: 3, createdAt: "2026-10-05T08:00:00Z" }]);
    mocks.api.getBatch.mockResolvedValue(batchOf([item({ id: "i1", itemNo: 1 })], { id: "b9", batchNumber: "RCB-2026-00009" }));
    render(<ControlledCopyRecallScanView />);

    fireEvent.click(await screen.findByRole("button", { name: "Resume" }));

    await waitFor(() => expect(mocks.api.getBatch).toHaveBeenCalledWith("b9"));
    expect(await screen.findByText("RCB-2026-00009")).toBeInTheDocument();
  });

  it("reports an upload the server refuses", async () => {
    mocks.api.createDraft.mockRejectedValue(new Error("Request failed"));
    render(<ControlledCopyRecallScanView />);

    await upload([pdf("a.pdf")]);

    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" })));
    expect(screen.getByText(/Upload scans of returned paper copies/)).toBeInTheDocument();
  });
});
