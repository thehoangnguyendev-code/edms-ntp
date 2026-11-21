import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Eye, Loader2, Trash2, Undo2 } from "lucide-react";
import { ROUTES } from "@/app/routes.constants";
import { Badge } from "@/components/ui/badge/Badge";
import { flagColor } from "@/utils/status";
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
import { cn } from "@/components/ui/utils";
import { controlledCopyRecallScan as recallScanBreadcrumbs } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { type RecallQueueState, type RecallQueuedFile, type RecallScanProgress } from "./RecallScanPanel";
import { RecallUploadArea } from "./RecallUploadArea";
import { formatBytes } from "./recallFormat";
import { ScanPreviewModal } from "@/features/documents/shared/components/ScanPreviewModal";
import { useRetainedValue } from "@/features/documents/shared/useRetainedValue";
import { useDebounce, useNavigateWithLoading, useTableDragScroll } from "@/hooks";
import { FilterSearchInput } from "@/components/ui/filter/FilterSearchInput";
import { usePermissions } from "@/hooks/usePermissions";
import {
  controlledCopyRecallApi,
  MAX_RECALL_FILE_BYTES,
  MAX_RECALL_SCANS,
  type RecallBatch,
  type RecallBatchSummary,
  type RecallCopyLookup,
  type RecallItem,
  type RecallItemGroup,
  type RecallItemPatch,
  type RecallItemQuery,
  type RecallQrStatus,
  type RecallUploadStep,
} from "@/services/api/controlledCopyRecallBatches";
import { formatDateTime } from "@/utils/format";
import { getApiErrorMessage } from "@/utils/apiError";
import { IconForms, IconTrash, IconX } from "@tabler/icons-react";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";

const QR_LABEL: Record<RecallQrStatus, string> = {
  DECODED: "Code read",
  NOT_FOUND: "No code found",
  FOREIGN: "Not an EQMS code",
  MULTIPLE: "Several codes",
  UNREADABLE_FILE: "File unreadable",
  NOT_ATTEMPTED: "Not read",
};

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

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

/** A badge that filters the table to the scans it counts; pressing it again shows every scan. */
const GroupBadge: React.FC<{
  group: RecallItemGroup;
  active: RecallItemGroup | undefined;
  color: "emerald" | "red" | "blue" | "slate";
  onSelect: (group: RecallItemGroup | undefined) => void;
  children: React.ReactNode;
}> = ({ group, active, color, onSelect, children }) => (
  <button
    type="button"
    aria-pressed={active === group}
    onClick={() => onSelect(active === group ? undefined : group)}
    className={cn(
      "rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1",
      active === group && "ring-2 ring-slate-400 ring-offset-1",
    )}
  >
    <Badge color={color} size="sm">{children}</Badge>
  </button>
);

/** The Result column and the card on small screens: the state of a scan, in words a person can read in full. */
/** Why a scan has the result it has, in words (the server's message), or null when there is nothing to add. */
const reasonOf = (item: RecallItem, isCommitted: boolean): string | null =>
  (isCommitted ? item.outcomeMessage : !item.excluded ? item.matchMessage : null) || null;

