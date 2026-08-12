import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { Badge, type BadgeColor } from "@/components/ui/badge/Badge";
import { useNavigateWithLoading, usePortalDropdown, type PortalDropdownPosition } from "@/hooks";
import { ROUTES } from "@/app/routes.constants";
import { documentApi } from "@/services/api/documents";
import { buildControlledCopySnapshotState } from "@/features/documents/shared/detailSnapshotHelpers";
import { formatDateTimeParts, formatDateUS } from "@/utils/format";
import { getStatusBadgeColor } from "@/utils/status";
import { cn } from "@/components/ui/utils";
import { formatControlledCopyNumber, formatDocumentLabel, formatDocumentRevisionLabel } from "../display";
import { getControlledCopyDistributionListText } from "../distributionDisplay";
import { normalizeControlledCopyRecord } from "../controlledCopyMapping";
import { normalizeControlledCopyStatusLabel } from "../status";
import type { ControlledCopy } from "../types";
import { FileX, History, MoreVertical, RefreshCw, Send, Shredder } from "lucide-react";
import { IconArrowBackUp, IconInfoCircle, IconShape3 } from "@tabler/icons-react";
import {
  getControlledCopyActionDecision,
} from "../controlledCopyCapabilities";
import { useControlledCopyActionCapabilities } from "@/hooks";

const CONTROLLED_COPY_CHILDREN_CACHE = new Map<string, ControlledCopy[]>();
const CONTROLLED_COPY_CHILDREN_IN_FLIGHT = new Map<string, Promise<ControlledCopy[]>>();
const CHILD_PAGE_SIZE = 50;

interface ExpandControlledCopiesRowProps {
  source: {
    id: string;
    batchId?: string;
    batchNumber?: string;
    copyIds?: string[];
    distributionBatchId?: string;
    distributionBatchNumber?: string;
    requestedAt?: string;
    requestedBy?: string;
    createdDate?: string;
    createdTime?: string;
    controlledCopyNumber?: string;
    documentNumber?: string;
    documentTitle?: string;
    revisionNumber?: string;
    validUntil?: string;
    expiryDate?: string;
    distributionList?: string;
    distributionRecipients?: string;
    status?: string;
    statusCode?: string;
    batchQuantity?: number;
  };
  isExpanded: boolean;
  visibleColumnsLength: number;
  onViewDetails?: (copy: ControlledCopy) => void;
  onViewAuditTrail?: (copy: ControlledCopy) => void;
  onDistribute?: (copy: ControlledCopy) => void;
  onRecall?: (copy: ControlledCopy) => void;
  onCancel?: (copy: ControlledCopy) => void;
  onReportLostDamaged?: (copy: ControlledCopy) => void;
  onReissue?: (copy: ControlledCopy) => void;
}

const getBadgeColor = (statusCode?: string, statusLabel?: string): BadgeColor =>
  getStatusBadgeColor(statusLabel, statusCode) ?? "slate";

export const getCachedControlledCopyChildren = (batchId: string) =>
  CONTROLLED_COPY_CHILDREN_CACHE.get(batchId) || null;

export const invalidateControlledCopyChildren = (batchId: string) => {
  if (batchId) {
    CONTROLLED_COPY_CHILDREN_CACHE.delete(batchId);
  }
};

export const preloadControlledCopyChildren = async (batchId: string) => {
  if (!batchId) {
    return [];
  }

  const cached = CONTROLLED_COPY_CHILDREN_CACHE.get(batchId);
  if (cached) {
    return cached;
  }

  const existing = CONTROLLED_COPY_CHILDREN_IN_FLIGHT.get(batchId);
  if (existing) {
    return existing;
  }

  const promise = documentApi.getControlledCopyDistributionBatchCopies(batchId, {
    page: 1,
    limit: CHILD_PAGE_SIZE,
  }).then((result) => {
    const copies = (result.data || []).map((item) => normalizeControlledCopyRecord(item));
    CONTROLLED_COPY_CHILDREN_CACHE.set(batchId, copies);
    CONTROLLED_COPY_CHILDREN_IN_FLIGHT.delete(batchId);
    return copies;
  }).catch((error) => {
    CONTROLLED_COPY_CHILDREN_IN_FLIGHT.delete(batchId);
    throw error;
  });

  CONTROLLED_COPY_CHILDREN_IN_FLIGHT.set(batchId, promise);
  return promise;
};

