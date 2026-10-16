import React, { useCallback, useMemo, useState } from "react";
import { reportsApi, type ReportAccessScopeRow, type ReportDeliveryRow, type ReportLegalHoldRow } from "@/services/api/reports";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar } from "../../report/shared/ReportListToolbar";
import { codeLabel } from "../../report/shared/reportLabels";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { reportBreadcrumbs } from "../../report/shared/reportBreadcrumbs";

/**
 * Frame of the Report Administration list screens: the header, an optional note, then the list in its own card, as the other report lists
 * (Run History, Report Definitions). The table is not wrapped in another section.
 */
const ReportAdminListPage: React.FC<{ title: string; note?: React.ReactNode; children: React.ReactNode }> = ({ title, note, children }) => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader title={title} breadcrumbItems={reportBreadcrumbs(navigate, title, true)} />
      {note && <div className="text-xs sm:text-sm text-slate-600">{note}</div>}
      {children}
    </div>
  );
};

/** Retention of report files, said once above the register (decision REPORT-FILE-RETENTION-PERMANENT-2026-10-14). */
const RetentionNote: React.FC = () => (
  <p>
    Report output files are kept permanently; no file expires by age. A legal hold still blocks any removal. Holds are placed and released on each run's page; the files held now are listed below.
  </p>
);

/** The limit of recipients is a setting of Report Properties; the log below records every notice. */
const DeliveryNote: React.FC = () => {
  const navigate = useNavigate();
  return (
    <p>
      Every notice sent about a scheduled report, including the ones skipped or failed. The most people one schedule can notify is set in{" "}
      <button type="button" onClick={() => navigate("/settings/report-properties")} className="font-medium text-emerald-700 underline underline-offset-2">
        Report Properties
      </button>
      .
    </p>
  );
};

const Yes: React.FC<{ on: boolean }> = ({ on }) => (
  <Badge color={on ? "emerald" : "slate"} size="sm">
    {on ? "Yes" : "No"}
  </Badge>
);

const SCOPE_LABEL = { PERSONAL: "Personal", DEPARTMENT: "Department", BUSINESS_UNIT: "Business Unit", SYSTEM: "Entire system" } as const;

/** Role scopes of every report template, from the server. Search, filter, sort and paging are applied by the server. Read-only here: scopes are set on each template. */
export const ReportAccessScopeView: React.FC = () => {
  const [scope, setScope] = useState("");
  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      reportsApi.listAccessScopes({
        search: params.search as string | undefined,
        scope: params.scope as string | undefined,
        sortBy: params.sortBy as string,
        sortDirection: params.sortDirection as "asc" | "desc",
        page: params.page as number,
        limit: params.limit as number,
      }),
    [],
  );
  const extraParams = useMemo(() => ({ scope }), [scope]);
  const table = useServerTable<ReportAccessScopeRow>({ fetcher, defaultSortBy: "templateName", defaultSortDirection: "asc", extraParams });
  const sortOf = (key: string) => ({
    direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined,
    onSort: () => table.handleSort(key),
  });
  const columns: DataTableColumn<ReportAccessScopeRow>[] = [
    {
      id: "template",
      header: "Template",
      sort: sortOf("templateName"),
      cell: (row) => (
        <div>
          <span className="font-medium text-slate-900">{row.templateName}</span>
          <span className="block text-xs text-slate-500">{row.templateCode}</span>
        </div>
      ),
    },
    { id: "role", header: "Role", sort: sortOf("roleName"), cell: (row) => row.roleName },
    { id: "scope", header: "Data scope", sort: sortOf("scope"), cell: (row) => SCOPE_LABEL[row.scope] ?? row.scope },
    {
      id: "status",
      header: "Template status",
      sort: sortOf("active"),
      cell: (row) => (
        <Badge color={row.active ? "emerald" : "slate"} size="sm">
          {row.active ? "Enabled" : "Disabled"}
        </Badge>
      ),
    },
  ];
  const { layout, control } = useCustomColumnLayout("reportAccessScopes", columns);
  return (
    <ReportAdminListPage
      title="Report Access & Data Scope"
      note="How far each role's data reaches, template by template. Scopes are changed on the template (Access & Scope tab); roles and permissions are edited in Access Profiles and Permission Sets."
    >
        <ReportListToolbar
          searchPlaceholder="Search template or role…"
          search={table.searchQuery}
          onSearch={(value) => {
            table.setSearchQuery(value);
            table.setCurrentPage(1);
          }}
          filters={[
            {
              id: "scope",
              label: "Data scope",
              value: scope,
              options: [{ label: "All scopes", value: "" }, ...Object.entries(SCOPE_LABEL).map(([value, label]) => ({ label, value }))],
              onChange: (value) => {
                setScope(value);
                table.setCurrentPage(1);
              },
            },
          ]}
          hasActiveFilters={!!scope}
          onClear={() => {
            setScope("");
            table.setCurrentPage(1);
          }}
          customControl={control}
        >
          <DataTable
            rows={table.items}
            getRowKey={(row) => row.templateCode + row.roleName}
            isLoading={table.isLoading}
            columns={columns}
            columnLayout={layout}
            emptyState={<TableEmptyState title="No role scopes" description="No template has a role scope that matches the search or filter." />}
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
    { id: "requester", header: "Requested by", sort: sortOf("requester"), cell: (row) => row.requester ?? "—" },
    { id: "heldBy", header: "Hold placed by", cell: (row) => row.heldBy ?? "—" },
    { id: "heldAt", header: "Hold placed", sort: sortOf("heldAt"), cell: (row) => (row.heldAt ? new Date(row.heldAt).toLocaleString() : "—") },
    { id: "reason", header: "Reason", cell: (row) => <span className="block max-w-96 whitespace-normal">{row.reason ?? "—"}</span> },
  ];
  const { layout, control } = useCustomColumnLayout("reportLegalHolds", columns);
  return (
    <ReportAdminListPage title="Report Retention & Legal Hold" note={<RetentionNote />}>
              <ReportListToolbar
          searchPlaceholder="Search report or file name…"
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
            emptyState={<TableEmptyState title="No legal holds" description="No file is held now." />}
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
  SKIPPED_NOT_AUTHORIZED: { label: "Skipped: not authorized", color: "amber" },
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
    { id: "at", header: "When", sort: sortOf("createdAt"), cell: (row) => new Date(row.createdAt).toLocaleString() },
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
    <ReportAdminListPage title="Scheduled Report Delivery" note={<DeliveryNote />}>
        <ReportListToolbar
          searchPlaceholder="Search recipient or schedule…"
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
                { label: "All channels", value: "" },
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
                { label: "All results", value: "" },
                { label: "Sent", value: "SENT" },
                { label: "Failed", value: "FAILED" },
                { label: "Skipped: not authorized", value: "SKIPPED_NOT_AUTHORIZED" },
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
            emptyState={<TableEmptyState title="No notices" description="No notice matches the search or filter." />}
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
