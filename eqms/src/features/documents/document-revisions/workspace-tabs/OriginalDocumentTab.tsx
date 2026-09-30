import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { StatusBadge } from "@/components/ui";
import type { StatusType } from "@/components/ui";
import { toDocumentBadgeStatus } from "@/features/documents/shared/statusMapping";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { ROUTES } from "@/app/routes.constants";
import { useNavigateWithLoading } from "@/hooks";
import { documentApi } from "@/services/api/documents";
import { buildDocumentDetailSnapshotState } from "@/features/documents/shared/detailSnapshotHelpers";
import { buildRevisionWorkspaceNavigationState, type RevisionWorkspaceState } from "@/features/documents/shared/navigationContext";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

type DocumentState = "Draft" | "Active" | "Obsoleted" | "Closed - Cancelled" | string;

export interface OriginalDocumentInfo {
  id?: string | null;
  documentNumber?: string | null;
  documentName?: string | null;
  displayName?: string | null;
  title?: string | null;
  created?: string | null;
  openedBy?: string | null;
  status?: DocumentState | null;
  statusCode?: string | null;
  statusInfo?: {
    id?: string | null;
    name?: string | null;
    code?: string | null;
    label?: string | null;
  } | null;
  author?: string | null;
  owner?: string | null;
  validUntil?: string | null;
  reviewDate?: string | null;
}

interface OriginalDocumentTabProps {
  document?: OriginalDocumentInfo | null;
  returnTo?: string;
  returnState?: RevisionWorkspaceState | null;
}

const mapDocumentStateToStatusType = (
  status?: DocumentState | null,
  statusInfo?: OriginalDocumentInfo["statusInfo"],
): StatusType => toDocumentBadgeStatus(status, statusInfo);

const displayValue = (value?: string | null): string => {
  return value && value.trim() ? value : "-";
};

const formatDateTimeFull = (dateStr?: string | null): string => {
  if (!dateStr) return "-";

  // Try matching dd/MM/yyyy, HH:mm:ss or dd/MM/yyyy HH:mm:ss
  const dtMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (dtMatch) {
    const [, d, m, y, hh, mm, ss] = dtMatch;
    return `${d}/${m}/${y} ${hh}:${mm}:${ss}`;
  }

  // Try matching dd/MM/yyyy
  const dMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dMatch) {
    const [, d, m, y] = dMatch;
    return `${d}/${m}/${y}`;
  }

  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(parsed.getDate())}/${pad(parsed.getMonth() + 1)}/${parsed.getFullYear()} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`;
};

export const OriginalDocumentTab: React.FC<OriginalDocumentTabProps> = ({ document, returnTo, returnState }) => {
  const { navigateTo, navigateToPrepared, isNavigating } = useNavigateWithLoading();

  const documents = useMemo(() => (document ? [document] : []), [document]);

  const navigationState = useMemo(
    () => {
      if (!returnTo) {
        return undefined;
      }

      return buildRevisionWorkspaceNavigationState({
        from: returnTo,
        returnTo,
        workspaceReturnPath: returnTo,
        workspaceMode: String(returnTo).startsWith(ROUTES.DOCUMENTS.REVISIONS.EDIT(""))
          ? "edit"
          : "create",
        workspaceState: returnState ?? undefined,
      });
    },
    [returnState, returnTo],
  );

  const handleDocumentClick = (doc: OriginalDocumentInfo) => {
    const targetId = doc.id || doc.documentNumber;
    if (!targetId) return;

    void navigateToPrepared(
      ROUTES.DOCUMENTS.DETAIL(targetId),
      async () => ({
        ...buildDocumentDetailSnapshotState(await documentApi.getDocumentDetailSnapshot(targetId)),
      }),
      {
        state: navigationState,
      },
    ).catch((error) => {
      console.error("Failed to preload original document detail", error);
      navigateTo(ROUTES.DOCUMENTS.DETAIL(targetId), {
        state: navigationState,
      });
    });
  };

  return (
    <div className="space-y-4">
      {isNavigating && <FullPageLoading text="Loading..." />}

      <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <TableMarkup.Root className="w-full">
            <TableMarkup.Head className="bg-slate-50 border-b border-slate-200">
              <TableMarkup.Row>
                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell16}>
                  No.
                </TableMarkup.HeaderCell>
                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell12}>
                  Document Number
                </TableMarkup.HeaderCell>
                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell14}>
                  Created
                </TableMarkup.HeaderCell>
                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell14}>
                  Opened by
                </TableMarkup.HeaderCell>
                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell12}>
                  Document Name
                </TableMarkup.HeaderCell>
                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell12}>
                  Status
                </TableMarkup.HeaderCell>
                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell13}>
                  Author
                </TableMarkup.HeaderCell>
                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell13}>
                  Valid Until
                </TableMarkup.HeaderCell>
              </TableMarkup.Row>
            </TableMarkup.Head>
            <TableMarkup.Body className="divide-y divide-slate-200 bg-white">
              {documents.length > 0 ? (
                documents.map((doc, index) => (
                  <TableMarkup.Row
                    key={doc.id || doc.documentNumber || index}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <TableMarkup.Cell className={TABLE_STYLES.cell18}>
                      {index + 1}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-2.5 px-2 md:py-3 md:px-4 text-xs md:text-sm whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleDocumentClick(doc)}
                        disabled={!doc.id && !doc.documentNumber}
                        className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline underline-offset-2 transition-colors cursor-pointer disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
                      >
                        {displayValue(doc.documentNumber)}
                      </button>
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className={TABLE_STYLES.cell20}>
                      {formatDateTimeFull(doc.created)}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className={TABLE_STYLES.cell20}>
                      {displayValue(doc.openedBy)}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-2.5 px-2 md:py-3 md:px-4 text-xs md:text-sm text-slate-900 whitespace-nowrap">
                      {displayValue(doc.documentName)}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-2.5 px-2 md:py-3 md:px-4 text-xs md:text-sm whitespace-nowrap">
                      {doc.status ? <StatusBadge status={mapDocumentStateToStatusType(doc.status, doc.statusInfo)} /> : "-"}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className={TABLE_STYLES.cell19}>
                      {displayValue(doc.author)}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className={TABLE_STYLES.cell19}>
                      {formatDateTimeFull(doc.validUntil)}
                    </TableMarkup.Cell>
                  </TableMarkup.Row>
                ))
              ) : (
                <TableMarkup.Row>
                  <TableMarkup.Cell colSpan={8} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center">
                        <Search className="h-5 w-5 text-slate-300" />
                      </div>
                      <p className="text-sm font-medium text-slate-500">
                        No records to display
                      </p>
                    </div>
                  </TableMarkup.Cell>
                </TableMarkup.Row>
              )}
            </TableMarkup.Body>
          </TableMarkup.Root>
        </div>
      </div>
    </div>
  );
};
