import React, { useCallback, useMemo, useState } from "react";
import { reportsApi, type ReportDeliveryRow, type ReportLegalHoldRow } from "@/services/api/reports";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar } from "../../report/shared/ReportListToolbar";
import { codeLabel } from "../../report/shared/reportLabels";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { flagColor } from "@/utils/status";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { ReportTabsFrame } from "../../report/shared/ReportTabsFrame";
import { displayDateTime } from "@/utils/format";
import { tr, trFormat } from "@/i18n";

/**
 * Frame of the report registers (Legal Hold Register, Delivery Log): each is the second tab of a menu entry (Report Run History, Scheduled Reports), so the header,
 * the tabs and the card are those of ReportTabsFrame. An optional note sits above the list; the list is not framed again.
 */
const ReportAdminListPage: React.FC<{ pair: "runs" | "scheduled"; note?: React.ReactNode; children: React.ReactNode }> = ({ pair, note, children }) => (
  <div className="flex flex-col gap-4 md:gap-5">
    <ReportTabsFrame pair={pair}>
      {note && <div className="px-4 pt-4 text-xs text-slate-600 sm:text-sm md:px-5">{note}</div>}
      {children}
    </ReportTabsFrame>
  </div>
);

/** The limit of recipients is a setting of Report Properties; the log below records every notice. */
const DeliveryNote: React.FC = () => {
  const navigate = useNavigate();
  return (
    <p>
              {tr("Every notice sent about a scheduled report, including the ones skipped or failed. The most people one schedule can notify is set in")}{" "}
      <button type="button" onClick={() => navigate("/settings/report-properties")} className="font-medium text-emerald-700 underline underline-offset-2">
        {tr("Report Properties")}
      </button>
      .
    </p>
  );
};

const Yes: React.FC<{ on: boolean }> = ({ on }) => (
  <Badge color={flagColor(on)} size="sm">
    {on ? "Yes" : "No"}
  </Badge>
);

/** Legal Hold Register: the files held now, from the server. Placing and releasing holds is done on each run's page. */
export const ReportRetentionView: React.FC = () => {
  const navigate = useNavigate();
  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      reportsApi.listLegalHolds({
        search: params.search as string | undefined,
        sortBy: params.sortBy as string,
        sortDirection: params.sortDirection as "asc" | "desc",
        page: params.page as number,
        limit: params.limit as number,
      }),
    [],
  );
  const table = useServerTable<ReportLegalHoldRow>({ fetcher, defaultSortBy: "heldAt", defaultSortDirection: "desc" });
  const sortOf = (key: string) => ({
    direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined,
    onSort: () => table.handleSort(key),
  });
  const columns: DataTableColumn<ReportLegalHoldRow>[] = [
    { id: "no", header: "No.", locked: true, cell: (_row, index) => (table.currentPage - 1) * table.itemsPerPage + index + 1 },
    {
      id: "report",
      header: "Report",
      sort: sortOf("report"),
      cell: (row) => (
        <button type="button" className="font-medium text-emerald-600 hover:underline" onClick={() => navigate(`/report/runs/${row.runId}`)}>
          {row.report}
        </button>
      ),
    },
    { id: "file", header: "File", sort: sortOf("fileName"), cell: (row) => <span className="break-all text-xs">{row.fileName}</span> },
    { id: "requester", header: tr("Requested by"), sort: sortOf("requester"), cell: (row) => row.requester ?? "—" },
    { id: "heldBy", header: tr("Hold placed by"), cell: (row) => row.heldBy ?? "—" },
    { id: "heldAt", header: tr("Hold placed"), sort: sortOf("heldAt"), cell: (row) => (row.heldAt ? displayDateTime(row.heldAt) : "—") },
    { id: "reason", header: "Reason", cell: (row) => <span className="block max-w-96 whitespace-normal">{row.reason ?? "—"}</span> },
  ];
  const { layout, control } = useCustomColumnLayout("reportLegalHolds", columns);
  return (
    <ReportAdminListPage pair="runs">
              <ReportListToolbar
          framed={false}
          searchPlaceholder={tr("Search report or file name…")}
          search={table.searchQuery}
          onSearch={(value) => {
            table.setSearchQuery(value);
            table.setCurrentPage(1);
          }}
          hasActiveFilters={false}
          onClear={() => table.setSearchQuery("")}
          customControl={control}
        >
          <DataTable
            rows={table.items}
            getRowKey={(row) => row.artifactId}
            isLoading={table.isLoading}
            columns={columns}
            columnLayout={layout}
            emptyState={<TableEmptyState title={tr("No legal holds")} description={tr("No file is held now.")} />}
            pagination={
              table.totalItems > 0 ? (
                <TablePagination
                  currentPage={table.currentPage}
                  totalPages={table.totalPages}
                  totalItems={table.totalItems}
                  itemsPerPage={table.itemsPerPage}
                  onPageChange={table.setCurrentPage}
                  onItemsPerPageChange={table.setItemsPerPage}
                />
              ) : undefined
            }
          />
        </ReportListToolbar>
    </ReportAdminListPage>
  );
};

