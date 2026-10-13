import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { FormField, Input } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Select } from "@/components/ui/select/Select";
import { TABLE_STYLES } from "@/components/ui/table";
import type { DataTableColumn } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast/Toast";
import { useDebounce } from "@/hooks";
import { ROUTES } from "@/app/routes.constants";
import { ServerListPanel } from "@/features/backup-restore/components/ServerListPanel";
import { formatBytes, formatDate, formatDateTime, pickerDateToIsoDate } from "@/features/backup-restore/format";
import { statusLabel } from "@/features/backup-restore/types";
import { backupRestoreApi, type MediaKind, type MediaStatus, type OfflineMedium } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { MEDIA_KIND_LABEL, MEDIA_STATUS_COLOR, exportErrorMessage } from "./mediaLabels";

type SortKey = "label" | "status" | "kind" | "holder" | "lastReadTestAt" | "expiresOn";

const ALL = "ALL";
const STATUS_OPTIONS = [{ label: "All Statuses", value: ALL }, ...(Object.keys(MEDIA_STATUS_COLOR) as MediaStatus[]).map((value) => ({ label: statusLabel(value), value }))];
const KIND_OPTIONS = [{ label: "All Kinds", value: ALL }, ...(Object.keys(MEDIA_KIND_LABEL) as MediaKind[]).map((value) => ({ label: MEDIA_KIND_LABEL[value], value }))];
const GB = 1_000_000_000;

