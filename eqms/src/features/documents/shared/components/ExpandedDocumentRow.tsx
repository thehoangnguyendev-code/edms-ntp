import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { EXPAND_CONTENT_MOTION, useExpandTransition } from "@/components/ui/table/expandMotion";
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
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

// What the expanded row shows is fetched on demand. To make the row open with its content already in it, the chevron asks for it
// as soon as the pointer reaches it (see preloadExpandedDocumentDetails), and what was fetched is remembered for a short while.
const DETAIL_TTL_MS = 10_000;
const DETAIL_CACHE_MAX_ENTRIES = 48;
type Remembered<T> = { value: T; at: number };
const versionsCache = new Map<string, Remembered<any[]>>();
const parentCache = new Map<string, Remembered<any | null>>();
const inFlight = new Map<string, Promise<any>>();

const remember = <T,>(cache: Map<string, Remembered<T>>, key: string, value: T) => {
  cache.delete(key);
  cache.set(key, { value, at: Date.now() });
  while (cache.size > DETAIL_CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
};

const dedupe = <T,>(key: string, start: () => Promise<T>): Promise<T> => {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = start().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
};

const loadVersions = (documentId: string): Promise<any[]> =>
  dedupe(`versions:${documentId}`, async () => {
    const versions = ((await documentApi.getDocumentVersions(documentId)) as any[]) || [];
    remember(versionsCache, documentId, versions);
    return versions;
  });

const loadParentDocument = (revisionId: string): Promise<any | null> =>
  dedupe(`parent:${revisionId}`, async () => {
    const detail = await documentApi.getRevisionById(revisionId);
    const parent = detail.originalDocument || null;
    remember(parentCache, revisionId, parent);
    return parent;
  });

/** Starts fetching what a row's expansion will show, so that it is there when the row opens. Safe to call repeatedly and on hover. */
export const preloadExpandedDocumentDetails = ({ documentId, revisionId }: { documentId?: string; revisionId?: string }) => {
  const cached = documentId ? versionsCache.get(documentId) : revisionId ? parentCache.get(revisionId) : undefined;
  if (cached && Date.now() - cached.at < DETAIL_TTL_MS) return;
  const request = documentId ? loadVersions(documentId) : revisionId ? loadParentDocument(revisionId) : null;
  request?.catch(() => undefined); // the row itself reports a failure when it opens
};

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
  const transitionConfig = useExpandTransition();

  const [fetchedRevisions, setFetchedRevisions] = useState<any[] | null>(() =>
    documentId ? (versionsCache.get(documentId)?.value ?? null) : null,
  );
  const [fetchedParentDocument, setFetchedParentDocument] = useState<any | null>(() =>
    !documentId && revisionId ? (parentCache.get(revisionId)?.value ?? null) : null,
  );
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Shown at once from what the chevron's hover/press already fetched (or the last visit), then replaced by a fresh copy when the
  // remembered one is older than DETAIL_TTL_MS. The spinner appears only when there is nothing at all to show.
  useEffect(() => {
    if (!isExpanded || !hasDocs) return;
    let isMounted = true;
    const finish = () => {
      if (isMounted) setIsLoadingDetails(false);
    };

    if (documentId) {
      const cached = versionsCache.get(documentId);
      if (cached) setFetchedRevisions(cached.value);
      if (cached && Date.now() - cached.at < DETAIL_TTL_MS) return;
      if (!cached) setIsLoadingDetails(true);
      loadVersions(documentId)
        .then((versions) => {
          if (isMounted) setFetchedRevisions(versions);
        })
        .catch((error) => console.error("Failed to load revisions for document", error))
        .finally(finish);
    } else if (revisionId) {
      const cached = parentCache.get(revisionId);
      if (cached) setFetchedParentDocument(cached.value);
      if (cached && Date.now() - cached.at < DETAIL_TTL_MS) return;
      if (!cached) setIsLoadingDetails(true);
      loadParentDocument(revisionId)
        .then((parent) => {
          if (isMounted) setFetchedParentDocument(parent);
        })
        .catch((error) => console.error("Failed to load parent document for revision", error))
        .finally(finish);
    }

    return () => {
      isMounted = false;
    };
  }, [isExpanded, hasDocs, documentId, revisionId]);

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
    <>
      {isExpanded && hasDocs && (
        <motion.tr
          key={`expanded-${revision?.id || documentId || revisionId}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transitionConfig}
          className="bg-slate-50/50"
        >
          <TableMarkup.Cell colSpan={visibleColumnsLength - 1} className="p-0 border-b border-slate-200">
            <motion.div
              {...EXPAND_CONTENT_MOTION}
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
                        <TableMarkup.Root className="text-xs table-auto w-auto">
                          <TableMarkup.Head>
                            <TableMarkup.Row className="bg-slate-100 border-b border-slate-200">
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table7}>
                                No.
                              </TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Revision Number
                              </TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Created
                              </TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Opened by
                              </TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Revision Name
                              </TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Status
                              </TableMarkup.HeaderCell>
                            </TableMarkup.Row>
                          </TableMarkup.Head>
                          <TableMarkup.Body className="divide-y divide-slate-100 bg-white">
                            {fetchedRevisions.map((rev, idx) => (
                              <TableMarkup.Row key={rev.id} className="hover:bg-slate-50 transition-colors">
                                <TableMarkup.Cell className="py-1.5 px-2.5 text-slate-500 text-center font-medium">
                                  {idx + 1}
                                </TableMarkup.Cell>
                                <TableMarkup.Cell
                                  className={TABLE_STYLES.table5}
                                  onClick={() => openRevisionDetail(rev.id)}
                                >
                                  {rev.revisionNumber}
                                </TableMarkup.Cell>
                                <TableMarkup.Cell className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                  {formatDateTimeFull(rev.created)}
                                </TableMarkup.Cell>
                                <TableMarkup.Cell className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                  {rev.openedBy || "-"}
                                </TableMarkup.Cell>
                                <TableMarkup.Cell className="py-1.5 px-2.5 text-slate-700 whitespace-normal min-w-[200px] max-w-[360px]">
                                  {rev.revisionName || rev.revisionNumber}
                                </TableMarkup.Cell>
                                <TableMarkup.Cell className="py-1.5 px-2.5 whitespace-nowrap">
                                  <Badge color={getBadgeColor(rev.statusCode, rev.status)} size="xs">
                                    {rev.status}
                                  </Badge>
                                </TableMarkup.Cell>
                              </TableMarkup.Row>
                            ))}
                          </TableMarkup.Body>
                        </TableMarkup.Root>
                      </div>
                    </div>
                  )}

                  {!isLoadingDetails && revisionId && fetchedParentDocument && (
                    <div className="w-full">
                      <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Document Master
                      </p>
                      <div className="rounded-lg border border-slate-200 overflow-hidden inline-block max-w-full">
                        <TableMarkup.Root className="text-xs table-auto w-auto">
                          <TableMarkup.Head>
                            <TableMarkup.Row className="bg-slate-100 border-b border-slate-200">
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table7}>
                                No.
                              </TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Document Number
                              </TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Created
                              </TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Opened by
                              </TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Document Name
                              </TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Status
                              </TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Author
                              </TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Valid Until
                              </TableMarkup.HeaderCell>
                            </TableMarkup.Row>
                          </TableMarkup.Head>
                          <TableMarkup.Body className="divide-y divide-slate-100 bg-white">
                            <TableMarkup.Row className="hover:bg-slate-50 transition-colors">
                              <TableMarkup.Cell className="py-1.5 px-2.5 text-slate-500 text-center font-medium">
                                1
                              </TableMarkup.Cell>
                              <TableMarkup.Cell
                                className={TABLE_STYLES.table5}
                                onClick={() => openDocumentDetail(fetchedParentDocument.id)}
                              >
                                {fetchedParentDocument.documentNumber}
                              </TableMarkup.Cell>
                              <TableMarkup.Cell className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                {formatDateTimeFull(fetchedParentDocument.created)}
                              </TableMarkup.Cell>
                              <TableMarkup.Cell className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                {fetchedParentDocument.openedBy || "-"}
                              </TableMarkup.Cell>
                              <TableMarkup.Cell className={TABLE_STYLES.table10}>
                                {fetchedParentDocument.documentName}
                              </TableMarkup.Cell>
                              <TableMarkup.Cell className="py-1.5 px-2.5 whitespace-nowrap">
                                <Badge color={getBadgeColor(fetchedParentDocument.statusCode, fetchedParentDocument.status)} size="xs">
                                  {fetchedParentDocument.status}
                                </Badge>
                              </TableMarkup.Cell>
                              <TableMarkup.Cell className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                {fetchedParentDocument.author || "-"}
                              </TableMarkup.Cell>
                              <TableMarkup.Cell className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                {formatDateTimeFull(fetchedParentDocument.validUntil)}
                              </TableMarkup.Cell>
                            </TableMarkup.Row>
                          </TableMarkup.Body>
                        </TableMarkup.Root>
                      </div>
                    </div>
                  )}

                  {!isLoadingDetails && normalizedRevision.relatedDocuments.length > 0 && (
                    <div>
                      <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Related Documents ({normalizedRevision.relatedDocuments.length})
                      </p>
                      <div className="rounded-lg border border-slate-200 overflow-hidden inline-block max-w-full">
                        <TableMarkup.Root className="text-xs table-auto w-auto">
                          <TableMarkup.Head>
                            <TableMarkup.Row className="bg-slate-100 border-b border-slate-200">
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Document Number
                              </TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Document Name
                              </TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Revision
                              </TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Type
                              </TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Status
                              </TableMarkup.HeaderCell>
                            </TableMarkup.Row>
                          </TableMarkup.Head>
                          <TableMarkup.Body className="divide-y divide-slate-100 bg-white">
                            {normalizedRevision.relatedDocuments.map((doc) => (
                              <TableMarkup.Row key={doc.id} className="hover:bg-slate-50 transition-colors">
                                <TableMarkup.Cell
                                  className={TABLE_STYLES.table5}
                                  onClick={() => openRevisionDetail(doc.id)}
                                >
                                  {doc.documentNumber}
                                </TableMarkup.Cell>
                                <TableMarkup.Cell className={TABLE_STYLES.table10}>
                                  {doc.documentName}
                                </TableMarkup.Cell>
                                <TableMarkup.Cell className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                  {doc.revisionNumber}
                                </TableMarkup.Cell>
                                <TableMarkup.Cell className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                  {doc.type}
                                </TableMarkup.Cell>
                                <TableMarkup.Cell className="py-1.5 px-2.5 whitespace-nowrap">
                                  <Badge color={getBadgeColor(doc.statusCode, doc.state)} size="xs">{doc.state}</Badge>
                                </TableMarkup.Cell>
                              </TableMarkup.Row>
                            ))}
                          </TableMarkup.Body>
                        </TableMarkup.Root>
                      </div>
                    </div>
                  )}

                  {!isLoadingDetails && normalizedRevision.correlatedDocuments.length > 0 && (
                    <div>
                      <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Correlated Documents ({normalizedRevision.correlatedDocuments.length})
                      </p>
                      <div className="rounded-lg border border-slate-200 overflow-hidden inline-block max-w-full">
                        <TableMarkup.Root className="text-xs table-auto w-auto">
                          <TableMarkup.Head>
                            <TableMarkup.Row className="bg-slate-100 border-b border-slate-200">
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Document Number
                              </TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Document Name
                              </TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Revision
                              </TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Type
                              </TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                Status
                              </TableMarkup.HeaderCell>
                              {showCorrelationType && (
                                <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>
                                  Correlation Type
                                </TableMarkup.HeaderCell>
                              )}
                            </TableMarkup.Row>
                          </TableMarkup.Head>
                          <TableMarkup.Body className="divide-y divide-slate-100 bg-white">
                            {normalizedRevision.correlatedDocuments.map((doc) => (
                              <TableMarkup.Row key={doc.id} className="hover:bg-slate-50 transition-colors">
                                <TableMarkup.Cell
                                  className={TABLE_STYLES.table5}
                                  onClick={() => openRevisionDetail(doc.id)}
                                >
                                  {doc.documentNumber}
                                </TableMarkup.Cell>
                                <TableMarkup.Cell className={TABLE_STYLES.table10}>
                                  {doc.documentName}
                                </TableMarkup.Cell>
                                <TableMarkup.Cell className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                  {doc.revisionNumber}
                                </TableMarkup.Cell>
                                <TableMarkup.Cell className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                                  {doc.type}
                                </TableMarkup.Cell>
                                <TableMarkup.Cell className="py-1.5 px-2.5 whitespace-nowrap">
                                  <Badge color={getBadgeColor(doc.statusCode, doc.state)} size="xs">{doc.state}</Badge>
                                </TableMarkup.Cell>
                                {showCorrelationType && (
                                  <TableMarkup.Cell className="py-1.5 px-2.5 text-slate-500 whitespace-nowrap">
                                    {doc.correlationType ?? "—"}
                                  </TableMarkup.Cell>
                                )}
                              </TableMarkup.Row>
                            ))}
                          </TableMarkup.Body>
                        </TableMarkup.Root>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </TableMarkup.Cell>
          <TableMarkup.Cell className={TABLE_STYLES.emptyCell1}></TableMarkup.Cell>
        </motion.tr>
      )}
      {isNavigating && <FullPageLoading text="Loading document details..." />}
    </>
  );
};
