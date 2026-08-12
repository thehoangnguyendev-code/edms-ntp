import type { ControlledCopy, ControlledCopyDistributionBatch } from "./types";
import { formatControlledCopyNumber } from "./display";
import { formatDocumentDisplayLabel } from "../shared/documentDisplay";
import { normalizeControlledCopyStatusLabel } from "./status";

const firstText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

export const splitDateTime = (value?: string | null) => {
  const text = firstText(value);
  if (!text) {
    return { date: "", time: "" };
  }

  // Backend sends "dd/MM/yyyy HH:mm:ss" — parse it explicitly instead of via
  // `new Date(text)`, which treats slash-separated strings as MM/DD/YYYY and
  // silently swaps day/month whenever the day is <= 12.
  const dmyMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})[,\s]+(\d{2}):(\d{2}):(\d{2})$/);
  if (dmyMatch) {
    const [, d, m, y, hh, mm, ss] = dmyMatch;
    return { date: `${d}/${m}/${y}`, time: `${hh}:${mm}:${ss}` };
  }

  const asDate = new Date(text);
  if (Number.isNaN(asDate.getTime())) {
    return { date: text, time: "" };
  }

  const date = `${String(asDate.getDate()).padStart(2, "0")}/${String(asDate.getMonth() + 1).padStart(2, "0")}/${asDate.getFullYear()}`;
  const time = `${String(asDate.getHours()).padStart(2, "0")}:${String(asDate.getMinutes()).padStart(2, "0")}:${String(asDate.getSeconds()).padStart(2, "0")}`;
  return { date, time };
};

export const stripControlledCopySuffix = (value?: string | null) => {
  const text = firstText(value);
  if (!text) {
    return "";
  }
  return text.replace(/\s*-\s*Controlled Copy\s+\d+\s*$/i, "").trim();
};

const buildDocumentName = (payload: any) =>
  firstText(payload?.documentName, payload?.documentTitle, payload?.name);

const buildRevisionNumber = (payload: any) =>
  firstText(payload?.revisionNumber, payload?.version);

const buildRevisionName = (documentName: string, revisionNumber: string, payload: any) =>
  firstText(payload?.revisionName, [documentName, revisionNumber].filter(Boolean).join("_"));

