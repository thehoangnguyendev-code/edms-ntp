import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, FileUp, Hash, Loader2, ScanLine, Trash2, Undo2, X } from "lucide-react";
import { ROUTES } from "@/app/routes.constants";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { FormModal } from "@/components/ui/modal/FormModal";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { DataTable, useCustomColumnLayout, type DataTableAction, type DataTableColumn } from "@/components/ui/table";
import { TABLE_STYLES } from "@/components/ui/table/TablePrimitives";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { useToast } from "@/components/ui/toast/Toast";
import { controlledCopyRecallScan as recallScanBreadcrumbs } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { ScanPreviewModal } from "@/features/documents/shared/components/ScanPreviewModal";
import { useRetainedValue } from "@/features/documents/shared/useRetainedValue";
import { useDebounce, useNavigateWithLoading, useTableDragScroll } from "@/hooks";
import { FilterSearchInput } from "@/components/ui/filter/FilterSearchInput";
import { usePermissions } from "@/hooks/usePermissions";
import {
  controlledCopyRecallApi,
  MAX_RECALL_SCANS,
  RECALL_SCAN_ACCEPT,
  type RecallBatch,
  type RecallBatchSummary,
  type RecallItem,
  type RecallItemPatch,
  type RecallItemQuery,
  type RecallQrStatus,
} from "@/services/api/controlledCopyRecallBatches";
import { formatDateTime } from "@/utils/format";
import { getApiErrorMessage } from "@/utils/apiError";
import { IconForms } from "@tabler/icons-react";

const QR_LABEL: Record<RecallQrStatus, string> = {
  DECODED: "Code read",
  NOT_FOUND: "No code found",
  FOREIGN: "Not an EQMS code",
  MULTIPLE: "Several codes",
  UNREADABLE_FILE: "File unreadable",
  NOT_ATTEMPTED: "Not read",
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** The picker works in dd/MM/yyyy; the request and the state keep an ISO date (yyyy-MM-dd). */
const isoToDisplay = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
};
const displayToIso = (display: string) => {
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
};

const todayIso = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * Recall paper controlled copies in bulk by scanning them. A QR code on each copy identifies WHICH copy a scan belongs to; it
 * cannot show that the paper is the original, complete and correct -- that physical check stays with the DCO, who attests it
 * by signing once for the whole reviewed list. Nothing about any copy changes until that signature.
 */
