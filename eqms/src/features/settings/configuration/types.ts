import type { PageBackground } from '@/config/page-background';

export interface CompanyInfo {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyWebsite: string;
  taxId: string;
  industry: string;
  regulatoryBody: string;
}

export interface BackupSettings {
  enableAutoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  backupTime: string;
  retentionDays: number;
  backupLocation: 'local' | 'cloud' | 's3';
  notifyOnBackupFailure: boolean;
  onlyOffice: OnlyOfficeStorageConfig;
}

/** Community Edition options for the read-only OnlyOffice Document-tab viewer. */
export interface OnlyOfficeViewerConfig {
  /** Enables plugins; Community Edition cannot hide the Plugins tab independently. */
  showPluginsTab?: boolean;
  /** Controls the initial right-menu state. A user's OnlyOffice browser preference may override it. */
  showRightMenu?: boolean;
  /** Hiding the name uses OnlyOffice's compact header layout. */
  showFileName?: boolean;
  /** How the assigned reviewer opens the file at Pending Review: Review Mode (track changes) or Comment Only. Review Mode when never set. */
  pendingReviewMode?: 'REVIEW' | 'COMMENT_ONLY';
  /** How the assigned approver opens the file at Pending Approval. Comment Only when never set. */
  pendingApprovalMode?: 'REVIEW' | 'COMMENT_ONLY';
  /** Whether a person who edits, reviews or comments sees the Download buttons and menu entries. On when never set; the read-only viewer never has them. */
  editorAllowDownload?: boolean;
  /** Whether such a person can print (the Print buttons, the menu entry and Ctrl+P). On when never set. */
  editorAllowPrint?: boolean;
  /** Draw the traceability watermark on every page of the read-only viewer. Off when never set. */
  watermarkEnabled?: boolean;
  /** The text and what is printed about the viewer: the same settings as the PDF preview watermark. */
  watermarkText?: string;
  watermarkShowViewerName?: boolean;
  watermarkShowOpenedAt?: boolean;
  watermarkShowEmployeeCode?: boolean;
  watermarkTiled?: boolean;
  watermarkColor?: string;
  watermarkStrength?: 'light' | 'standard' | 'strong';
  /** Whole degrees, -90 to 90, counter-clockwise; 45 when never set. */
  watermarkAngle?: number;
}

export interface OnlyOfficeStorageConfig {
  viewer?: OnlyOfficeViewerConfig;
  enabled: boolean;
  documentServerUrl: string;
  callbackBaseUrl: string;
  jwtSecret: string;
  jwtSecretConfigured?: boolean;
  jwtSecretMasked?: string;
  clearJwtSecret?: boolean;
}

export interface LocaleSettings {
  language: string;
  numberFormat: string;
}

export type ToastPosition = 'center' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

export interface AppearanceSettings {
  mainBackground?: PageBackground | null;
  authBackground?: PageBackground | null;
  /** Background of the Knowledge Base explorer: a colour or a gradient. */
  knowledgeBackground?: PageBackground | null;
  alternatingRecordColors?: boolean;
  alternatingRecordColor?: string;
  /** Colour of the text and of the icons of the items of every dropdown (action) menu, "#RRGGBB". Empty or missing: the built-in colour. */
  menuTextColor?: string;
  menuIconColor?: string;
  /** Vertical lines between the columns of every table. */
  tableColumnDividers?: boolean;
  /** Desktop Search + two-column draft filter panel. */
  compactDesktopFilters?: boolean;
  /** Where system toast notifications appear. Machine values only; labels live in GeneralTab. */
  toastPosition?: ToastPosition;
  /** How long a system message stays on screen, in seconds (2 to 60; 5 when empty). */
  toastDurationSeconds?: number;
  /** How the materials of a training are drawn on every Training screen: a table (default) or tiles. */
  trainingMaterialsLayout?: 'TABLE' | 'TILES';
  /** How the folders of the Knowledge Base are named: the full name (default) or its abbreviation. */
  knowledgeFolderNames?: 'FULL' | 'ABBREVIATION';
  /** How the folders are named in the sidebar of the Knowledge Base; follows `knowledgeFolderNames` until chosen. */
  knowledgeSidebarFolderNames?: 'FULL' | 'ABBREVIATION';
  /** The Knowledge Base menu opens the Explorer in a new browser tab (default) or in the current tab. */
  knowledgeOpenInNewTab?: boolean;
  systemSidebarCollapsedLogo?: string;
  /** When enabled by an administrator, show the signed-in user's profile at the bottom of the sidebar. */
  showSidebarUserProfile?: boolean;
  /** When enabled, the Knowledge Base menu opens the explorer experience in a new browser tab. */
  theme: 'light' | 'dark' | 'auto';
  primaryColor: string;
  compactMode: boolean;
  showBreadcrumbs: boolean;
  sidebarDefaultCollapsed: boolean;
  animationsEnabled: boolean;
}

