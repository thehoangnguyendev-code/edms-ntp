import React, { useCallback, useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { ROUTES } from '@/app/routes.constants';
import { Button } from "@/components/ui/button/Button";
import { cn } from "@/components/ui/utils";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { useToast } from "@/components/ui/toast/Toast";
import { useTranslation } from "@/i18n";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { auditTrailApi } from "@/services/api/auditTrail";
import { documentApi } from "@/services/api/documents";
import { ControlledCopy, ControlledCopyDistributionBatch } from "../types";
import { DestructionTypeSelectionModal } from "../components/DestructionTypeSelectionModal";
import { RecallControlledCopyModal, type RecallControlledCopyValues } from "../components/RecallControlledCopyModal";
import { DistributeBatchProgressModal } from "../components/DistributeBatchProgressModal";
import { DistributeBatchResultModal, type DistributeBatchFailedItem } from "../components/DistributeBatchResultModal";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { controlledCopyDetail } from "@/components/ui/breadcrumb/breadcrumbs.config";
import {
  DocumentInformationTab,
  DistributionInformationTab,
  SignaturesTab,
  AuditTrailTab,
  EvidenceTab,
} from "./tabs";
import type { ControlledCopyEvidenceFile } from "../types";
import type { SignatureRecord } from "./tabs/SignaturesTab";
import {
  buildControlledCopySnapshotState,
  isControlledCopySnapshotPreload,
  refreshDetailAfterSnapshot,
} from "@/features/documents/shared/detailSnapshotHelpers";
import { getControlledCopyActionTargetId } from "../controlledCopyActions";
import {
  mergeControlledCopyAuditTrailRows,
  normalizeControlledCopyBatchDetail,
  normalizeControlledCopyDetail,
} from "../controlledCopyMapping";
import {
  getControlledCopyActionDecision,
} from "../controlledCopyCapabilities";
import {
  useControlledCopyActionCapabilities,
  useControlledCopyBatchActionCapabilities,
} from "@/hooks";
import { resolveTerminalProgressStep } from "@/features/documents/shared/statusMapping";
import { subscribeNotificationRealtime } from "@/features/notifications/notificationRealtime";
import { startControlledCopyJobStatusPolling } from "../jobStatusPolling";
import { buildControlledCopyRouteState } from "../controlledCopyNavigation";
import type { ControlledCopyRouteState } from "../controlledCopyNavigation";

// Tab Type
type TabType = "document" | "distribution" | "signatures" | "audit" | "evidence";

// Main Component
interface ControlledCopyDetailViewProps {
  controlledCopyId: string;
  onBack: () => void;
  initialTab?: TabType;
}

export const ControlledCopyDetailView: React.FC<ControlledCopyDetailViewProps> = ({
  controlledCopyId,
  onBack,
  initialTab = "document",
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as ControlledCopyRouteState | undefined;

  const [controlledCopy, setControlledCopy] = useState<ControlledCopy & { copyIds?: string[] }>(() => normalizeControlledCopyDetail({ id: controlledCopyId }, controlledCopyId));
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isDestructionModalOpen, setIsDestructionModalOpen] = useState(false);
  const [isDistributeModalOpen, setIsDistributeModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isRecallFormOpen, setIsRecallFormOpen] = useState(false);
  const [isRecallESignModalOpen, setIsRecallESignModalOpen] = useState(false);
  const [recallValues, setRecallValues] = useState<RecallControlledCopyValues | null>(null);
  const [isReportLostDamagedModalOpen, setIsReportLostDamagedModalOpen] = useState(false);
  const [isReissueModalOpen, setIsReissueModalOpen] = useState(false);
  const [auditTrailRows, setAuditTrailRows] = useState<any[]>([]);
  const [signatureRows, setSignatureRows] = useState<SignatureRecord[]>([]);
  const [evidenceRows, setEvidenceRows] = useState<ControlledCopyEvidenceFile[]>([]);
  const [isBatchParent, setIsBatchParent] = useState(false);
  const [distributeProgress, setDistributeProgress] = useState<{
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
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as TabType;
  const [activeTab, setActiveTab] = useState<TabType>(urlTab || initialTab);
  const [isNavigating, setIsNavigating] = useState(false);
  const { showToast } = useToast();
  const { t } = useTranslation();
  const {
    capabilities: copyCapabilities,
    loading: isCopyCapabilityLoading,
    refresh: refreshCopyCapabilities,
  } = useControlledCopyActionCapabilities(!isBatchParent ? controlledCopy.id : null);
  const {
    capabilities: batchCapabilities,
    loading: isBatchCapabilityLoading,
    refresh: refreshBatchCapabilities,
  } = useControlledCopyBatchActionCapabilities(isBatchParent ? (controlledCopy.distributionBatchId || controlledCopy.id) : null);
  const activeCapabilities = isBatchParent ? batchCapabilities : copyCapabilities;
  const isCapabilityLoading = isBatchParent ? isBatchCapabilityLoading : isCopyCapabilityLoading;
  const cancelDecision = getControlledCopyActionDecision(activeCapabilities, isBatchParent ? "cancelBatch" : "cancelRequest");
  const distributeDecision = getControlledCopyActionDecision(activeCapabilities, isBatchParent ? "distributeBatch" : "distributeCopy");
  const recallDecision = getControlledCopyActionDecision(activeCapabilities, isBatchParent ? "recallBatch" : "recallCopy");
  const reportLostDamagedDecision = getControlledCopyActionDecision(activeCapabilities, "reportLostDamaged");
  const reissueDecision = getControlledCopyActionDecision(activeCapabilities, "replaceLostDamaged");
  const terminalProgressStep = React.useMemo(
    () => resolveTerminalProgressStep(controlledCopy.status, auditTrailRows as any[]),
    [auditTrailRows, controlledCopy.status],
  );

  const loadAuditTrail = useCallback(async (entityType: string, entityId: string, childIds: string[] = []) => {
    if (!entityId) {
      setAuditTrailRows([]);
      return;
    }

    try {
      const batchResponse = await auditTrailApi.getByEntity(entityType, entityId);
      const batchRows = Array.isArray(batchResponse) ? batchResponse : (batchResponse as any)?.data || [];

      if (entityType !== "Controlled Copy Distribution Batch" || childIds.length === 0) {
        setAuditTrailRows(batchRows);
        return;
      }

      const childResponses = await Promise.allSettled(
        childIds.map((childId) => auditTrailApi.getByEntity("Controlled Copy", childId))
      );
      const childRows = childResponses.flatMap((result) => {
        if (result.status !== "fulfilled") {
          return [];
        }
        const value = result.value;
        return Array.isArray(value) ? value : (value as any)?.data || [];
      });
      setAuditTrailRows(mergeControlledCopyAuditTrailRows(batchRows, childRows));
    } catch {
      setAuditTrailRows([]);
    }
  }, []);

  const loadSignatureRows = useCallback(async (entityId: string) => {
    if (!entityId) {
      setSignatureRows([]);
      return;
    }

    try {
      const response = await documentApi.getControlledCopySignatures(entityId);
      const rows = Array.isArray(response) ? response : (response as any)?.data || [];
      setSignatureRows(rows);
    } catch {
      setSignatureRows([]);
    }
  }, []);

  const loadEvidenceRows = useCallback(async (entityId: string, isBatch: boolean) => {
    if (!entityId || isBatch) {
      setEvidenceRows([]);
      return;
    }
    try {
      const response = await documentApi.listControlledCopyEvidence(entityId);
      const rows = Array.isArray(response) ? response : (response as any)?.data || [];
      setEvidenceRows(rows);
    } catch {
      setEvidenceRows([]);
    }
  }, []);

  const refreshDetailRelatedData = useCallback(async (entityType: string, entityId: string, childIds: string[] = []) => {
    await Promise.all([
      loadAuditTrail(entityType, entityId, childIds),
      loadSignatureRows(entityId),
      loadEvidenceRows(entityId, entityType === "Controlled Copy Distribution Batch"),
    ]);
  }, [loadAuditTrail, loadSignatureRows, loadEvidenceRows]);

  const refreshDetailCapabilities = useCallback(async () => {
    const refreshers: Array<() => Promise<any>> = [];
    if (refreshCopyCapabilities) {
      refreshers.push(refreshCopyCapabilities);
    }
    if (refreshBatchCapabilities) {
      refreshers.push(refreshBatchCapabilities);
    }
    if (refreshers.length === 0) {
      return;
    }
    await Promise.all(refreshers.map((refresh) => refresh()));
  }, [refreshBatchCapabilities, refreshCopyCapabilities]);

  const refreshDistributionDetail = useCallback(async () => {
    const entityId = isBatchParent
      ? controlledCopy.distributionBatchId || controlledCopy.id
      : controlledCopy.id;
    const response = isBatchParent
      ? await documentApi.getControlledCopyDistributionBatchDetailById(entityId)
      : await documentApi.getControlledCopyDetailById(entityId);
    const refreshed = isBatchParent
      ? normalizeControlledCopyBatchDetail(response as ControlledCopyDistributionBatch)
      : normalizeControlledCopyDetail(response, entityId);
    setControlledCopy(refreshed);
    await refreshDetailRelatedData(
      isBatchParent ? "Controlled Copy Distribution Batch" : "Controlled Copy",
      isBatchParent ? refreshed.distributionBatchId || refreshed.id : refreshed.id,
      isBatchParent ? refreshed.copyIds || [] : [],
    );
  }, [controlledCopy.distributionBatchId, controlledCopy.id, isBatchParent, refreshDetailRelatedData]);

  useEffect(() => {
    const unsubscribe = subscribeNotificationRealtime((event) => {
      if (event.type !== "controlled-copy-batch-progress") return;
      try {
        const payload = JSON.parse(event.data) as {
          batchId?: string; processed?: number; total?: number; failed?: number; status?: string;
        };
        if (!payload.batchId) return;
        setDistributeProgress((current) => {
          if (!current || current.scope !== "batch" || current.batchId !== payload.batchId) return current;
          return {
            ...current,
            processed: payload.processed ?? current.processed,
            total: payload.total ?? current.total,
            failed: payload.failed ?? current.failed,
            status: payload.status === "completed_with_errors"
              ? "completed_with_errors"
              : payload.status === "completed" ? "completed" : "in_progress",
          };
        });
        setBatchRecallProgress((current) => {
          if (!current || current.batchId !== payload.batchId) return current;
          return {
            ...current,
            processed: payload.processed ?? current.processed,
            total: payload.total ?? current.total,
            failed: payload.failed ?? current.failed,
            status: payload.status === "completed_with_errors"
              ? "completed_with_errors"
              : payload.status === "completed" ? "completed" : "in_progress",
          };
        });
        setBatchCancelProgress((current) => {
          if (!current || current.batchId !== payload.batchId) return current;
          return {
            ...current,
            processed: payload.processed ?? current.processed,
            total: payload.total ?? current.total,
            failed: payload.failed ?? current.failed,
            status: payload.status === "completed_with_errors"
              ? "completed_with_errors"
              : payload.status === "completed" ? "completed" : "in_progress",
          };
        });
      } catch {
        // Ignore an invalid realtime payload; the server remains authoritative.
      }
    });
    return unsubscribe;
  }, []);

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
      void refreshDetailCapabilities();
      void refreshDistributionDetail();
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
  }, [batchRecallProgress, refreshDetailCapabilities, refreshDistributionDetail, showToast]);

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
      void refreshDetailCapabilities();
      void refreshDistributionDetail();
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
  }, [batchCancelProgress, refreshDetailCapabilities, refreshDistributionDetail, showToast]);

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

  // Polling fallback: SSE delivery above is fire-and-forget with no buffering/replay — if the
  // connection is momentarily down or reconnecting when the backend publishes a progress event,
  // that event is lost forever and this modal would otherwise hang indefinitely even though the
  // backend already finished. Poll the durable job-status endpoint as a backup.
  useEffect(() => {
    if (!distributeProgress || distributeProgress.scope !== "batch" || distributeProgress.status !== "in_progress") {
      return;
    }
    const batchId = distributeProgress.batchId;
    return startControlledCopyJobStatusPolling({
      batchId,
      action: "DISTRIBUTE",
      fetchStatus: documentApi.getControlledCopyDistributionJobStatus,
      onStatus: (status) => setDistributeProgress((current) => {
        if (!current || current.scope !== "batch" || current.batchId !== batchId) return current;
        return { ...current, processed: status.processed, total: status.total, failed: status.failed, status: status.status };
      }),
    });
  }, [distributeProgress?.batchId, distributeProgress?.scope, distributeProgress?.status]);

  useEffect(() => {
    if (distributeProgress?.status !== "completed" && distributeProgress?.status !== "completed_with_errors") return;
    const hasErrors = distributeProgress.status === "completed_with_errors";
    const scope = distributeProgress.scope;
    const batchId = distributeProgress.batchId;
    const timer = window.setTimeout(() => {
      setDistributeProgress(null);
      void refreshDetailCapabilities();
      void refreshDistributionDetail();

      if (scope === "batch") {
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
  }, [distributeProgress, refreshDetailCapabilities, refreshDistributionDetail, showToast]);

  const handleRetryAllFailedDistribution = async () => {
    if (!distributeResultModal || distributeResultModal.failed === 0) return;
    const batchId = distributeResultModal.batchId;
    const failedCount = distributeResultModal.failed;
    setDistributeResultModal((prev) => (prev ? { ...prev, isRetrying: true } : prev));
    try {
      await documentApi.retryFailedControlledCopyDistribution(batchId);
      setDistributeResultModal(null);
      setDistributeProgress({
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

  const getHttpStatus = (error: unknown) => {
    const candidate = error as any;
    return candidate?.response?.status || candidate?.status || candidate?.response?.data?.status || null;
  };

  // Sync state if controlledCopyId changes
  useEffect(() => {
    let mounted = true;

    const loadDetail = async () => {
      try {
        setIsLoadingDetail(true);
        setIsBatchParent(false);
        const preloadedCopy =
          locationState?.preloadedControlledCopy?.id === controlledCopyId
            ? locationState.preloadedControlledCopy
            : null;
        const isSnapshotPreload = isControlledCopySnapshotPreload(locationState, controlledCopyId);

        const source = preloadedCopy?.id === controlledCopyId
          ? preloadedCopy
          : await documentApi.getControlledCopyDetailById(controlledCopyId);

        if (!mounted) return;

        const mapped = normalizeControlledCopyDetail(source, controlledCopyId);
        const isBatch = Array.isArray(mapped.copyIds) && mapped.copyIds.length > 1;
        const batchId = (source as ControlledCopyDistributionBatch).id || mapped.id || controlledCopyId;
        const resolvedMapped = mapped;
        const batchCopyIds = isBatch ? (mapped.copyIds || []) : [];

        const relatedEntityId = isBatch
          ? batchId
          : resolvedMapped.id;

        setIsBatchParent(isBatch);
        setControlledCopy(resolvedMapped);

        if (!mounted || !resolvedMapped) return;
        try {
          await refreshDetailRelatedData(
            isBatch ? "Controlled Copy Distribution Batch" : "Controlled Copy",
            relatedEntityId,
            batchCopyIds,
          );
        } catch (relatedError) {
          console.warn("Failed to load controlled copy related data", relatedError);
        }

        void refreshDetailAfterSnapshot({
          enabled: isSnapshotPreload,
          fetchLive: () => documentApi.getControlledCopyDetailById(controlledCopyId),
          onSuccess: (freshDetail) => {
            if (!mounted) {
              return;
            }
            const refreshed = normalizeControlledCopyDetail(freshDetail, controlledCopyId);
            setControlledCopy(refreshed);
          },
        });
      } catch (error) {
        console.error("Failed to load controlled copy detail", error);
        if (!mounted) return;
        showToast({
          type: "error",
          title: t("controlledCopyDetail.loadFailed.title"),
          message: t("controlledCopyDetail.loadFailed.message"),
          duration: 3500,
        });
      } finally {
        if (mounted) {
          setIsLoadingDetail(false);
        }
      }
    };

    void loadDetail();
    return () => {
      mounted = false;
    };
  }, [controlledCopyId, locationState?.preloadedControlledCopy, locationState?.preloadedControlledCopySnapshot, refreshDetailRelatedData, showToast]);

  // Status workflow steps
  const getStatusSteps = () => {
    return [
      "Ready for Distribution",
      "Distributed",
      "Obsoleted",
      "Closed - Cancelled",
    ];
  };

  const statusSteps = getStatusSteps();
  const currentStepIndex = statusSteps.indexOf(controlledCopy.status);

  // Tabs configuration
  const tabs = [
    { id: "document" as TabType, label: "Document Information" },
    { id: "distribution" as TabType, label: "Distribution Information" },
    ...(evidenceRows.length > 0 || Boolean(controlledCopy.destructionType)
      ? [{ id: "evidence" as TabType, label: "Evidence" }]
      : []),
    { id: "signatures" as TabType, label: "Signatures" },
    { id: "audit" as TabType, label: "Audit Trail" },
  ];


  const handleMarkAsDestroyed = (
    formData: any,
    reason: string
  ) => {
    void formData;
    void reason;
  };

  const handleDistribute = () => {
    setIsDistributeModalOpen(true);
  };

  const handleDistributeSuccess = async (data: { username: string; password: string; reason: string; signatureToken?: string }) => {
    setIsActionLoading(true);
    try {
      const targetId = isBatchParent
        ? controlledCopy.distributionBatchId || controlledCopy.id
        : controlledCopy.id;
      setDistributeProgress({
        batchId: targetId,
        scope: isBatchParent ? "batch" : "copy",
        processed: 0,
        total: isBatchParent ? controlledCopy.copyIds?.length || 1 : 1,
        failed: 0,
        status: "in_progress",
      });
      const updated = isBatchParent
        ? (await documentApi.distributeControlledCopyBatch(controlledCopy.id, {
            distributedTo: controlledCopy.recipientName || controlledCopy.distributionList || controlledCopy.location || "",
            distributedAt: new Date().toISOString(),
            location: controlledCopy.location || "",
            comment: data.reason,
            signatureToken: data.signatureToken as string,
          })) as ControlledCopyDistributionBatch
        : await documentApi.distribute(getControlledCopyActionTargetId(controlledCopy), {
            distributedTo: controlledCopy.recipientName || controlledCopy.distributionList || controlledCopy.location || "",
            distributedAt: new Date().toISOString(),
            location: controlledCopy.location || "",
            comment: data.reason,
            signatureToken: data.signatureToken as string,
          });
      const mapped = isBatchParent
        ? normalizeControlledCopyBatchDetail(updated as ControlledCopyDistributionBatch)
        : normalizeControlledCopyDetail(updated, controlledCopy.id);
      const resolvedMapped = mapped;
      setControlledCopy(resolvedMapped);
      await refreshDetailCapabilities();
      await refreshDetailRelatedData(
        isBatchParent ? "Controlled Copy Distribution Batch" : "Controlled Copy",
        isBatchParent ? (resolvedMapped as any).distributionBatchId || resolvedMapped.id : resolvedMapped.id,
        isBatchParent ? (resolvedMapped.copyIds || controlledCopy.copyIds || []) : [],
      );
      if (!isBatchParent) {
        setDistributeProgress((current) => current?.scope === "copy" && current.batchId === targetId
          ? { ...current, processed: 1, status: "completed" }
          : current);
      }
    } catch (error) {
      console.error("Failed to distribute controlled copy", error);
      setDistributeProgress(null);
      if ([403, 409, 410].includes(getHttpStatus(error))) {
        await refreshDetailCapabilities();
        await refreshDetailRelatedData(
          isBatchParent ? "Controlled Copy Distribution Batch" : "Controlled Copy",
          isBatchParent ? (controlledCopy as any).distributionBatchId || controlledCopy.id : controlledCopy.id,
          isBatchParent ? (controlledCopy.copyIds || []) : [],
        );
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
      setIsDistributeModalOpen(false);
      setIsActionLoading(false);
    }
  };

  const handleCancelDistribution = () => {
    setIsCancelModalOpen(true);
  };

  const handleRecallDistribution = () => {
    setIsRecallFormOpen(true);
  };

  const handleRecallFormConfirm = (values: RecallControlledCopyValues) => {
    setRecallValues(values);
    setIsRecallFormOpen(false);
    setIsRecallESignModalOpen(true);
  };

  const handleCancelSuccess = async (data: { username: string; password: string; reason: string; signatureToken?: string }) => {
    setIsActionLoading(true);
    try {
      const updated = isBatchParent
        ? await documentApi.cancelControlledCopyBatch(controlledCopy.id, { reason: data.reason, signatureToken: data.signatureToken as string })
        : await documentApi.cancelControlledCopy(getControlledCopyActionTargetId(controlledCopy), { reason: data.reason, signatureToken: data.signatureToken as string });
      const mapped = isBatchParent
        ? normalizeControlledCopyBatchDetail(updated as ControlledCopyDistributionBatch)
        : normalizeControlledCopyDetail(updated, controlledCopy.id);
      const resolvedMapped = mapped;
      setControlledCopy(resolvedMapped);
      await refreshDetailCapabilities();
      await refreshDetailRelatedData(
        isBatchParent ? "Controlled Copy Distribution Batch" : "Controlled Copy",
        isBatchParent ? (resolvedMapped as any).distributionBatchId || resolvedMapped.id : resolvedMapped.id,
        isBatchParent ? (resolvedMapped.copyIds || controlledCopy.copyIds || []) : [],
      );
      if (isBatchParent) {
        // Per-copy cancel now finishes async — batch-level status is already Closed - Cancelled,
        // but child copies are still processing; the progress/result modals take over from here.
        setBatchCancelProgress({
          batchId: controlledCopy.distributionBatchId || controlledCopy.id,
          processed: 0,
          total: (updated as any)?.quantity || controlledCopy.copyIds?.length || 1,
          failed: 0,
          status: "in_progress",
        });
      } else {
        showToast({
          type: "success",
          title: "Success",
          message: `Controlled copy ${controlledCopy.controlledCopyNumber} has been cancelled and moved to Closed - Cancelled status.`,
          duration: 3500,
        });
      }
    } catch (error) {
      console.error("Failed to cancel controlled copy", error);
      if ([403, 409, 410].includes(getHttpStatus(error))) {
        await refreshDetailCapabilities();
        await refreshDetailRelatedData(
          isBatchParent ? "Controlled Copy Distribution Batch" : "Controlled Copy",
          isBatchParent ? (controlledCopy as any).distributionBatchId || controlledCopy.id : controlledCopy.id,
          isBatchParent ? (controlledCopy.copyIds || []) : [],
        );
      }
      showToast({
        type: "error",
        title: "Cancellation failed",
        message: (error as any)?.response?.data?.error?.message
          ?? (error as any)?.response?.data?.message
          ?? "Unable to cancel the controlled copy.",
        duration: 3500,
      });
    } finally {
      setIsCancelModalOpen(false);
      setIsActionLoading(false);
    }
  };

  const handleRecallSuccess = async (data: { username: string; password: string; reason: string; comment?: string; signatureToken?: string }) => {
    if (!recallValues) {
      setIsRecallESignModalOpen(false);
      return;
    }
    setIsActionLoading(true);
    try {
      const updated = isBatchParent
        ? await documentApi.recallControlledCopyBatch(controlledCopy.id, {
            recalledBy: data.username,
            recallReason: recallValues.recallReason,
            recallDate: recallValues.recallDate,
            comment: data.comment,
            signatureToken: data.signatureToken as string,
          })
        : await documentApi.recallControlledCopy(getControlledCopyActionTargetId(controlledCopy), {
            recalledBy: data.username,
            recallReason: recallValues.recallReason,
            recallDate: recallValues.recallDate,
            comment: data.comment,
            signatureToken: data.signatureToken as string,
          });
      const mapped = isBatchParent
        ? normalizeControlledCopyBatchDetail(updated as ControlledCopyDistributionBatch)
        : normalizeControlledCopyDetail(updated, controlledCopy.id);
      const resolvedMapped = mapped;
      setControlledCopy(resolvedMapped);
      await refreshDetailCapabilities();
      await refreshDetailRelatedData(
        isBatchParent ? "Controlled Copy Distribution Batch" : "Controlled Copy",
        isBatchParent ? (resolvedMapped as any).distributionBatchId || resolvedMapped.id : resolvedMapped.id,
        isBatchParent ? (resolvedMapped.copyIds || controlledCopy.copyIds || []) : [],
      );
      if (isBatchParent) {
        // Per-copy recall now finishes async — batch-level status is already Obsoleted, but
        // child copies are still processing; the progress/result modals take over from here.
        setBatchRecallProgress({
          batchId: controlledCopy.distributionBatchId || controlledCopy.id,
          processed: 0,
          total: (updated as any)?.quantity || controlledCopy.copyIds?.length || 1,
          failed: 0,
          status: "in_progress",
        });
      } else {
        showToast({
          type: "success",
          title: "Controlled Copy Recalled",
          message: "The controlled copy has been successfully recalled.",
          duration: 3500,
        });
      }
    } catch (error) {
      console.error("Failed to recall controlled copy", error);
      if ([403, 409, 410].includes(getHttpStatus(error))) {
        await refreshDetailCapabilities();
        await refreshDetailRelatedData(
          isBatchParent ? "Controlled Copy Distribution Batch" : "Controlled Copy",
          isBatchParent ? (controlledCopy as any).distributionBatchId || controlledCopy.id : controlledCopy.id,
          isBatchParent ? (controlledCopy.copyIds || []) : [],
        );
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
      setRecallValues(null);
      setIsActionLoading(false);
    }
  };

  const handleReportLostDamaged = () => {
    setIsReportLostDamagedModalOpen(true);
  };

  const handleReportLostDamagedConfirm = (type: "Lost" | "Damaged") => {
    
    setIsReportLostDamagedModalOpen(false);
    
    
    setIsNavigating(true);
    // DestroyControlledCopyView only supports a single controlled-copy record. For a singleton
    // batch (exactly one distributed copy), controlledCopy.id here is the parent BATCH id — the
    // /action-capabilities and reportLostDamaged endpoints require the child copy id instead.
    navigate(`${ROUTES.DOCUMENTS.CONTROLLED_COPIES.DESTROY(getControlledCopyActionTargetId(controlledCopy))}?type=${type}`, {
      state: buildControlledCopyRouteState({ from: location.state?.from, type, ...buildControlledCopySnapshotState(controlledCopy) }),
    });
  };

  const handleReissue = () => {
    setIsReissueModalOpen(true);
  };

  const handleReissueConfirm = async (data: { username: string; password: string; reason: string; signatureToken?: string }) => {
    setIsActionLoading(true);
    try {
      const created = await documentApi.replaceControlledCopy(getControlledCopyActionTargetId(controlledCopy), {
        reason: data.reason,
        signatureToken: data.signatureToken as string,
      }) as ControlledCopy;
      showToast({
        type: "success",
        title: t("controlledCopyDetail.reissue.successTitle"),
        message: t("controlledCopyDetail.reissue.successMessage", { number: created?.controlledCopyNumber || "" }),
        duration: 4500,
      });
      await refreshDetailCapabilities();
      await refreshDetailRelatedData("Controlled Copy", controlledCopy.id);
    } catch (error) {
      console.error("Failed to reissue controlled copy", error);
      if ([403, 409, 410].includes(getHttpStatus(error))) {
        await refreshDetailCapabilities();
      }
      const backendMessage =
        (error as any)?.response?.data?.error?.message || (error as any)?.response?.data?.message;
      showToast({
        type: "error",
        title: t("controlledCopyDetail.reissue.failedTitle"),
        message: backendMessage || t("controlledCopyDetail.reissue.failedMessage"),
        duration: 3500,
      });
    } finally {
      setIsReissueModalOpen(false);
      setIsActionLoading(false);
    }
  };

  if (isLoadingDetail || isActionLoading) {
    return <FullPageLoading text="Loading..." />;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <PageHeader
          title={isBatchParent ? "Controlled Copy Batch Details" : "Controlled Copy Details"}
          breadcrumbItems={controlledCopyDetail(navigate, location.state?.from)}
          actions={
            <>
              <Button
                onClick={() => {
                  setIsNavigating(true);
                  onBack();
                }}
                variant="outline-emerald"
                size="sm"
                className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
              >
                Back
              </Button>
              {isBatchParent && !isCapabilityLoading && cancelDecision?.allowed && (
                <Button
                  onClick={handleCancelDistribution}
                  variant="outline-emerald"
                  size="sm"
                  className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
                  disabled={isCapabilityLoading}
                  title={isCapabilityLoading ? "Capability information is still loading." : ""}
                >
                  Cancel Batch Distribution
                </Button>
              )}
              {!isBatchParent && !isCapabilityLoading && cancelDecision?.allowed && (
                <Button
                  onClick={handleCancelDistribution}
                  variant="outline-emerald"
                  size="sm"
                  className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
                  disabled={isCapabilityLoading}
                  title={isCapabilityLoading ? "Capability information is still loading." : ""}
                >
                  Cancel Request
                </Button>
              )}
              {!isCapabilityLoading && distributeDecision?.allowed && (
                <Button
                  onClick={handleDistribute}
                  variant="outline-emerald"
                  size="sm"
                  className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation shadow-sm"
                  disabled={isCapabilityLoading}
                  title={isCapabilityLoading ? "Capability information is still loading." : ""}
                >
                  {isBatchParent ? "Distribute Batch" : "Distribute"}
                </Button>
              )}
              {!isCapabilityLoading && recallDecision?.allowed && (
                <Button
                  onClick={handleRecallDistribution}
                  variant="outline-emerald"
                  size="sm"
                  className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation shadow-sm"
                  disabled={isCapabilityLoading}
                  title={isCapabilityLoading ? "Capability information is still loading." : ""}
                >
                  {isBatchParent ? "Recall Batch Immediately" : "Recall Immediately"}
                </Button>
              )}
              {!isBatchParent && !isCapabilityLoading && reportLostDamagedDecision?.allowed && (
                <Button
                  onClick={handleReportLostDamaged}
                  variant="outline-emerald"
                  size="sm"
                  className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation shadow-sm"
                  disabled={isCapabilityLoading}
                  title={isCapabilityLoading ? "Capability information is still loading." : ""}
                >
                  Report Lost/Damaged
                </Button>
              )}
              {!isBatchParent && !isCapabilityLoading && reissueDecision?.allowed && (
                <Button
                  onClick={handleReissue}
                  variant="outline-emerald"
                  size="sm"
                  className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation shadow-sm"
                  disabled={isCapabilityLoading}
                  title={isCapabilityLoading ? "Capability information is still loading." : ""}
                >
                  Reissue Copy
                </Button>
              )}
            </>
          }
        />
      </div>

      {/* Status Stepper */}
      <WorkflowStepper
        steps={statusSteps}
        currentStepIndex={currentStepIndex}
        terminalProgressStep={terminalProgressStep}
      />


      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabType)} />

        {/* Tab Content */}
        <div className="p-4 md:p-5">
          <div className={cn(activeTab !== "document" && "hidden")}>
            <DocumentInformationTab
              controlledCopy={controlledCopy}
              isBatchParent={isBatchParent}
              onNavigateToLinkedCopy={(id) => navigate(ROUTES.DOCUMENTS.CONTROLLED_COPIES.DETAIL(id))}
            />
          </div>
          <div className={cn(activeTab !== "distribution" && "hidden")}>
            <DistributionInformationTab
              controlledCopy={controlledCopy}
            />
          </div>
          <div className={cn(activeTab !== "signatures" && "hidden")}>
            <SignaturesTab
              controlledCopy={controlledCopy}
              records={signatureRows}
              auditTrailRecords={auditTrailRows as any}
            />
          </div>
          <div className={cn(activeTab !== "audit" && "hidden")}>
            {isBatchParent ? (
              <AuditTrailTab
                records={auditTrailRows as any}
                entityType="Controlled Copy Distribution Batch"
                emptyMessage="No audit records available for this batch."
              />
            ) : (
              <AuditTrailTab
                records={auditTrailRows as any}
                entityId={controlledCopy.id}
                entityType="Controlled Copy"
              />
            )}
          </div>
          {(evidenceRows.length > 0 || Boolean(controlledCopy.destructionType)) && (
            <div className={cn(activeTab !== "evidence" && "hidden")}>
              <EvidenceTab
                controlledCopyId={controlledCopy.id}
                evidence={evidenceRows}
                reportType={controlledCopy.destructionType}
              />
            </div>
          )}
        </div>
      </div>

      {/* Footer Action Buttons */}
      <div className="flex items-center gap-2 md:gap-3 flex-wrap">
        <Button
          onClick={() => {
            setIsNavigating(true);
            onBack();
          }}
          variant="outline-emerald"
          size="sm"
          className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
        >
          Back
        </Button>
        {isBatchParent && !isCapabilityLoading && cancelDecision?.allowed && (
          <Button
            onClick={handleCancelDistribution}
            variant="outline-emerald"
            size="sm"
            className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
            disabled={isCapabilityLoading}
            title={isCapabilityLoading ? "Capability information is still loading." : ""}
          >
            Cancel Batch Distribution
          </Button>
        )}
                {!isBatchParent && !isCapabilityLoading && cancelDecision?.allowed && (
          <Button
            onClick={handleCancelDistribution}
            variant="outline-emerald"
            size="sm"
            className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
            disabled={isCapabilityLoading}
            title={isCapabilityLoading ? "Capability information is still loading." : ""}
          >
            Cancel Request
          </Button>
        )}
        {!isCapabilityLoading && distributeDecision?.allowed && (
          <Button
            onClick={handleDistribute}
            variant="outline-emerald"
            size="sm"
            className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation shadow-sm"
            disabled={isCapabilityLoading}
            title={isCapabilityLoading ? "Capability information is still loading." : ""}
          >
            {isBatchParent ? "Distribute Batch" : "Distribute"}
          </Button>
        )}
        {!isCapabilityLoading && recallDecision?.allowed && (
          <Button
            onClick={handleRecallDistribution}
            variant="outline-emerald"
            size="sm"
            className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation shadow-sm"
            disabled={isCapabilityLoading}
            title={isCapabilityLoading ? "Capability information is still loading." : ""}
          >
            {isBatchParent ? "Recall Batch Immediately" : "Recall Immediately"}
          </Button>
        )}
        {!isBatchParent && !isCapabilityLoading && reportLostDamagedDecision?.allowed && (
          <Button
            onClick={handleReportLostDamaged}
            variant="outline-emerald"
            size="sm"
            className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation shadow-sm"
            disabled={isCapabilityLoading}
            title={isCapabilityLoading ? "Capability information is still loading." : ""}
          >
            Report Lost/Damaged
          </Button>
        )}
        {!isBatchParent && !isCapabilityLoading && reissueDecision?.allowed && (
          <Button
            onClick={handleReissue}
            variant="outline-emerald"
            size="sm"
            className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation shadow-sm"
            disabled={isCapabilityLoading}
            title={isCapabilityLoading ? "Capability information is still loading." : ""}
          >
            Reissue Copy
          </Button>
        )}
      </div>

      {/* E-Signature Modal for Distribute */}
      <ESignatureModal
        isOpen={isDistributeModalOpen}
        onClose={() => setIsDistributeModalOpen(false)}
        onConfirm={handleDistributeSuccess}
        transactionType="distribute"
        targetDetails={{
          code: controlledCopy.controlledCopyNumber,
          title: controlledCopy.name,
          revision: controlledCopy.revisionNumber 
        }}
      />

      <DistributeBatchProgressModal
        isOpen={distributeProgress !== null}
        processed={distributeProgress?.processed ?? 0}
        total={distributeProgress?.total ?? 0}
        failed={distributeProgress?.failed ?? 0}
        status={distributeProgress?.status ?? "in_progress"}
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

      {/* E-Signature Modal for Cancel Distribution */}
      <ESignatureModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleCancelSuccess}
        transactionType="cancel-distribution"
        targetDetails={{
          code: controlledCopy.controlledCopyNumber,
          title: controlledCopy.name,
          revision: controlledCopy.revisionNumber 
        }}
      />

      <RecallControlledCopyModal
        isOpen={isRecallFormOpen}
        onClose={() => {
          setIsRecallFormOpen(false);
          setRecallValues(null);
        }}
        onConfirm={handleRecallFormConfirm}
        controlledCopyNumber={controlledCopy.controlledCopyNumber}
        isBatch={isBatchParent}
      />

      <ESignatureModal
        isOpen={isRecallESignModalOpen}
        onClose={() => {
          setIsRecallESignModalOpen(false);
          setRecallValues(null);
        }}
        onConfirm={handleRecallSuccess}
        transactionType="recall-distribution"
        targetDetails={{
          code: controlledCopy.controlledCopyNumber,
          title: controlledCopy.name,
          revision: controlledCopy.revisionNumber
        }}
      />

      {/* Destruction Type Selection Modal */}
      <DestructionTypeSelectionModal
        isOpen={isReportLostDamagedModalOpen}
        onClose={() => setIsReportLostDamagedModalOpen(false)}
        onConfirm={handleReportLostDamagedConfirm}
        allowedTypes={[
          "Damaged" as const,
          "Lost" as const,
        ]}
      />

      <ESignatureModal
        isOpen={isReissueModalOpen}
        onClose={() => setIsReissueModalOpen(false)}
        onConfirm={handleReissueConfirm}
        actionTitle="Reissue Replacement Controlled Copy"
        targetDetails={{
          code: controlledCopy.controlledCopyNumber,
          title: controlledCopy.name,
          revision: controlledCopy.revisionNumber
        }}
      />

      {(isNavigating || isLoadingDetail) && <FullPageLoading text="Loading..." />}
    </div>
  );
};