const RegisterMediumModal: React.FC<{ isOpen: boolean; onClose: () => void; onDone: (medium: OfflineMedium) => void }> = ({ isOpen, onClose, onDone }) => {
  const { showToast } = useToast();
  const [label, setLabel] = useState("");
  const [serial, setSerial] = useState("");
  const [kind, setKind] = useState<MediaKind>("USB");
  const [capacityGb, setCapacityGb] = useState("");
  const [folder, setFolder] = useState("");
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const capacity = Number(capacityGb);
  const valid = label.trim() && serial.trim() && /^[A-Za-z0-9._-]{1,64}$/.test(folder) && folder !== "." && folder !== ".." && capacity > 0;

  const submit = async () => {
    setBusy(true);
    try {
      const medium = await backupRestoreApi.registerMedium({
        label: label.trim(),
        serialNumber: serial.trim(),
        kind,
        capacityBytes: Math.round(capacity * GB),
        exportDir: folder.trim(),
        expiresOn: pickerDateToIsoDate(expires),
      });
      setLabel("");
      setSerial("");
      setCapacityGb("");
      setFolder("");
      setExpires("");
      onDone(medium);
    } catch (e) {
      showToast({ type: "error", title: "The medium was not registered", message: exportErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Register Offline Medium"
      description="Only a registered medium can receive a backup package. The label must match the sticker on the physical medium."
      confirmText={busy ? "Registering…" : "Register"}
      confirmDisabled={!valid || busy}
      onConfirm={() => void submit()}
    >
      <div className="space-y-4">
        <FormField label="Label" required hint="Printed on the medium, for example USB-OFFSITE-01.">
          <Input value={label} maxLength={60} onChange={(event) => setLabel(event.target.value)} />
        </FormField>
        <FormField label="Serial number" required>
          <Input value={serial} maxLength={120} onChange={(event) => setSerial(event.target.value)} />
        </FormField>
        <FormField label="Kind" hint="The kind decides how the medium is written and how much it holds.">
          <Select value={kind} onChange={(value) => setKind(value as MediaKind)} options={(Object.keys(MEDIA_KIND_LABEL) as MediaKind[]).map((k) => ({ label: MEDIA_KIND_LABEL[k], value: k }))} />
        </FormField>
        <FormField label="Capacity (GB)" required>
          <Input type="number" min={1} value={capacityGb} onChange={(event) => setCapacityGb(event.target.value)} />
        </FormField>
        <FormField label="Folder on the export mount" required hint="One folder name (letters, digits, dot, dash, underscore). The Backup Agent writes only here for this medium.">
          <Input value={folder} maxLength={64} onChange={(event) => setFolder(event.target.value)} />
        </FormField>
        <DateTimePicker
          label="Expires on"
          value={expires}
          onChange={setExpires}
          placeholder="Select a date"
        />
        <p className="text-xs text-slate-500">Replace the medium by this date, or when it shows read errors.</p>
      </div>
    </FormModal>
  );
};

/** The Offline Media Register: every medium a package can be written to, where it is and who holds it. */
/** The media list. The Register Medium button and its state belong to the screen's header; the panel only receives them. */
export const MediaRegisterPanel: React.FC<{ registering: boolean; onRegisterClose: () => void }> = ({ registering, onRegisterClose }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [status, setStatus] = useState(ALL);
  const [kind, setKind] = useState(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "label", direction: "asc" });
  const [rows, setRows] = useState<OfflineMedium[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    backupRestoreApi
      .media({ search: debouncedSearch.trim() || undefined, status: status === ALL ? undefined : status, kind: kind === ALL ? undefined : kind, sortBy: sort.key, sortDirection: sort.direction, page, limit: pageSize })
      .then((data) => {
        if (!live) return;
        setRows(data.data);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages || 1);
        if (data.pagination.page !== page) setPage(data.pagination.page);
      })
      .catch((e) => {
        if (!live) return;
        setRows([]);
        setTotal(0);
        setError(getApiErrorMessage(e, "Unable to load the offline media."));
      })
      .finally(() => {
        if (!live) return;
        setLoading(false);
        setHasLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [debouncedSearch, status, kind, sort, page, pageSize, reloadKey]);

  useEffect(() => setPage(1), [debouncedSearch, status, kind, pageSize]);

  const sortFor = (key: SortKey) => ({
    direction: sort.key === key ? sort.direction : undefined,
    onSort: () => {
      setSort((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
      setPage(1);
    },
  });

  const columns: DataTableColumn<OfflineMedium>[] = [
    {
      id: "label",
      header: "Medium",
      label: "Medium",
      locked: true,
      sort: sortFor("label"),
      headerClassName: TABLE_STYLES.headerCell35,
      cell: (row) => (
        <button type="button" className="text-left font-medium text-emerald-600 hover:underline" onClick={() => navigate(ROUTES.SETTINGS.BACKUP_ADMINISTRATION.MEDIUM_DETAIL(row.id))}>
          {row.label}
        </button>
      ),
    },
    { id: "kind", header: "Kind", label: "Kind", sort: sortFor("kind"), cell: (row) => `${MEDIA_KIND_LABEL[row.kind] ?? row.kind} · ${formatBytes(row.capacityBytes)}` },
    { id: "status", header: "Status", label: "Status", sort: sortFor("status"), cell: (row) => <Badge color={MEDIA_STATUS_COLOR[row.status]}>{statusLabel(row.status)}</Badge> },
    { id: "packages", header: "Packages", label: "Packages", cell: (row) => row.packageCount },
    { id: "holder", header: "Held by", label: "Held by", sort: sortFor("holder"), cell: (row) => (row.holder ? `${row.holder}${row.storageLocation ? `, ${row.storageLocation}` : ""}` : "—") },
    {
      id: "lastReadTestAt",
      header: "Last read test",
      label: "Last read test",
      sort: sortFor("lastReadTestAt"),
      cell: (row) =>
        row.lastReadTestAt ? (
          <span className="inline-flex items-center gap-2">
            <Badge color={row.lastReadTestResult === "PASSED" ? "emerald" : "red"}>{statusLabel(row.lastReadTestResult ?? "")}</Badge>
            <span className="text-xs text-slate-500">{formatDateTime(row.lastReadTestAt)}</span>
          </span>
        ) : (
          "Never"
        ),
    },
    { id: "expiresOn", header: "Expires", label: "Expires", sort: sortFor("expiresOn"), cell: (row) => formatDate(row.expiresOn) },
  ];

  return (
    <>
      <ServerListPanel
        framed={false}
        tableKey="backup-admin.offline-media"
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        loading={loading}
        hasLoaded={hasLoaded}
        error={error}
        emptyTitle="No Offline Media"
        emptyDescription="Register a medium before a backup can be exported to it."
        search={search}
        onSearch={setSearch}
        searchLabel="Search offline media"
        searchPlaceholder="Label, serial or holder…"
        filters={[
          { id: "status", label: "Status", value: status, options: STATUS_OPTIONS, defaultValue: ALL, placeholder: "All Statuses", onChange: setStatus },
          { id: "kind", label: "Kind", value: kind, options: KIND_OPTIONS, defaultValue: ALL, placeholder: "All Kinds", onChange: setKind },
        ]}
        onClear={() => {
          setSearch("");
          setStatus(ALL);
          setKind(ALL);
          setPage(1);
        }}
        page={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
      <RegisterMediumModal
        isOpen={registering}
        onClose={onRegisterClose}
        onDone={(medium) => {
          onRegisterClose();
          showToast({ type: "success", title: "Medium registered", message: medium.label });
          setReloadKey((key) => key + 1);
        }}
      />
    </>
  );
};
