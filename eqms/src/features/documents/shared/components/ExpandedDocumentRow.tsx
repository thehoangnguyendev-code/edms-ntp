import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Badge, type BadgeColor } from "@/components/ui/badge";
import { useNavigateWithLoading } from "@/hooks";
import { ROUTES } from "@/app/routes.constants";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { documentApi } from "@/services/api/documents";
import {
  buildDocumentDetailSnapshotState,
  buildRevisionDetailSnapshotState,
} from "@/features/documents/shared/detailSnapshotHelpers";
import { getStatusBadgeColor } from "@/utils/status";

const getBadgeColor = (statusCode?: string, statusLabel?: string): BadgeColor =>
  getStatusBadgeColor(statusLabel, statusCode) ?? "slate";

interface ExpandedDocumentRelation {
  id: string;
  documentNumber?: string;
  documentName?: string;
  revisionNumber?: string;
  version?: string;
  type?: string;
  state?: string;
  status?: string;
  statusCode?: string;
  correlationType?: string;
  relationType?: string;
}

interface ExpandedDocumentRowProps {
  revision?: {
    id: string;
    relatedDocuments?: ExpandedDocumentRelation[];
    correlatedDocuments?: ExpandedDocumentRelation[];
  };
  isExpanded: boolean;
  visibleColumnsLength: number;
  hasDocs: boolean;
  showCorrelationType?: boolean;
  documentId?: string;
  revisionId?: string;
}

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

/**
 * Reusable expanded row component for displaying related and correlated documents,
 * parent documents, and revisions list.
 * Used in DocumentsView, RevisionListView, RevisionsOwnedByMeView, and PendingDocumentsView
 */
