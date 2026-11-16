import { useCallback, useEffect, useState } from "react";
import { IconBraces, IconCheck, IconCopy } from "@tabler/icons-react";
import { CopyButton, CopyButtonIcon } from "@animate-ui/react/primitives/buttons/copy";
import { FormField, Input } from "@/components/ui/form/ResponsiveForm";
import { FormSection } from "@/components/ui/form/FormSection";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { DataTable, TABLE_STYLES, type DataTableColumn } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { useDebounce } from "@/hooks";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { reportAppearanceApi, type ReportPlaceholder, type ReportPlaceholderQuery } from "@/services/api/reportAppearance";
import { reportError, type Pagination } from "@/services/api/reportTemplates";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";

const PAGE_SIZE = 10;
type SortKey = NonNullable<ReportPlaceholderQuery["sort"]>;

/**
 * The automatic fields a text can hold, as a table on a wide screen and as cards on a phone. The server does the search, the sort and the paging (10 rows at most a page):
 * this screen only sends what the person typed and clicked. The Copy button copies the field; the chips under a text on the page insert it.
 */
export function ReportPlaceholdersSection() {
  const mobile = useMediaQuery("(max-width: 767px)");
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ReportPlaceholder[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    reportAppearanceApi
      .placeholders({ search: debounced || undefined, sort: sort?.key, direction: sort?.direction, page, limit: PAGE_SIZE }, controller.signal)
      .then((result) => {
        setRows(result.data);
        setPagination(result.pagination);
        setError("");
        if (result.pagination.page !== page) setPage(result.pagination.page);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(reportError(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debounced, sort, page]);

  const sortFor = useCallback(
    (key: SortKey) => ({
      direction: sort?.key === key ? sort.direction : undefined,
      onSort: () => {
        setSort((previous) => ({ key, direction: previous?.key === key && previous.direction === "asc" ? "desc" : "asc" }));
        setPage(1);
      },
    }),
    [sort],
  );

  // The button is the Animate UI copy button: it writes the field to the clipboard itself and swaps the copy icon for a check. Its text stays "Copy".
  const copyButton = (token: ReportPlaceholder) => (
    <CopyButton
      content={token.placeholder}
      aria-label={`Copy ${token.code}`}
      className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 md:h-7 md:px-3"
    >
      <CopyButtonIcon icon={<IconCopy className="h-3.5 w-3.5" />} copiedIcon={<IconCheck className="h-3.5 w-3.5 text-emerald-600" />} />
      Copy
    </CopyButton>
  );

  const first = (pagination.page - 1) * pagination.limit;
  const columns: DataTableColumn<ReportPlaceholder>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: TABLE_STYLES.headerCell35, cellClassName: TABLE_STYLES.cell30, cell: (_token, index) => first + index + 1 },
    { id: "name", header: "Name", label: "Name", sort: sortFor("name"), cell: (token) => <span className="font-medium text-slate-900">{token.name}</span> },
    { id: "code", header: "Placeholder", label: "Placeholder", sort: sortFor("code"), cell: (token) => <span translate="no" className="font-mono text-xs text-slate-700">{token.placeholder}</span> },
    { id: "example", header: "Filled with", label: "Filled with", sort: sortFor("example"), cellClassName: "max-w-md whitespace-normal", cell: (token) => <span className="text-slate-600">{token.example}</span> },
    { id: "copy", header: "Copy", label: "Copy", cell: (token) => copyButton(token) },
  ];

  const empty = <p className="py-6 text-center text-sm text-slate-500">No field matches.</p>;
  return (
    <FormSection title="Report Placeholders" icon={<IconBraces className="h-4 w-4" />}>
      <div className="space-y-3">
        <div>
          <FormField label="Search">
            <Input
              placeholder="Search by name, code or description…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </FormField>
        </div>
        {error && <WarningBanner variant="error" description={error} />}
        {mobile ? (
          <ul className="space-y-2" aria-busy={loading}>
            {rows.map((token) => (
              <li key={token.code} className="space-y-1.5 rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-sm font-medium text-slate-900">{token.name}</span>
                  {copyButton(token)}
                </div>
                <p translate="no" className="break-all font-mono text-xs text-slate-700">{token.placeholder}</p>
                <p className="text-xs text-slate-500">{token.example}</p>
              </li>
            ))}
            {!loading && rows.length === 0 && <li>{empty}</li>}
          </ul>
        ) : (
          <DataTable rows={rows} columns={columns} getRowKey={(token) => token.code} isLoading={loading && rows.length === 0} emptyState={empty} />
        )}
        <TablePagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={PAGE_SIZE}
          isLoading={loading}
          showItemsPerPageSelector={false}
          onPageChange={setPage}
        />
      </div>
    </FormSection>
  );
}