/** How the stamp on one kind of uploaded picture looks (Image Watermark tab). Missing values mean the defaults of that tab. */
export interface ImageWatermarkSettings {
  /** Stamp every picture uploaded for this purpose. */
  enabled?: boolean;
  showLogo?: boolean;
  /** SYSTEM = the system logo of the General tab; CUSTOM = the picture in logoData. */
  logoSource?: 'SYSTEM' | 'CUSTOM';
  /** PNG or JPEG data URL, up to 2 MB, used when logoSource is CUSTOM. */
  logoData?: string;
  /** The name of the signed-in user who uploads. */
  showUploadedBy?: boolean;
  /** The time of the upload, as the server clock gives it. */
  showUploadedAt?: boolean;
  /** The time zone the upload time is printed in, as an offset from UTC such as "+07:00" (-12:00 to +14:00). +07:00 when never set. */
  utcOffset?: string;
  position?: 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT';
  /** Width of the whole stamp as a share of the picture width, 5 to 40. */
  sizePercent?: number;
  /** How solid the stamp is, 10 to 100. */
  opacityPercent?: number;
  /** Distance from the edge as a share of the shorter side of the picture, 0 to 10. */
  marginPercent?: number;
  /** A light panel behind the stamp so the text can be read on a dark picture. */
  textBackground?: boolean;
}

export interface ImageWatermarkConfig {
  controlledCopyEvidence?: ImageWatermarkSettings;
  specimenSignature?: ImageWatermarkSettings;
}

export interface GeneralConfig {
  systemName: string;
  systemDisplayName: string;
  systemLogo: string;
  systemSidebarCollapsedLogo?: string;
  systemFavicon: string;
  /** Home-screen shortcut icon (PNG or JPEG data URL, at least 512 x 512). Empty means the built-in icon. */
  appIcon?: string;
  /** Label under the shortcut icon, at most 64 characters; empty means the display name. */
  appShortName?: string;
  /** Colour behind the icon on the home screen (#RRGGBB); a transparent logo needs one. */
  appIconBackground?: string;
  /** Left footer text; the built-in copyright line when never set. {year} is the current year. */
  systemFooterLeft?: string;
  /** Right footer text, always aligned to the right. */
  systemFooterRight?: string;
  /** Footer on desktop and tablet (on when never set). */
  footerShowOnDesktop?: boolean;
  /** Footer on mobile (off when never set). */
  footerShowOnMobile?: boolean;
  /** Text of the Dashboard top bar; empty means the built-in default. */
  systemHeaderTitle?: string;
  navigationLabelOverrides?: Record<string, string>;
  adminEmail: string;
  maintenanceMode: boolean;
  dateTimeFormat: string;
  timeZone: string;
  companyInfo: CompanyInfo;
  backupSettings: BackupSettings;
  locale: LocaleSettings;
  appearance: AppearanceSettings;
  /** Stamp on pictures uploaded as evidence or as specimen signatures. */
  imageWatermark?: ImageWatermarkConfig;
}

export interface SecurityConfig {
  passwordMinLength: number;
  requireSpecialChars: boolean;
  requireNumbers: boolean;
  requireUppercase: boolean;
  requireLowercase: boolean;
  /** Minimum number of distinct characters (0 = off). */
  minUniqueChars?: number;
  /** Longest run of the same character allowed (0 = off). */
  maxRepeatedChars?: number;
  disallowSequentialChars?: boolean;
  disallowCommonPasswords?: boolean;
  disallowUserInfo?: boolean;
  disallowWhitespace?: boolean;
  passwordExpiryDays: number;
  enablePasswordExpiry: boolean;
  preventPasswordReuse: boolean;
  passwordHistoryCount: number;
  sessionTimeoutMinutes: number;
  sessionTimeoutEnabled?: boolean;
  enable2FA: boolean;
  forcePasswordChangeOnFirstLogin: boolean;
  enableAccountLockout: boolean;
  maxLoginAttempts: number;
}

export interface ESignatureSettings {
  enableESignature: boolean;
  requirePasswordForSigning: boolean;
  allowDigitalCertificates: boolean;
  signingMethods: ('password' | 'otp' | 'biometric' | 'certificate')[];
  enforceSigningOrder: boolean;
  signatureValidityDays: number;
}