export const ControlledCopyRecallScanView: React.FC = () => {
  const { navigateTo } = useNavigateWithLoading();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canRecall = hasPermission("documents.controlled_copy.recall");

  const [batch, setBatch] = useState<RecallBatch | null>(null);
  const [drafts, setDrafts] = useState<RecallBatchSummary[]>([]);
  const [selected, setSelected] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    index: number;
    count: number;
    fileName: string;
    percent: number;
    /** The whole file has been sent; the server is scanning it. */
    processing: boolean;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const addInput = useRef<HTMLInputElement>(null);

  // Search and sort of the scans are done by the server. With the default query (no search, upload order) the batch response
  // already holds every scan in that order, so nothing more is fetched.
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [sortConfig, setSortConfig] = useState<{ key: NonNullable<RecallItemQuery["sortBy"]>; direction: "asc" | "desc" }>({
    key: "itemNo",
    direction: "asc",
  });
  const [queriedItems, setQueriedItems] = useState<RecallItem[] | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const isDefaultQuery = !debouncedSearch.trim() && sortConfig.key === "itemNo" && sortConfig.direction === "asc";

  const [previewItem, setPreviewItem] = useState<RecallItem | null>(null);
  // Kept after the preview is closed, so the modal can play its closing animation still showing the scan.
  const shownItem = useRetainedValue(previewItem);
  const shownBatch = useRetainedValue(batch);
  const [matchItem, setMatchItem] = useState<RecallItem | null>(null);
  const [matchNumber, setMatchNumber] = useState("");
  const [matchPage, setMatchPage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [attested, setAttested] = useState(false);
  const [receivedDate, setReceivedDate] = useState(todayIso());
  const [signing, setSigning] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const fail = useCallback(
    (error: unknown, fallback: string) => showToast({ type: "error", title: "Recall by Scan", message: getApiErrorMessage(error, fallback) }),
    [showToast],
  );

  useEffect(() => {
    if (!canRecall) return;
    controlledCopyRecallApi.listMyDrafts().then(setDrafts).catch(() => setDrafts([]));
  }, [canRecall]);

  // Asks the server for the searched / sorted scans whenever the query or the batch changes (an upload, a match, an exclusion).
  useEffect(() => {
    if (!batch || isDefaultQuery) {
      setQueriedItems(null);
      return undefined;
    }
    let active = true;
    setQueryLoading(true);
    controlledCopyRecallApi
      .listItems(batch.id, { search: debouncedSearch.trim() || undefined, sortBy: sortConfig.key, sortDirection: sortConfig.direction })
      .then((items) => active && setQueriedItems(items))
      .catch((error) => active && fail(error, "The scans could not be loaded."))
      .finally(() => active && setQueryLoading(false));
    return () => {
      active = false;
    };
  }, [batch, isDefaultQuery, debouncedSearch, sortConfig, fail]);

  const handleSort = (key: NonNullable<RecallItemQuery["sortBy"]>) =>
    setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
  const sortOf = (key: NonNullable<RecallItemQuery["sortBy"]>) => ({
    direction: sortConfig.key === key ? sortConfig.direction : undefined,
    onSort: () => handleSort(key),
  });
  const rows = isDefaultQuery ? (batch?.items ?? []) : (queriedItems ?? batch?.items ?? []);

  const selectedBytes = selected.reduce((sum, file) => sum + file.size, 0);
  const isDraft = batch?.status === "DRAFT";
  const isCommitted = batch?.status === "COMMITTED";
  const remainingSlots = MAX_RECALL_SCANS - (batch?.totalItems ?? 0);

  // ── selecting files ────────────────────────────────────────────────────────

  const acceptFiles = (incoming: FileList | File[] | null, limit: number) => {
    const all = Array.from(incoming ?? []);
    const files = all.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (files.length < all.length) {
      showToast({
        type: "warning",
        title: "Only PDF scans are accepted",
        message: `${all.length - files.length} file(s) that are not PDF were left out.`,
      });
    }
    if (files.length === 0) return [];
    if (files.length > limit) {
      showToast({
        type: "warning",
        title: "Too many files",
        message: `A recall batch holds at most ${MAX_RECALL_SCANS} scans; the first ${limit} were kept.`,
      });
    }
    return files.slice(0, limit);
  };

  const handleSelect = (incoming: FileList | File[] | null) => {
    const room = MAX_RECALL_SCANS - selected.length;
    const added = acceptFiles(incoming, Math.max(room, 0));
    setSelected((current) => [...current, ...added]);
  };

  // ── draft lifecycle ────────────────────────────────────────────────────────

  /** Uploads the files ONE AT A TIME (the server scans each for viruses and reads its code, so a big set in one request would
   *  hold the server for minutes), reporting 0-100% over the bytes of the whole set. The first file starts the draft, each next
   *  one is added to it. Stops at the first failure: files already uploaded stay in the draft, the rest are left for a retry. */
  const uploadSequentially = async (files: File[], startFrom: RecallBatch | null, onFileDone?: (file: File) => void) => {
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0) || 1;
    let doneBytes = 0;
    let current = startFrom;
    setBusy("Uploading...");
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const show = (loaded: number) =>
          setUploadProgress({
            index: index + 1,
            count: files.length,
            fileName: file.name,
            percent: Math.min(100, Math.round(((doneBytes + Math.min(loaded, file.size)) / totalBytes) * 100)),
            processing: loaded >= file.size,
          });
        show(0);
        try {
          current = current
            ? await controlledCopyRecallApi.addFiles(current.id, [file], show)
            : await controlledCopyRecallApi.createDraft([file], show);
        } catch (error) {
          const notSent = files.length - index;
          fail(
            error,
            `"${file.name}" could not be uploaded.${
              current ? ` ${notSent} file(s) were not sent: choose them again with "Add more scans".` : ""
            }`,
          );
          return false;
        }
        setBatch(current);
        doneBytes += file.size;
        onFileDone?.(file);
      }
      return true;
    } finally {
      setUploadProgress(null);
      setBusy(null);
    }
  };

  const upload = async () => {
    if (selected.length === 0) return;
    await uploadSequentially([...selected], null, (done) => setSelected((current) => current.filter((file) => file !== done)));
  };

  const addMore = async (incoming: FileList | null) => {
    if (!batch) return;
    const files = acceptFiles(incoming, Math.max(remainingSlots, 0));
    try {
      if (files.length > 0) await uploadSequentially(files, batch);
    } finally {
      if (addInput.current) addInput.current.value = "";
    }
  };

  const resume = async (id: string) => {
    setBusy("Opening draft...");
    try {
      setBatch(await controlledCopyRecallApi.getBatch(id));
    } catch (error) {
      fail(error, "The draft could not be opened.");
    } finally {
      setBusy(null);
    }
  };

  const patchItem = async (item: RecallItem, patch: RecallItemPatch) => {
    if (!batch) return false;
    setBusy("Updating...");
    try {
      setBatch(await controlledCopyRecallApi.updateItem(batch.id, item.id, patch));
      return true;
    } catch (error) {
      fail(error, "The change could not be saved.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const submitMatch = async () => {
    if (!matchItem || !matchNumber.trim()) return;
    const pageNumber = Number.parseInt(matchPage, 10);
    if (matchItem.loosePage && !(pageNumber >= 1)) return;
    if (await patchItem(matchItem, matchItem.loosePage ? { copyNumber: matchNumber.trim(), pageNumber } : { copyNumber: matchNumber.trim() })) {
      setMatchItem(null);
      setMatchNumber("");
      setMatchPage("");
    }
  };

  const discard = async () => {
    if (!batch) return;
    setBusy("Discarding...");
    try {
      await controlledCopyRecallApi.discard(batch.id);
      setConfirmingDiscard(false);
      setBatch(null);
      setDrafts((current) => current.filter((draft) => draft.id !== batch.id));
      showToast({ type: "success", title: "Draft discarded", message: "No controlled copy was recalled." });
    } catch (error) {
      fail(error, "The draft could not be discarded.");
    } finally {
      setBusy(null);
    }
  };

  const handleSigned = async (data: { reason: string; signatureToken: string }) => {
    if (!batch) return;
    try {
      const committed = await controlledCopyRecallApi.commit(batch.id, {
        reason: data.reason,
        receivedAt: receivedDate && receivedDate !== todayIso() ? receivedDate : undefined,
        signatureToken: data.signatureToken,
      });
      setBatch(committed);
      setSigning(false);
      setConfirming(false);
      setAttested(false);
      showToast({
        type: "success",
        title: "Controlled copies recalled",
        message: `${committed.items.filter((item) => item.outcome === "RECALLED").length} controlled copies recalled in ${committed.batchNumber}.`,
      });
    } catch (error) {
      // Nothing was recalled. Reload so the list shows which scans are no longer ready, then let the signature dialog report why.
      try {
        setBatch(await controlledCopyRecallApi.getBatch(batch.id));
      } catch {
        /* the original error is what matters */
      }
      throw error;
    }
  };

  const startAnother = () => {
    setBatch(null);
    setSelected([]);
    controlledCopyRecallApi.listMyDrafts().then(setDrafts).catch(() => setDrafts([]));
  };

  // ── table ──────────────────────────────────────────────────────────────────

  const columns: DataTableColumn<RecallItem>[] = useMemo(
    () => [
      {
        id: "no",
        header: "No.",
        label: "No.",
        sort: sortOf("itemNo"),
        locked: true,
        headerClassName: TABLE_STYLES.headerCell35,
        cellClassName: TABLE_STYLES.cell30,
        cell: (item) => item.itemNo,
      },
      {
        id: "file",
        header: "Scan",
        label: "Scan",
        sort: sortOf("file"),
        cell: (item) => (
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {item.previewAvailable && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setPreviewItem(item);
                  }}
                  aria-label={`Preview ${item.fileName}`}
                  className="shrink-0 text-emerald-700 hover:text-emerald-800"
                >
                  <Eye className="h-4 w-4" />
                </button>
              )}
              <span className="truncate font-medium text-slate-800">{item.fileName}</span>
            </div>
            {item.sourcePages && (
              <p className="mt-0.5 truncate text-2xs text-slate-500" title={item.sourcePages}>
                {item.pageNumbers
                  ? `Pages ${item.pageNumbers.split(",").join(", ")}${item.expectedPages ? ` of ${item.expectedPages}` : ""} · `
                  : ""}
                {item.sourcePages}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "size",
        header: "Size",
        label: "Size",
        sort: sortOf("size"),
        cellClassName: "text-slate-600 whitespace-nowrap",
        cell: (item) => formatBytes(item.fileSize),
      },
      {
        id: "code",
        header: "Code",
        label: "Code",
        sort: sortOf("code"),
        cell: (item) =>
          item.virusStatus === "INFECTED" ? (
            <Badge color="red" size="sm">Virus found</Badge>
          ) : (
            <Badge color={item.qrStatus === "DECODED" ? "emerald" : "amber"} size="sm">{QR_LABEL[item.qrStatus] ?? item.qrStatus}</Badge>
          ),
      },
      {
        id: "copy",
        header: "Controlled copy",
        label: "Controlled copy",
        sort: sortOf("copy"),
        cell: (item) =>
          item.copy ? (
            <span className="font-medium text-slate-800">
              {item.copy.number}
              {item.matchSource === "MANUAL" && <span className="ml-1.5 text-2xs font-normal text-amber-700">(matched by hand)</span>}
            </span>
          ) : (
            "—"
          ),
      },
      {
        id: "document",
        header: "Document",
        label: "Document",
        sort: sortOf("document"),
        cell: (item) =>
          item.copy ? (
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">
                {[item.copy.documentNumber, item.copy.revisionNumber && `rev ${item.copy.revisionNumber}`].filter(Boolean).join(" · ") || "—"}
              </p>
              {item.copy.documentTitle && <p className="truncate text-2xs text-slate-500">{item.copy.documentTitle}</p>}
            </div>
          ) : (
            "—"
          ),
      },
      {
        id: "recipient",
        header: "Recipient",
        label: "Recipient",
        sort: sortOf("recipient"),
        cellClassName: "text-slate-700 whitespace-nowrap",
        cell: (item) => item.copy?.recipientName ?? "—",
      },
      {
        id: "result",
        header: "Result",
        label: "Result",
        sort: sortOf("result"),
        cell: (item) => {
          if (isCommitted) {
            return (
              <div>
                <Badge color={item.outcome === "RECALLED" ? "emerald" : "slate"} size="sm">
                  {item.outcome === "RECALLED" ? "Recalled" : "Not recalled"}
                </Badge>
                {item.outcomeMessage && <p className="mt-1 text-2xs text-slate-500">{item.outcomeMessage}</p>}
              </div>
            );
          }
          return (
            <div>
              {item.excluded ? (
                <Badge color="slate" size="sm">{item.readAndComply ? "Removed" : "Excluded"}</Badge>
              ) : item.readAndComply ? (
                <Badge color="blue" size="sm">Read only</Badge>
              ) : item.matchStatus === "READY" ? (
                <Badge color="emerald" size="sm">Ready</Badge>
              ) : item.matchStatus === "UNMATCHED" ? (
                <Badge color="amber" size="sm">{item.loosePage ? "Page not recognised" : "Needs a match"}</Badge>
              ) : (
                <Badge color="red" size="sm">Blocked</Badge>
              )}
              {!item.excluded && item.matchMessage && <p className="mt-1 text-2xs text-slate-600">{item.matchMessage}</p>}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isCommitted, sortConfig],
  );

  // Icon buttons on narrow screens (the label stays as the accessible name and tooltip); icon + text from the lg breakpoint.
  const action: DataTableAction<RecallItem> | undefined = isDraft
    ? {
        header: "Actions",
        cell: (item: RecallItem) => (
          <div className="flex items-center justify-center gap-1.5" onClick={(event) => event.stopPropagation()}>
            {!item.excluded && !item.readAndComply && item.previewAvailable && item.virusStatus !== "INFECTED" && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1 px-2"
                disabled={Boolean(busy)}
                aria-label="Match by number"
                title="Match by number"
                onClick={() => {
                  setMatchItem(item);
                  setMatchNumber(item.copy?.number ?? "");
                  setMatchPage("");
                }}
              >
                <IconForms className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Match by number</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-1 px-2"
              disabled={Boolean(busy)}
              aria-label={item.excluded ? "Include" : item.readAndComply ? "Remove" : "Exclude"}
              title={item.excluded ? "Include" : item.readAndComply ? "Remove" : "Exclude"}
              onClick={() => patchItem(item, { excluded: !item.excluded })}
            >
              {item.excluded ? <Undo2 className="h-3.5 w-3.5" /> : item.readAndComply ? <Trash2 className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              <span className="hidden lg:inline">{item.excluded ? "Include" : item.readAndComply ? "Remove" : "Exclude"}</span>
            </Button>
          </div>
        ),
      }
    : undefined;
  const { layout, control: columnControl } = useCustomColumnLayout("documents.controlled-copies.recall-scan", columns, action);

  if (!canRecall) {
    return (
      <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
        <PageHeader title="Recall by Scan" breadcrumbItems={recallScanBreadcrumbs(navigateTo)} />
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-800">
          You are not allowed to recall controlled copies. Ask an administrator for the "Recall Controlled Copy" permission.
        </div>
      </div>
    );
  }

  // Scans of copies issued for reading only: shown apart, never recalled by scan; one click removes each from the batch.
  const readOnlyItems = batch?.items.filter((item) => item.readAndComply && !item.excluded) ?? [];
  const removeAllReadOnly = async () => {
    for (const item of readOnlyItems) {
      if (!(await patchItem(item, { excluded: true }))) return;
    }
  };
  const recalledCount = batch?.items.filter((item) => item.outcome === "RECALLED").length ?? 0;

  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title="Recall by Scan"
        breadcrumbItems={recallScanBreadcrumbs(navigateTo)}
        actions={
          <Button variant="outline-emerald" size="sm" onClick={() => navigateTo(ROUTES.DOCUMENTS.CONTROLLED_COPIES.ALL)}>
            Back
          </Button>
        }
      />

      {uploadProgress ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800" role="status">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              <span className="truncate">
                File {uploadProgress.index} of {uploadProgress.count} · {uploadProgress.fileName}
              </span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{uploadProgress.percent}%</span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={uploadProgress.percent}
            aria-label="Upload progress"
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
              style={{ width: `${uploadProgress.percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-2xs text-emerald-700">
            {uploadProgress.processing
              ? "Scanning for viruses and reading the QR code..."
              : "Uploading one file at a time. Keep this page open."}
          </p>
        </div>
      ) : (
        busy && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> {busy}
          </div>
        )
      )}

      {!batch && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ScanLine className="h-4 w-4 text-emerald-600" /> Upload scans of returned paper copies
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Choose up to {MAX_RECALL_SCANS} scans (PDF only), one file per paper copy. Each file is checked for viruses, its QR
              code is read and matched to a controlled copy. Nothing is recalled until you have reviewed the list and signed.
            </p>

            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                handleSelect(event.dataTransfer.files);
              }}
              className={`mt-4 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
                dragging ? "border-emerald-400 bg-emerald-50" : "border-slate-300 bg-slate-50"
              }`}
            >
              <FileUp className="h-6 w-6 text-slate-400" />
              <p className="text-sm text-slate-600">Drop the scans here, or</p>
              <Button size="sm" variant="outline-emerald" disabled={Boolean(busy) || selected.length >= MAX_RECALL_SCANS} onClick={() => fileInput.current?.click()}>
                Choose files
              </Button>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept={RECALL_SCAN_ACCEPT}
                className="hidden"
                data-testid="recall-scan-input"
                onChange={(event) => {
                  handleSelect(event.target.files);
                  event.target.value = "";
                }}
              />
            </div>

            {selected.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-slate-700">
                  {selected.length} of {MAX_RECALL_SCANS} files chosen · {formatBytes(selectedBytes)}
                </p>
                <ul className="mt-2 max-h-56 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200">
                  {selected.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
                      <span className="truncate text-slate-800">{file.name}</span>
                      <span className="flex shrink-0 items-center gap-2 text-slate-500">
                        {formatBytes(file.size)}
                        <button
                          type="button"
                          aria-label={`Remove ${file.name}`}
                          className="text-slate-400 hover:text-red-600"
                          onClick={() => setSelected((current) => current.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => setSelected([])}>
                    Clear
                  </Button>
                  <Button size="sm" variant="outline-emerald" disabled={Boolean(busy)} onClick={upload}>
                    Read codes and review
                  </Button>
                </div>
              </div>
            )}
          </div>

          {drafts.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <h2 className="text-sm font-semibold text-slate-900">Your open drafts</h2>
              <ul className="mt-2 divide-y divide-slate-100">
                {drafts.map((draft) => (
                  <li key={draft.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="text-slate-700">
                      <span className="font-medium">{draft.batchNumber}</span> · {draft.totalItems} scan(s) · started {formatDateTime(draft.createdAt ?? "")}
                    </span>
                    <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => resume(draft.id)}>
                      Resume
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {batch && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <span className="text-sm font-semibold text-slate-900">{batch.batchNumber}</span>
            <Badge color={isCommitted ? "emerald" : "amber"} size="sm">{isCommitted ? "Committed" : "Draft"}</Badge>
            {isDraft ? (
              <>
                <Badge color="emerald" size="sm">{batch.readyItems} ready</Badge>
                {batch.blockedItems + batch.unmatchedItems - readOnlyItems.length > 0 && (
                  <Badge color="red" size="sm">{batch.blockedItems + batch.unmatchedItems - readOnlyItems.length} need attention</Badge>
                )}
                {readOnlyItems.length > 0 && <Badge color="blue" size="sm">{readOnlyItems.length} read only</Badge>}
                {batch.excludedItems > 0 && <Badge color="slate" size="sm">{batch.excludedItems} excluded</Badge>}
              </>
            ) : (
              <span className="text-xs text-slate-600">
                {recalledCount} recalled{batch.committedByName ? ` by ${batch.committedByName}` : ""}
                {batch.committedAt ? ` on ${formatDateTime(batch.committedAt)}` : ""}
              </span>
            )}
          </div>

          {isDraft && readOnlyItems.length > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900" role="status">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <span>
                  {readOnlyItems.length} scan(s) are of copies issued for reading only (Read and comply). They are not recalled by scan and no Record is made
                  from them. Remove them here; the other scans are processed as usual. If such a copy has to be recalled, do it from Controlled Copies.
                </span>
                {readOnlyItems.length > 1 && (
                  <Button size="sm" variant="outline" className="gap-1 shrink-0" disabled={Boolean(busy)} onClick={removeAllReadOnly}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove all
                  </Button>
                )}
              </div>
              <ul className="mt-2 space-y-1.5">
                {readOnlyItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 rounded-md bg-white/70 px-2 py-1.5">
                    <span className="min-w-0 truncate">
                      <span className="font-semibold">{item.copy?.number ?? item.fileName}</span>
                      <span className="text-blue-800"> · {item.fileName}</span>
                    </span>
                    <Button size="sm" variant="outline" className="gap-1 px-2 shrink-0" disabled={Boolean(busy)} aria-label={`Remove ${item.fileName}`} onClick={() => patchItem(item, { excluded: true })}>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Remove</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isDraft && batch.blockedItems + batch.unmatchedItems - readOnlyItems.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert">
              <span>
                Some scans cannot be recalled yet. Match them by copy number, or exclude them, then continue. A scan that is excluded stays
                uploaded but nothing happens to its copy.
              </span>
            </div>
          )}

          {isCommitted && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900" role="status">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                The recall is signed and final. Each scan is filed under Records, where it can be opened and previewed.
              </span>
            </div>
          )}

          <div className="overflow-hidden rounded-none border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between md:px-4">
              <div className="w-full sm:max-w-sm">
                <FilterSearchInput
                  aria-label="Search scans"
                  placeholder="File, copy number, document or recipient..."
                  value={searchQuery}
                  onChange={setSearchQuery}
                />
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-xs font-medium text-slate-600">
                  {rows.length === batch.totalItems
                    ? `${batch.totalItems} ${batch.totalItems === 1 ? "scan" : "scans"}`
                    : `${rows.length} of ${batch.totalItems} scans`}
                </span>
                {columnControl}
              </div>
            </div>
            <div className="relative">
              {queryLoading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-[2px]" role="status" aria-label="Searching">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                </div>
              )}
              <DataTable
                className="rounded-none"
                rows={rows}
                columns={layout.columns}
                columnLayout={layout}
                action={action}
                scrollerRef={scrollerRef}
                scrollProps={dragEvents}
                isDragging={isDragging}
                getRowKey={(item) => item.id}
                emptyState={
                  <TableEmptyState
                    title={isDefaultQuery ? "No scans" : "No scans found"}
                    description={isDefaultQuery ? "This batch has no scans." : "No scan matches your search."}
                  />
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {isDraft ? (
              <>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={Boolean(busy) || remainingSlots <= 0} onClick={() => addInput.current?.click()}>
                    Add more scans
                  </Button>
                  <input
                    ref={addInput}
                    type="file"
                    multiple
                    accept={RECALL_SCAN_ACCEPT}
                    className="hidden"
                    data-testid="recall-scan-add-input"
                    onChange={(event) => addMore(event.target.files)}
                  />
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" disabled={Boolean(busy)} onClick={() => setConfirmingDiscard(true)}>
                    Discard draft
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="outline-emerald"
                  disabled={Boolean(busy) || !batch.readyToCommit}
                  onClick={() => {
                    setAttested(false);
                    setReceivedDate(todayIso());
                    setConfirming(true);
                  }}
                >
                  Recall {batch.readyItems} controlled {batch.readyItems === 1 ? "copy" : "copies"}
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => navigateTo(ROUTES.DOCUMENTS.RECORDS)}>
                  Open Records
                </Button>
                <Button size="sm" variant="outline-emerald" onClick={startAnother}>
                  Start another batch
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Preview of one uploaded scan */}
      {shownBatch && shownItem && (
        <ScanPreviewModal
          isOpen={Boolean(batch && previewItem)}
          onClose={() => setPreviewItem(null)}
          title={shownItem.fileName}
          subtitle={shownItem.copy?.number ?? shownBatch.batchNumber}
          fileKey={shownItem.id}
          loadFile={() => controlledCopyRecallApi.fetchItemFile(shownBatch.id, shownItem.id)}
        />
      )}

      {/* Identify a copy by number when its code could not be read */}
      <FormModal
        isOpen={Boolean(matchItem)}
        onClose={() => {
          setMatchItem(null);
          setMatchNumber("");
          setMatchPage("");
        }}
        onConfirm={submitMatch}
        title={matchItem?.loosePage ? "Place this page in a controlled copy" : "Match to a controlled copy"}
        description={
          matchItem?.loosePage
            ? `Look at the page (${matchItem.sourcePages ?? matchItem.fileName}) and type the controlled copy number printed on it, and which page of that copy it is. The page is put into that copy's file at exactly that place.`
            : `Type the controlled copy number printed on the paper for ${matchItem?.fileName ?? "this scan"}. Only paper copies that carry a scan code can be recalled this way; an electronic copy is recalled from its own page.`
        }
        confirmText={matchItem?.loosePage ? "Place page" : "Match"}
        confirmDisabled={!matchNumber.trim() || (Boolean(matchItem?.loosePage) && !(Number.parseInt(matchPage, 10) >= 1)) || Boolean(busy)}
        size="md"
      >
        <input
          value={matchNumber}
          onChange={(event) => setMatchNumber(event.target.value)}
          placeholder="Controlled copy number"
          aria-label="Controlled copy number"
          className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        {matchItem?.loosePage && (
          <input
            value={matchPage}
            onChange={(event) => setMatchPage(event.target.value.replace(/\D/g, ""))}
            placeholder="Page number within the copy"
            aria-label="Page number"
            inputMode="numeric"
            className="mt-3 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        )}
      </FormModal>

      {/* Attestation before the signature */}
      <FormModal
        isOpen={confirming && !signing}
        onClose={() => setConfirming(false)}
        onConfirm={() => setSigning(true)}
        title={`Recall ${batch?.readyItems ?? 0} Controlled ${batch?.readyItems === 1 ? "Copy" : "Copies"}?`}
        description="You will sign once for every copy in this list. Each copy becomes Obsoleted (recalled) and its scan is filed under Records. This cannot be undone."
        confirmText="Continue to sign"
        confirmDisabled={!attested || !receivedDate || receivedDate > todayIso()}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <DateTimePicker
              label="Date the paper was received"
              value={isoToDisplay(receivedDate)}
              onChange={(value) => setReceivedDate(displayToIso(value))}
              error={receivedDate > todayIso() ? "The received date cannot be in the future." : undefined}
            />
            <p className="mt-1 text-2xs text-slate-500">The signing time is recorded separately and cannot be changed.</p>
          </div>
          <Checkbox
            checked={attested}
            onChange={setAttested}
            label="I have physically received these paper copies and checked that each one is the copy shown for it: the original, complete and the right one. A QR code alone does not prove that."
          />
        </div>
      </FormModal>

      {signing && batch && (
        <ESignatureModal
          isOpen
          onClose={() => setSigning(false)}
          onConfirm={handleSigned}
          actionTitle="Recall Controlled Copies"
          meaningCode="CONTROLLED_COPY_RECALLED"
          meaningDisplayName="Controlled Copy Recalled"
          targetDetails={{ code: batch.batchNumber, title: `${batch.readyItems} controlled ${batch.readyItems === 1 ? "copy" : "copies"}` }}
        />
      )}

      <FormModal
        isOpen={confirmingDiscard}
        onClose={() => setConfirmingDiscard(false)}
        onConfirm={discard}
        title="Discard This Draft?"
        description="The uploaded scans are kept on record but no controlled copy is recalled."
        confirmText="Discard draft"
        confirmVariant="destructive"
        isLoading={busy === "Discarding..."}
        size="md"
      />
    </div>
  );
};
