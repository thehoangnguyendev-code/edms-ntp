import React, { useState, createRef, useRef, useEffect, useMemo } from "react";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ROUTES } from '@/app/routes.constants';
import {
    Download,
    ChevronUp,
    ChevronDown,
    Search,
    Check,
    X,
    MoreVertical,
    FileX,
    Link2,
    RotateCcw,
    ArrowDownAZ,
    ArrowDownZA,
    History,
    RefreshCw,
} from "lucide-react";
import { IconHandClick } from '@tabler/icons-react';
import { Button } from "@/components/ui/button/Button";
import { cn } from "@/components/ui/utils";
import { Select } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { formatDateUS, formatDateTimeParts } from "@/utils/format";
import { useToast } from "@/components/ui/toast/Toast";
import type { ControlledCopy, TableColumn } from "./types";
import {IconArrowBackUp, IconFilter2, IconInfoCircle, IconShare3, IconShredder} from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { controlledCopies } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { EmptyState } from "@/components/ui/page/EmptyState";
import { usePortalDropdown, useNavigateWithLoading, useTableDragScroll, PortalDropdownPosition, useDebounce } from "@/hooks";
import { documentApi } from "@/services/api/documents";
import { buildControlledCopySnapshotState } from "@/features/documents/shared/detailSnapshotHelpers";
import { buildControlledCopyRouteState } from "./controlledCopyNavigation";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import {
  formatControlledCopyNumber,
  formatDocumentLabel,
  formatDocumentRevisionLabel,
} from "./display";
import { getControlledCopyDistributionListText } from "./distributionDisplay";
import {
  getControlledCopyActionTargetId,
  isControlledCopyBatchRow,
} from "./controlledCopyActions";
import {
  getControlledCopyActionDecision,
  getControlledCopyActionDeniedReason,
  type ControlledCopyActionDecision,
} from "./controlledCopyCapabilities";
import { normalizeControlledCopyBatch } from "./controlledCopyMapping";
import { Badge, BadgeColor } from "@/components/ui/badge/Badge";
import type { ControlledCopyDistributionBatch, CurrentStage } from "./types";
import {
  ExpandControlledCopiesRow,
  getCachedControlledCopyChildren,
  invalidateControlledCopyChildren,
} from "./components/ExpandControlledCopiesRow";
import { DistributeBatchProgressModal } from "./components/DistributeBatchProgressModal";
import { DistributeBatchResultModal, type DistributeBatchFailedItem } from "./components/DistributeBatchResultModal";
import { subscribeNotificationRealtime } from "@/features/notifications/notificationRealtime";
import { startControlledCopyJobStatusPolling } from "./jobStatusPolling";
import { ChevronRight } from "lucide-react";
import { getStatusBadgeColor } from "@/utils/status";
import { normalizeControlledCopyStatusLabel } from "./status";
import { DestructionTypeSelectionModal } from "./components/DestructionTypeSelectionModal";
import { RecallControlledCopyModal, type RecallControlledCopyValues } from "./components/RecallControlledCopyModal";
import {
  useControlledCopyActionCapabilities,
  useControlledCopyBatchActionCapabilities,
} from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";

// Default Columns Configuration
const DEFAULT_COLUMNS: TableColumn[] = [
  { id: "controlledCopyNumber", label: "Controlled Copy / Batch Number", visible: true, order: 1, locked: true },
  { id: "created", label: "Created", visible: true, order: 2 },
  { id: "openedBy", label: "Opened by", visible: true, order: 3 },
  { id: "name", label: "Controlled Copy Name", visible: true, order: 4 },
  { id: "quantity", label: "Quantity", visible: true, order: 5 },
  { id: "status", label: "Status", visible: true, order: 6 },
  { id: "validUntil", label: "Valid Until", visible: true, order: 7 },
  { id: "expiryDate", label: "Expiry Date", visible: true, order: 8 },
  { id: "document", label: "Document", visible: true, order: 9 },
  { id: "distributionList", label: "Distribution List", visible: true, order: 10 },
  { id: "recallDate", label: "Recall Date", visible: true, order: 11 },
  { id: "recallReason", label: "Reason for Recall", visible: true, order: 12 },
  { id: "documentRevision", label: "Document Revision", visible: true, order: 13 },
];

// View types
type ViewType = "all" | "ready" | "distributed";

type ControlledCopyRow = ControlledCopy & {
  batchId?: string;
  batchNumber?: string;
  batchStatus?: string;
  batchStatusCode?: string;
  batchQuantity?: number;
  primaryControlledCopyId?: string;
  requestedAt?: string;
  requestedBy?: string;
  distributedAt?: string;
  distributedBy?: string;
  copyIds?: string[];
  distributionBatchId?: string;
  distributionBatchNumber?: string;
};

const CONTROLLED_COPY_TABS: TabItem[] = [
  { id: "all", label: "All Controlled Copies" },
  { id: "ready", label: "Ready for Distribution" },
  { id: "distributed", label: "Distributed Copies" },
];

const mapBatchToRow = (batch: ControlledCopyDistributionBatch): ControlledCopyRow => {
  const mapped = normalizeControlledCopyBatch(batch) as ControlledCopyRow;
  return {
    ...mapped,
    currentStage: mapped.currentStage as ControlledCopyRow["currentStage"],
    batchId: batch.id,
    batchNumber: batch.batchNumber,
    batchStatus: batch.status,
    batchStatusCode: batch.statusCode,
    batchQuantity: batch.quantity,
    primaryControlledCopyId: batch.primaryControlledCopyId || batch.copyIds?.[0],
    documentId: batch.documentId || mapped.documentId,
    sourceRevisionId: batch.sourceRevisionId || mapped.sourceRevisionId,
    copyIds: batch.copyIds || [],
  };
};

const mapRecordToRow = (copy: ControlledCopy): ControlledCopyRow => ({
  ...copy,
  batchId: copy.distributionBatchId || undefined,
  batchNumber: copy.distributionBatchNumber || undefined,
});

const getControlledCopiesRoute = (viewType: ViewType) => {
  switch (viewType) {
    case "ready":
      return ROUTES.DOCUMENTS.CONTROLLED_COPIES.READY;
    case "distributed":
      return ROUTES.DOCUMENTS.CONTROLLED_COPIES.DISTRIBUTED;
    case "all":
    default:
      return ROUTES.DOCUMENTS.CONTROLLED_COPIES.ALL;
  }
};

const isBatchRow = (copy: ControlledCopyRow) => isControlledCopyBatchRow(copy);

const getDetailId = (copy: ControlledCopyRow) => {
  if (!copy) {
    return "";
  }

  return getControlledCopyActionTargetId(copy) || copy.primaryControlledCopyId || "";
};

const getAuditTargetId = (copy: ControlledCopyRow) => {
  if (!copy) {
    return "";
  }

  return getControlledCopyActionTargetId(copy) || copy.primaryControlledCopyId || "";
};

// ==================== HELPER FUNCTIONS ====================

const getBadgeColor = (statusCode?: string, statusLabel?: string): BadgeColor =>
  getStatusBadgeColor(statusLabel, statusCode) ?? "slate";

// ==================== DROPDOWN MENU COMPONENT ====================

const DropdownMenu: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  position: PortalDropdownPosition;
  isBatch?: boolean;
  isCapabilityLoading?: boolean;
  cancelDecision?: ControlledCopyActionDecision | null;
  distributeDecision?: ControlledCopyActionDecision | null;
  recallDecision?: ControlledCopyActionDecision | null;
  reportLostDamagedDecision?: ControlledCopyActionDecision | null;
  reissueDecision?: ControlledCopyActionDecision | null;
  onViewDetails?: () => void;
  onCancel?: () => void;
  onDistribute?: () => void;
  onRecall?: () => void;
  onReportLostDamaged?: () => void;
  onReissue?: () => void;
  onViewAuditTrail?: () => void;
  viewType: ViewType;
}> = ({
  isOpen,
  onClose,
  position,
  isBatch = false,
  isCapabilityLoading = false,
  cancelDecision,
  distributeDecision,
  recallDecision,
  reportLostDamagedDecision,
  reissueDecision,
  onViewDetails,
  onCancel,
  onDistribute,
  onRecall,
  onReportLostDamaged,
  onReissue,
  onViewAuditTrail,
  viewType,
}) => {
    return (
      <PortalDropdownMenu isOpen={isOpen} onClose={onClose} position={position} minWidth={200}>
        <div className="py-1">
          {onViewDetails && (
            <DropdownMenuItem icon={<IconInfoCircle className="h-4 w-4" />} onClick={() => { onViewDetails!(); onClose(); }}>
              View Details
            </DropdownMenuItem>
          )}
          {onViewAuditTrail && (
            <DropdownMenuItem icon={<History className="h-4 w-4" />} onClick={() => { onViewAuditTrail!(); onClose(); }}>
              View Audit Trail
            </DropdownMenuItem>
          )}
          {onDistribute && !isCapabilityLoading && distributeDecision?.allowed && (
            <DropdownMenuItem
              icon={<IconShare3 className="h-4 w-4" />}
              disabled={isCapabilityLoading}
              title={isCapabilityLoading ? "Capability information is still loading." : ""}
              onClick={() => { onDistribute!(); onClose(); }}
            >
              {isBatch ? "Distribute Batch" : "Distribute"}
            </DropdownMenuItem>
          )}
          {onRecall && !isCapabilityLoading && recallDecision?.allowed && (
            <DropdownMenuItem
              icon={<IconArrowBackUp className="h-4 w-4" />}
              disabled={isCapabilityLoading}
              title={isCapabilityLoading ? "Capability information is still loading." : ""}
              onClick={() => { onRecall!(); onClose(); }}
            >
              {isBatch ? "Recall Batch Immediately" : "Recall Immediately"}
            </DropdownMenuItem>
          )}
          {!isBatch && onReportLostDamaged && !isCapabilityLoading && reportLostDamagedDecision?.allowed && (
            <DropdownMenuItem
              icon={<IconShredder className="h-4 w-4" />}
              onClick={() => { onReportLostDamaged!(); onClose(); }}
            >
              Report Lost/Damaged
            </DropdownMenuItem>
          )}
          {!isBatch && onReissue && !isCapabilityLoading && reissueDecision?.allowed && (
            <DropdownMenuItem
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={() => { onReissue!(); onClose(); }}
            >
              Reissue Copy
            </DropdownMenuItem>
          )}
          {(viewType === "ready" || viewType === "all") && onCancel && !isCapabilityLoading && cancelDecision?.allowed && (
            <DropdownMenuItem
              icon={<FileX className="h-4 w-4" />}
              disabled={isCapabilityLoading}
              title={isCapabilityLoading ? "Capability information is still loading." : ""}
              onClick={() => { onCancel!(); onClose(); }}
            >
              {isBatch ? "Cancel Batch Distribution" : "Cancel Request"}
            </DropdownMenuItem>
          )}
        </div>
      </PortalDropdownMenu>
    );
  };

