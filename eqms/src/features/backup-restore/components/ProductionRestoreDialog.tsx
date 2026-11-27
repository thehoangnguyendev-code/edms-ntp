import { tr as __ariaTr, trFormat as __ariaTrFormat } from "@/i18n";
import React, { useEffect, useMemo, useState } from "react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { PartCheckbox } from "./PartCheckbox";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { type BackupPart } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { Badge } from "@/components/ui/badge/Badge";
import { SearchInput } from "@/components/ui/form/SearchInput";
import { useDebounce } from "@/hooks";
import type { DataTableColumn } from "@/components/ui/table";
import { backupRestoreApi as backups } from "@/services/api/backupRestore";
import type { BackupRecord } from "../types";
import { PagedTable } from "./PagedTable";
import { formatDateTime } from "../format";
import { CONTENT_COLOR, statusLabel } from "../types";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { tr } from "@/i18n";

/** The backups are listed five to a page, newest first. */
const PAGE_SIZE = 5;
const CONTENT_SHORT: Record<string, string> = { DATABASE: "Database", OBJECT_STORE: "Files", CONFIGURATION: "Settings" };

const PART_LABEL: Record<BackupPart, { label: string; hint: string }> = {
  DATABASE: { label: "Database", get hint() { return tr("Replaces the live database. It contains the settings."); } },
  OBJECT_STORE: { label: "Files", get hint() { return tr("Adds the files the store is missing. Nothing is overwritten."); } },
};

const ORDER: BackupPart[] = ["DATABASE", "OBJECT_STORE"];

/**
 * Step 1 of a restore: choose a backup whose integrity check passed, choose which of its parts to restore, read what will happen, and
 * confirm. The person then signs. The choice is limited to the most recent verified backups; the one to restore is almost always
 * among them. Only the parts the backup holds are offered.
 */