const ExpandedControlledCopyRow: React.FC<{
  copy: ControlledCopy;
  rowNumber: number;
  onViewDetails: (copy: ControlledCopy) => void;
  onViewAuditTrail: (copy: ControlledCopy) => void;
  onDistribute?: (copy: ControlledCopy) => void;
  onRecall?: (copy: ControlledCopy) => void;
  onCancel?: (copy: ControlledCopy) => void;
  onReportLostDamaged?: (copy: ControlledCopy) => void;
  onReissue?: (copy: ControlledCopy) => void;
}> = ({
  copy,
  rowNumber,
  onViewDetails,
  onViewAuditTrail,
  onDistribute,
  onRecall,
  onCancel,
  onReportLostDamaged,
  onReissue,
}) => {
  const { capabilities, loading } = useControlledCopyActionCapabilities(copy.id);
  const recallDecision = getControlledCopyActionDecision(capabilities, "recallCopy");
  const distributeDecision = getControlledCopyActionDecision(capabilities, "distributeCopy");
  const cancelDecision = getControlledCopyActionDecision(capabilities, "cancelRequest");
  const reportLostDamagedDecision = getControlledCopyActionDecision(capabilities, "reportLostDamaged");
  const reissueDecision = getControlledCopyActionDecision(capabilities, "replaceLostDamaged");
  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const tdClass = "py-1.5 px-2.5 text-slate-700 whitespace-nowrap border-b border-slate-100";
  const statusLabel = normalizeControlledCopyStatusLabel(copy.status, copy.statusInfo as any);

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className={cn(tdClass, "text-center text-slate-500 font-medium")}>{rowNumber}</td>
      <td
        className={cn(tdClass, "font-medium text-emerald-600 cursor-pointer hover:underline")}
        onClick={() => onViewDetails(copy)}
      >
        {formatControlledCopyNumber(copy.controlledCopyNumber)}
      </td>
      <td className={tdClass}>{formatDateTimeParts(copy.createdDate, copy.createdTime)}</td>
      <td className={tdClass}>{copy.openedBy || "-"}</td>
      <td className={cn(tdClass, "font-medium text-slate-900")}>{copy.name || "-"}</td>
      <td className={tdClass}>
        <Badge color={getBadgeColor(copy.statusCode || copy.statusInfo?.id, statusLabel)}>
          {statusLabel}
        </Badge>
      </td>
      <td className={tdClass}>{formatDateUS(copy.validUntil)}</td>
      <td className={tdClass}>{copy.expiryDate ? formatDateUS(copy.expiryDate) : "-"}</td>
      <td className={tdClass}>
        <span className="font-medium text-slate-900">{formatDocumentLabel(copy)}</span>
      </td>
      <td className={tdClass}>{getControlledCopyDistributionListText(copy) || "-"}</td>
      <td className={tdClass}>
        <span className="font-medium text-slate-900">{formatDocumentRevisionLabel(copy)}</span>
      </td>
      <td
        onClick={(e) => e.stopPropagation()}
        className="border-b border-l border-slate-200 bg-white py-3 px-4 text-center whitespace-nowrap group-hover:bg-slate-50 transition-colors"
      >
        <button
          ref={getRef(copy.id)}
          onClick={(e) => {
            e.stopPropagation();
            toggle(copy.id, e);
          }}
          className="inline-flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
          aria-label="More actions"
        >
          <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4" />
        </button>
        <ChildDropdownMenu
          isOpen={openId === copy.id}
          onClose={close}
          position={position}
          isCapabilityLoading={loading}
          recallDecision={recallDecision}
          distributeDecision={distributeDecision}
          cancelDecision={cancelDecision}
          reportLostDamagedDecision={reportLostDamagedDecision}
          reissueDecision={reissueDecision}
          onViewDetails={() => onViewDetails(copy)}
          onViewAuditTrail={() => onViewAuditTrail(copy)}
          onDistribute={onDistribute ? () => onDistribute(copy) : undefined}
          onRecall={onRecall ? () => onRecall(copy) : undefined}
          onCancel={onCancel ? () => onCancel(copy) : undefined}
          onReportLostDamaged={onReportLostDamaged ? () => onReportLostDamaged(copy) : undefined}
          onReissue={onReissue ? () => onReissue(copy) : undefined}
        />
      </td>
    </tr>
  );
};