export const normalizeControlledCopyRecord = (payload: any, fallbackId = ""): ControlledCopy => {
  const documentName = buildDocumentName(payload);
  const revisionNumber = buildRevisionNumber(payload);
  const revisionName = buildRevisionName(documentName, revisionNumber, payload);
  const controlledCopyNumber = formatControlledCopyNumber(
    payload?.controlledCopyNumber || payload?.controlNumber || payload?.documentNumber || "",
  );
  const createdAt = firstText(payload?.createdAt, payload?.requestedAt, payload?.created);
  const created = splitDateTime(createdAt);
  const documentNumber = firstText(payload?.documentNumber, payload?.document);

  return {
    id: String(payload?.id || fallbackId),
    controlledCopyNumber,
    createdDate: firstText(payload?.createdDate, created.date),
    createdTime: firstText(payload?.createdTime, created.time),
    openedBy: firstText(payload?.openedBy, payload?.requestedBy, payload?.createdBy),
    name: firstText(payload?.name, documentName, revisionName),
    status: normalizeControlledCopyStatusLabel(payload?.status, payload?.statusInfo),
    validUntil: firstText(payload?.validUntil),
    documentNumber,
    distributionList: firstText(payload?.distributionList),
    distributionRecipients: firstText(payload?.distributionRecipients, payload?.externalRecipients, payload?.distributionList),
    statusCode: firstText(payload?.statusCode, payload?.statusInfo?.id) || undefined,
    statusInfo: payload?.statusInfo
      ? {
          id: firstText(payload?.statusCode, payload?.statusInfo?.id) || undefined,
          name: normalizeControlledCopyStatusLabel(payload?.status, payload?.statusInfo),
        }
      : undefined,
    distributionMode: firstText(payload?.distributionMode) || undefined,
    distributionScope: firstText(payload?.distributionScope) || undefined,
    externalRecipients: firstText(payload?.externalRecipients) || undefined,
    revisionNumber,
    revisionName,
    documentName,
    location: firstText(payload?.location) || undefined,
    locationCode: firstText(payload?.locationCode) || undefined,
    businessUnit: firstText(payload?.businessUnit) || undefined,
    department: firstText(payload?.department) || undefined,
    reason: firstText(payload?.reason, payload?.requestReason) || undefined,
    documentDisplayLabel: firstText(
      payload?.documentDisplayLabel,
      formatDocumentDisplayLabel(documentNumber, documentName || payload?.name),
    ),
    distributedDate: firstText(payload?.distributedDate) || undefined,
    distributedBy: firstText(payload?.distributedBy) || undefined,
    recipientName: firstText(payload?.recipientName) || undefined,
    distributionComment: firstText(payload?.distributionComment) || undefined,
    recipientSignature: firstText(payload?.recipientSignature) || undefined,
    recipientDate: firstText(payload?.recipientDate) || undefined,
    recallDate: firstText(payload?.recallDate) || undefined,
    recalledBy: firstText(payload?.recalledBy) || undefined,
    recallReason: firstText(payload?.recallReason) || undefined,
    destroyedBy: firstText(payload?.destroyedBy) || undefined,
    destroyedDate: firstText(payload?.destroyedDate) || undefined,
    destroyReason: firstText(payload?.destroyReason) || undefined,
    obsoleteReason: firstText(payload?.obsoleteReason) || undefined,
    destructionMethod: firstText(payload?.destructionMethod) || undefined,
    destructionType: firstText(payload?.destructionType) || undefined,
    witnessedBy: firstText(payload?.witnessedBy) || undefined,
    evidenceFiles: payload?.evidenceFiles || [],
    expiryDate: firstText(payload?.expiryDate) || undefined,
    hasExpiryDate: typeof payload?.hasExpiryDate === "boolean" ? payload.hasExpiryDate : undefined,
    expiryReminderSentAt: firstText(payload?.expiryReminderSentAt) || undefined,
    controlNumber: controlledCopyNumber,
    documentId: firstText(payload?.documentId, payload?.document) || undefined,
    sourceRevisionId: firstText(payload?.sourceRevisionId, payload?.revisionId) || undefined,
    copyNumber: Number(payload?.copyNumber || 0),
    totalCopies: Number(payload?.totalCopies || 0),
    requestDate: firstText(payload?.requestDate, payload?.requestedAt) || undefined,
    requestedBy: firstText(payload?.requestedBy) || undefined,
    currentStage: firstText(payload?.currentStage) as ControlledCopy["currentStage"],
    effectiveDate: firstText(payload?.effectiveDate) || undefined,
    printedDate: firstText(payload?.printedDate) || undefined,
    printedBy: firstText(payload?.printedBy) || undefined,
    distributionBatchId: firstText(payload?.distributionBatchId, payload?.batchId) || undefined,
    distributionBatchNumber: firstText(payload?.distributionBatchNumber, payload?.batchNumber) || undefined,
    replacedControlledCopyId: firstText(payload?.replacedControlledCopyId) || undefined,
    replacedControlledCopyNumber: firstText(payload?.replacedControlledCopyNumber) || undefined,
    replacementControlledCopyId: firstText(payload?.replacementControlledCopyId) || undefined,
    replacementControlledCopyNumber: firstText(payload?.replacementControlledCopyNumber) || undefined,
  };
};