const DELIVERY_STATUS = {
  SENT: { label: "Sent", color: "emerald" },
  FAILED: { label: "Failed", color: "red" },
  SKIPPED_NOT_AUTHORIZED: { label: tr("Skipped: not authorized"), color: "amber" },
} as const;
const DELIVERY_EVENT = { REPORT_READY: "Report ready", REPORT_SCHEDULE_SUSPENDED: "Schedule suspended" } as const;

/** Real delivery log (REPORT-NOTIFICATION-CHANNEL-2026-10-14). Search, filters, sort and paging are applied by the server. Read-only. */
export const ReportDeliveryView: React.FC = () => {
  const [channel, setChannel] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      reportsApi.listDeliveries({
        search: params.search as string | undefined,
        channel: params.channel as string | undefined,
        status: params.status as string | undefined,
        sortBy: params.sortBy as string,
        sortDirection: params.sortDirection as "asc" | "desc",
        page: params.page as number,
        limit: params.limit as number,
      }),
    [],
  );
  const extraParams = useMemo(() => ({ channel, status: deliveryStatus }), [channel, deliveryStatus]);
  const table = useServerTable<ReportDeliveryRow>({ fetcher, defaultSortBy: "createdAt", defaultSortDirection: "desc", extraParams });
  const sortOf = (key: string) => ({
    direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined,
    onSort: () => table.handleSort(key),
  });
  const columns: DataTableColumn<ReportDeliveryRow>[] = [
    { id: "no", header: "No.", locked: true, cell: (_row, index) => (table.currentPage - 1) * table.itemsPerPage + index + 1 },
    { id: "at", header: "When", sort: sortOf("createdAt"), cell: (row) => displayDateTime(row.createdAt) },
    { id: "schedule", header: "Schedule", sort: sortOf("scheduleName"), cell: (row) => <span className="font-medium text-slate-900">{row.scheduleName ?? "—"}</span> },
    { id: "recipient", header: "Recipient", sort: sortOf("recipientName"), cell: (row) => row.recipientName ?? "—" },
    { id: "channel", header: "Channel", sort: sortOf("channel"), cell: (row) => (row.channel === "EMAIL" ? "E-mail" : "In app") },
    { id: "event", header: "Notice", cell: (row) => DELIVERY_EVENT[row.eventCode as keyof typeof DELIVERY_EVENT] ?? row.eventCode },
    {
      id: "status",
      header: "Result",
      sort: sortOf("status"),
      cell: (row) => {
        const s = DELIVERY_STATUS[row.status];
        return (
          <Badge color={s.color} size="sm">
            {s.label}
          </Badge>
        );
      },
    },
    { id: "reason", header: "Reason", cell: (row) => codeLabel(row.reasonCode) },
  ];
  const { layout, control } = useCustomColumnLayout("reportDeliveryLog", columns);
  return (
    <ReportAdminListPage pair="scheduled" note={<DeliveryNote />}>
        <ReportListToolbar
          framed={false}
          searchPlaceholder={tr("Search recipient or schedule…")}
          search={table.searchQuery}
          onSearch={(value) => {
            table.setSearchQuery(value);
            table.setCurrentPage(1);
          }}
          filters={[
            {
              id: "channel",
              label: "Channel",
              value: channel,
              options: [
                { label: "All", value: "" },
                { label: "In app", value: "IN_APP" },
                { label: "E-mail", value: "EMAIL" },
              ],
              onChange: (value) => {
                setChannel(value);
                table.setCurrentPage(1);
              },
            },
            {
              id: "result",
              label: "Result",
              value: deliveryStatus,
              options: [
                { label: "All", value: "" },
                { label: "Sent", value: "SENT" },
                { label: "Failed", value: "FAILED" },
                { label: tr("Skipped: not authorized"), value: "SKIPPED_NOT_AUTHORIZED" },
              ],
              onChange: (value) => {
                setDeliveryStatus(value);
                table.setCurrentPage(1);
              },
            },
          ]}
          hasActiveFilters={!!channel || !!deliveryStatus}
          onClear={() => {
            setChannel("");
            setDeliveryStatus("");
            table.setCurrentPage(1);
          }}
          customControl={control}
        >
          <DataTable
            rows={table.items}
            getRowKey={(row) => row.id}
            isLoading={table.isLoading}
            columns={columns}
            columnLayout={layout}
            emptyState={<TableEmptyState title={tr("No notices")} description={tr("No notice matches the search or filter.")} />}
            pagination={
              table.totalItems > 0 ? (
                <TablePagination
                  currentPage={table.currentPage}
                  totalPages={table.totalPages}
                  totalItems={table.totalItems}
                  itemsPerPage={table.itemsPerPage}
                  onPageChange={table.setCurrentPage}
                  onItemsPerPageChange={table.setItemsPerPage}
                />
              ) : undefined
            }
          />
        </ReportListToolbar>
    </ReportAdminListPage>
  );
};