const SkeletonRow: React.FC<{ rowNumber: number }> = ({ rowNumber }) => {
  const tdClass = "py-1.5 px-2.5 text-slate-700 whitespace-nowrap border-b border-slate-100";
  const skeletonClass = "h-3.5 rounded bg-slate-200/70 animate-pulse";
  return (
    <tr className="bg-white">
      <td className={cn(tdClass, "text-center text-slate-500 font-medium")}>{rowNumber}</td>
      <td className={tdClass}><div className={cn(skeletonClass, "w-24")} /></td>
      <td className={tdClass}><div className={cn(skeletonClass, "w-28")} /></td>
      <td className={tdClass}><div className={cn(skeletonClass, "w-20")} /></td>
      <td className={tdClass}><div className={cn(skeletonClass, "w-40")} /></td>
      <td className={tdClass}><div className={cn(skeletonClass, "w-20")} /></td>
      <td className={tdClass}><div className={cn(skeletonClass, "w-24")} /></td>
      <td className={tdClass}><div className={cn(skeletonClass, "w-24")} /></td>
      <td className={tdClass}><div className={cn(skeletonClass, "w-28")} /></td>
      <td className={tdClass}><div className={cn(skeletonClass, "w-32")} /></td>
      <td className={tdClass}><div className={cn(skeletonClass, "w-28")} /></td>
      <td className={cn(tdClass, "text-center")}><div className={cn(skeletonClass, "w-7 mx-auto")} /></td>
    </tr>
  );
};

const ChildDropdownMenu: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  position: PortalDropdownPosition;
  isCapabilityLoading?: boolean;
  recallDecision?: ReturnType<typeof getControlledCopyActionDecision> | null;
  distributeDecision?: ReturnType<typeof getControlledCopyActionDecision> | null;
  cancelDecision?: ReturnType<typeof getControlledCopyActionDecision> | null;
  reportLostDamagedDecision?: ReturnType<typeof getControlledCopyActionDecision> | null;
  reissueDecision?: ReturnType<typeof getControlledCopyActionDecision> | null;
  onViewDetails?: () => void;
  onViewAuditTrail?: () => void;
  onDistribute?: () => void;
  onRecall?: () => void;
  onCancel?: () => void;
  onReportLostDamaged?: () => void;
  onReissue?: () => void;
}> = ({
  isOpen,
  onClose,
  position,
  isCapabilityLoading = false,
  recallDecision,
  distributeDecision,
  cancelDecision,
  reportLostDamagedDecision,
  reissueDecision,
  onViewDetails,
  onViewAuditTrail,
  onDistribute,
  onRecall,
  onCancel,
  onReportLostDamaged,
  onReissue,
}) => {
  return (
    <PortalDropdownMenu isOpen={isOpen} onClose={onClose} position={position} minWidth={200}>
      <div className="py-1">
        {onViewDetails && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails();
              onClose();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
          >
            <IconInfoCircle className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">View Details</span>
          </button>
        )}
        {onViewAuditTrail && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewAuditTrail();
              onClose();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
          >
            <History className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">View Audit Trail</span>
          </button>
        )}
        {onDistribute && !isCapabilityLoading && distributeDecision?.allowed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDistribute();
              onClose();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
          >
            <IconShape3 className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">Distribute</span>
          </button>
        )}
        {onRecall && !isCapabilityLoading && recallDecision?.allowed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isCapabilityLoading) return;
              onRecall();
              onClose();
            }}
            disabled={isCapabilityLoading}
            title={isCapabilityLoading ? "Capability information is still loading." : ""}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconArrowBackUp className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">Recall</span>
          </button>
        )}
        {onCancel && !isCapabilityLoading && cancelDecision?.allowed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isCapabilityLoading) return;
              onCancel();
              onClose();
            }}
            disabled={isCapabilityLoading}
            title={isCapabilityLoading ? "Capability information is still loading." : ""}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileX className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">Cancel Request</span>
          </button>
        )}
        {onReportLostDamaged && !isCapabilityLoading && reportLostDamagedDecision?.allowed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isCapabilityLoading) return;
              onReportLostDamaged();
              onClose();
            }}
            disabled={isCapabilityLoading}
            title={isCapabilityLoading ? "Capability information is still loading." : ""}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Shredder className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">Report Lost/Damaged</span>
          </button>
        )}
        {onReissue && !isCapabilityLoading && reissueDecision?.allowed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isCapabilityLoading) return;
              onReissue();
              onClose();
            }}
            disabled={isCapabilityLoading}
            title={isCapabilityLoading ? "Capability information is still loading." : ""}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">Reissue Copy</span>
          </button>
        )}
      </div>
    </PortalDropdownMenu>
  );
};