export const normalizeControlledCopyBatch = (batch: ControlledCopyDistributionBatch): ControlledCopy => {
  const documentName = stripControlledCopySuffix(batch.documentTitle || batch.documentDisplayLabel || batch.documentNumber);
  const revisionNumber = firstText(batch.revisionNumber);
  const created = splitDateTime(batch.requestedAt);
  const controlledCopyName = firstText(
    batch.controlledCopyName,
    [documentName, revisionNumber].filter(Boolean).join(" - "),
  );
  const isSingleton = Number(batch.quantity || 0) <= 1;
  const controlledCopyNumber = formatControlledCopyNumber(
    stripControlledCopySuffix(isSingleton ? batch.controlledCopyNumber : batch.batchNumber),
  );

  return {
    id: batch.id,
    controlledCopyNumber,
    createdDate: firstText(created.date),
    createdTime: firstText(created.time),
    openedBy: firstText(batch.requestedBy),
    name: controlledCopyName || documentName || batch.documentDisplayLabel || batch.documentNumber || "",
    status: normalizeControlledCopyStatusLabel(batch.status, batch.statusInfo),
    statusCode: firstText(batch.statusCode, batch.statusInfo?.id) || undefined,
    statusInfo: batch.statusInfo
      ? {
          id: firstText(batch.statusCode, batch.statusInfo.id) || undefined,
          name: normalizeControlledCopyStatusLabel(batch.status, batch.statusInfo),
        }
      : undefined,
    validUntil: firstText(batch.validUntil),
    expiryDate: firstText(batch.expiryDate),
    hasExpiryDate: typeof batch.hasExpiryDate === "boolean" ? batch.hasExpiryDate : undefined,
    documentNumber: firstText(batch.documentNumber),
    documentId: firstText(batch.documentId) || undefined,
    documentDisplayLabel: firstText(
      batch.documentDisplayLabel,
      formatDocumentDisplayLabel(batch.documentNumber, batch.documentTitle),
    ),
    distributionList: firstText(batch.distributionList),
    distributionRecipients: firstText(batch.distributionRecipients, batch.externalRecipients, batch.distributionList),
    distributionMode: firstText((batch as any).distributionMode) || undefined,
    distributionScope: firstText(batch.distributionScope) || undefined,
    externalRecipients: firstText(batch.externalRecipients) || undefined,
    revisionNumber,
    sourceRevisionId: firstText(batch.sourceRevisionId) || undefined,
    revisionName: controlledCopyName || documentName || batch.documentTitle || "",
    documentName,
    location: firstText(batch.location) || "",
    locationCode: firstText(batch.locationCode) || "",
    businessUnit: "",
    department: "",
    reason: "",
    distributedDate: firstText(batch.distributedAt),
    distributedBy: firstText(batch.distributedBy),
    recallDate: firstText(batch.recallDate) || undefined,
    recallReason: firstText(batch.recallReason) || undefined,
    recipientName: firstText(batch.distributionRecipients, batch.externalRecipients, batch.distributionList),
    distributionComment: "",
    controlNumber: controlledCopyNumber,
    copyNumber: 1,
    totalCopies: batch.quantity,
    requestDate: firstText(batch.requestedAt),
    requestedBy: firstText(batch.requestedBy),
    currentStage: firstText(batch.currentStage) as ControlledCopy["currentStage"],
    effectiveDate: "",
    printedDate: "",
    printedBy: "",
    distributionBatchId: batch.id,
    distributionBatchNumber: batch.batchNumber,
    copyIds: batch.copyIds,
  } as ControlledCopy & { copyIds?: string[] };
};

export const normalizeControlledCopyDetail = (
  payload: any,
  fallbackId = "",
): ControlledCopy & { copyIds?: string[] } => {
  if (Array.isArray(payload?.copyIds) && payload.copyIds.length > 1) {
    return normalizeControlledCopyBatchDetail(payload as ControlledCopyDistributionBatch);
  }

  const mapped = normalizeControlledCopyRecord(payload, fallbackId) as ControlledCopy & { copyIds?: string[] };
  mapped.status = normalizeControlledCopyStatusLabel(payload?.status || mapped.status, payload?.statusInfo || mapped.statusInfo) as any;
  return mapped;
};

export const normalizeControlledCopyBatchDetail = (
  batch: ControlledCopyDistributionBatch,
): ControlledCopy & { copyIds?: string[] } => {
  const mapped = normalizeControlledCopyBatch(batch) as ControlledCopy & { copyIds?: string[] };
  mapped.status = normalizeControlledCopyStatusLabel(batch.status || mapped.status, batch.statusInfo || mapped.statusInfo) as any;
  return mapped;
};

export const mergeControlledCopyAuditTrailRows = (...collections: any[][]) => {
  const merged = collections.flat().filter(Boolean);
  const unique = new Map<string, any>();

  merged.forEach((row) => {
    const key = String(
      row?.id ||
        row?.auditId ||
        `${row?.entityId || ""}-${row?.timestamp || ""}-${row?.action || ""}-${row?.comment || ""}`,
    );
    if (!unique.has(key)) {
      unique.set(key, row);
    }
  });

  return Array.from(unique.values()).sort((left, right) => {
    const leftTime = left?.timestamp ? new Date(left.timestamp).getTime() : 0;
    const rightTime = right?.timestamp ? new Date(right.timestamp).getTime() : 0;
    return leftTime - rightTime;
  });
};