// ==================== MAIN COMPONENT ====================

interface ControlledCopiesViewProps {
  viewType?: ViewType;
}

export const ControlledCopiesView: React.FC<ControlledCopiesViewProps> = ({ viewType: propViewType = "all" }) => {
  const { navigateTo, navigateToPrepared, isNavigating } = useNavigateWithLoading();
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canReviewBatchDiscrepancies = hasPermissionAlias('documents.admin.view');

  // Use prop viewType instead of URL params
  const viewType = propViewType;

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [statusOptions, setStatusOptions] = useState<Array<{ label: string; value: string }>>([{ label: "All States", value: "All" }]);
  const [createdFromDate, setCreatedFromDate] = useState("");
  const [createdToDate, setCreatedToDate] = useState("");
  const [validFromDate, setValidFromDate] = useState("");
  const [validToDate, setValidToDate] = useState("");
  const [expiryFromDate, setExpiryFromDate] = useState("");
  const [expiryToDate, setExpiryToDate] = useState("");
  const [recallFromDate, setRecallFromDate] = useState("");
  const [recallToDate, setRecallToDate] = useState("");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["status", "dates"]));

  const [isLoading, setIsLoading] = useState(true);
  const [controlledCopiesData, setControlledCopiesData] = useState<ControlledCopyRow[]>([]);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "created",
    direction: "desc",
  });
  const [error, setError] = useState<string | null>(null);
  const [isReportLostDamagedModalOpen, setIsReportLostDamagedModalOpen] = useState(false);
  const [selectedCopyForReportLostDamaged, setSelectedCopyForReportLostDamaged] = useState<ControlledCopyRow | null>(null);
  const [isReissueModalOpen, setIsReissueModalOpen] = useState(false);
  const [selectedCopyForReissue, setSelectedCopyForReissue] = useState<ControlledCopyRow | null>(null);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    let mounted = true;

    const fetchFilters = async () => {
      try {
        const filters = await documentApi.getControlledCopyFilters();
        if (!mounted) return;
        const options = [
          { label: "All States", value: "All" },
          ...(filters.statuses || []).map((status) => ({
            label: normalizeControlledCopyStatusLabel(status?.label || status?.name || status?.code || ""),
            value: status?.value || status?.code || status?.label || status?.name || "Unknown",
          })),
        ];
        setStatusOptions(options.length > 1 ? options : [{ label: "All States", value: "All" }]);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("Failed to fetch controlled copy filters", err);
        }
        if (mounted) {
          setStatusOptions([{ label: "All States", value: "All" }]);
        }
      }
    };

    void fetchFilters();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (viewType !== "ready") {
      setExpandedBatchId(null);
    }
    const fetchCopies = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await documentApi.getControlledCopyDistributionBatches({
          page: currentPage,
          limit: itemsPerPage,
          search: debouncedSearchQuery || undefined,
          status: viewType === "all"
            ? (statusFilter !== "All" ? statusFilter : undefined)
            : viewType === "ready"
              ? "READY_FOR_DISTRIBUTION"
              : "DISTRIBUTED",
          createdFrom: createdFromDate ? convertDate(createdFromDate) : undefined,
          createdTo: createdToDate ? convertDate(createdToDate) : undefined,
          validFrom: validFromDate ? convertDate(validFromDate) : undefined,
          validTo: validToDate ? convertDate(validToDate) : undefined,
          expiryFrom: expiryFromDate ? convertDate(expiryFromDate) : undefined,
          expiryTo: expiryToDate ? convertDate(expiryToDate) : undefined,
          recallFrom: recallFromDate ? convertDate(recallFromDate) : undefined,
          recallTo: recallToDate ? convertDate(recallToDate) : undefined,
          sortBy: sortConfig.key,
          sortDirection: sortConfig.direction,
        });
        if (!mounted) return;
        const rows = (res?.data || []).map((item: ControlledCopyDistributionBatch) => mapBatchToRow(item));
        setControlledCopiesData(rows);
        setTotalItems(res?.pagination?.total ?? rows.length);
      } catch (err: any) {
        console.error("Failed to fetch controlled copies", err);
        if (mounted) {
          setError(err?.message || "Failed to load controlled copies");
          showToast({
            type: "error",
            title: "Error",
            message: "Failed to load controlled copies",
          });
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    const convertDate = (dateStr: string) => {
      if (!dateStr) return "";
      const parts = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (parts) {
        return `${parts[3]}-${parts[2]}-${parts[1]}`;
      }
      return dateStr;
    };
    void fetchCopies();
    return () => {
      mounted = false;
    };
  }, [currentPage, itemsPerPage, debouncedSearchQuery, statusFilter, createdFromDate, createdToDate, validFromDate, validToDate, expiryFromDate, expiryToDate, recallFromDate, recallToDate, sortConfig.key, sortConfig.direction, viewType, showToast, refreshToken]);

  // Modal states
  const [selectedCopyForCancel, setSelectedCopyForCancel] = useState<ControlledCopyRow | null>(null);
  const [isESignModalOpen, setisESignModalOpen] = useState(false);
  const [isDistributeisESignModalOpen, setisDistributeisESignModalOpen] = useState(false);
  const [selectedCopyForDistribute, setSelectedCopyForDistribute] = useState<ControlledCopyRow | null>(null);
  const [isRecallFormOpen, setIsRecallFormOpen] = useState(false);
  const [isRecallESignModalOpen, setIsRecallESignModalOpen] = useState(false);
  const [selectedCopyForRecall, setSelectedCopyForRecall] = useState<ControlledCopyRow | null>(null);
  const [recallValues, setRecallValues] = useState<RecallControlledCopyValues | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [batchDistributeProgress, setBatchDistributeProgress] = useState<{
    batchId: string;
    scope: "batch" | "copy";
    processed: number;
    total: number;
    failed: number;
    status: "in_progress" | "completed" | "completed_with_errors";
  } | null>(null);
  const [distributeResultModal, setDistributeResultModal] = useState<{
    batchId: string;
    total: number;
    succeeded: number;
    failed: number;
    failedItems: DistributeBatchFailedItem[];
    isRetrying: boolean;
  } | null>(null);
  const [batchRecallProgress, setBatchRecallProgress] = useState<{
    batchId: string;
    processed: number;
    total: number;
    failed: number;
    status: "in_progress" | "completed" | "completed_with_errors";
  } | null>(null);
  const [recallResultModal, setRecallResultModal] = useState<{
    batchId: string;
    total: number;
    succeeded: number;
    failed: number;
    failedItems: DistributeBatchFailedItem[];
    isRetrying: boolean;
  } | null>(null);
  const [batchCancelProgress, setBatchCancelProgress] = useState<{
    batchId: string;
    processed: number;
    total: number;
    failed: number;
    status: "in_progress" | "completed" | "completed_with_errors";
  } | null>(null);
  const [cancelResultModal, setCancelResultModal] = useState<{
    batchId: string;
    total: number;
    succeeded: number;
    failed: number;
    failedItems: DistributeBatchFailedItem[];
    isRetrying: boolean;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeNotificationRealtime((event) => {
      if (event.type !== "controlled-copy-batch-progress") return;
      let payload: { batchId?: string; processed?: number; total?: number; failed?: number; status?: string } | null = null;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!payload?.batchId) return;
      setBatchDistributeProgress((prev) => {
        if (!prev || prev.scope !== "batch" || prev.batchId !== payload!.batchId) return prev;
        return {
          ...prev,
          processed: payload!.processed ?? prev.processed,
          total: payload!.total ?? prev.total,
          failed: payload!.failed ?? prev.failed,
          status: payload!.status === "completed_with_errors"
            ? "completed_with_errors"
            : payload!.status === "completed" ? "completed" : "in_progress",
        };
      });
      setBatchRecallProgress((prev) => {
        if (!prev || prev.batchId !== payload!.batchId) return prev;
        return {
          ...prev,
          processed: payload!.processed ?? prev.processed,
          total: payload!.total ?? prev.total,
          failed: payload!.failed ?? prev.failed,
          status: payload!.status === "completed_with_errors"
            ? "completed_with_errors"
            : payload!.status === "completed" ? "completed" : "in_progress",
        };
      });
      setBatchCancelProgress((prev) => {
        if (!prev || prev.batchId !== payload!.batchId) return prev;
        return {
          ...prev,
          processed: payload!.processed ?? prev.processed,
          total: payload!.total ?? prev.total,
          failed: payload!.failed ?? prev.failed,
          status: payload!.status === "completed_with_errors"
            ? "completed_with_errors"
            : payload!.status === "completed" ? "completed" : "in_progress",
        };
      });
    });
    return unsubscribe;
  }, []);

  // Polling fallback for Recall Batch progress — same rationale as the Distribute polling
  // effect below (SSE delivery is fire-and-forget with no replay/buffering).
  useEffect(() => {
    if (!batchRecallProgress || batchRecallProgress.status !== "in_progress") {
      return;
    }
    const batchId = batchRecallProgress.batchId;
    return startControlledCopyJobStatusPolling({
      batchId,
      action: "RECALL",
      fetchStatus: documentApi.getControlledCopyDistributionJobStatus,
      onStatus: (status) => setBatchRecallProgress((prev) => {
        if (!prev || prev.batchId !== batchId) return prev;
        return { ...prev, processed: status.processed, total: status.total, failed: status.failed, status: status.status };
      }),
    });
  }, [batchRecallProgress?.batchId, batchRecallProgress?.status]);

  useEffect(() => {
    if (batchRecallProgress?.status !== "completed" && batchRecallProgress?.status !== "completed_with_errors") return;
    const batchId = batchRecallProgress.batchId;
    const timer = window.setTimeout(() => {
      setBatchRecallProgress(null);
      setRefreshToken(Date.now());
      void refreshSelectedCapabilities();
      void (async () => {
        try {
          const status = await documentApi.getControlledCopyDistributionJobStatus(batchId, "RECALL");
          const failedItems = status.failed > 0
            ? await documentApi.getControlledCopyDistributionFailedItems(batchId, "RECALL")
            : [];
          setRecallResultModal({
            batchId,
            total: status.total,
            succeeded: Math.max(status.total - status.failed, 0),
            failed: status.failed,
            failedItems,
            isRetrying: false,
          });
        } catch (error) {
          console.error("Failed to load recall result", error);
          showToast({
            type: "success",
            title: "Controlled Copy Recalled",
            message: "The recall batch has finished processing.",
            duration: 4000,
          });
        }
      })();
    }, batchRecallProgress.status === "completed_with_errors" ? 1800 : 600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchRecallProgress?.status]);

  const handleRetryAllFailedRecall = async () => {
    if (!recallResultModal || recallResultModal.failed === 0) return;
    const batchId = recallResultModal.batchId;
    const failedCount = recallResultModal.failed;
    setRecallResultModal((prev) => (prev ? { ...prev, isRetrying: true } : prev));
    try {
      await documentApi.retryFailedControlledCopyDistribution(batchId, "RECALL");
      setRecallResultModal(null);
      setBatchRecallProgress({
        batchId,
        processed: 0,
        total: failedCount,
        failed: 0,
        status: "in_progress",
      });
    } catch (error) {
      console.error("Failed to retry failed controlled copy recall", error);
      setRecallResultModal((prev) => (prev ? { ...prev, isRetrying: false } : prev));
      showToast({
        type: "error",
        title: "Retry failed",
        message: (error as any)?.response?.data?.error?.message
          ?? (error as any)?.response?.data?.message
          ?? "Unable to retry the failed controlled copy recalls.",
        duration: 4000,
      });
    }
  };

  // Polling fallback for Cancel Batch progress — same rationale as the Recall/Distribute
  // polling effects (SSE delivery is fire-and-forget with no replay/buffering).
  useEffect(() => {
    if (!batchCancelProgress || batchCancelProgress.status !== "in_progress") {
      return;
    }
    const batchId = batchCancelProgress.batchId;
    return startControlledCopyJobStatusPolling({
      batchId,
      action: "CANCEL",
      fetchStatus: documentApi.getControlledCopyDistributionJobStatus,
      onStatus: (status) => setBatchCancelProgress((prev) => {
        if (!prev || prev.batchId !== batchId) return prev;
        return { ...prev, processed: status.processed, total: status.total, failed: status.failed, status: status.status };
      }),
    });
  }, [batchCancelProgress?.batchId, batchCancelProgress?.status]);

  useEffect(() => {
    if (batchCancelProgress?.status !== "completed" && batchCancelProgress?.status !== "completed_with_errors") return;
    const batchId = batchCancelProgress.batchId;
    const timer = window.setTimeout(() => {
      setBatchCancelProgress(null);
      setRefreshToken(Date.now());
      void refreshSelectedCapabilities();
      void (async () => {
        try {
          const status = await documentApi.getControlledCopyDistributionJobStatus(batchId, "CANCEL");
          const failedItems = status.failed > 0
            ? await documentApi.getControlledCopyDistributionFailedItems(batchId, "CANCEL")
            : [];
          setCancelResultModal({
            batchId,
            total: status.total,
            succeeded: Math.max(status.total - status.failed, 0),
            failed: status.failed,
            failedItems,
            isRetrying: false,
          });
        } catch (error) {
          console.error("Failed to load cancel result", error);
          showToast({
            type: "success",
            title: "Controlled Copy Cancelled",
            message: "The cancel batch has finished processing.",
            duration: 4000,
          });
        }
      })();
    }, batchCancelProgress.status === "completed_with_errors" ? 1800 : 600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchCancelProgress?.status]);

  const handleRetryAllFailedCancel = async () => {
    if (!cancelResultModal || cancelResultModal.failed === 0) return;
    const batchId = cancelResultModal.batchId;
    const failedCount = cancelResultModal.failed;
    setCancelResultModal((prev) => (prev ? { ...prev, isRetrying: true } : prev));
    try {
      await documentApi.retryFailedControlledCopyDistribution(batchId, "CANCEL");
      setCancelResultModal(null);
      setBatchCancelProgress({
        batchId,
        processed: 0,
        total: failedCount,
        failed: 0,
        status: "in_progress",
      });
    } catch (error) {
      console.error("Failed to retry failed controlled copy cancel", error);
      setCancelResultModal((prev) => (prev ? { ...prev, isRetrying: false } : prev));
      showToast({
        type: "error",
        title: "Retry failed",
        message: (error as any)?.response?.data?.error?.message
          ?? (error as any)?.response?.data?.message
          ?? "Unable to retry the failed controlled copy cancellations.",
        duration: 4000,
      });
    }
  };

  // Polling fallback: the SSE push above is fire-and-forget with no buffering/replay. If the
  // client's SSE connection is momentarily down or reconnecting when the backend publishes a
  // progress event, that event is lost forever and this modal would otherwise hang indefinitely
  // even though the backend already finished (and, for distribute, already emailed the
  // recipient). Poll the durable job-status endpoint as a backup while a batch is in progress.
  useEffect(() => {
    if (!batchDistributeProgress || batchDistributeProgress.scope !== "batch" || batchDistributeProgress.status !== "in_progress") {
      return;
    }
    const batchId = batchDistributeProgress.batchId;
    return startControlledCopyJobStatusPolling({
      batchId,
      action: "DISTRIBUTE",
      fetchStatus: documentApi.getControlledCopyDistributionJobStatus,
      onStatus: (status) => setBatchDistributeProgress((prev) => {
        if (!prev || prev.scope !== "batch" || prev.batchId !== batchId) return prev;
        return { ...prev, processed: status.processed, total: status.total, failed: status.failed, status: status.status };
      }),
    });
  }, [batchDistributeProgress?.batchId, batchDistributeProgress?.scope, batchDistributeProgress?.status]);

  useEffect(() => {
    if (batchDistributeProgress?.status !== "completed" && batchDistributeProgress?.status !== "completed_with_errors") return;
    // Computed here (not inside the setTimeout callback) — it's needed both by the callback
    // body AND by setTimeout's own delay argument below, which is evaluated in this outer
    // scope. Declaring it inside the callback made it a ReferenceError at the delay argument
    // every time a distribution completed, which crashed this effect before it could ever
    // clear batchDistributeProgress — leaving the progress modal stuck indefinitely even though
    // the backend had already finished.
    const hasErrors = batchDistributeProgress.status === "completed_with_errors";
    const scope = batchDistributeProgress.scope;
    const batchId = batchDistributeProgress.batchId;
    const timer = window.setTimeout(() => {
      if (scope === "batch") {
        invalidateControlledCopyChildren(batchId);
      }
      setBatchDistributeProgress(null);
      setRefreshToken(Date.now());
      void refreshSelectedCapabilities();

      if (scope === "batch") {
        // Fetch authoritative aggregate counts from the job (rather than trusting the
        // in-memory processed/total, which for a retry only reflects the retried subset)
        // and, if there are failures, the specific copies so the user can retry them.
        void (async () => {
          try {
            const status = await documentApi.getControlledCopyDistributionJobStatus(batchId);
            const failedItems = status.failed > 0
              ? await documentApi.getControlledCopyDistributionFailedItems(batchId)
              : [];
            setDistributeResultModal({
              batchId,
              total: status.total,
              succeeded: Math.max(status.total - status.failed, 0),
              failed: status.failed,
              failedItems,
              isRetrying: false,
            });
          } catch (error) {
            console.error("Failed to load distribution result", error);
            showToast({
              type: hasErrors ? "error" : "success",
              title: hasErrors ? "Distribution completed with errors" : "Controlled Copy Distributed",
              message: "The distribution batch has finished processing.",
              duration: 4000,
            });
          }
        })();
        return;
      }

      showToast({
        type: "success",
        title: "Controlled Copy Distributed",
        message: "The controlled copy has been successfully distributed and sent to its recipient.",
        duration: 3500,
      });
    }, hasErrors ? 1800 : 600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchDistributeProgress?.status]);

  const handleRetryAllFailedDistribution = async () => {
    if (!distributeResultModal || distributeResultModal.failed === 0) return;
    const batchId = distributeResultModal.batchId;
    const failedCount = distributeResultModal.failed;
    setDistributeResultModal((prev) => (prev ? { ...prev, isRetrying: true } : prev));
    try {
      await documentApi.retryFailedControlledCopyDistribution(batchId);
      // Hand off to the progress modal for the retry itself; a fresh result modal reopens
      // once it completes (see the completion effect above), so only one modal shows at a time.
      setDistributeResultModal(null);
      setBatchDistributeProgress({
        batchId,
        scope: "batch",
        processed: 0,
        total: failedCount,
        failed: 0,
        status: "in_progress",
      });
    } catch (error) {
      console.error("Failed to retry failed controlled copy distribution", error);
      setDistributeResultModal((prev) => (prev ? { ...prev, isRetrying: false } : prev));
      showToast({
        type: "error",
        title: "Retry failed",
        message: (error as any)?.response?.data?.error?.message
          ?? (error as any)?.response?.data?.message
          ?? "Unable to retry the failed controlled copies.",
        duration: 4000,
      });
    }
  };

  const applyControlledCopyUpdate = (updatedCopy: ControlledCopyRow) => {
    setControlledCopiesData((prev) =>
      prev.map((copy) => (copy.id === updatedCopy.id ? { ...copy, ...updatedCopy } : copy)),
    );
  };

  const handleViewTypeChange = (nextViewType: string) => {
    if (nextViewType === viewType) {
      return;
    }
    const targetRoute = getControlledCopiesRoute(nextViewType as ViewType);
    navigateTo(targetRoute, { replace: true });
  };

  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const selectedCopy = useMemo(
    () => (openId ? controlledCopiesData.find((copy) => copy.id === openId) || null : null),
    [controlledCopiesData, openId],
  );
  const selectedIsBatch = Boolean(selectedCopy && isControlledCopyBatchRow(selectedCopy));
  // A singleton distribution is represented by a batch row in the list, but its
  // actions belong to the child controlled-copy record.  Always resolve the
  // capability target rather than querying the batch id for that row.
  const selectedCopyCapabilityId = selectedCopy && !selectedIsBatch
    ? getControlledCopyActionTargetId(selectedCopy)
    : null;
  const {
    capabilities: selectedCopyCapabilities,
    loading: isSelectedCopyCapabilityLoading,
    refresh: refreshSelectedCopyCapabilities,
  } = useControlledCopyActionCapabilities(selectedCopyCapabilityId);
  const {
    capabilities: selectedBatchCapabilities,
    loading: isSelectedBatchCapabilityLoading,
    refresh: refreshSelectedBatchCapabilities,
  } = useControlledCopyBatchActionCapabilities(selectedCopy && selectedIsBatch ? (selectedCopy.batchId || selectedCopy.distributionBatchId || selectedCopy.id) : null);
  const selectedCapabilities = selectedIsBatch ? selectedBatchCapabilities : selectedCopyCapabilities;
  const isCapabilityLoading = selectedIsBatch ? isSelectedBatchCapabilityLoading : isSelectedCopyCapabilityLoading;
  const selectedCancelDecision = getControlledCopyActionDecision(
    selectedCapabilities,
    selectedIsBatch ? "cancelBatch" : "cancelRequest",
  );
  const selectedDistributeDecision = getControlledCopyActionDecision(
    selectedCapabilities,
    selectedIsBatch ? "distributeBatch" : "distributeCopy",
  );
  const selectedRecallDecision = getControlledCopyActionDecision(
    selectedCapabilities,
    selectedIsBatch ? "recallBatch" : "recallCopy",
  );
  const selectedReportLostDamagedDecision = getControlledCopyActionDecision(
    selectedCapabilities,
    "reportLostDamaged",
  );
  const selectedReissueDecision = getControlledCopyActionDecision(
    selectedCapabilities,
    "replaceLostDamaged",
  );
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setCreatedFromDate("");
    setCreatedToDate("");
    setValidFromDate("");
    setValidToDate("");
    setExpiryFromDate("");
    setExpiryToDate("");
    setRecallFromDate("");
    setRecallToDate("");
    setCurrentPage(1);
  };

  const getOptionClassName = (isActive: boolean) =>
    cn(
      "flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all text-left w-full",
      isActive
        ? "bg-white border-emerald-500 text-emerald-700 font-semibold shadow-sm shadow-emerald-100/50"
        : "bg-white border-slate-200 text-slate-500 font-medium hover:border-slate-200"
    );

  const hasActiveFilters =
    !!searchQuery ||
    (viewType === "all" && statusFilter !== "All") ||
    !!createdFromDate ||
    !!createdToDate ||
    !!validFromDate ||
    !!validToDate ||
    !!expiryFromDate ||
    !!expiryToDate ||
    !!recallFromDate ||
    !!recallToDate;

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  const resolveBatchDisplayFields = (copy: ControlledCopyRow) => {
    const batchId = copy.batchId || copy.distributionBatchId || copy.id;
    const cachedChildren = batchId ? getCachedControlledCopyChildren(batchId) : null;
    const firstChild = cachedChildren && cachedChildren.length > 0 ? cachedChildren[0] : null;

    return {
      createdDate: firstChild?.createdDate || copy.createdDate || "",
      createdTime: firstChild?.createdTime || copy.createdTime || "",
      validUntil: firstChild?.validUntil || copy.validUntil || "",
      expiryDate: firstChild?.expiryDate || copy.expiryDate || "",
      distributedDate: firstChild?.distributedDate || (copy as any).distributedDate || "",
    };
  };

  const refreshSelectedCapabilities = async () => {
    const refreshers: Array<() => Promise<any>> = [];
    if (refreshSelectedCopyCapabilities) {
      refreshers.push(refreshSelectedCopyCapabilities);
    }
    if (refreshSelectedBatchCapabilities) {
      refreshers.push(refreshSelectedBatchCapabilities);
    }
    if (refreshers.length === 0) {
      return;
    }
    await Promise.all(refreshers.map((refresh) => refresh()));
  };

  const getHttpStatus = (error: unknown) => {
    const candidate = error as any;
    return candidate?.response?.status || candidate?.status || candidate?.response?.data?.status || null;
  };

  // Event handlers
  const handleViewDetails = (copy: ControlledCopy) => {
    const detailId = getDetailId(copy as ControlledCopyRow);
    if (!detailId) {
      showToast({
        type: "error",
        title: "Unable to open controlled copy",
        message: "This distribution batch does not expose a controlled copy record yet.",
        duration: 3500,
      });
      return;
    }
    const fromPath = viewType === "ready" ? ROUTES.DOCUMENTS.CONTROLLED_COPIES.READY :
      viewType === "distributed" ? ROUTES.DOCUMENTS.CONTROLLED_COPIES.DISTRIBUTED :
        ROUTES.DOCUMENTS.CONTROLLED_COPIES.ALL;
    void navigateToPrepared(
      ROUTES.DOCUMENTS.CONTROLLED_COPIES.DETAIL(detailId),
      async () => ({
        ...buildControlledCopySnapshotState(await documentApi.getControlledCopyDetailSnapshotById(detailId)),
      }),
      { state: buildControlledCopyRouteState({ from: fromPath }) },
    ).catch((error) => {
      console.error("Failed to preload controlled copy detail", error);
      navigateTo(ROUTES.DOCUMENTS.CONTROLLED_COPIES.DETAIL(detailId), { state: buildControlledCopyRouteState({ from: fromPath }) });
    });
  };

  const handleViewAuditTrail = (copy: ControlledCopy) => {
    const detailId = getAuditTargetId(copy as ControlledCopyRow);
    if (!detailId) {
      showToast({
        type: "error",
        title: "Unable to open audit trail",
        message: "This distribution batch does not expose a controlled copy record yet.",
        duration: 3500,
      });
      return;
    }
    const fromPath = viewType === "ready" ? ROUTES.DOCUMENTS.CONTROLLED_COPIES.READY :
      viewType === "distributed" ? ROUTES.DOCUMENTS.CONTROLLED_COPIES.DISTRIBUTED :
        ROUTES.DOCUMENTS.CONTROLLED_COPIES.ALL;
    void navigateToPrepared(
      `${ROUTES.DOCUMENTS.CONTROLLED_COPIES.DETAIL(detailId)}?tab=audit`,
      async () => ({
        ...buildControlledCopySnapshotState(await documentApi.getControlledCopyDetailSnapshotById(detailId)),
      }),
      { state: buildControlledCopyRouteState({ from: fromPath }) },
    ).catch((error) => {
      console.error("Failed to preload controlled copy audit detail", error);
      navigateTo(`${ROUTES.DOCUMENTS.CONTROLLED_COPIES.DETAIL(detailId)}?tab=audit`, { state: buildControlledCopyRouteState({ from: fromPath }) });
    });
  };

  const toggleBatchExpansion = (batchId?: string) => {
    if (!batchId) {
      return;
    }
    setExpandedBatchId((current) => (current === batchId ? null : batchId));
  };

  const handleCancel = (copy: ControlledCopy) => {
    setSelectedCopyForCancel(copy);
    setisESignModalOpen(true);
    close();
  };


  const handleESignConfirm = async (data: { username: string; password: string; reason: string; signatureToken?: string }) => {
    if (!selectedCopyForCancel) {
      setisESignModalOpen(false);
      return;
    }

    try {
      setIsActionLoading(true);
      const target = selectedCopyForCancel as ControlledCopyRow;
      const isBatch = isBatchRow(target);
      const batchId = getControlledCopyActionTargetId(target);
      const updated = isBatch
        ? await documentApi.cancelControlledCopyBatch(batchId, {
            reason: data.reason,
            signatureToken: data.signatureToken as string,
          })
        : await documentApi.cancelControlledCopy(batchId, {
            reason: data.reason,
            signatureToken: data.signatureToken as string,
          });
      applyControlledCopyUpdate(updated as ControlledCopy);
      await refreshSelectedCapabilities();
      setRefreshToken(Date.now());
      if (isBatch) {
        // Per-copy cancel now finishes async — batch-level status is already Closed - Cancelled,
        // but child copies are still processing; the progress/result modals take over from here.
        setBatchCancelProgress({
          batchId,
          processed: 0,
          total: (updated as any)?.quantity || target?.batchQuantity || 0,
          failed: 0,
          status: "in_progress",
        });
      } else {
        showToast({
          type: "success",
          title: "Success",
          message: `Controlled copy ${selectedCopyForCancel.controlledCopyNumber} has been cancelled and moved to Closed - Cancelled status.`,
        });
      }
    } catch (error) {
      setBatchCancelProgress(null);
      console.error("Failed to cancel controlled copy", error);
      if ([403, 409, 410].includes(getHttpStatus(error))) {
        setRefreshToken(Date.now());
        await refreshSelectedCapabilities();
      }
      showToast({
        type: "error",
        title: "Cancellation failed",
        message: (error as any)?.response?.data?.error?.message
          ?? (error as any)?.response?.data?.message
          ?? "Unable to cancel the controlled copy.",
      });
    } finally {
      setisESignModalOpen(false);
      setSelectedCopyForCancel(null);
      setIsActionLoading(false);
    }
  };

  const handleCancelModalClose = () => {
    setisESignModalOpen(false);
    setSelectedCopyForCancel(null);
  };

  const handleDistribute = async (copy: ControlledCopy) => {
    const isBatch = isControlledCopyBatchRow(copy);
    try {
      const targetId = getControlledCopyActionTargetId(copy);
      const capabilities = isBatch
        ? await documentApi.getControlledCopyBatchActionCapabilities(targetId)
        : await documentApi.getControlledCopyActionCapabilities(targetId);
      const decision = getControlledCopyActionDecision(capabilities, isBatch ? "distributeBatch" : "distributeCopy");
      if (!decision?.allowed) {
        setRefreshToken(Date.now());
        showToast({ type: "error", title: "Distribution unavailable", message: getControlledCopyActionDeniedReason(decision), duration: 3500 });
        close();
        return;
      }
    } catch {
      setRefreshToken(Date.now());
      close();
      return;
    }
    setSelectedCopyForDistribute(copy);
    setisDistributeisESignModalOpen(true);
    close();
  };

  const handleDistributeESignConfirm = async (data: { username: string; password: string; reason: string; signatureToken?: string }) => {
    if (!selectedCopyForDistribute) {
      setisDistributeisESignModalOpen(false);
      return;
    }

    try {
      setIsActionLoading(true);
      const payload = {
        distributedTo:
          selectedCopyForDistribute?.recipientName ||
          selectedCopyForDistribute?.distributionList ||
          selectedCopyForDistribute?.location ||
          "",
        distributedAt: new Date().toISOString(),
        location: selectedCopyForDistribute?.location || "",
        comment: data.reason,
      };

      if (isControlledCopyBatchRow(selectedCopyForDistribute)) {
        const batchId = getControlledCopyActionTargetId(selectedCopyForDistribute);
        setBatchDistributeProgress({
          batchId,
          scope: "batch",
          processed: 0,
          total: selectedCopyForDistribute?.batchQuantity || 0,
          failed: 0,
          status: "in_progress",
        });
        const response = await documentApi.distributeControlledCopyBatch(
          batchId,
          { ...payload, signatureToken: data.signatureToken as string }
        );
        setBatchDistributeProgress({
          batchId: response?.id || batchId,
          scope: "batch",
          processed: 0,
          total: response?.quantity || selectedCopyForDistribute?.batchQuantity || 0,
          failed: 0,
          status: "in_progress",
        });
      } else {
        const copyId = getControlledCopyActionTargetId(selectedCopyForDistribute);
        setBatchDistributeProgress({
          batchId: copyId,
          scope: "copy",
          processed: 0,
          total: 1,
          failed: 0,
          status: "in_progress",
        });
        await documentApi.distribute(copyId, {
          ...payload,
          signatureToken: data.signatureToken as string,
        });
        setBatchDistributeProgress((current) => current?.scope === "copy" && current.batchId === copyId
          ? { ...current, processed: 1, status: "completed" }
          : current);
      }
    } catch (error) {
      console.error("Failed to distribute controlled copy", error);
      setBatchDistributeProgress(null);
      if ([403, 409, 410].includes(getHttpStatus(error))) {
        setRefreshToken(Date.now());
        await refreshSelectedCapabilities();
      }
      showToast({
        type: "error",
        title: "Distribution failed",
        message: (error as any)?.response?.data?.message
          ?? (error as any)?.response?.data?.error?.message
          ?? "Unable to distribute the controlled copy.",
        duration: 3500,
      });
    } finally {
      setisDistributeisESignModalOpen(false);
      setSelectedCopyForDistribute(null);
      setIsActionLoading(false);
    }
  };

  const handleViewRow = (copy: ControlledCopy) => {
    handleViewDetails(copy);
  };

  const handleReportLostDamaged = (copy: ControlledCopyRow) => {
    setSelectedCopyForReportLostDamaged(copy);
    setIsReportLostDamagedModalOpen(true);
  };

  const handleReportLostDamagedConfirm = (type: "Lost" | "Damaged") => {
    if (!selectedCopyForReportLostDamaged) {
      setIsReportLostDamagedModalOpen(false);
      return;
    }

    navigateTo(
      ROUTES.DOCUMENTS.CONTROLLED_COPIES.DESTROY(getControlledCopyActionTargetId(selectedCopyForReportLostDamaged)),
      {
        state: buildControlledCopyRouteState({
          from: getControlledCopiesRoute(viewType),
          type,
          ...buildControlledCopySnapshotState(selectedCopyForReportLostDamaged),
        }),
      },
      0,
    );

    setIsReportLostDamagedModalOpen(false);
    setSelectedCopyForReportLostDamaged(null);
  };

  const handleReissue = (copy: ControlledCopyRow) => {
    setSelectedCopyForReissue(copy);
    setIsReissueModalOpen(true);
  };

  const handleReissueConfirm = async (data: { username: string; password: string; reason: string; signatureToken?: string }) => {
    if (!selectedCopyForReissue) {
      setIsReissueModalOpen(false);
      return;
    }
    try {
      setIsActionLoading(true);
      const created = await documentApi.replaceControlledCopy(getControlledCopyActionTargetId(selectedCopyForReissue), {
        reason: data.reason,
        signatureToken: data.signatureToken as string,
      }) as ControlledCopy;
      setRefreshToken(Date.now());
      showToast({
        type: "success",
        title: "Replacement Copy Reissued",
        message: `New controlled copy ${created?.controlledCopyNumber || ""} created (Ready for Distribution) for the same recipient.`,
        duration: 4500,
      });
    } catch (error) {
      console.error("Failed to reissue controlled copy", error);
      const backendMessage =
        (error as any)?.response?.data?.error?.message || (error as any)?.response?.data?.message;
      showToast({
        type: "error",
        title: "Reissue failed",
        message: backendMessage || "Unable to reissue a replacement controlled copy.",
        duration: 3500,
      });
    } finally {
      setIsReissueModalOpen(false);
      setSelectedCopyForReissue(null);
      setIsActionLoading(false);
    }
  };

  const getPageTitle = () => {
    switch (viewType) {
      case "ready":
        return "Ready for Distribution";
      case "distributed":
        return "Distributed Copies";
      case "all":
      default:
        return "All Controlled Copies";
    }
  };

  const handleRecall = (copy: ControlledCopy) => {
    setSelectedCopyForRecall(copy);
    setIsRecallFormOpen(true);
    close();
  };

  const handleRecallFormConfirm = (values: RecallControlledCopyValues) => {
    setRecallValues(values);
    setIsRecallFormOpen(false);
    setIsRecallESignModalOpen(true);
  };

  const handleRecallESignConfirm = async (data: { username: string; password: string; reason: string; signatureToken?: string }) => {
    if (!selectedCopyForRecall || !recallValues) {
      setIsRecallESignModalOpen(false);
      return;
    }

    try {
      setIsActionLoading(true);
      const target = selectedCopyForRecall as ControlledCopyRow;
      const isBatch = isControlledCopyBatchRow(target);
      const batchId = getControlledCopyActionTargetId(target);
      if (isBatch) {
        setBatchRecallProgress({ batchId, processed: 0, total: target?.batchQuantity || 0, failed: 0, status: "in_progress" });
      }
      const updated = isBatch
        ? await documentApi.recallControlledCopyBatch(batchId, {
            recalledBy: data.username,
            recallReason: recallValues.recallReason,
            recallDate: recallValues.recallDate,
            comment: data.reason,
            signatureToken: data.signatureToken as string,
          })
        : await documentApi.recallControlledCopy(batchId, {
            recalledBy: data.username,
            recallReason: recallValues.recallReason,
            recallDate: recallValues.recallDate,
            comment: data.reason,
            signatureToken: data.signatureToken as string,
          });
      applyControlledCopyUpdate((isBatch ? updated : updated) as ControlledCopy);
      await refreshSelectedCapabilities();
      setRefreshToken(Date.now());
      if (isBatch) {
        // Per-copy recall now finishes async — the batch-level status above is already
        // Obsoleted, but child copies are still processing; the progress/result modals
        // (driven by batchRecallProgress) take over from here instead of an immediate toast.
        setBatchRecallProgress({
          batchId,
          processed: 0,
          total: (updated as any)?.quantity || target?.batchQuantity || 0,
          failed: 0,
          status: "in_progress",
        });
      } else {
        showToast({
          type: "success",
          title: "Controlled Copy Recalled",
          message: `Controlled copy ${selectedCopyForRecall.controlledCopyNumber} has been recalled and moved to Obsoleted status.`,
          duration: 3500,
        });
      }
    } catch (error) {
      setBatchRecallProgress(null);
      console.error("Failed to recall controlled copy", error);
      if ([403, 409, 410].includes(getHttpStatus(error))) {
        setRefreshToken(Date.now());
        await refreshSelectedCapabilities();
      }
      showToast({
        type: "error",
        title: "Recall failed",
        message: (error as any)?.response?.data?.error?.message
          ?? (error as any)?.response?.data?.message
          ?? "Unable to recall the controlled copy.",
        duration: 3500,
      });
    } finally {
      setIsRecallESignModalOpen(false);
      setSelectedCopyForRecall(null);
      setRecallValues(null);
      setIsActionLoading(false);
    }
  };

  const handleExport = () => {
    const csvEscape = (value: string | number | null | undefined) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const headers = [
      "Controlled Copy / Batch Number",
      "Requested At",
      "Requested By",
      "Quantity",
      "Status",
      "Document",
      "Revision",
      "Distribution List",
      "Recall Date",
      "Reason for Recall",
      "Valid Until",
      "Expiry Date",
      "Location",
      "Location Code",
      "Distributed By",
      "Distributed At",
    ];
    const rows = controlledCopiesData.map((batch) => [
      batch.batchNumber || batch.controlledCopyNumber,
      formatDateTimeParts(batch.createdDate, batch.createdTime),
      batch.requestedBy || batch.openedBy || "",
      batch.batchQuantity ?? batch.totalCopies ?? 0,
      batch.batchStatus || batch.status || "",
      formatDocumentLabel(batch),
      formatDocumentRevisionLabel(batch),
      getControlledCopyDistributionListText(batch),
      batch.recallDate || "",
      batch.recallReason || "",
      batch.validUntil || "",
      batch.expiryDate || "",
      batch.location || "",
      batch.locationCode || "",
      batch.distributedBy || "",
      batch.distributedDate || "",
    ].map(csvEscape).join(","));
    const csv = [headers.map(csvEscape).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `controlled-copies-${viewType}.csv`;
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  if (isLoading || isNavigating || isActionLoading) return <SectionLoading minHeight="60vh" />;

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6 w-full flex-1">
      <PageHeader
        title={getPageTitle()}
        breadcrumbItems={controlledCopies(navigateTo, viewType)}
        actions={
          <div className="flex items-center gap-2">
            {canReviewBatchDiscrepancies && (
              <Button
                onClick={() => navigateTo(ROUTES.DOCUMENTS.CONTROLLED_COPIES.DISCREPANCIES)}
                variant="outline"
                size="sm"
                className="whitespace-nowrap gap-2"
              >
                <IconHandClick className="h-4 w-4" />
                Needs Review
              </Button>
            )}
            <Button
              onClick={handleExport}
              variant="outline"
              size="sm"
              className="whitespace-nowrap gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        }
      />

      {/* Unified Content Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col">
        {/* Main Content Area (Filters + Table) */}
        <div className="p-4 md:p-5 flex-1 flex flex-col">
          <div className="flex flex-col w-full">
            <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
              <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search copies..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="block w-full pl-10 pr-9 h-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setCurrentPage(1);
                      }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setIsFilterDrawerOpen(true)}
                  className="whitespace-nowrap gap-2 h-10"
                >
                  <IconFilter2 className="h-4 w-4" />
                  Filters
                </Button>
              </div>
            </div>

            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-end pb-4 md:pb-5">
              <div>
                <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 transition-colors" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Document #, Name, ID..."
                    className="w-full h-9 pl-10 pr-4 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-400 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Status</label>
                {viewType === "all" ? (
                  <Select
                    value={statusFilter}
                    onChange={(value) => {
                      setStatusFilter(value);
                      setCurrentPage(1);
                    }}
                    options={statusOptions}
                    placeholder="All States"
                  />
                ) : (
                  <Select
                    value={viewType === "ready" ? "Ready for Distribution" : "Distributed"}
                    onChange={() => { }}
                    options={[
                      {
                        label: viewType === "ready" ? "Ready for Distribution" : "Distributed",
                        value: viewType === "ready" ? "Ready for Distribution" : "Distributed",
                      },
                    ]}
                    placeholder={viewType === "ready" ? "Ready for Distribution" : "Distributed"}
                    disabled
                  />
                )}
              </div>

              <div>
                <DateRangePicker
                  label="Created Date Range"
                  startDate={createdFromDate}
                  endDate={createdToDate}
                  onStartDateChange={(val) => {
                    setCreatedFromDate(val);
                    setCurrentPage(1);
                  }}
                  onEndDateChange={(val) => {
                    setCreatedToDate(val);
                    setCurrentPage(1);
                  }}
                  placeholder="Select date range"
                />
              </div>

              <div>
                <DateRangePicker
                  label="Valid Until Date Range"
                  startDate={validFromDate}
                  endDate={validToDate}
                  onStartDateChange={(val) => {
                    setValidFromDate(val);
                    setCurrentPage(1);
                  }}
                  onEndDateChange={(val) => {
                    setValidToDate(val);
                    setCurrentPage(1);
                  }}
                  placeholder="Select date range"
                />
              </div>

              <div>
                <DateRangePicker
                  label="Expiry Date Range"
                  startDate={expiryFromDate}
                  endDate={expiryToDate}
                  onStartDateChange={(val) => { setExpiryFromDate(val); setCurrentPage(1); }}
                  onEndDateChange={(val) => { setExpiryToDate(val); setCurrentPage(1); }}
                  placeholder="Select date range"
                />
              </div>

              <div>
                <DateRangePicker
                  label="Recall Date Range"
                  startDate={recallFromDate}
                  endDate={recallToDate}
                  onStartDateChange={(val) => { setRecallFromDate(val); setCurrentPage(1); }}
                  onEndDateChange={(val) => { setRecallToDate(val); setCurrentPage(1); }}
                  placeholder="Select date range"
                />
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap"
                >
                  Clear Filters
                </Button>
              </div>
            </div>

            <FilterDrawer
              isOpen={isFilterDrawerOpen}
              onClose={() => setIsFilterDrawerOpen(false)}
              onClear={clearFilters}
              onApply={() => setIsFilterDrawerOpen(false)}
              
            >
              <FilterAccordionItem
                label="Status"
                isExpanded={expandedSections.has("status")}
                onToggle={() => toggleSection("status")}
                disabled={viewType !== "all"}
              >
                <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
                  {(viewType === "all"
                    ? statusOptions
                    : statusOptions.filter(
                      (opt) => opt.label === (viewType === "ready" ? "Ready for Distribution" : "Distributed")
                        || opt.value === (viewType === "ready" ? "READY_FOR_DISTRIBUTION" : "DISTRIBUTED")
                        || opt.value === (viewType === "ready" ? "Ready for Distribution" : "Distributed")
                    )
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        if (viewType === "all") {
                          setStatusFilter(opt.value);
                          setCurrentPage(1);
                        }
                      }}
                      className={getOptionClassName(viewType === "all" ? statusFilter === opt.value : true)}
                    >
                      <span className="text-xs">{opt.label}</span>
                      {(viewType === "all" ? statusFilter === opt.value : true) && (
                        <Check size={16} className="text-emerald-500" />
                      )}
                    </button>
                  ))}
                </div>
              </FilterAccordionItem>

              <FilterAccordionItem
                label="Created Date Range"
                isExpanded={expandedSections.has("createdDates")}
                onToggle={() => toggleSection("createdDates")}
              >
                <div className="pt-2 pb-4">
                  <DateRangePicker
                    label="Created Date Range"
                    startDate={createdFromDate}
                    endDate={createdToDate}
                    onStartDateChange={(val) => {
                      setCreatedFromDate(val);
                      setCurrentPage(1);
                    }}
                    onEndDateChange={(val) => {
                      setCreatedToDate(val);
                      setCurrentPage(1);
                    }}
                    placeholder="Select date range"
                  />
                </div>
              </FilterAccordionItem>

              <FilterAccordionItem
                label="Valid Until Date Range"
                isExpanded={expandedSections.has("validDates")}
                onToggle={() => toggleSection("validDates")}
              >
                <div className="pt-2 pb-4">
                  <DateRangePicker
                    label="Valid Until Date Range"
                    startDate={validFromDate}
                    endDate={validToDate}
                    onStartDateChange={(val) => {
                      setValidFromDate(val);
                      setCurrentPage(1);
                    }}
                    onEndDateChange={(val) => {
                      setValidToDate(val);
                      setCurrentPage(1);
                    }}
                    placeholder="Select date range"
                  />
                </div>
              </FilterAccordionItem>

              <FilterAccordionItem
                label="Expiry Date Range"
                isExpanded={expandedSections.has("expiryDates")}
                onToggle={() => toggleSection("expiryDates")}
              >
                <div className="pt-2 pb-4">
                  <DateRangePicker
                    label="Expiry Date Range"
                    startDate={expiryFromDate}
                    endDate={expiryToDate}
                    onStartDateChange={(val) => { setExpiryFromDate(val); setCurrentPage(1); }}
                    onEndDateChange={(val) => { setExpiryToDate(val); setCurrentPage(1); }}
                    placeholder="Select date range"
                  />
                </div>
              </FilterAccordionItem>

              <FilterAccordionItem
                label="Recall Date Range"
                isExpanded={expandedSections.has("recallDates")}
                onToggle={() => toggleSection("recallDates")}
              >
                <div className="pt-2 pb-4">
                  <DateRangePicker
                    label="Recall Date Range"
                    startDate={recallFromDate}
                    endDate={recallToDate}
                    onStartDateChange={(val) => { setRecallFromDate(val); setCurrentPage(1); }}
                    onEndDateChange={(val) => { setRecallToDate(val); setCurrentPage(1); }}
                    placeholder="Select date range"
                  />
                </div>
              </FilterAccordionItem>
            </FilterDrawer>
          </div>

          {/* Table Section */}
          <div className="flex-1 flex flex-col relative">
            <div className={cn(
              "border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white transition-all duration-300 relative"
            )}>
              <div
                ref={scrollerRef}
                className={cn(
                  "flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400",
                  isDragging ? "cursor-grabbing select-none" : "cursor-grab"
                )}
                {...dragEvents}
              >
                <table className="w-full min-w-max border-spacing-0 text-left">
                  <thead>
                    <tr>
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-10">
                        {" "}
                      </th>
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-16">
                        No.
                      </th>
                      {DEFAULT_COLUMNS.filter((c) => c.visible).map((col) => {
                        const isSorted = sortConfig.key === col.id;
                        return (
                          <th
                            key={col.id}
                            onClick={() => handleSort(col.id)}
                            className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors group"
                          >
                            <div className="flex items-center justify-between gap-2 w-full">
                              <span className="truncate">{col.label}</span>
                              <div className="flex flex-col text-slate-500 flex-shrink-0 group-hover:text-slate-700 transition-colors">
                                <ChevronUp className={cn("h-3 w-3 -mb-1", isSorted && sortConfig.direction === 'asc' ? "text-emerald-600" : "")} />
                                <ChevronDown className={cn("h-3 w-3", isSorted && sortConfig.direction === 'desc' ? "text-emerald-600" : "")} />
                              </div>
                            </div>
                          </th>
                        );
                      })}
                      <th className="sticky top-0 right-0 z-30 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap border-b-2 border-slate-200 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {controlledCopiesData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={DEFAULT_COLUMNS.filter((c) => c.visible).length + 3}
                          className="py-12 text-center border-b border-slate-200"
                        >
                          <EmptyState
                            title={
                              error
                                ? "Unable to load controlled copies"
                                : viewType === "ready"
                                  ? "No Distribution Batches Found"
                                  : "No Controlled Copies Found"
                            }
                            description={
                              error ||
                              (viewType === "ready"
                                ? "We couldn't find any distribution batches matching your filters. Try adjusting your search criteria."
                                : "We couldn't find any controlled copies matching your filters. Try adjusting your search criteria.")
                            }
                          />
                        </td>
                      </tr>
                    ) : (
                    controlledCopiesData.map((copy, index) => {
                        const rowNumber = (currentPage - 1) * itemsPerPage + index + 1;
                        const tdClass = "py-3 px-4 text-xs md:text-sm text-slate-700 border-b border-slate-200 whitespace-nowrap";
                        const expandableBatchId = copy.batchId || copy.distributionBatchId || copy.id;
                        // A single-copy request is still stored as a batch for
                        // audit/distribution consistency, but it should render as
                        // one normal record instead of a redundant expandable row.
                        const batchSize = Number(copy.batchQuantity ?? copy.totalCopies ?? copy.copyIds?.length ?? 0);
                        const isExpandable = Boolean(expandableBatchId) && batchSize > 1;
                        const isExpanded = expandedBatchId === expandableBatchId;
                        const displayFields = resolveBatchDisplayFields(copy);

                        return (
                          <React.Fragment key={copy.id}>
                            <tr
                              className={cn("transition-colors group hover:bg-slate-50/80")}
                            >
                              <td className={cn(tdClass, "text-center")}>
                                {isExpandable && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      toggleBatchExpansion(expandableBatchId);
                                    }}
                                    className="inline-flex h-5 w-5 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                    aria-label={isExpanded ? "Collapse batch" : "Expand batch"}
                                  >
                                  <ChevronRight className={cn("h-4 w-4 transition-transform duration-200", isExpanded && "rotate-90")} />
                                  </button>
                                )}
                              </td>
                              <td className={tdClass}>
                                {rowNumber}
                              </td>
                              <td className={tdClass}>
                                <button
                                  type="button"
                                  onClick={() => handleViewDetails(copy)}
                                  className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline text-left"
                                  title={isExpandable ? "Open controlled copy batch details" : "Open controlled copy details"}
                                >
                                  {formatControlledCopyNumber(copy.controlledCopyNumber)}
                                </button>
                              </td>
                              <td className={tdClass}>
                                {formatDateTimeParts(displayFields.createdDate, displayFields.createdTime)}
                              </td>
                              <td className={tdClass}>
                                {copy.openedBy}
                              </td>
                              <td className={cn(tdClass, "font-medium text-slate-900")}>
                                {copy.name}
                              </td>
                              <td className={tdClass}>
                                {isExpandable ? (copy.batchQuantity ?? copy.totalCopies ?? "-") : (copy.totalCopies ?? "-")}
                              </td>
                              <td className={tdClass}>
                                <Badge
                                  color={getBadgeColor(
                                    copy.statusCode || copy.statusInfo?.id,
                                    normalizeControlledCopyStatusLabel(copy.status, copy.statusInfo as any)
                                  )}
                                >
                                  {normalizeControlledCopyStatusLabel(copy.status, copy.statusInfo as any)}
                                </Badge>
                              </td>
                              <td className={tdClass}>
                                {formatDateUS(displayFields.validUntil)}
                              </td>
                              <td className={tdClass}>
                                {displayFields.expiryDate ? formatDateUS(displayFields.expiryDate) : "-"}
                              </td>
                              <td className={tdClass}>
                                <span className="font-medium text-slate-900">{formatDocumentLabel(copy)}</span>
                              </td>
                              <td className={tdClass}>
                                {getControlledCopyDistributionListText(copy) || "-"}
                              </td>
                              <td className={tdClass}>
                                {copy.recallDate ? formatDateUS(copy.recallDate) : "-"}
                              </td>
                              <td className={tdClass}>
                                {copy.recallReason || "-"}
                              </td>
                              <td className={tdClass}>
                                <span className="font-medium text-slate-900">{formatDocumentRevisionLabel(copy)}</span>
                              </td>
                              <td
                                onClick={(e) => e.stopPropagation()}
                                className="sticky right-0 z-10 bg-white border-b border-slate-200 py-3 px-4 text-center whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50 transition-colors"
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
                              </td>
                            </tr>
                            {isExpandable && (
                              <ExpandControlledCopiesRow
                                source={copy}
                                isExpanded={isExpanded}
                                visibleColumnsLength={DEFAULT_COLUMNS.filter((c) => c.visible).length + 3}
                                onViewDetails={handleViewDetails}
                                onViewAuditTrail={handleViewAuditTrail}
                                onDistribute={handleDistribute}
                                onRecall={handleRecall}
                                onCancel={handleCancel}
                                onReportLostDamaged={handleReportLostDamaged}
                                onReissue={handleReissue}
                            />
                          )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {controlledCopiesData.length > 0 && (
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {openId && (() => (
        <DropdownMenu
          isOpen={openId !== null}
          onClose={close}
          position={position}
          isBatch={selectedIsBatch}
          isCapabilityLoading={isCapabilityLoading}
          cancelDecision={selectedCancelDecision}
          distributeDecision={selectedDistributeDecision}
          recallDecision={selectedRecallDecision}
          reportLostDamagedDecision={selectedReportLostDamagedDecision}
          reissueDecision={selectedReissueDecision}
          viewType={viewType}
          onViewDetails={!selectedCopy ? undefined : () => handleViewDetails(selectedCopy)}
          onViewAuditTrail={!selectedCopy ? undefined : () => handleViewAuditTrail(selectedCopy)}
          onDistribute={selectedCopy && selectedDistributeDecision ? () => handleDistribute(selectedCopy) : undefined}
          onRecall={selectedCopy && selectedRecallDecision ? () => handleRecall(selectedCopy) : undefined}
          onCancel={selectedCopy && selectedCancelDecision ? () => handleCancel(selectedCopy) : undefined}
          onReportLostDamaged={selectedCopy && !selectedIsBatch && selectedReportLostDamagedDecision ? () => handleReportLostDamaged(selectedCopy) : undefined}
          onReissue={selectedCopy && !selectedIsBatch && selectedReissueDecision ? () => handleReissue(selectedCopy) : undefined}
        />
      ))()}

      {/* ESignature Modal - Cancel Distribution */}
      <ESignatureModal
        isOpen={isESignModalOpen}
        onClose={handleCancelModalClose}
        onConfirm={handleESignConfirm}
        transactionType="cancel-distribution"
        meaningDisplayName="Controlled Copy Distribution Cancelled"
        meaningCode="CONTROLLED_COPY_DISTRIBUTION_CANCELLED"
        targetDetails={{
          code: selectedCopyForCancel?.controlledCopyNumber || "N/A",
          title: selectedCopyForCancel?.name || "N/A",
          revision: selectedCopyForCancel?.revisionNumber || "—"
        }}
      />

      {/* ESignature Modal - Distribute */}
      <ESignatureModal
        isOpen={isDistributeisESignModalOpen}
        onClose={() => {
          setisDistributeisESignModalOpen(false);
          setSelectedCopyForDistribute(null);
        }}
        onConfirm={handleDistributeESignConfirm}
        transactionType="distribute"
        meaningDisplayName="Controlled Copy Distributed"
        meaningCode="CONTROLLED_COPY_DISTRIBUTED"
        targetDetails={{
          code: selectedCopyForDistribute?.controlledCopyNumber || "N/A",
          title: selectedCopyForDistribute?.name || "N/A",
          revision: selectedCopyForDistribute?.revisionNumber || "—"
        }}
      />

      <RecallControlledCopyModal
        isOpen={isRecallFormOpen}
        onClose={() => {
          setIsRecallFormOpen(false);
          setSelectedCopyForRecall(null);
          setRecallValues(null);
        }}
        onConfirm={handleRecallFormConfirm}
        controlledCopyNumber={selectedCopyForRecall?.controlledCopyNumber}
        isBatch={selectedCopyForRecall ? isControlledCopyBatchRow(selectedCopyForRecall) : false}
      />

      {/* ESignature Modal - Recall */}
      <ESignatureModal
        isOpen={isRecallESignModalOpen}
        onClose={() => {
          setIsRecallESignModalOpen(false);
          setSelectedCopyForRecall(null);
          setRecallValues(null);
        }}
        onConfirm={handleRecallESignConfirm}
        transactionType="recall-distribution"
        meaningDisplayName="Controlled Copy Recalled"
        meaningCode="CONTROLLED_COPY_RECALLED"
        targetDetails={{
          code: selectedCopyForRecall?.controlledCopyNumber || "N/A",
          title: selectedCopyForRecall?.name || "N/A",
          revision: selectedCopyForRecall?.revisionNumber || "—"
        }}
      />

      <DestructionTypeSelectionModal
        isOpen={isReportLostDamagedModalOpen}
        onClose={() => {
          setIsReportLostDamagedModalOpen(false);
          setSelectedCopyForReportLostDamaged(null);
        }}
        onConfirm={handleReportLostDamagedConfirm}
        allowedTypes={["Lost", "Damaged"]}
      />

      <ESignatureModal
        isOpen={isReissueModalOpen}
        onClose={() => {
          setIsReissueModalOpen(false);
          setSelectedCopyForReissue(null);
        }}
        onConfirm={handleReissueConfirm}
        actionTitle="Reissue Replacement Controlled Copy"
        meaningDisplayName="Controlled Copy Reissued"
        meaningCode="CONTROLLED_COPY_REISSUED"
        targetDetails={{
          code: selectedCopyForReissue?.controlledCopyNumber || "N/A",
          title: selectedCopyForReissue?.name || "N/A",
          revision: selectedCopyForReissue?.revisionNumber || "—"
        }}
      />

      <DistributeBatchProgressModal
        isOpen={batchDistributeProgress !== null}
        processed={batchDistributeProgress?.processed ?? 0}
        total={batchDistributeProgress?.total ?? 0}
        failed={batchDistributeProgress?.failed ?? 0}
        status={batchDistributeProgress?.status ?? "in_progress"}
      />

      <DistributeBatchResultModal
        isOpen={distributeResultModal !== null}
        total={distributeResultModal?.total ?? 0}
        succeeded={distributeResultModal?.succeeded ?? 0}
        failed={distributeResultModal?.failed ?? 0}
        failedItems={distributeResultModal?.failedItems ?? []}
        isRetrying={distributeResultModal?.isRetrying ?? false}
        onRetryAllFailed={() => void handleRetryAllFailedDistribution()}
        onClose={() => setDistributeResultModal(null)}
      />

      <DistributeBatchProgressModal
        isOpen={batchRecallProgress !== null}
        processed={batchRecallProgress?.processed ?? 0}
        total={batchRecallProgress?.total ?? 0}
        failed={batchRecallProgress?.failed ?? 0}
        status={batchRecallProgress?.status ?? "in_progress"}
        actionLabel="Recall"
      />

      <DistributeBatchResultModal
        isOpen={recallResultModal !== null}
        total={recallResultModal?.total ?? 0}
        succeeded={recallResultModal?.succeeded ?? 0}
        failed={recallResultModal?.failed ?? 0}
        failedItems={recallResultModal?.failedItems ?? []}
        isRetrying={recallResultModal?.isRetrying ?? false}
        onRetryAllFailed={() => void handleRetryAllFailedRecall()}
        onClose={() => setRecallResultModal(null)}
        actionLabel="Recall"
        failedStatusLabel="Distributed"
      />

      <DistributeBatchProgressModal
        isOpen={batchCancelProgress !== null}
        processed={batchCancelProgress?.processed ?? 0}
        total={batchCancelProgress?.total ?? 0}
        failed={batchCancelProgress?.failed ?? 0}
        status={batchCancelProgress?.status ?? "in_progress"}
        actionLabel="Cancellation"
      />

      <DistributeBatchResultModal
        isOpen={cancelResultModal !== null}
        total={cancelResultModal?.total ?? 0}
        succeeded={cancelResultModal?.succeeded ?? 0}
        failed={cancelResultModal?.failed ?? 0}
        failedItems={cancelResultModal?.failedItems ?? []}
        isRetrying={cancelResultModal?.isRetrying ?? false}
        onRetryAllFailed={() => void handleRetryAllFailedCancel()}
        onClose={() => setCancelResultModal(null)}
        actionLabel="Cancellation"
        failedStatusLabel="Distributed (cannot be cancelled)"
      />

    </div>
  );
};