export const ExpandControlledCopiesRow: React.FC<ExpandControlledCopiesRowProps> = ({
  source,
  isExpanded,
  visibleColumnsLength,
  onViewDetails,
  onViewAuditTrail,
  onDistribute,
  onRecall,
  onCancel,
  onReportLostDamaged,
  onReissue,
}) => {
  const { navigateTo, navigateToPrepared } = useNavigateWithLoading();
  const shouldReduceMotion = useReducedMotion();
  const transitionConfig = useMemo(
    () => (shouldReduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 90, damping: 16 }),
    [shouldReduceMotion],
  );
  const [isLoading, setIsLoading] = useState(false);
  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const batchKey = source.batchId || source.distributionBatchId || source.id;
  const expectedChildCount = Number(source.batchQuantity ?? source.copyIds?.length ?? 0);
  const [copies, setCopies] = useState<ControlledCopy[] | null>(() => getCachedControlledCopyChildren(batchKey));
  const [childPage, setChildPage] = useState(1);
  const [totalChildren, setTotalChildren] = useState(expectedChildCount);
  const totalChildPages = Math.max(1, Math.ceil(totalChildren / CHILD_PAGE_SIZE));

  useEffect(() => {
    setChildPage(1);
    setTotalChildren(expectedChildCount);
    setCopies(getCachedControlledCopyChildren(batchKey));
  }, [batchKey, expectedChildCount]);

  useEffect(() => {
    if (!isExpanded) return;
    let mounted = true;

    const cached = childPage === 1 && batchKey ? getCachedControlledCopyChildren(batchKey) : null;
    if (cached) {
      setCopies(cached);
      setIsLoading(false);
      return () => {
        mounted = false;
      };
    }

    setIsLoading(true);
    const request = childPage === 1
      ? preloadControlledCopyChildren(batchKey).then((data) => ({ data, pagination: null }))
      : documentApi.getControlledCopyDistributionBatchCopies(batchKey, {
        page: childPage,
        limit: CHILD_PAGE_SIZE,
      }).then((result) => ({
        data: (result.data || []).map((item) => normalizeControlledCopyRecord(item)),
        pagination: result.pagination,
      }));

    void request
      .then((result) => {
        if (mounted) {
          setCopies(result.data);
          if (result.pagination?.total !== undefined) {
            setTotalChildren(result.pagination.total);
          }
        }
      })
      .catch((error) => {
        console.error("Failed to load controlled copy batch items", error);
        if (mounted) {
          setCopies([]);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [batchKey, childPage, isExpanded]);

  const openDetail = (copyId: string) => {
      void navigateToPrepared(
        ROUTES.DOCUMENTS.CONTROLLED_COPIES.DETAIL(copyId),
        async () => ({
          ...buildControlledCopySnapshotState(await documentApi.getControlledCopyDetailSnapshotById(copyId)),
        }),
    ).catch((error) => {
      console.error("Failed to preload controlled copy detail", error);
      navigateTo(ROUTES.DOCUMENTS.CONTROLLED_COPIES.DETAIL(copyId));
    });
  };

  const handleViewDetails = (copy: ControlledCopy) => {
    if (onViewDetails) {
      onViewDetails(copy);
      return;
    }
    openDetail(copy.id);
  };

  const handleViewAuditTrail = (copy: ControlledCopy) => {
    if (onViewAuditTrail) {
      onViewAuditTrail(copy);
      return;
    }
      void navigateToPrepared(
        `${ROUTES.DOCUMENTS.CONTROLLED_COPIES.DETAIL(copy.id)}?tab=audit`,
        async () => ({
          ...buildControlledCopySnapshotState(await documentApi.getControlledCopyDetailSnapshotById(copy.id)),
        }),
    ).catch((error) => {
      console.error("Failed to preload controlled copy audit detail", error);
      navigateTo(`${ROUTES.DOCUMENTS.CONTROLLED_COPIES.DETAIL(copy.id)}?tab=audit`);
    });
  };

  const handleRecall = (copy: ControlledCopy) => {
    if (onRecall) {
      onRecall(copy);
      return;
    }
    openDetail(copy.id);
  };

  const handleCancel = (copy: ControlledCopy) => {
    if (onCancel) {
      onCancel(copy);
      return;
    }
    openDetail(copy.id);
  };

  const handleReportLostDamaged = (copy: ControlledCopy) => {
    if (onReportLostDamaged) {
      onReportLostDamaged(copy);
      return;
    }
    openDetail(copy.id);
  };

  const handleReissue = (copy: ControlledCopy) => {
    if (onReissue) {
      onReissue(copy);
      return;
    }
    openDetail(copy.id);
  };

  return (
    <AnimatePresence initial={false}>
      {isExpanded && (
        <motion.tr
          key={`expanded-controlled-copies-${source.id}`}
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
                  {(isLoading || !copies) && totalChildren > 0 && (
                    <div className="w-full">
                      <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Controlled Copies ({totalChildren})
                      </p>
                      <div className="rounded-lg border border-slate-200 overflow-hidden inline-block max-w-full">
                        <table className="text-xs table-auto w-auto">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200">
                              <th className="py-1.5 px-2.5 text-center text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap w-10">No.</th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Controlled Copy Number</th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Created</th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Opened by</th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Controlled Copy Name</th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Status</th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Valid Until</th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Expiry Date</th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Document</th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Distribution List</th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Document Revision</th>
                              <th className="py-1.5 px-2.5 text-center text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap w-14 border-l border-slate-200 bg-slate-100">
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {Array.from({ length: Math.min(CHILD_PAGE_SIZE, Math.max(0, totalChildren - ((childPage - 1) * CHILD_PAGE_SIZE))) }).map((_, idx) => (
                              <SkeletonRow key={`controlled-copy-skeleton-${idx}`} rowNumber={((childPage - 1) * CHILD_PAGE_SIZE) + idx + 1} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {!isLoading && copies && copies.length > 0 && (
                    <div className="w-full">
                      <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Controlled Copies ({totalChildren || copies.length})
                      </p>
                      <div className="rounded-lg border border-slate-200 overflow-hidden inline-block max-w-full">
                        <table className="text-xs table-auto w-auto">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200">
                              <th className="py-1.5 px-2.5 text-center text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap w-10">No.</th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Controlled Copy Number</th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Created</th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Opened by</th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Controlled Copy Name</th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Status</th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Valid Until</th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Expiry Date</th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Document</th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Distribution List</th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Document Revision</th>
                              <th className="py-1.5 px-2.5 text-center text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap w-14 border-l border-slate-200 bg-slate-100">
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {copies.map((copy, idx) => (
                              <ExpandedControlledCopyRow
                                key={copy.id}
                                copy={copy}
                                rowNumber={((childPage - 1) * CHILD_PAGE_SIZE) + idx + 1}
                                onViewDetails={handleViewDetails}
                                onViewAuditTrail={handleViewAuditTrail}
                                onDistribute={onDistribute}
                                onRecall={onRecall}
                                onCancel={onCancel}
                                onReportLostDamaged={onReportLostDamaged}
                                onReissue={onReissue}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {totalChildPages > 1 && (
                        <div className="mt-3 flex items-center justify-end gap-3 text-2xs text-slate-600">
                          <span>
                            {((childPage - 1) * CHILD_PAGE_SIZE) + 1}-{Math.min(childPage * CHILD_PAGE_SIZE, totalChildren)} of {totalChildren}
                          </span>
                          <button
                            type="button"
                            onClick={() => setChildPage((page) => Math.max(1, page - 1))}
                            disabled={childPage <= 1 || isLoading}
                            className="rounded border border-slate-200 px-2 py-1 font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Previous
                          </button>
                          <button
                            type="button"
                            onClick={() => setChildPage((page) => Math.min(totalChildPages, page + 1))}
                            disabled={childPage >= totalChildPages || isLoading}
                            className="rounded border border-slate-200 px-2 py-1 font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {!isLoading && copies && copies.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-xs text-slate-500">
                      No controlled copies found in this batch.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </td>
        </motion.tr>
      )}
    </AnimatePresence>
  );
};
