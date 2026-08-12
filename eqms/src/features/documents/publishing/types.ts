import type { RevisionDetailResponse } from "../document-revisions/detail-revision/types";

export interface PublishingPlaceholderItemResponse {
  value?: string | null;
  description?: string | null;
}

export interface PublishingPlaceholderGroupResponse {
  title?: string | null;
  description?: string | null;
  items?: PublishingPlaceholderItemResponse[];
}

export interface PublishingPlaceholderCatalogResponse {
  groups?: PublishingPlaceholderGroupResponse[];
}

export interface PublishingPlaceholderStyleConfig {
  transforms?: string[] | null;
  fontFamily?: string | null;
  fontSizePt?: number | null;
  bold?: boolean | null;
  italic?: boolean | null;
  underline?: boolean | null;
  color?: string | null;
  alignment?: string | null;
  dateFormat?: string | null;
  numberFormat?: string | null;
  preserveLineBreaks?: boolean | null;
  maxLines?: number | null;
}

export interface PublishingPlaceholderStyleResponse {
  id?: string | null;
  templateId?: string | null;
  templateVersionId?: string | null;
  templateVersionNumber?: number | null;
  componentType?: string | null;
  layout?: string | null;
  placeholderKey?: string | null;
  placeholderToken?: string | null;
  placeholderType?: string | null;
  style?: PublishingPlaceholderStyleConfig | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface PublishingPlaceholderStyleRequest {
  componentType: string;
  layout: string;
  placeholderKey: string;
  placeholderToken?: string | null;
  placeholderType?: string | null;
  style?: PublishingPlaceholderStyleConfig | null;
}

export interface PublishingTemplateResponse {
  id?: string | null;
  templateName?: string | null;
  documentType?: string | null;
  versionNumber?: number | null;
  status?: string | null;
  description?: string | null;
  coverTemplatePath?: string | null;
  bodyTemplatePath?: string | null;
  headerTemplatePath?: string | null;
  footerTemplatePath?: string | null;
  logoTemplatePath?: string | null;
  coverFileName?: string | null;
  bodyFileName?: string | null;
  headerFileName?: string | null;
  footerFileName?: string | null;
  logoFileName?: string | null;
  publishingMode?: string | null;
  coverOrientation?: string | null;
  bodyOrientation?: string | null;
  enableHeader?: boolean;
  enableFooter?: boolean;
  showLogo?: boolean;
  showQrCode?: boolean;
  showBarcode?: boolean;
  showConfidentiality?: boolean;
  showElectronicSignatureInformation?: boolean;
  watermarkMode?: string | null;
  coverSourcePageFrom?: number | null;
  coverSourcePageTo?: number | null;
  bodySourcePageFrom?: number | null;
  bodySourcePageTo?: number | null;
  headerPageFrom?: number | null;
  headerPageTo?: number | null;
  footerPageFrom?: number | null;
  footerPageTo?: number | null;
  watermarkPageFrom?: number | null;
  watermarkPageTo?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  publishedAt?: string | null;
  publishedBy?: string | null;
  components?: PublishingTemplateComponentResponse[];
}

export interface PublishingTemplateVersionResponse {
  id?: string | null;
  versionNumber?: number | null;
  templateName?: string | null;
  documentType?: string | null;
  status?: string | null;
  description?: string | null;
  coverTemplatePath?: string | null;
  bodyTemplatePath?: string | null;
  headerTemplatePath?: string | null;
  footerTemplatePath?: string | null;
  logoTemplatePath?: string | null;
  logoFileName?: string | null;
  bodyFileName?: string | null;
  changeSummary?: string | null;
  publishingMode?: string | null;
  coverOrientation?: string | null;
  bodyOrientation?: string | null;
  enableHeader?: boolean;
  enableFooter?: boolean;
  showLogo?: boolean;
  showQrCode?: boolean;
  showBarcode?: boolean;
  showConfidentiality?: boolean;
  showElectronicSignatureInformation?: boolean;
  watermarkMode?: string | null;
  coverSourcePageFrom?: number | null;
  coverSourcePageTo?: number | null;
  bodySourcePageFrom?: number | null;
  bodySourcePageTo?: number | null;
  headerPageFrom?: number | null;
  headerPageTo?: number | null;
  footerPageFrom?: number | null;
  footerPageTo?: number | null;
  watermarkPageFrom?: number | null;
  watermarkPageTo?: number | null;
  createdAt?: string | null;
  createdBy?: string | null;
  publishedAt?: string | null;
  publishedBy?: string | null;
}

export interface PublishingTemplateComponentResponse {
  id?: string | null;
  componentType?: string | null;
  layout?: string | null;
  objectKey?: string | null;
  fileName?: string | null;
  checksum?: string | null;
  versionNumber?: number | null;
  status?: string | null;
  detectedPlaceholders?: string[];
  previewAvailable?: boolean;
  uploadedAt?: string | null;
  uploadedBy?: string | null;
}

export interface PublishingTemplateRequest {
  templateName: string;
  documentType?: string | null;
  description?: string | null;
  status?: string | null;
  publishingMode?: string | null;
  coverOrientation?: string | null;
  bodyOrientation?: string | null;
  enableHeader?: boolean;
  enableFooter?: boolean;
  showLogo?: boolean;
  showQrCode?: boolean;
  showBarcode?: boolean;
  showConfidentiality?: boolean;
  showElectronicSignatureInformation?: boolean;
  watermarkMode?: string | null;
  coverSourcePageFrom?: number | null;
  coverSourcePageTo?: number | null;
  bodySourcePageFrom?: number | null;
  bodySourcePageTo?: number | null;
  headerPageFrom?: number | null;
  headerPageTo?: number | null;
  footerPageFrom?: number | null;
  footerPageTo?: number | null;
  watermarkPageFrom?: number | null;
  watermarkPageTo?: number | null;
}

export interface PublishingWorkspaceResponse {
  revisionId?: string | null;
  revisionStatus?: string | null;
  revision?: RevisionDetailResponse | null;
  templates?: PublishingTemplateResponse[];
  selectedTemplateId?: string | null;
  selectedTemplateVersion?: number | null;
  publishingPreviewPdfPath?: string | null;
  publishingPreviewChecksum?: string | null;
  publishedPdfPath?: string | null;
  conversionEngine?: string | null;
  previewReady?: boolean;
  publishReady?: boolean;
  publishingTemplateName?: string | null;
  publishingTemplateStatus?: string | null;
  sourceFileName?: string | null;
  previewPageCount?: number | null;
  previewGeneratedAt?: string | null;
  previewGeneratedBy?: string | null;
  publishedBy?: string | null;
  previewChecksum?: string | null;
  selectedLayout?: string | null;
  availableLayouts?: string[];
  availablePreviewComponents?: Array<"cover" | "header" | "footer" | string>;
  publishingJobId?: string | null;
  publishingJobStatus?: string | null;
  publishingJobMessage?: string | null;
  publishingJobError?: string | null;
  previewVersionToken?: string | null;
  previewType?: "NONE" | "PUBLISHING_PREVIEW" | "REVIEW_SNAPSHOT" | "PUBLISHED_PDF" | string | null;
  previewStatus?: "NONE" | "GENERATING" | "READY" | "FAILED" | string | null;
  previewError?: string | null;
  previewLastGeneratedAt?: string | null;
  reviewSnapshotVersionToken?: string | null;
  publishingPreviewVersionToken?: string | null;
  publishedPdfVersionToken?: string | null;
}

export interface PublishingWorkspaceRequest {
  publishingTemplateId?: string | null;
  selectedLayout?: string | null;
  changeSummary?: string | null;
  signatureToken?: string | null;
  coverSourcePageFrom?: number | null;
  coverSourcePageTo?: number | null;
  bodySourcePageFrom?: number | null;
  bodySourcePageTo?: number | null;
  headerPageFrom?: number | null;
  headerPageTo?: number | null;
  footerPageFrom?: number | null;
  footerPageTo?: number | null;
  watermarkPageFrom?: number | null;
  watermarkPageTo?: number | null;
  reason?: string | null;
  enableCover?: boolean | null;
  enableHeader?: boolean | null;
  enableFooter?: boolean | null;
}

export interface PublishingTemplateComponentInspectionResponse {
  componentType?: string | null;
  layout?: string | null;
  fileName?: string | null;
  filePath?: string | null;
  contentType?: string | null;
  previewAvailable?: boolean;
  detectedVariables?: string[];
  paragraphCount?: number | null;
  tableCount?: number | null;
  headerSectionCount?: number | null;
  footerSectionCount?: number | null;
  sampleRevisionId?: string | null;
  sampleDocumentNumber?: string | null;
  sampleRevisionNumber?: string | null;
  sampleCode?: string | null;
  samplePageLabel?: string | null;
  sampleDocumentName?: string | null;
  sampleTitleLocalLanguage?: string | null;
  sampleRevisionName?: string | null;
  sampleDocumentType?: string | null;
  sampleEffectiveDate?: string | null;
  sampleValidUntil?: string | null;
  sampleReviewDate?: string | null;
  sampleStatus?: string | null;
  samplePreparedDate?: string | null;
  samplePreparedDesignation?: string | null;
  samplePreparedSign?: string | null;
  samplePreparedName?: string | null;
  sampleCheckedDate?: string | null;
  sampleCheckedDesignation?: string | null;
  sampleCheckedSign?: string | null;
  sampleCheckedName?: string | null;
  sampleApprovedDate?: string | null;
  sampleApprovedDesignation?: string | null;
  sampleApprovedSign?: string | null;
  sampleApprovedName?: string | null;
  notes?: string | null;
  placeholderMappings?: Array<{
    placeholder?: string | null;
    revisionField?: string | null;
    label?: string | null;
    sampleValue?: string | null;
    sourceSection?: string | null;
  }>;
}