/** Admin options for the system PDF viewer (Settings > Configuration > Preview File). */
export interface PdfPreviewConfig {
  /** 'page-fit' | 'page-width' | 'actual-size' (100%). */
  defaultZoom?: 'page-fit' | 'page-width' | 'actual-size';
  /** Open the thumbnail sidebar by default where the viewer supports it. */
  showThumbnailSidebar?: boolean;
  showSearch?: boolean;
  showPageNavigation?: boolean;
  showZoomControls?: boolean;
  showFullScreen?: boolean;
  /** Allow temporary annotations/comments in PDF previews. Missing means disabled. */
  allowAnnotations?: boolean;
  /** Shows EmbedPDF's Insert tab. Inserted marks stay in the browser session and are never persisted by EQMS. */
  showInsertTools?: boolean;
  /** Allow selecting another local PDF from EmbedPDF's Document menu. */
  showOpenDocumentAction?: boolean;
  /** Allow closing the current PDF from EmbedPDF's Document menu. */
  showCloseDocumentAction?: boolean;
  /** Show EmbedPDF's document permissions/security information dialog. */
  showSecurityAction?: boolean;
  /** Allow a temporary screenshot capture from the current preview. */
  showScreenshotAction?: boolean;
  /** Allow selecting/copying text in the preview. */
  allowTextSelection?: boolean;
  /** Text rendered by the server on the transient PDF preview watermark. */
  watermarkText?: string;
  /** Include the authenticated viewer's display name in the preview watermark. */
  watermarkShowViewerName?: boolean;
  /** Include the local time at which the preview was opened. */
  watermarkShowOpenedAt?: boolean;
  /** Include the viewer's employee code, so a copy can be traced to a person. */
  watermarkShowEmployeeCode?: boolean;
  /** Print the watermark as a repeated grid across the page instead of one large mark. */
  watermarkTiled?: boolean;
  /** Colour of the watermark, as a hex value such as #B3B3F5. */
  watermarkColor?: string;
  /** Turn of the watermark in whole degrees, counter-clockwise from the line of the page: -90 to 90. 45 (rising to the right) when never set. */
  watermarkAngle?: number;
  /** How visible the watermark is: light, standard (the original), or strong. */
  watermarkStrength?: 'light' | 'standard' | 'strong';
}

export interface DocumentConfig {
  pdfPreview?: PdfPreviewConfig;
  defaultRetentionPeriodDays: number;
  enableWatermark: boolean;
  allowDownload: boolean;
  maxFileSizeMB: number;
  /** Seed for the first revision number of newly created documents: '0.0.1' (three-part) or '0.1' (two-part). */
  revisionNumberSeed?: '0.0.1' | '0.1';
  eSignature: ESignatureSettings;
}

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  senderEmail: string;
  senderName: string;
  useSSL: boolean;
}

export interface SmsConfig {
  enableSms: boolean;
  provider: 'twilio' | 'vonage' | 'aws-sns';
  accountSid: string;
  authToken: string;
  fromNumber: string;
  rateLimitPerHour: number;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  event: string;
  subject: string;
  body: string;
  variables: string[];
}

export interface NotificationConfig {
  enableEmailNotifications: boolean;
  enableInAppNotifications: boolean;
  emailDigestFrequency: 'daily' | 'weekly' | 'instant';
  publicAppUrl: string;
  emailConfig: EmailConfig;
  smsConfig: SmsConfig;
  enableCustomTemplates: boolean;
  templates: NotificationTemplate[];
  triggers: {
    documentApproval: boolean;
    taskAssignment: boolean;
    systemAlerts: boolean;
  };
}

// --- Integration Types ---

export interface SsoConfig {
  enableSso: boolean;
  provider: 'saml' | 'oidc' | 'azure-ad';
  entityId: string;
  ssoUrl: string;
  certificate: string;
  autoProvisionUsers: boolean;
  defaultRole: string;
}

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  enabled: boolean;
  lastTriggered: string;
  failureCount: number;
}

export interface StorageIntegration {
  provider: 'local' | 'aws-s3' | 'azure-blob' | 'google-cloud' | 'minio' | 'nas' | 'google-drive' | 'dropbox';
  bucketName: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  basePath: string;
  enableCdn: boolean;
  cdnUrl: string;
  minioEndpoint?: string;
  minioBucket?: string;
  minioAccessKeyId?: string;
  minioSecretAccessKey?: string;
  minioRetentionYears?: number;
  documentsPrefix?: string;
  controlledCopiesPrefix?: string;
  templatesPrefix?: string;
  trainingPrefix?: string;
  auditPrefix?: string;
  tempPrefix?: string;
  nasHost?: string;
  nasPath?: string;
  nasShareName?: string;
  nasDomain?: string;
  nasUsername?: string;
  nasPassword?: string;
  googleDriveClientId?: string;
  googleDriveClientSecret?: string;
  googleDriveFolderId?: string;
  dropboxAccessToken?: string;
  dropboxAppKey?: string;
  dropboxAppSecret?: string;
  dropboxFolderPath?: string;
}

export interface IntegrationConfig {
  sso: SsoConfig;
  webhooks: WebhookConfig[];
  storage: StorageIntegration;
  enableApiKeyAuth: boolean;
  apiRateLimitPerMinute: number;
  corsAllowedOrigins: string[];
}

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category?: string;
  parentId?: string | null;
}

export interface SystemConfig {
  general: GeneralConfig;
  security: SecurityConfig;
  documents: DocumentConfig;
  notifications: NotificationConfig;
  integrations: IntegrationConfig;
  features: FeatureFlag[];
}
