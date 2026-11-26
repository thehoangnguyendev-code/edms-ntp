import { tr as __ariaTr } from "@/i18n";
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  KeyRound,
  Search,
  UserCheck,
  Users,
  Waypoints,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { openPermissionHoldersReport } from "./openPermissionHoldersReport";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button/Button";
import { Badge, type BadgeColor } from "@/components/ui/badge/Badge";
import { Switch } from "@/components/ui/switch/Switch";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import { cn } from "@/components/ui/utils";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { TablePagination } from "@/components/ui/table/TablePagination";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import {
  FullPageLoading,
  SectionLoading,
} from "@/components/ui/loading/Loading";
import { accessExplorerDetail } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { useDebounce } from "@/hooks";
import { settingsApi } from "@/services/api";
import type {
  AccessExplorerHolder,
  AccessExplorerHolders,
} from "@/services/api/settings";
import { ROUTES } from "@/app/routes.constants";
import { formatDateTime } from "@/utils/format";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { moduleLabel } from "./accessExplorerLabels";
import { IconReportSearch } from "@tabler/icons-react";
import { tr } from "@/i18n";
import { statusColors } from "@/components/ui/badge/statusColors";

const STATUS_COLOR = statusColors("Active", "Suspended", "Terminated", "Pending", "Inactive") as Record<string, BadgeColor>;
type TabId = "general" | "people" | "through";
const TABS: TabItem[] = [
  { id: "general", label: "General" },
  { id: "people", label: "People" },
  { id: "through", label: tr("Granted Through") },
];

type ThroughRow = {
  key: string;
  setName: string;
  setCode: string;
  profileId: string | null;
  profileName: string | null;
  holderCount: number;
};

const labelCls = "text-xs sm:text-sm font-medium text-slate-700";
const readCls =
  "flex h-9 w-full items-center rounded-lg border border-slate-200 bg-slate-50/70 px-3";

// the same read-only field as the General tab of Access Profile Details
const Field: React.FC<{
  label: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ label, className, children }) => (
  <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
    <label className={labelCls}>{label}</label>
    {children}
  </div>
);

const ReadOnly: React.FC<{ children: React.ReactNode; strong?: boolean }> = ({
  children,
  strong,
}) => (
  <div className={cn(readCls, CONTROL_STATE_CLASSES.readonly)}>
    <p
      className={cn(
        "truncate text-sm",
        strong ? "font-medium text-slate-900" : "text-slate-600",
      )}
    >
      {children}
    </p>
  </div>
);

/**
 * Access Explorer Details: one permission, who holds it, and through what (permission set, then access profile). It reads the chain the system itself uses to decide, so the answer
 * is what is enforced. Read only; the people are searched and paged by the server.
 */