export const ExpandedDocumentRow: React.FC<ExpandedDocumentRowProps> = ({
  revision,
  isExpanded,
  visibleColumnsLength,
  hasDocs,
  showCorrelationType = false,
  documentId,
  revisionId,
}) => {
  const { navigateTo, navigateToPrepared, isNavigating } = useNavigateWithLoading();
  const shouldReduceMotion = useReducedMotion();
  const transitionConfig = useMemo(() => shouldReduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 90, damping: 16 }, [shouldReduceMotion]);

  const [fetchedRevisions, setFetchedRevisions] = useState<any[] | null>(null);
  const [fetchedParentDocument, setFetchedParentDocument] = useState<any | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    if (!isExpanded) return;

    let isMounted = true;
    const loadDetails = async () => {
      if (documentId && fetchedRevisions === null) {
        setIsLoadingDetails(true);
        try {
          const res = await documentApi.getDocumentVersions(documentId);
          if (isMounted) {
            setFetchedRevisions((res as any[]) || []);
          }
        } catch (error) {
          console.error("Failed to load revisions for document", error);
        } finally {
          if (isMounted) setIsLoadingDetails(false);
        }
      } else if (revisionId && fetchedParentDocument === null) {
        setIsLoadingDetails(true);
        try {
          const detail = await documentApi.getRevisionById(revisionId);
          if (isMounted) {
            setFetchedParentDocument(detail.originalDocument || null);
          }
        } catch (error) {
          console.error("Failed to load parent document for revision", error);
        } finally {
          if (isMounted) setIsLoadingDetails(false);
        }
      }
    };

    void loadDetails();

    return () => {
      isMounted = false;
    };
  }, [isExpanded, documentId, revisionId, fetchedRevisions, fetchedParentDocument]);

  const normalizedRevision = useMemo(() => {
    const mapRelation = (r: ExpandedDocumentRelation) => ({
      id: r.id,
      documentNumber: r.documentNumber,
      documentName: r.documentName,
      revisionNumber: r.revisionNumber || r.version || "-",
      type: r.type,
      state: r.state || r.status,
      statusCode: r.statusCode,
      correlationType: r.correlationType || r.relationType,
    });
    return {
      id: revision?.id || "",
      relatedDocuments: (revision?.relatedDocuments ?? []).map(mapRelation),
      correlatedDocuments: (revision?.correlatedDocuments ?? []).map(mapRelation),
    };
  }, [revision]);

  const openRevisionDetail = (revisionId: string) => {
    void navigateToPrepared(
      ROUTES.DOCUMENTS.REVISIONS.DETAIL(revisionId),
      async () => ({
        ...buildRevisionDetailSnapshotState(await documentApi.getRevisionByIdSnapshot(revisionId)),
      }),
    ).catch((error) => {
      console.error("Failed to preload related revision detail", error);
      navigateTo(ROUTES.DOCUMENTS.REVISIONS.DETAIL(revisionId));
    });
  };

  const openDocumentDetail = (docId: string) => {
    void navigateToPrepared(
      ROUTES.DOCUMENTS.DETAIL(docId),
      async () => ({
        ...buildDocumentDetailSnapshotState(await documentApi.getDocumentDetailSnapshot(docId)),
      }),
    ).catch((error) => {
      console.error("Failed to preload document detail", error);
      navigateTo(ROUTES.DOCUMENTS.DETAIL(docId));
    });
  };

  return (
    <AnimatePresence initial={false}>
      {isExpanded && hasDocs && (
        <motion.tr
          key={`expanded-${revision?.id || documentId || revisionId}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transitionConfig}
          className="bg-slate-50/50"
        >
          <td colSpan={visibleColumnsLength - 1} className="p-0 border-b border-slate-200">
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={transitionConfig}
              className="overflow-hidden"
            >
              <div className="p-4 md:p-5">
                <div className="ml-9 flex flex-col gap-4 items-start">
                  {isLoadingDetails && (
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-medium py-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
                      Loading details...
                    </div>
                  )}

                  {!isLoadingDetails && documentId && fetchedRevisions && fetchedRevisions.length > 0 && (
                    <div className="w-full">
                      <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Revisions ({fetchedRevisions.length})
                      </p>
                      <div className="rounded-lg border border-slate-200 overflow-hidden inline-block max-w-full">
                        <table className="text-xs table-auto w-auto">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200">
                              <th className="py-1.5 px-2.5 text-center text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap w-10">
                                No.
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Revision Number
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Created
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Opened by
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Revision Name
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {fetchedRevisions.map((rev, idx) => (
                              <tr key={rev.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-1.5 px-2.5 text-slate-500 text-center font-medium">
                                  {idx + 1}
                                </td>
                                <td
                                  className="py-1.5 px-2.5 font-medium text-emerald-600 whitespace-nowrap cursor-pointer hover:underline"
                                  onClick={() => openRevisionDetail(rev.id)}
                                >
                                  {rev.revisionNumber}
                                </td>
                                <td className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                  {formatDateTimeFull(rev.created)}
                                </td>
                                <td className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                  {rev.openedBy || "-"}
                                </td>
                                <td className="py-1.5 px-2.5 text-slate-700 whitespace-normal min-w-[200px] max-w-[360px]">
                                  {rev.revisionName || rev.revisionNumber}
                                </td>
                                <td className="py-1.5 px-2.5 whitespace-nowrap">
                                  <Badge color={getBadgeColor(rev.statusCode, rev.status)} size="xs">
                                    {rev.status}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {!isLoadingDetails && revisionId && fetchedParentDocument && (
                    <div className="w-full">
                      <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Document Master
                      </p>
                      <div className="rounded-lg border border-slate-200 overflow-hidden inline-block max-w-full">
                        <table className="text-xs table-auto w-auto">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200">
                              <th className="py-1.5 px-2.5 text-center text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap w-10">
                                No.
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Document Number
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Created
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Opened by
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Document Name
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Status
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Author
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Valid Until
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            <tr className="hover:bg-slate-50 transition-colors">
                              <td className="py-1.5 px-2.5 text-slate-500 text-center font-medium">
                                1
                              </td>
                              <td
                                className="py-1.5 px-2.5 font-medium text-emerald-600 whitespace-nowrap cursor-pointer hover:underline"
                                onClick={() => openDocumentDetail(fetchedParentDocument.id)}
                              >
                                {fetchedParentDocument.documentNumber}
                              </td>
                              <td className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                {formatDateTimeFull(fetchedParentDocument.created)}
                              </td>
                              <td className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                {fetchedParentDocument.openedBy || "-"}
                              </td>
                              <td className="py-1.5 px-2.5 text-slate-700 whitespace-normal min-w-[220px] max-w-[360px]">
                                {fetchedParentDocument.documentName}
                              </td>
                              <td className="py-1.5 px-2.5 whitespace-nowrap">
                                <Badge color={getBadgeColor(fetchedParentDocument.statusCode, fetchedParentDocument.status)} size="xs">
                                  {fetchedParentDocument.status}
                                </Badge>
                              </td>
                              <td className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                {fetchedParentDocument.author || "-"}
                              </td>
                              <td className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                {formatDateTimeFull(fetchedParentDocument.validUntil)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {!isLoadingDetails && normalizedRevision.relatedDocuments.length > 0 && (
                    <div>
                      <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Related Documents ({normalizedRevision.relatedDocuments.length})
                      </p>
                      <div className="rounded-lg border border-slate-200 overflow-hidden inline-block max-w-full">
                        <table className="text-xs table-auto w-auto">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200">
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Document Number
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Document Name
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Revision
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Type
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {normalizedRevision.relatedDocuments.map((doc) => (
                              <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                                <td
                                  className="py-1.5 px-2.5 font-medium text-emerald-600 whitespace-nowrap cursor-pointer hover:underline"
                                  onClick={() => openRevisionDetail(doc.id)}
                                >
                                  {doc.documentNumber}
                                </td>
                                <td className="py-1.5 px-2.5 text-slate-700 whitespace-normal min-w-[220px] max-w-[360px]">
                                  {doc.documentName}
                                </td>
                                <td className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                  {doc.revisionNumber}
                                </td>
                                <td className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                  {doc.type}
                                </td>
                                <td className="py-1.5 px-2.5 whitespace-nowrap">
                                  <Badge color={getBadgeColor(doc.statusCode, doc.state)} size="xs">{doc.state}</Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {!isLoadingDetails && normalizedRevision.correlatedDocuments.length > 0 && (
                    <div>
                      <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Correlated Documents ({normalizedRevision.correlatedDocuments.length})
                      </p>
                      <div className="rounded-lg border border-slate-200 overflow-hidden inline-block max-w-full">
                        <table className="text-xs table-auto w-auto">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200">
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Document Number
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Document Name
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Revision
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Type
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Status
                              </th>
                              {showCorrelationType && (
                                <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                  Correlation Type
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {normalizedRevision.correlatedDocuments.map((doc) => (
                              <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                                <td
                                  className="py-1.5 px-2.5 font-medium text-emerald-600 whitespace-nowrap cursor-pointer hover:underline"
                                  onClick={() => openRevisionDetail(doc.id)}
                                >
                                  {doc.documentNumber}
                                </td>
                                <td className="py-1.5 px-2.5 text-slate-700 whitespace-normal min-w-[220px] max-w-[360px]">
                                  {doc.documentName}
                                </td>
                                <td className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                  {doc.revisionNumber}
                                </td>
                                <td className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                  {doc.type}
                                </td>
                                <td className="py-1.5 px-2.5 whitespace-nowrap">
                                  <Badge color={getBadgeColor(doc.statusCode, doc.state)} size="xs">{doc.state}</Badge>
                                </td>
                                {showCorrelationType && (
                                  <td className="py-1.5 px-2.5 text-slate-500 whitespace-nowrap">
                                    {doc.correlationType ?? "—"}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </td>
          <td className="p-0 border-b border-slate-200 sticky right-0 z-10 bg-slate-50/50 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]"></td>
        </motion.tr>
      )}
      {isNavigating && <FullPageLoading text="Loading document details..." />}
    </AnimatePresence>
  );
};