export const ProductionRestoreDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onContinue: (backupNumber: string, parts: BackupPart[]) => void;
  /** A backup chosen on another screen; it is selected when the dialog opens. */
  initialBackup?: string;
  /** Started from the page of one backup: only that backup is listed, already chosen, with no search or paging. */
  onlyBackup?: string;
}> = ({ isOpen, onClose, onContinue, initialBackup, onlyBackup }) => {
  const [rows, setRows] = useState<BackupRecord[]>([]);
  const [page, setPage] = useState(1);
  /** Typed by the person; the server is asked once they pause, and always from the first page. */
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  /** The backup chosen. It is kept apart from the page shown, so it stays chosen while the person turns pages. */
  const [chosen, setChosen] = useState<BackupRecord>();
  const [parts, setParts] = useState<BackupPart[]>([]);
  const [understood, setUnderstood] = useState(false);
  const backup = chosen?.id ?? "";

  const keys = useMemo(() => (chosen?.components ?? []).map((c) => c.key), [chosen]);
  const offered = useMemo(() => ORDER.filter((p) => keys.includes(p)), [keys]);
  const holdsOldSettingsPart = keys.includes("CONFIGURATION");

  useEffect(() => {
    if (!isOpen) {
      setChosen(undefined);
      setParts([]);
      setUnderstood(false);
      setPage(1);
      setSearch("");
      return;
    }
    let live = true;
    setLoading(true);
    setError("");
    backups
      .list({ status: "COMPLETED", verification: "VERIFIED", search: onlyBackup ?? (debouncedSearch.trim() || undefined), sortBy: "startedAt", sortDirection: "desc", page: onlyBackup ? 1 : page, limit: onlyBackup ? 5 : PAGE_SIZE })
      .then((data) => {
        if (!live) return;
        const shown = onlyBackup ? data.data.filter((row) => row.id === onlyBackup) : data.data;
        setRows(shown);
        setTotal(onlyBackup ? shown.length : data.pagination.total);
        setTotalPages(onlyBackup ? 1 : data.pagination.totalPages || 1);
        if (onlyBackup && shown[0]) setChosen(shown[0]);
      })
      .catch((e) => {
        if (live) setError(getApiErrorMessage(e, "The backups could not be loaded."));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [isOpen, page, debouncedSearch, onlyBackup]);

  useEffect(() => setPage(1), [debouncedSearch]);

  // arriving from the page of a backup: that backup is chosen when the window opens, wherever it falls in the list
  useEffect(() => {
    if (!isOpen || !initialBackup) return;
    let live = true;
    backups
      .list({ status: "COMPLETED", verification: "VERIFIED", search: initialBackup, page: 1, limit: 5 })
      .then((data) => {
        const found = data.data.find((row) => row.id === initialBackup);
        if (live && found) setChosen(found);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [isOpen, initialBackup]);

  // choosing a backup selects what can be restored from it: the database and the files when it holds them
  useEffect(() => {
    setParts(offered);
  }, [offered]);

  const toggle = (part: BackupPart) => setParts((current) => (current.includes(part) ? current.filter((p) => p !== part) : [...current, part]));
  const canContinue = !!backup && understood && parts.length > 0;
  const columns: DataTableColumn<BackupRecord>[] = [
    { id: "id", header: tr("Backup Number"), cellClassName: "py-1.5 md:py-3", cell: (row) => <span className="font-medium text-slate-900">{row.id}</span> },
    { id: "started", header: "Started", cellClassName: "py-1.5 md:py-3", cell: (row) => formatDateTime(row.startedAt) },
    { id: "type", header: "Type", cellClassName: "py-1.5 md:py-3", cell: (row) => statusLabel(row.type) },
    { id: "contents", header: "Contents", cellClassName: "py-1.5 md:py-3", cell: (row) => (row.components.length === 0 ? "—" : <span className="flex flex-wrap gap-2">{row.components.map((c) => <Badge key={c.key} color={CONTENT_COLOR[c.key] ?? "slate"}>{CONTENT_SHORT[c.key] ?? c.key}</Badge>)}</span>) },
  ];

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={tr("Restore a Backup")}
      description={tr("Replaces the live data with what the backup holds. Files are only added, never overwritten.")}
      confirmText={tr("Continue to Sign")}
      confirmDisabled={!canContinue}
      onConfirm={() => onContinue(backup, parts)}
      size="2xl"
    >
      <div className="space-y-4">
        <WarningBanner
          variant="warning"
          description={tr("Everything entered after this backup was taken will no longer be in the live system. The current database is kept aside, so a database restore can be rolled back until it is finalized. The system must be in restore maintenance first.")}
        />
        {error && <WarningBanner variant="error" description={error} />}
        {holdsOldSettingsPart && (
          <WarningBanner variant="info" description={tr("This backup also holds a separate settings part, made before it was removed. It is not restored on its own: the settings are inside the database.")} />
        )}
        <FormField label={tr("Backup")} required hint={tr("Only completed backups whose integrity check passed are listed, newest first. Tick the one to restore.")}>
          {!onlyBackup && <SearchInput value={search} onChange={setSearch} ariaLabel={__ariaTr("Search backups")} placeholder={tr("Backup number…")} className="mb-3" />}
          <PagedTable
            rows={rows}
            getRowKey={(row) => row.id}
            isLoading={loading}
            columns={columns}
            selection={{
              visible: true,
              header: "",
              cellClassName: "w-10 py-1.5 md:py-3",
              cell: (row) => <Checkbox checked={backup === row.id} onChange={(on) => setChosen(on ? row : undefined)} aria-label={__ariaTrFormat("Choose {v1}", { v1: row.id })} />,
            }}
            onRowClick={(row) => setChosen(backup === row.id ? undefined : row)}
            rowClassName={(row) => (backup === row.id ? "bg-emerald-50/60 cursor-pointer" : "cursor-pointer")}
            paging={{ page, pageSize: PAGE_SIZE, totalItems: onlyBackup ? 0 : total, totalPages, onPageChange: setPage, onPageSizeChange: () => undefined, pageSizeOptions: [PAGE_SIZE] }}
          />
        </FormField>
        {chosen && (
          <FormField label={tr("What to restore")} required>
            <div className="space-y-2">
              {offered.map((part) => (
                <PartCheckbox key={part} id={`restore-part-${part}`} label={PART_LABEL[part].label} hint={PART_LABEL[part].hint} checked={parts.includes(part)} onChange={() => toggle(part)} />
              ))}
            </div>
          </FormField>
        )}
        <Checkbox
          checked={understood}
          onChange={setUnderstood}
          label={tr("I understand that the live data will be replaced by this backup.")}
          labelClassName="normal-case font-normal sm:text-sm"
        />
      </div>
    </FormModal>
  );
};
