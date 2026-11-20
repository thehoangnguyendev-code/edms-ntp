import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Palette } from "lucide-react";
import { IconInfoCircle, IconPencilMinus } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { TABLE_STYLES, type DataTableColumn } from "@/components/ui/table";
import { ServerListPanel, type ListFilter } from "@/features/backup-restore/components/ServerListPanel";
import { ROUTES } from "@/app/routes.constants";
import { notificationsAdmin as notificationsBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { formatDateTime } from "@/utils/format";
import { usePermissions } from "@/hooks/usePermissions";
import {
  notificationAdministrationApi,
  type AdministrationChannel,
  type NotificationAdministrationRow,
} from "@/services/api/notificationAdministration";
import { emailTemplateApi } from "@/services/api/emailTemplates";
import { MODULE_OPTIONS, PRIORITY_COLOR, moduleLabel, priorityLabel } from "./labels";
import { useServerList } from "./useServerList";
import { useRowMenu } from "./components/useRowMenu";

const ALL = "All";
type Direction = "asc" | "desc";
type Sort = "name" | "channel" | "category" | "status" | "updatedAt";
type TabId = "all" | "in-app" | "email";

const TABS: (TabItem & { id: TabId })[] = [
  { id: "all", label: "All Notifications" },
  { id: "in-app", label: "In-app Notification" },
  { id: "email", label: "Email Notification" },
];

/** The channel a tab is limited to; the first tab shows both. */
const TAB_CHANNEL: Record<TabId, AdministrationChannel | undefined> = { all: undefined, "in-app": "IN_APP", email: "EMAIL" };

const CHANNEL_LABEL: Record<AdministrationChannel, string> = { IN_APP: "In-app", EMAIL: "Email" };

const CHANNEL_OPTIONS = [
  { label: "All", value: ALL },
  { label: "In-app", value: "IN_APP" },
  { label: "Email", value: "EMAIL" },
];

const STATUS_OPTIONS = [
  { label: "All", value: ALL },
  { label: "Active", value: "ACTIVE" },
  { label: "Draft", value: "DRAFT" },
  { label: "Inactive", value: "INACTIVE" },
];

const PRIORITY_OPTIONS = [
  { label: "All", value: ALL },
  { label: "Low", value: "LOW" },
  { label: "Medium", value: "MEDIUM" },
  { label: "High", value: "HIGH" },
  { label: "Critical", value: "CRITICAL" },
];

const USAGE_OPTIONS = [
  { label: "All", value: ALL },
  { label: "Sent at least once", value: "SENT" },
  { label: "Never sent", value: "NEVER_SENT" },
];

const STATUS_COLOR: Record<string, "emerald" | "slate" | "gray"> = { ACTIVE: "emerald", DRAFT: "slate", INACTIVE: "gray" };

/** "controlled-copy-recall-notification" as "Controlled Copy Recall Notification". */
const typeLabel = (type: string) => type.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

const NO = TABLE_STYLES.headerCell35;

/** The Action column: one menu item, Edit for a person who can manage, View Details for one who cannot. */
function useOpenMenu(rows: readonly NotificationAdministrationRow[], canManage: boolean, open: (row: NotificationAdministrationRow) => void) {
  return useRowMenu(rows, (row) => `${row.channel}:${row.id}`, (row) => [
    {
      label: canManage ? (row.type ? "Edit Email Message" : row.channel === "EMAIL" ? "Edit Email Notification" : "Edit In-App Notification") : "View Details",
      icon: canManage ? <IconPencilMinus className="h-4 w-4" /> : <IconInfoCircle className="h-4 w-4" />,
      onClick: () => open(row),
    },
  ]);
}

/**
 * One list for the three tabs. The first tab shows in-app notifications and email notifications together with the Channel filter on All; each
 * of the other two is limited to its channel, and its Channel filter shows that channel and cannot be changed. The server does the search, the
 * filters, the sort and the page.
 */
const NotificationsList: React.FC<{ tab: TabId; canManage: boolean }> = ({ tab, canManage }) => {
  const navigate = useNavigate();
  const fixed = TAB_CHANNEL[tab];
  const list = useServerList<NotificationAdministrationRow, Sort>(
    (a) =>
      notificationAdministrationApi.list({
        search: a.search,
        channel: fixed ?? (a.filters.channel === ALL ? undefined : (a.filters.channel as AdministrationChannel)),
        status: a.filters.status === ALL ? undefined : a.filters.status,
        module: a.filters.module === ALL ? undefined : a.filters.module,
        priority: a.filters.priority === ALL ? undefined : a.filters.priority,
        type: a.filters.type === ALL ? undefined : a.filters.type,
        usage: a.filters.usage === ALL ? undefined : a.filters.usage,
        updatedFrom: a.filters.updatedFrom || undefined,
        updatedTo: a.filters.updatedTo || undefined,
        sortBy: a.sortBy,
        sortDirection: a.sortDirection as Direction,
        page: a.page,
        limit: a.limit,
      }),
    {
      sort: "name",
      filters: { channel: ALL, status: ALL, module: ALL, priority: ALL, type: ALL, usage: ALL, updatedFrom: "", updatedTo: "" },
    },
    "The notifications could not be loaded.",
  );

  const [typeOptions, setTypeOptions] = useState([{ label: "All", value: ALL }]);
  useEffect(() => {
    if (fixed === "IN_APP") return undefined;
    let live = true;
    emailTemplateApi
      .getEmailTemplateTypes()
      .then((types) => live && setTypeOptions([{ label: "All", value: ALL }, ...types.map((value) => ({ label: typeLabel(value), value }))]))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [fixed]);

  const open = (row: NotificationAdministrationRow) =>
    // an event of the registry opens its notification; a notice still written as an e-mail message (it has a message type) opens that message, whichever channel the row shows
    navigate(row.type ? ROUTES.SETTINGS.NOTIFICATIONS_EMAIL(row.id) : row.channel === "EMAIL" ? ROUTES.SETTINGS.NOTIFICATIONS_EVENT_EMAIL(row.id) : ROUTES.SETTINGS.NOTIFICATIONS_EVENT(row.id));
  const { action, menuNode } = useOpenMenu(list.rows, canManage, open);

  const allColumns: DataTableColumn<NotificationAdministrationRow>[] = [
    {
      id: "no",
      header: "No.",
      label: "No.",
      locked: true,
      headerClassName: NO,
      cellClassName: TABLE_STYLES.cell30,
      cell: (_row, index) => (list.page - 1) * list.pageSize + index + 1,
    },
    {
      id: "name",
      header: "Notification",
      label: "Notification",
      sort: list.sortFor("name"),
      cell: (row) => (
        <div className="max-w-[22rem]">
          <button
            type="button"
            onClick={() => open(row)}
            className="block max-w-full truncate text-left font-semibold text-slate-900 hover:text-emerald-700"
            title={row.name}
          >
            {row.name}
          </button>
          <span className="block truncate font-mono text-xs text-slate-500">{row.code}</span>
          {/* on a narrow screen the channel and the status columns are not shown: they are said here */}
          <span className="mt-1 flex flex-wrap gap-1 md:hidden">
            <Badge color={row.channel === "EMAIL" ? "blue" : "slate"} size="sm">{CHANNEL_LABEL[row.channel]}</Badge>
            <Badge color={STATUS_COLOR[row.status] ?? "gray"} size="sm">{STATUS_OPTIONS.find((o) => o.value === row.status)?.label ?? row.status}</Badge>
          </span>
        </div>
      ),
    },
    {
      id: "channel",
      header: "Channel",
      label: "Channel",
      sort: list.sortFor("channel"),
      cell: (row) => (
        <Badge color={row.channel === "EMAIL" ? "blue" : "slate"} size="sm">
          {CHANNEL_LABEL[row.channel]}
        </Badge>
      ),
    },
    {
      id: "category",
      header: "Module / Type",
      label: "Module / Type",
      sort: list.sortFor("category"),
      cell: (row) => (row.module ? moduleLabel(row.module) : row.type ? typeLabel(row.type) : "—"),
    },
    {
      id: "details",
      header: "Details",
      label: "Details",
      cell: (row) => (
        <div className="flex flex-col items-start gap-1">
          {row.priority ? (
            <Badge color={PRIORITY_COLOR[row.priority] ?? "slate"} size="sm">
              {priorityLabel(row.priority)}
            </Badge>
          ) : null}
          <span className="text-xs text-slate-600">{row.sent ? `Sent ${row.sent} time(s)` : "Never sent"}</span>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      label: "Status",
      sort: list.sortFor("status"),
      cell: (row) => (
        <Badge color={STATUS_COLOR[row.status] ?? "gray"} size="sm" showDot={row.status === "ACTIVE"}>
          {STATUS_OPTIONS.find((o) => o.value === row.status)?.label ?? row.status}
        </Badge>
      ),
    },
    {
      id: "updated",
      header: "Last Updated",
      label: "Last Updated",
      sort: list.sortFor("updatedAt"),
      cell: (row) => <span className="whitespace-nowrap text-slate-600">{row.updatedAt ? formatDateTime(row.updatedAt) : "—"}</span>,
    },
  ];

  const columns = allColumns;

  const select = (id: string, label: string, options: { label: string; value: string }[], extra?: Partial<ListFilter>): ListFilter => ({
    id,
    label,
    value: list.filters[id],
    options,
    defaultValue: ALL,
    placeholder: "All",
    onChange: list.setFilter(id),
    ...extra,
  });

  // the Channel filter shows the channel of a limited tab and cannot be changed; each filter that only one kind has is left out of the other tab
  const filters: ListFilter[] = [
    fixed
      ? select("channel", "Channel", CHANNEL_OPTIONS.filter((o) => o.value === fixed), { value: fixed, defaultValue: fixed, disabled: true, onChange: () => undefined })
      : select("channel", "Channel", CHANNEL_OPTIONS),
    select("status", "Status", STATUS_OPTIONS),
    ...(fixed === "EMAIL" ? [] : [select("module", "Module", MODULE_OPTIONS)]),
    select("priority", "Priority", PRIORITY_OPTIONS),
    ...(fixed === "IN_APP" ? [] : [select("type", "Type", typeOptions), select("usage", "Sent", USAGE_OPTIONS)]),
  ];

  return (
    <>
      <ServerListPanel
        action={action}
        tableKey={`settings.notifications.${tab}.v1`}
        framed={false}
        tableFramed
        columns={columns}
        rows={list.rows}
        getRowKey={(row) => `${row.channel}:${row.id}`}
        loading={list.loading}
        hasLoaded={list.hasLoaded}
        error={list.error}
        emptyTitle="No Notifications"
        emptyDescription="No notification matches this filter."
        search={list.search}
        onSearch={list.setSearch}
        searchLabel="Search notifications"
        searchPlaceholder="Name, code or description…"
        filters={filters}
        dates={[
          {
            id: "updated",
            label: "Updated Date Range",
            from: list.filters.updatedFrom,
            to: list.filters.updatedTo,
            onFromChange: list.setFilter("updatedFrom"),
            onToChange: list.setFilter("updatedTo"),
          },
        ]}
        onClear={list.clear}
        page={list.page}
        totalPages={list.totalPages}
        totalItems={list.total}
        pageSize={list.pageSize}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
      />
      {menuNode}
    </>
  );
};

/**
 * The notifications of the system, listed and edited, never created: the code that raises an event is what makes it real, so a record a person
 * made would never be sent. Three tabs: all notifications, the in-app ones (system events) and the email ones (email messages).
 */
export const NotificationsView: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { hasPermissionAlias } = usePermissions();
  const canManage =
    hasPermissionAlias("settings.notification_policy.manage") ||
    hasPermissionAlias("settings.email_template.manage");
  const requested = params.get("tab");
  const tab: TabId = requested === "in-app" || requested === "email" ? requested : "all";

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Notifications Administration"
        breadcrumbItems={notificationsBreadcrumb(navigate)}
        actions={
          tab === "email" ? (
            <Button size="sm" variant="default" onClick={() => navigate(ROUTES.SETTINGS.NOTIFICATIONS_EMAIL_DESIGN)}>
              <Palette className="mr-1.5 h-4 w-4" />
              Email Design
            </Button>
          ) : tab === "in-app" ? (
            <Button size="sm" variant="default" onClick={() => navigate(ROUTES.SETTINGS.NOTIFICATIONS_IN_APP_DESIGN)}>
              <Palette className="mr-1.5 h-4 w-4" />
              In-App Notification Design
            </Button>
          ) : undefined
        }
      />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <TabNav tabs={TABS} activeTab={tab} onChange={(id) => setParams(id === "all" ? {} : { tab: id }, { replace: true })} />
        <div className="p-4 md:p-5">
          {/* a list per tab: its filters, sort and page start again when the tab changes */}
          <NotificationsList key={tab} tab={tab} canManage={canManage} />
        </div>
      </div>
    </div>
  );
};