/** {@code reason}: also write the reason under the badge (the card on small screens); the table has a column of its own for it. */
const ResultCell: React.FC<{ item: RecallItem; isCommitted: boolean; onOpenRecord: (recordNumber: string) => void; reason?: boolean }> = ({ item, isCommitted, onOpenRecord, reason = true }) => {
  if (isCommitted) {
    return (
      <div>
        <Badge color={flagColor(item.outcome === "RECALLED")} size="sm">
          {item.outcome === "RECALLED" ? "Recalled" : "Not recalled"}
        </Badge>
        {reason && item.outcomeMessage && <p className="mt-1 text-2xs text-slate-500 whitespace-normal break-words">{item.outcomeMessage}</p>}
        {item.executedRecordNumber && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenRecord(item.executedRecordNumber!);
            }}
            className="mt-1 inline-flex items-center gap-1 text-2xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
          >
            Open {item.executedRecordNumber}
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
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
      {reason && !item.excluded && item.matchMessage && (
        <p className="mt-1 text-2xs text-slate-600 whitespace-normal break-words" title={item.matchMessage}>
          {item.matchMessage}
        </p>
      )}
    </div>
  );
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
  const [uploadProgress, setUploadProgress] = useState<RecallScanProgress | null>(null);
  const [queue, setQueue] = useState<RecallQueuedFile[]>([]);
  const cancelUpload = useRef(false);
  /** The Add More Scans dialog, for a draft that is already open. */
  const [addOpen, setAddOpen] = useState(false);

  // Search, group and sort of the scans are done by the server. With the default query (nothing typed, no group, upload order)
  // the batch response already holds every scan in that order, so nothing more is fetched.
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);
  const [group, setGroup] = useState<RecallItemGroup | undefined>(undefined);
  const [sortConfig, setSortConfig] = useState<{ key: NonNullable<RecallItemQuery["sortBy"]>; direction: "asc" | "desc" }>({
    key: "itemNo",
    direction: "asc",
  });
  const [queriedItems, setQueriedItems] = useState<RecallItem[] | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const isDefaultQuery = !debouncedSearch.trim() && !group && sortConfig.key === "itemNo" && sortConfig.direction === "asc";

  const [previewItem, setPreviewItem] = useState<RecallItem | null>(null);
  // Kept after the preview is closed, so the modal can play its closing animation still showing the scan.
  const shownItem = useRetainedValue(previewItem);
  const shownBatch = useRetainedValue(batch);
  const [matchItem, setMatchItem] = useState<RecallItem | null>(null);
  const [matchNumber, setMatchNumber] = useState("");
  const [matchPage, setMatchPage] = useState("");
  const debouncedMatchNumber = useDebounce(matchNumber, SEARCH_DEBOUNCE_MS);
  const [lookup, setLookup] = useState<{ number: string; result: RecallCopyLookup } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [attested, setAttested] = useState(false);
  const [receivedDate, setReceivedDate] = useState(todayIso());
  const [signing, setSigning] = useState(false);
  const [discardTarget, setDiscardTarget] = useState<{ id: string; number: string } | null>(null);
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  const fail = useCallback(
    (error: unknown, fallback: string) => showToast({ type: "error", title: "Recall by Scan", message: getApiErrorMessage(error, fallback) }),
    [showToast],
  );

  useEffect(() => {
    if (!canRecall) return;
    controlledCopyRecallApi.listMyDrafts().then(setDrafts).catch(() => setDrafts([]));
  }, [canRecall]);

  // Files chosen but not yet uploaded, or an upload under way, are lost when the tab closes.
  const holdsUnsentWork = Boolean(uploadProgress) || (!batch && selected.length > 0);
  useEffect(() => {
    if (!holdsUnsentWork) return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [holdsUnsentWork]);

  // Asks the server for the searched / grouped / sorted scans whenever the query or the batch changes (an upload, a match, an exclusion).
  useEffect(() => {
    if (!batch || isDefaultQuery) {
      setQueriedItems(null);
      return undefined;
    }
    let active = true;
    setQueryLoading(true);
    controlledCopyRecallApi
      .listItems(batch.id, { search: debouncedSearch.trim() || undefined, status: group, sortBy: sortConfig.key, sortDirection: sortConfig.direction })
      .then((items) => active && setQueriedItems(items))
      .catch((error) => active && fail(error, "The scans could not be loaded."))
      .finally(() => active && setQueryLoading(false));
    return () => {
      active = false;
    };
  }, [batch, isDefaultQuery, debouncedSearch, group, sortConfig, fail]);

  // Shows the copy a typed number would match, before the DCO confirms a hand match.
  useEffect(() => {
    const number = debouncedMatchNumber.trim();
    if (!matchItem || !batch || !number) {
      setLookup(null);
      return undefined;
    }
    let active = true;
    setLookingUp(true);
    controlledCopyRecallApi
      .lookupCopy(batch.id, number)
      .then((result) => active && setLookup({ number, result }))
      .catch(() => active && setLookup(null))
      .finally(() => active && setLookingUp(false));
    return () => {
      active = false;
    };
  }, [matchItem, batch, debouncedMatchNumber]);

  const handleSort = (key: NonNullable<RecallItemQuery["sortBy"]>) =>
    setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
  const sortOf = (key: NonNullable<RecallItemQuery["sortBy"]>) => ({
    direction: sortConfig.key === key ? sortConfig.direction : undefined,
    onSort: () => handleSort(key),
  });
  const rows = isDefaultQuery ? (batch?.items ?? []) : (queriedItems ?? batch?.items ?? []);

  const isDraft = batch?.status === "DRAFT";
  const isCommitted = batch?.status === "COMMITTED";
  const remainingSlots = MAX_RECALL_SCANS - (batch?.totalItems ?? 0);

  // ── selecting files ────────────────────────────────────────────────────────

  const acceptFiles = (incoming: FileList | File[] | null, limit: number) => {
    const all = Array.from(incoming ?? []);
    const pdfs = all.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length < all.length) {
      showToast({
        type: "warning",
        title: "Only PDF scans are accepted",
        message: `${plural(all.length - pdfs.length, "file")} that ${all.length - pdfs.length === 1 ? "is" : "are"} not PDF left out.`,
      });
    }
    const files = pdfs.filter((file) => file.size <= MAX_RECALL_FILE_BYTES);
    if (files.length < pdfs.length) {
      showToast({
        type: "warning",
        title: "File too large",
        message: `${plural(pdfs.length - files.length, "file")} over ${formatBytes(MAX_RECALL_FILE_BYTES)} left out. Split a large scan into smaller files.`,
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
    const room = (batch ? remainingSlots : MAX_RECALL_SCANS) - selected.length;
    const added = acceptFiles(incoming, Math.max(room, 0));
    setSelected((current) => [...current, ...added]);
  };

  // ── draft lifecycle ────────────────────────────────────────────────────────

  /** Uploads the files ONE AT A TIME (the server scans each for viruses and reads its code, so a big set in one request would
   *  hold the server for minutes). The bar follows the real work: sending the bytes is the first fifth of a file, and the rest
   *  follows the steps the server reports for that upload, asked for every 400 ms. Over the whole set it is weighted by file size.
   *  The first file starts the draft, each next one is added to it. Stops at the first failure or when the user stops it: files
   *  already uploaded stay in the draft, the rest are left for a retry. */
  const uploadSequentially = async (files: File[], startFrom: RecallBatch | null, onFileDone?: (file: File) => void) => {
    const SEND_SHARE = 0.2;
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0) || 1;
    let doneBytes = 0;
    let current = startFrom;
    let stopped = false;
    let sentFiles = 0;
    cancelUpload.current = false;
    setQueue(files.map((file) => ({ name: file.name, size: file.size, state: "waiting" })));
    const mark = (index: number, state: RecallQueueState) => setQueue((items) => items.map((item, position) => (position === index ? { ...item, state } : item)));
    setBusy("Uploading...");
    try {
      for (let index = 0; index < files.length; index += 1) {
        if (cancelUpload.current) {
          stopped = true;
          break;
        }
        const file = files[index];
        const uploadId = crypto.randomUUID();
        let sentFraction = 0;
        let serverStep: RecallUploadStep | null = null;
        let sent = false;
        // a late answer to the progress question of THIS file must not draw after the file is done: by then the next file has the bar (and doneBytes already counts this one)
        let live = true;
        const render = () => {
          if (!live) return;
          const serverFraction = serverStep ? serverStep.percent / 100 : 0;
          const fileFraction = sent ? SEND_SHARE + (1 - SEND_SHARE) * serverFraction : SEND_SHARE * sentFraction;
          setUploadProgress({
            index: index + 1,
            count: files.length,
            fileName: file.name,
            percent: Math.min(100, Math.round(((doneBytes + file.size * fileFraction) / totalBytes) * 100)),
            filePercent: Math.min(100, Math.round(fileFraction * 100)),
            processing: sent,
            step: serverStep?.message,
          });
        };
        const show = (loaded: number) => {
          sentFraction = Math.min(loaded, file.size) / (file.size || 1);
          sent = loaded >= file.size;
          render();
        };
        let polling = false;
        const poll = window.setInterval(async () => {
          if (!sent || polling) return;
          polling = true;
          try {
            const step = await controlledCopyRecallApi.getUploadProgress(uploadId);
            if (step && (!serverStep || step.percent >= serverStep.percent)) {
              serverStep = step;
              render();
            }
          } catch {
            // a missed answer just keeps the last step shown
          } finally {
            polling = false;
          }
        }, 400);
        mark(index, "active");
        show(0);
        try {
          current = current
            ? await controlledCopyRecallApi.addFiles(current.id, [file], show, uploadId)
            : await controlledCopyRecallApi.createDraft([file], show, uploadId);
        } catch (error) {
          mark(index, "failed");
          const notSent = files.length - index;
          fail(
            error,
            `"${file.name}" could not be uploaded.${
              current ? ` ${plural(notSent, "file")} not sent: choose ${notSent === 1 ? "it" : "them"} again with "Add More Scans".` : ""
            }`,
          );
          return false;
        } finally {
          live = false;
          window.clearInterval(poll);
        }
        mark(index, "done");
        // A draft being started is only shown when every file is in and the bar is full; files added to a draft already on screen show at once.
        if (startFrom) setBatch(current);
        doneBytes += file.size;
        sentFiles += 1;
        onFileDone?.(file);
      }
      if (stopped) {
        showToast({ type: "info", title: "Upload stopped", message: `${plural(files.length - sentFiles, "file")} not sent.` });
        return false;
      }
      setUploadProgress({ index: files.length, count: files.length, fileName: files[files.length - 1].name, percent: 100, filePercent: 100, processing: true, step: "Done.", finished: true });
      await new Promise((resolve) => window.setTimeout(resolve, 900)); // the sheet is seen read, with its check, before the screen changes
      if (!startFrom) setBatch(current);
      return true;
    } finally {
      // a draft started by an upload that stopped half way still opens, with the files that did get in
      if (!startFrom && current) setBatch(current);
      setUploadProgress(null);
      setQueue([]);
      setBusy(null);
    }
  };

  const upload = async () => {
    if (selected.length === 0) return;
    await uploadSequentially([...selected], null, (done) => setSelected((current) => current.filter((file) => file !== done)));
  };

  /** Sends the files chosen in the Add More Scans dialog to the open draft; the dialog closes when every code is read, and stays open with what was not sent if it stops. */
  const addUpload = async () => {
    if (!batch || selected.length === 0) return;
    const sent = await uploadSequentially([...selected], batch, (done) => setSelected((current) => current.filter((file) => file !== done)));
    if (sent) setAddOpen(false);
  };

  const closeAdd = () => {
    if (uploadProgress) return; // the files are being sent: stop them with "Stop After This File", the dialog is not left in the middle of it
    setAddOpen(false);
    setSelected([]);
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

  const closeMatch = () => {
    setMatchItem(null);
    setMatchNumber("");
    setMatchPage("");
    setLookup(null);
  };

  const submitMatch = async () => {
    if (!matchItem || !matchNumber.trim()) return;
    const pageNumber = Number.parseInt(matchPage, 10);
    if (matchItem.loosePage && !(pageNumber >= 1)) return;
    if (await patchItem(matchItem, matchItem.loosePage ? { copyNumber: matchNumber.trim(), pageNumber } : { copyNumber: matchNumber.trim() })) {
      closeMatch();
    }
  };

  const discard = async () => {
    if (!discardTarget) return;
    const target = discardTarget;
    setBusy("Discarding...");
    try {
      await controlledCopyRecallApi.discard(target.id);
      setDiscardTarget(null);
      if (batch?.id === target.id) setBatch(null);
      setDrafts((current) => current.filter((draft) => draft.id !== target.id));
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
    setGroup(undefined);
    setSearchQuery("");
    controlledCopyRecallApi.listMyDrafts().then(setDrafts).catch(() => setDrafts([]));
  };

  const goBack = () => (uploadProgress ? setConfirmingLeave(true) : navigateTo(ROUTES.DOCUMENTS.CONTROLLED_COPIES.ALL));
  const openRecord = useCallback(
    (recordNumber: string) => navigateTo(`${ROUTES.DOCUMENTS.RECORDS}?search=${encodeURIComponent(recordNumber)}`),
    [navigateTo],
  );

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
            {/* A scan the server refused at upload (not a PDF, too many pages, a virus...) was never stored, so it has no preview: say why here, where the person looks for the eye. */}
            {!item.previewAvailable && item.matchMessage && (
              <p className="mt-0.5 whitespace-normal break-words text-2xs text-red-600" title={item.matchMessage}>
                No preview: {item.matchMessage}
              </p>
            )}
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
        id: "result",
        header: "Result",
        label: "Result",
        sort: sortOf("result"),
        cell: (item) => <ResultCell item={item} isCommitted={isCommitted} onOpenRecord={openRecord} reason={false} />,
      },
      {
        id: "reason",
        header: "Reason",
        label: "Reason",
        headerClassName: "min-w-[18rem]",
        cellClassName: "!whitespace-normal",
        cell: (item) => {
          const reason = reasonOf(item, isCommitted);
          return reason ? <p className="text-xs text-slate-600 break-words" title={reason}>{reason}</p> : <span className="text-slate-400">—</span>;
        },
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
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isCommitted, sortConfig, openRecord],
  );

  const startMatch = (item: RecallItem) => {
    setMatchItem(item);
    setMatchNumber(item.copy?.number ?? "");
    setMatchPage("");
  };

  const itemButtons = (item: RecallItem) => {
    const label = item.excluded ? "Include" : item.readAndComply ? "Remove" : "Exclude";
    return (
      <>
        {!item.excluded && !item.readAndComply && item.previewAvailable && item.virusStatus !== "INFECTED" && (
          <Button size="sm" variant="default" className="gap-1 px-2" disabled={Boolean(busy)} aria-label="Match by number" title="Match by number" onClick={() => startMatch(item)}>
            <IconForms className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Match by Number</span>
          </Button>
        )}
        <Button
          size="sm"
          variant={item.excluded ? "outline-emerald" : item.readAndComply ? "outline" : "destructive"}
          className="gap-1 px-2"
          disabled={Boolean(busy)}
          aria-label={label}
          title={label}
          onClick={() => patchItem(item, { excluded: !item.excluded })}
        >
          {item.excluded ? <Undo2 className="h-3.5 w-3.5" /> : item.readAndComply ? <IconTrash className="h-3.5 w-3.5" /> : <IconX className="h-3.5 w-3.5" />}
          <span className="hidden lg:inline">{label}</span>
        </Button>
      </>
    );
  };

  // Icon buttons on narrow screens (the label stays as the accessible name and tooltip); icon + text from the lg breakpoint.
  const action: DataTableAction<RecallItem> | undefined = isDraft
    ? {
        header: "Actions",
        cell: (item: RecallItem) => (
          <div className="flex items-center justify-center gap-1.5" onClick={(event) => event.stopPropagation()}>
            {itemButtons(item)}
          </div>
        ),
      }
    : undefined;
  const { layout, control: columnControl, isDesktop } = useCustomColumnLayout("documents.controlled-copies.recall-scan", columns, action);

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
  const attentionCount = batch ? batch.blockedItems + batch.unmatchedItems - readOnlyItems.length : 0;

  const lookupFor = lookup && lookup.number === matchNumber.trim() ? lookup.result : null;
  const lookupPending = Boolean(matchNumber.trim()) && (lookingUp || !lookupFor);
  const matchPageInvalid = Boolean(matchItem?.loosePage) && !(Number.parseInt(matchPage, 10) >= 1);

  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title="Recall by Scan"
        breadcrumbItems={recallScanBreadcrumbs(navigateTo)}
        actions={
          <Button variant="outline-emerald" size="sm" onClick={goBack}>
            Back
          </Button>
        }
      />

      {busy && !uploadProgress && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> {busy}
        </div>
      )}

      {!batch && (
        <div className="space-y-4">
          {drafts.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <h2 className="text-sm font-semibold text-slate-900">Your Open Drafts</h2>
              <p className="mt-0.5 text-xs text-slate-500">Resume one of these before starting a new batch, so a scan is not uploaded twice.</p>
              <ul className="mt-2 divide-y divide-slate-100">
                {drafts.map((draft, index) => (
                  <li key={draft.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 text-slate-700">
                      <span className="mr-2 inline-block min-w-[1.5rem] text-slate-400 tabular-nums">{index + 1}.</span>
                      <span className="font-medium">{draft.batchNumber}</span> · {plural(draft.totalItems, "scan")} · started {formatDateTime(draft.createdAt ?? "")}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        disabled={Boolean(busy)}
                        aria-label={`Discard ${draft.batchNumber}`}
                        onClick={() => setDiscardTarget({ id: draft.id, number: draft.batchNumber })}
                      >
                        Discard
                      </Button>
                      <Button size="sm" variant="default" disabled={Boolean(busy)} onClick={() => resume(draft.id)}>
                        Resume
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <RecallUploadArea
            selected={selected}
            maxFiles={MAX_RECALL_SCANS}
            busy={Boolean(busy)}
            progress={uploadProgress}
            queue={queue}
            onSelect={handleSelect}
            onRemove={(index) => setSelected((current) => current.filter((_, i) => i !== index))}
            onClear={() => setSelected([])}
            onUpload={upload}
            onStop={() => { cancelUpload.current = true; }}
          />
        </div>
      )}

      {batch && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <span className="text-sm font-semibold text-slate-900">{batch.batchNumber}</span>
            <Badge color={isCommitted ? "emerald" : "amber"} size="sm">{isCommitted ? "Committed" : "Draft"}</Badge>
            {isDraft ? (
              <>
                <GroupBadge group="READY" active={group} color="emerald" onSelect={setGroup}>{batch.readyItems} ready</GroupBadge>
                {attentionCount > 0 && <GroupBadge group="ATTENTION" active={group} color="red" onSelect={setGroup}>{attentionCount} need attention</GroupBadge>}
                {readOnlyItems.length > 0 && <GroupBadge group="READ_ONLY" active={group} color="blue" onSelect={setGroup}>{readOnlyItems.length} read only</GroupBadge>}
                {batch.excludedItems > 0 && <GroupBadge group="EXCLUDED" active={group} color="slate" onSelect={setGroup}>{batch.excludedItems} excluded</GroupBadge>}
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
                  {plural(readOnlyItems.length, "scan")} {readOnlyItems.length === 1 ? "is" : "are"} of copies issued for reading only (Read and comply). They are not recalled by scan and no Record is made
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

          {isDraft && attentionCount > 0 && (
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
              <span>The recall is signed and final. Each scan is filed under Records, where it can be opened and previewed.</span>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-end gap-2 p-4 md:p-5">
              <div className="min-w-0 flex-1">
                <label className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">Search</label>
                <FilterSearchInput
                  aria-label="Search scans"
                  placeholder="File, copy number, document or recipient..."
                  value={searchQuery}
                  onChange={setSearchQuery}
                />
              </div>
              {columnControl}
            </div>
            <div className="relative px-4 pb-4 md:px-5 md:pb-5">
              {queryLoading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-[2px]" role="status" aria-label="Searching">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                </div>
              )}
              {isDesktop ? (
                <DataTable
                  rows={rows}
                  columns={layout.columns}
                  columnLayout={layout}
                  action={action}
                  scrollerRef={scrollerRef}
                  scrollProps={dragEvents}
                  isDragging={isDragging}
                  getRowKey={(item) => item.id}
                  rowClassName={(item) => (item.previewAvailable ? "cursor-pointer" : "")}
                  rowTabIndex={0}
                  onRowClick={(item) => item.previewAvailable && setPreviewItem(item)}
                  onRowKeyDown={(event, item) => {
                    if ((event.key === "Enter" || event.key === " ") && item.previewAvailable) {
                      event.preventDefault();
                      setPreviewItem(item);
                    }
                  }}
                  emptyState={
                    <TableEmptyState
                      title={isDefaultQuery ? "No scans" : "No scans found"}
                      description={isDefaultQuery ? "This batch has no scans." : "No scan matches your search."}
                    />
                  }
                />
              ) : (
                <div className="space-y-3">
                  {rows.length === 0 ? (
                    <TableEmptyState
                      title={isDefaultQuery ? "No scans" : "No scans found"}
                      description={isDefaultQuery ? "This batch has no scans." : "No scan matches your search."}
                    />
                  ) : (
                    rows.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {item.itemNo}. {item.fileName}
                            </p>
                            <p className="mt-0.5 text-2xs text-slate-500">{formatBytes(item.fileSize)}</p>
                          </div>
                          {item.previewAvailable && (
                            <Button size="icon-sm" variant="ghost" className="shrink-0 text-emerald-700" aria-label={`Preview ${item.fileName}`} onClick={() => setPreviewItem(item)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {item.virusStatus === "INFECTED" ? (
                            <Badge color="red" size="sm">Virus found</Badge>
                          ) : (
                            <Badge color={item.qrStatus === "DECODED" ? "emerald" : "amber"} size="sm">{QR_LABEL[item.qrStatus] ?? item.qrStatus}</Badge>
                          )}
                        </div>
                        {item.copy && (
                          <div className="mt-2 text-xs text-slate-600">
                            <p className="font-medium text-slate-800">
                              {item.copy.number}
                              {item.matchSource === "MANUAL" && <span className="ml-1.5 text-2xs font-normal text-amber-700">(matched by hand)</span>}
                            </p>
                            <p className="truncate">
                              {[item.copy.documentNumber, item.copy.revisionNumber && `rev ${item.copy.revisionNumber}`].filter(Boolean).join(" · ")}
                              {item.copy.recipientName ? ` · ${item.copy.recipientName}` : ""}
                            </p>
                          </div>
                        )}
                        <div className="mt-3 border-t border-slate-100 pt-3">
                          <ResultCell item={item} isCommitted={Boolean(isCommitted)} onOpenRecord={openRecord} />
                        </div>
                        {isDraft && <div className="mt-3 flex items-center justify-end gap-2">{itemButtons(item)}</div>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {isDraft ? (
              <>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline-emerald" disabled={Boolean(busy) || remainingSlots <= 0} onClick={() => setAddOpen(true)}>
                    Add More Scans
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600" disabled={Boolean(busy)} onClick={() => setDiscardTarget({ id: batch.id, number: batch.batchNumber })}>
                    Discard Draft
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  disabled={Boolean(busy) || !batch.readyToCommit}
                  onClick={() => {
                    setAttested(false);
                    setReceivedDate(todayIso());
                    setConfirming(true);
                  }}
                >
                  {batch.readyItems > 0 ? `Recall ${batch.readyItems} Controlled ${batch.readyItems === 1 ? "Copy" : "Copies"}` : "Recall Controlled Copies"}
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => navigateTo(ROUTES.DOCUMENTS.RECORDS)}>
                  Open Records
                </Button>
                <Button size="sm" variant="outline-emerald" onClick={startAnother}>
                  Start Another Batch
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

      {/* Add scans to the draft that is open: choose them here, and the scan panel shows the codes being read, without leaving the page */}
      <FormModal
        isOpen={Boolean(batch) && addOpen}
        onClose={closeAdd}
        title="Add More Scans"
        size="2xl"
        showFooter={false}
      >
        <RecallUploadArea
          inDialog
          selected={selected}
          maxFiles={Math.max(remainingSlots, 0)}
          busy={Boolean(busy)}
          progress={uploadProgress}
          queue={queue}
          inputTestId="recall-scan-add-input"
          onSelect={handleSelect}
          onRemove={(index) => setSelected((current) => current.filter((_, i) => i !== index))}
          onClear={() => setSelected([])}
          onUpload={addUpload}
          onStop={() => { cancelUpload.current = true; }}
        />
      </FormModal>

      {/* Identify a copy by number when its code could not be read */}
      <FormModal
        isOpen={Boolean(matchItem)}
        onClose={closeMatch}
        onConfirm={submitMatch}
        title={matchItem?.loosePage ? "Place this page in a controlled copy" : "Match to a controlled copy"}
        description={
          matchItem?.loosePage
            ? `Look at the page (${matchItem.sourcePages ?? matchItem.fileName}) and type the controlled copy number printed on it, and which page of that copy it is. The page is put into that copy's file at exactly that place.`
            : `Type the controlled copy number printed on the paper for ${matchItem?.fileName ?? "this scan"}. Only paper copies that carry a scan code can be recalled this way; an electronic copy is recalled from its own page.`
        }
        confirmText={matchItem?.loosePage ? "Place page" : "Match"}
        confirmDisabled={!matchNumber.trim() || lookupPending || !lookupFor?.copy || Boolean(lookupFor?.problem) || matchPageInvalid || Boolean(busy)}
        size="md"
      >
        <input
          value={matchNumber}
          onChange={(event) => setMatchNumber(event.target.value)}
          placeholder="Controlled copy number"
          aria-label="Controlled copy number"
          className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        {matchNumber.trim() && (
          <div className="mt-2 min-h-[3.25rem] text-xs" aria-live="polite">
            {lookupPending ? (
              <p className="flex items-center gap-1.5 text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking up the copy...
              </p>
            ) : lookupFor?.copy ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="font-medium text-slate-900">
                  {lookupFor.copy.number}
                  {lookupFor.copy.status && <span className="ml-2 font-normal text-slate-500">{lookupFor.copy.status}</span>}
                </p>
                <p className="mt-0.5 text-slate-600">
                  {[lookupFor.copy.documentNumber, lookupFor.copy.revisionNumber && `rev ${lookupFor.copy.revisionNumber}`].filter(Boolean).join(" · ")}
                  {lookupFor.copy.documentTitle ? ` — ${lookupFor.copy.documentTitle}` : ""}
                </p>
                {lookupFor.copy.recipientName && <p className="text-slate-600">Issued to {lookupFor.copy.recipientName}</p>}
                {lookupFor.problem && <p className="mt-1 text-amber-700">{lookupFor.problem}</p>}
              </div>
            ) : (
              <p className="flex items-start gap-1.5 text-red-600">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {lookupFor?.problem ?? "This copy could not be looked up."}
              </p>
            )}
          </div>
        )}
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
        confirmText="Continue to Sign"
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
        isOpen={Boolean(discardTarget)}
        onClose={() => setDiscardTarget(null)}
        onConfirm={discard}
        title="Discard This Draft?"
        description={`${discardTarget?.number ?? "This draft"}: the uploaded scans are kept on record but no controlled copy is recalled.`}
        confirmText="Discard draft"
        confirmVariant="destructive"
        isLoading={busy === "Discarding..."}
        size="md"
      />

      <FormModal
        isOpen={confirmingLeave}
        onClose={() => setConfirmingLeave(false)}
        onConfirm={() => navigateTo(ROUTES.DOCUMENTS.CONTROLLED_COPIES.ALL)}
        title="Leave While Uploading?"
        description="Files that have not been sent yet will be lost. A draft that was already started stays under Your Open Drafts."
        confirmText="Leave"
        confirmVariant="destructive"
        size="md"
      />
    </div>
  );
};
