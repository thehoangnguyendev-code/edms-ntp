import { api } from './client';

/**
 * A row in the unified Expiry Duration Policy. Every Controlled Copy always has an expiry —
 * resolved from the most specific active row matching its document type/department, falling back
 * to the mandatory "Global Default" row (documentTypeId = departmentId = null, isSystem = true,
 * always present, cannot be deleted, scope cannot be changed).
 */
export type ControlledCopyExpiryDurationUnit = 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS';

export interface ControlledCopyExpiryLimit {
  id: string;
  documentTypeId?: string | null;
  documentTypeName?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  durationValue: number;
  durationUnit: ControlledCopyExpiryDurationUnit;
  active: boolean;
  isSystem: boolean;
}

export interface ControlledCopyExpiryLimitInput {
  documentTypeId?: string | null;
  departmentId?: string | null;
  durationValue: number;
  durationUnit: ControlledCopyExpiryDurationUnit;
  active?: boolean;
  signatureToken?: string;
  reason?: string;
}

/**
 * One row of the desired end-state of the Expiry Duration Policy, saved as part of the whole
 * Controlled Copies Policy (one "Save Changes", one e-signature, one consolidated Audit Trail
 * entry) -- not the standalone, per-row instant-save-with-its-own-signature endpoints above, which
 * this screen no longer calls. `id` absent/empty means a new rule; the mandatory "Global Default"
 * row must always be included (its own scope can't be changed, only its duration).
 */
export interface ControlledCopyExpiryLimitDraft {
  id?: string | null;
  documentTypeId?: string | null;
  departmentId?: string | null;
  durationValue: number;
  durationUnit: ControlledCopyExpiryDurationUnit;
  active?: boolean;
}

/**
 * Admin-defined placeholder field (e.g. "Recipient Department") that DCO fills in free-text when
 * distributing a Controlled Copy — merged into the {{fieldKey}} placeholder in the cover/header/
 * footer at Distribute time, alongside the built-in {{copyNo}}/{{distributionList}}.
 */
export interface ControlledCopyPlaceholderField {
  id: string;
  fieldKey: string;
  label: string;
  description?: string | null;
  active: boolean;
}

export interface ControlledCopyPlaceholderFieldInput {
  fieldKey?: string;
  label: string;
  description?: string | null;
  active?: boolean;
  signatureToken?: string;
  reason?: string;
}

export interface ControlledCopyPolicyDistributionSecurity {
  allowEmailDistribution: boolean;
  allowPortalView: boolean;
  allowDownload: boolean;
  allowPrint: boolean;
  downloadOnce: boolean;
  printOnce: boolean;
  watermarkEnabled: boolean;
  watermarkCopyNumber: boolean;
  watermarkRecipient: boolean;
  watermarkDistributedDate: boolean;
  watermarkExpiryDate: boolean;
  /** Longest an external recipient may keep a copy open before the viewer locks (5..480 minutes). */
  previewSessionMinutes: number;
}

export interface ControlledCopyMarkingPreviewRequest {
  templateId?: string;
  layout: 'portrait' | 'landscape';
  pageKind: 'COVER' | 'BODY';
  scenario: 'ISSUED' | 'OBSOLETED' | 'CLOSED_CANCELLED';
  reason?: string;
  distributionSecurity: ControlledCopyPolicyDistributionSecurity;
  marking: ControlledCopyPolicyMarking;
  statusMarking: Record<ControlledCopyStatusMarkingKey, ControlledCopyStatusMarking>;
}

export interface ControlledCopyMarkingPreview {
  imageBase64: string;
  pageWidthPt: number;
  pageHeightPt: number;
  /** Where each mark was drawn (points, origin bottom-left). Watermark boxes are unrotated, rotated by `angle` about their centre. */
  marks: { layer: string; kind: 'STAMP' | 'WATERMARK'; x: number; y: number; width: number; height: number; angle: number; adjusted: boolean }[];
  warnings: { code: string; message: string }[];
  note?: string | null;
}

/**
 * Where a stamp/watermark is drawn on some pages, as fractions of the page (0 = left/top edge, 1 = right/bottom edge) so the
 * same rule works for any paper size. `pages` is "FIRST" (cover page), "OTHERS" (page 2 onward), "ALL", or an explicit list
 * like "3,5-7,LAST". Missing position fields fall back to the marking's ordinary corner/centre defaults.
 */
