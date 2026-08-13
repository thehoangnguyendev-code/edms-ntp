import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { EmptyState } from "@/components/ui/page/EmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { Badge } from "@/components/ui/badge/Badge";
import { useToast } from "@/components/ui/toast/Toast";
import { useTranslation } from "@/i18n";
import { documentApi, type ControlledCopyBatchStatusDiscrepancy } from "@/services/api/documents";
import { controlledCopyBatchStatusDiscrepancies } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { normalizeControlledCopyStatusLabel } from "./status";
import { ROUTES } from "@/app/routes.constants";

const PAGE_SIZE = 20;

export const ControlledCopyBatchStatusDiscrepanciesView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { locale, t } = useTranslation();
  const [rows, setRows] = useState<ControlledCopyBatchStatusDiscrepancy[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    documentApi
      .getControlledCopyBatchStatusDiscrepancies({ page: currentPage, limit: PAGE_SIZE })
      .then((response) => {
        if (cancelled) return;
        setRows(response.data);
        setTotal(response.pagination.total);
        setTotalPages(response.pagination.totalPages);
      })
      .catch(() => {
        if (cancelled) return;
        showToast({ type: "error", message: t("controlledCopyDiscrepancies.loadFailed") });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentPage, showToast]);

  const formatDateTime = (value: string) => {
    try {
      return new Date(value).toLocaleString(locale === "vi" ? "vi-VN" : "en-US");
    } catch {
      return value;
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6 w-full flex-1">
      <PageHeader
        title={t("controlledCopyDiscrepancies.title")}
        breadcrumbItems={controlledCopyBatchStatusDiscrepancies(navigate)}
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col">
        <div className="p-4 md:p-5 flex-1 flex flex-col">
          <p className="text-sm text-slate-500 mb-4">
            Distribution batches whose stored status does not match the status derived from their
            member copies. The system scans automatically every hour and{" "}
            <strong>never corrects this automatically</strong> — an authorized reviewer must check
            and resolve each case manually.
          </p>

          {isLoading ? (
            <SectionLoading minHeight="40vh" />
          ) : rows.length === 0 ? (
            <EmptyState
              title={t("controlledCopyDiscrepancies.emptyTitle")}
              description={t("controlledCopyDiscrepancies.emptyDescription")}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-2 pr-4 font-medium">{t("controlledCopyDiscrepancies.columns.batchNumber")}</th>
                      <th className="py-2 pr-4 font-medium">{t("controlledCopyDiscrepancies.columns.document")}</th>
                      <th className="py-2 pr-4 font-medium">{t("controlledCopyDiscrepancies.columns.storedStatus")}</th>
                      <th className="py-2 pr-4 font-medium">{t("controlledCopyDiscrepancies.columns.expectedStatus")}</th>
                      <th className="py-2 pr-4 font-medium">{t("controlledCopyDiscrepancies.columns.detectedAt")}</th>
                      <th className="py-2 pr-4 font-medium">{t("controlledCopyDiscrepancies.columns.lastChecked")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                        onClick={() => navigate(ROUTES.DOCUMENTS.CONTROLLED_COPIES.DETAIL(row.batchId))}
                      >
                        <td className="py-2.5 pr-4 font-medium text-slate-800 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                          {row.batchNumber}
                        </td>
                        <td className="py-2.5 pr-4 text-slate-600">
                          {row.documentNumber || "—"}
                          {row.documentTitle ? ` — ${row.documentTitle}` : ""}
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge color="amber">{normalizeControlledCopyStatusLabel(row.actualStatusCode)}</Badge>
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge color="emerald">{normalizeControlledCopyStatusLabel(row.expectedStatusCode)}</Badge>
                        </td>
                        <td className="py-2.5 pr-4 text-slate-500">{formatDateTime(row.detectedAt)}</td>
                        <td className="py-2.5 pr-4 text-slate-500">{formatDateTime(row.lastCheckedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4">
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={total}
                  itemsPerPage={PAGE_SIZE}
                  onPageChange={setCurrentPage}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ControlledCopyBatchStatusDiscrepanciesView;