export const AccessExplorerDetailView: React.FC = () => {
  const { code = "" } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("people");
  const [result, setResult] = useState<AccessExplorerHolders | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    settingsApi
      .getAccessExplorerHolders(code, {
        activeOnly,
        search: debounced.trim(),
        page: page - 1,
        size,
      })
      .then((response) => {
        if (!cancelled) {
          setResult(response);
          setLoadedOnce(true);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setResult(null);
          setError(
            e?.response?.data?.message ||
              "Unable to read who holds this permission.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code, activeOnly, debounced, page, size]);

  useEffect(() => load(), [load]);

  const permission = result?.permission;
  const profileCount = result
    ? new Set(result.permissionSets.flatMap((s) => s.profiles.map((p) => p.id)))
        .size
    : 0;
  const tabs = TABS.map((tab) =>
    tab.id === "people" && result
      ? { ...tab, count: result.holderCount }
      : tab.id === "through" && result
        ? { ...tab, count: result.permissionSets.length }
        : tab,
  );

  const columns: DataTableColumn<AccessExplorerHolder>[] = [
    {
      id: "no",
      header: "No.",
      label: "No.",
      locked: true,
      headerClassName: "w-14 text-center",
      cellClassName: "text-center",
      cell: (_h, i) => (page - 1) * size + i + 1,
    },
    {
      id: "person",
      header: "Person",
      label: "Person",
      cell: (h) => (
        <button
          type="button"
          className="text-left"
          onClick={() =>
            navigate(ROUTES.SETTINGS.USERS_PROFILE(h.userId), {
              state: { returnTo: ROUTES.SECURITY.ACCESS_EXPLORER_DETAIL(code) },
            })
          }
        >
          <span className="font-medium text-emerald-700 hover:underline">
            {h.fullName ?? h.username}
          </span>
          <span className="block text-xs text-slate-500">
            {h.username}
            {h.employeeCode ? ` · ${h.employeeCode}` : ""}
          </span>
        </button>
      ),
    },
    {
      id: "department",
      header: "Department",
      label: "Department",
      cell: (h) => h.department || "—",
    },
    {
      id: "status",
      header: "Status",
      label: "Status",
      cell: (h) => (
        <Badge size="sm" pill color={STATUS_COLOR[h.status ?? ""] ?? "slate"}>
          {h.status ?? "—"}
        </Badge>
      ),
    },
    {
      id: "profiles",
      header: tr("Through Access Profile"),
      label: tr("Through Access Profile"),
      cell: (h) => (
        <div className="flex flex-wrap gap-1">
          {h.viaProfiles.map((p) => (
            <Badge key={p} size="sm" color="slate">
              {p}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: "sets",
      header: tr("Through Permission Set"),
      label: tr("Through Permission Set"),
      cell: (h) => h.viaPermissionSets.join(", "),
    },
    {
      id: "timeLimited",
      header: tr("Time-limited Until"),
      label: tr("Time-limited Until"),
      cell: (h) =>
        h.timeLimitedUntil ? formatDateTime(h.timeLimitedUntil) : "—",
    },
    {
      id: "lastLogin",
      header: tr("Last Sign-in"),
      label: tr("Last Sign-in"),
      cell: (h) => (h.lastLoginAt ? formatDateTime(h.lastLoginAt) : "Never"),
    },
  ];

  // one row for each permission set and access profile that gives the permission (a set no active profile uses still gets its row, so it is not lost)
  const throughRows: ThroughRow[] = (result?.permissionSets ?? []).flatMap(
    (set): ThroughRow[] =>
      set.profiles.length === 0
        ? [
            {
              key: set.id,
              setName: set.name,
              setCode: set.code,
              profileId: null,
              profileName: null,
              holderCount: 0,
            },
          ]
        : set.profiles.map((p) => ({
            key: `${set.id}:${p.id}`,
            setName: set.name,
            setCode: set.code,
            profileId: p.id,
            profileName: p.name,
            holderCount: p.holderCount,
          })),
  );
  const throughColumns: DataTableColumn<ThroughRow>[] = [
    {
      id: "no",
      header: "No.",
      label: "No.",
      locked: true,
      headerClassName: "w-14 text-center",
      cellClassName: "text-center text-slate-500",
      cell: (_row, i) => i + 1,
    },
    {
      id: "set",
      header: tr("Permission Set"),
      label: tr("Permission Set"),
      cellClassName: "font-medium text-slate-900",
      cell: (row) => row.setName,
    },
    {
      id: "setCode",
      header: "Code",
      label: "Code",
      cell: (row) => (
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
          {row.setCode}
        </code>
      ),
    },
    {
      id: "profile",
      header: tr("Access Profile"),
      label: tr("Access Profile"),
      cell: (row) =>
        row.profileName ? (
          <span className="font-medium text-emerald-700">{row.profileName}</span>
        ) : (
          <span className="text-slate-500">
            {tr("Not used by any active access profile")}
          </span>
        ),
    },
    {
      id: "people",
      header: "People",
      label: "People",
      cell: (row) => (row.profileId ? row.holderCount : "—"),
    },
  ];

  if (loading && !loadedOnce) return <FullPageLoading text="Loading…" />;

  const stats = result
    ? [
        {
          icon: <KeyRound className="h-4 w-4 text-emerald-600" />,
          value: result.permissionSets.length,
          label: tr("Permission Sets"),
        },
        {
          icon: <Waypoints className="h-4 w-4 text-emerald-600" />,
          value: profileCount,
          label: tr("Access Profiles"),
        },
        {
          icon: <Users className="h-4 w-4 text-emerald-600" />,
          value: result.holderCount,
          label: "People",
        },
        {
          icon: <UserCheck className="h-4 w-4 text-emerald-600" />,
          value: result.activeHolderCount,
          label: tr("Active Accounts"),
        },
      ]
    : [];

  return (
    <div className="space-y-5 w-full flex-1 flex flex-col">
      <PageHeader
        title={tr("Access Explorer Details")}
        breadcrumbItems={accessExplorerDetail(navigate)}
        actions={
          <>
            <Button
              variant="outline-emerald"
              size="sm"
              className="whitespace-nowrap gap-2"
              onClick={() => navigate(ROUTES.SECURITY.ACCESS_EXPLORER)}
            >
              {tr("Back")}
            </Button>
            <Button
              variant="default"
              size="sm"
              className="whitespace-nowrap gap-2"
              onClick={() => void openPermissionHoldersReport(navigate, showToast, code)}
              title={tr("Create a report of the type Permission Holders: the run is authorized, audited and kept like every other report")}
            >
              <IconReportSearch className="h-4 w-4" />
              {tr("Permission Holders Report")}
            </Button>
          </>
        }
      />

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {permission && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-5 bg-linear-to-r from-emerald-50 via-white to-slate-50">
            <div className="flex flex-col lg:flex-row lg:items-start gap-4">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {permission.name}
                  </h2>
                  <Badge color="blue" size="sm">
                    {moduleLabel(permission.moduleKey)}
                  </Badge>
                  {permission.category && (
                    <Badge color="slate" size="sm">
                      {permission.category}
                    </Badge>
                  )}
                  {result && result.holderCount === 0 && (
                    <Badge color="amber" size="sm">
                      {tr("Held by nobody")}
                    </Badge>
                  )}
                </div>
                <p className="font-mono text-xs text-slate-500">
                  {permission.code}
                </p>
                {permission.description && (
                  <p className="text-sm text-slate-600">
                    {permission.description}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto">
                {stats.map(({ icon, value, label }) => (
                  <div
                    key={label}
                    className="min-w-[112px] rounded-xl border border-slate-200 bg-white/90 px-3 py-2.5 flex flex-col items-center shadow-sm"
                  >
                    <div className="flex items-center gap-1.5">
                      {icon}
                      <span className="text-base font-bold text-slate-800">
                        {value}
                      </span>
                    </div>
                    <span className="text-2xs text-slate-500 mt-0.5 whitespace-nowrap">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
          <TabNav
            tabs={tabs}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as TabId)}
            ariaLabel={__ariaTr("Access Explorer Details")}
          />
          <div className="p-4 md:p-5">
            {activeTab === "general" && permission && (
              <div className="space-y-4">
                <WarningBanner
                  variant="info"
                  description={tr("Read only. A person holds a permission through an Active access profile that holds an Active permission set that contains it: the same chain the system uses when they sign in. To keep or send this list, create a report of the type Permission Holders.")}
                />
                <div className="grid grid-cols-1 gap-3 md:gap-4 md:grid-cols-2">
                  <Field label={tr("Permission")}>
                    <ReadOnly strong>{permission.name}</ReadOnly>
                  </Field>
                  <Field label={tr("Code")}>
                    <ReadOnly>
                      <span className="font-mono text-xs">{permission.code}</span>
                    </ReadOnly>
                  </Field>
                  <Field label={tr("Module")}>
                    <ReadOnly>{moduleLabel(permission.moduleKey)}</ReadOnly>
                  </Field>
                  <Field label={tr("Category")}>
                    <ReadOnly>{permission.category || "—"}</ReadOnly>
                  </Field>
                  <Field label={tr("Permission Sets")}>
                    <ReadOnly>{result.permissionSets.length}</ReadOnly>
                  </Field>
                  <Field label={tr("Access Profiles")}>
                    <ReadOnly>{profileCount}</ReadOnly>
                  </Field>
                  <Field label={tr("People")}>
                    <ReadOnly>{result.holderCount}</ReadOnly>
                  </Field>
                  <Field label={tr("Active Accounts")}>
                    <ReadOnly>{result.activeHolderCount}</ReadOnly>
                  </Field>
                  <Field label={tr("Description")} className="md:col-span-2">
                    <div className="min-h-[76px] w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
                      <p className="whitespace-pre-line text-sm text-slate-700">
                        {permission.description || "No description available."}
                      </p>
                    </div>
                  </Field>
                </div>
              </div>
            )}

            {activeTab === "people" && (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="relative w-full md:max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      placeholder={tr("Search people, department, profile or set…")}
                      aria-label={tr("Search people")}
                      className="w-full pl-9 pr-8 h-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setPage(1);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        aria-label={tr("Clear search")}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <span className="flex items-center gap-2">
                    <Switch
                      checked={activeOnly}
                      onChange={(v) => {
                        setActiveOnly(v);
                        setPage(1);
                      }}
                      aria-label={tr("Only active accounts")}
                    />
                    <span className="text-sm text-slate-700">
                      {tr("Only active accounts")}
                    </span>
                  </span>
                </div>
                <div className="relative">
                  {loading && (
                    <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center rounded-xl">
                      <SectionLoading text="Searching..." minHeight="150px" />
                    </div>
                  )}
                  <DataTable
                    rows={result.holders}
                    getRowKey={(h) => h.userId}
                    columns={columns}
                    emptyState={
                      <TableEmptyState
                        title={tr("Nobody holds this permission")}
                        description={
                          debounced || !activeOnly
                            ? tr("No person matches. Try another search, or switch off 'Only active accounts' to include the others.")
                            : tr("No person with an Active account holds it. Switch off 'Only active accounts' to include the others.")
                        }
                      />
                    }
                    pagination={
                      result.holderTotal > 0 ? (
                        <div className="border-t border-slate-200">
                          <TablePagination
                            currentPage={page}
                            totalPages={result.totalPages}
                            totalItems={result.holderTotal}
                            itemsPerPage={size}
                            isLoading={loading}
                            onPageChange={setPage}
                            onItemsPerPageChange={(n) => {
                              setSize(n);
                              setPage(1);
                            }}
                            itemsPerPageOptions={[10, 20, 50]}
                          />
                        </div>
                      ) : undefined
                    }
                  />
                </div>
              </div>
            )}

            {activeTab === "through" && (
              <DataTable
                rows={throughRows}
                getRowKey={(row) => row.key}
                columns={throughColumns}
                onRowClick={(row) => {
                  if (row.profileId)
                    navigate(`${ROUTES.SECURITY.ACCESS_PROFILES}/${row.profileId}`);
                }}
                emptyState={
                  <TableEmptyState
                    title={tr("Nobody holds this permission")}
                    description={tr("No active permission set contains this permission.")}
                  />
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