/** Bundled fonts a stamp/watermark may use; must match the families the server can render (ControlledCopyPdfMarkingService). */
export type MarkingFontFamily = 'NOTO_SANS' | 'NOTO_SERIF' | 'ROBOTO_MONO' | 'OSWALD';

export interface MarkingPlacementRule {
  pages: 'ALL' | 'FIRST' | 'OTHERS' | string;
  stampX?: number | null;
  stampY?: number | null;
  stampWidthPercent?: number | null;
  watermarkX?: number | null;
  watermarkY?: number | null;
  watermarkScalePercent?: number | null;
  watermarkAngleDegrees?: number | null;
}

export interface ControlledCopyPolicyRecall {
  allowManualRecall: boolean;
  allowReportLostDamaged: boolean;
  allowReplacementForLostDamaged: boolean;
}

/**
 * When redirectDeliveryToDco is on, the designated DCO (dcoRecipientUserId) receives the
 * printable link (single distribute) or a ZIP of all copies (batch distribute) instead of the
 * original requester(s) — for recipients without a computer/phone to view the copy themselves.
 * Requesters instead get a "your copy was distributed" notification email with no link/attachment.
 */
export interface ControlledCopyPolicyDelivery {
  redirectDeliveryToDco: boolean;
  dcoRecipientUserId?: string | null;
  dcoRecipientName?: string | null;
  dcoRecipientEmail?: string | null;
  /** False when redirectDeliveryToDco is on but the assigned user no longer holds the required permission. */
  dcoRecipientEligible?: boolean;
}

/** A user eligible to be selected as the DCO delivery recipient — holds the dedicated
 * "Receive Controlled Copies as DCO" permission (no hardcoded role/access-profile name). */
export interface ControlledCopyDcoEligibleUser {
  id: string;
  fullName: string;
  email?: string | null;
}

/** Stamp (framed box) and watermark (diagonal text) burned into every issued controlled copy PDF. The server validates every value. */
export interface ControlledCopyPolicyMarking {
  stampEnabled: boolean;
  stampText: string;
  stampColor: string;
  stampPosition: 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT';
  /** Distance of the stamp from the page edges, in millimetres. */
  stampMarginMm: number;
  stampSize: 'SMALL' | 'MEDIUM' | 'LARGE';
  stampOpacityPercent: number;
  stampPages: 'ALL' | 'FIRST';
  stampShowCopyNumber: boolean;
  stampShowRecipient: boolean;
  stampShowDistributedDate: boolean;
  stampShowExpiryDate: boolean;
  stampFontFamily: MarkingFontFamily;
  watermarkText: string;
  watermarkColor: string;
  watermarkOpacityPercent: number;
  watermarkAngleDegrees: number;
  watermarkPages: 'ALL' | 'FIRST';
  /** BEHIND keeps the document text crisp; ABOVE is always fully visible. */
  watermarkLayer: 'BEHIND' | 'ABOVE';
  watermarkFontFamily: MarkingFontFamily;
  /** Per-page drag-and-drop placement; overrides the corner/centre fields above for pages it covers. */
  placements?: MarkingPlacementRule[];
}

/** Stamp and watermark shown on the Document tab of a copy that is Obsoleted or Closed - Cancelled (one object per status). */
export interface ControlledCopyStatusMarking {
  watermarkEnabled: boolean;
  watermarkLayer: 'BEHIND' | 'ABOVE';
  /** Blank means the automatic text (for an obsoleted copy: the reason it was withdrawn). */
  watermarkText: string;
  watermarkColor: string;
  watermarkOpacityPercent: number;
  watermarkAngleDegrees: number;
  watermarkFontFamily: MarkingFontFamily;
  /** Whether the withdrawal/cancellation date is added as a second watermark line. */
  watermarkShowDate: boolean;
  watermarkPages: 'ALL' | 'FIRST';
  stampEnabled: boolean;
  stampText: string;
  stampColor: string;
  stampPosition: 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT';
  stampMarginMm: number;
  stampSize: 'SMALL' | 'MEDIUM' | 'LARGE';
  stampOpacityPercent: number;
  stampShowDate: boolean;
  stampFontFamily: MarkingFontFamily;
  stampPages: 'ALL' | 'FIRST';
  /** Per-page drag-and-drop placement; overrides the corner/centre fields above for pages it covers. */
  placements?: MarkingPlacementRule[];
  /** Uncontrolled Copy watermark only: whether "Issued to: {recipient}" is drawn. Unused by Controlled Copy's per-status marking. */
  watermarkShowRecipient?: boolean;
  /** Uncontrolled Copy watermark only: whether "Issued: {timestamp}" is drawn. Unused by Controlled Copy's per-status marking. */
  watermarkShowIssuedDate?: boolean;
  /** Uncontrolled Copy stamp only: whether the copy number line is drawn. Unused by Controlled Copy's per-status marking. */
  stampShowCopyNumber?: boolean;
}

export type ControlledCopyStatusMarkingKey = 'OBSOLETED' | 'CLOSED_CANCELLED';

export interface ControlledCopyPolicy {
  distributionSecurity: ControlledCopyPolicyDistributionSecurity;
  recallLostDamaged: ControlledCopyPolicyRecall;
  delivery: ControlledCopyPolicyDelivery;
  marking?: ControlledCopyPolicyMarking;
  statusMarking?: Partial<Record<ControlledCopyStatusMarkingKey, ControlledCopyStatusMarking>>;
  /** Present on the GET response (current rules) and sent back on save (desired end-state). */
  expiryLimits?: ControlledCopyExpiryLimit[] | ControlledCopyExpiryLimitDraft[];
}

export const controlledCopyPolicyApi = {
  getPolicy: async (): Promise<ControlledCopyPolicy> => {
    const response = await api.get<ControlledCopyPolicy>('/documents/administration/controlled-copies-policy');
    return response.data;
  },

  /** The server draws the DRAFT marks on a page of a Publishing Template; nothing is saved. */
  previewMarking: async (payload: ControlledCopyMarkingPreviewRequest): Promise<ControlledCopyMarkingPreview> => {
    const response = await api.post<ControlledCopyMarkingPreview>('/documents/administration/controlled-copies-policy/marking-preview', payload);
    return response.data;
  },

  savePolicy: async (payload: ControlledCopyPolicy, sig?: { signatureToken: string; reason?: string }): Promise<ControlledCopyPolicy> => {
    const response = await api.put<ControlledCopyPolicy>('/documents/administration/controlled-copies-policy', { ...payload, ...sig });
    return response.data;
  },

  getDcoEligibleUsers: async (): Promise<ControlledCopyDcoEligibleUser[]> => {
    const response = await api.get<ControlledCopyDcoEligibleUser[]>('/documents/administration/controlled-copies-policy/dco-eligible-users');
    return response.data;
  },

  listExpiryLimits: async (): Promise<ControlledCopyExpiryLimit[]> => {
    const response = await api.get<ControlledCopyExpiryLimit[]>('/documents/administration/controlled-copies-policy/expiry-limits');
    return response.data;
  },

  createExpiryLimit: async (payload: ControlledCopyExpiryLimitInput): Promise<ControlledCopyExpiryLimit> => {
    const response = await api.post<ControlledCopyExpiryLimit>('/documents/administration/controlled-copies-policy/expiry-limits', payload);
    return response.data;
  },

  updateExpiryLimit: async (id: string, payload: ControlledCopyExpiryLimitInput): Promise<ControlledCopyExpiryLimit> => {
    const response = await api.put<ControlledCopyExpiryLimit>(`/documents/administration/controlled-copies-policy/expiry-limits/${id}`, payload);
    return response.data;
  },

  deleteExpiryLimit: async (id: string, sig: { signatureToken: string; reason?: string }): Promise<void> => {
    await api.delete(`/documents/administration/controlled-copies-policy/expiry-limits/${id}`, { data: sig });
  },

  listPlaceholderFields: async (): Promise<ControlledCopyPlaceholderField[]> => {
    const response = await api.get<ControlledCopyPlaceholderField[]>('/documents/administration/controlled-copies-policy/placeholder-fields');
    return response.data;
  },

  /** Keys the server fills in itself for every controlled copy (lower case). */
  listReservedPlaceholderKeys: async (): Promise<string[]> => {
    const response = await api.get<string[]>('/documents/administration/controlled-copies-policy/placeholder-fields/reserved-keys');
    return response.data;
  },

  createPlaceholderField: async (payload: ControlledCopyPlaceholderFieldInput): Promise<ControlledCopyPlaceholderField> => {
    const response = await api.post<ControlledCopyPlaceholderField>('/documents/administration/controlled-copies-policy/placeholder-fields', payload);
    return response.data;
  },

  deletePlaceholderField: async (id: string): Promise<void> => {
    await api.delete(`/documents/administration/controlled-copies-policy/placeholder-fields/${id}`);
  },
};
