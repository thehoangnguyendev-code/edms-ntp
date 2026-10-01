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

export interface AppearanceSettings {
  /** Desktop Search + two-column draft filter panel. */
  compactDesktopFilters?: boolean;
  systemSidebarCollapsedLogo?: string;
  /** When enabled by an administrator, show the signed-in user's profile at the bottom of the sidebar. */
  showSidebarUserProfile?: boolean;
  /** When enabled, the Knowledge Base menu opens the explorer experience in a new browser tab. */
  knowledgeExplorerEnabled?: boolean;
  theme: 'light' | 'dark' | 'auto';
  primaryColor: string;
  compactMode: boolean;
  showBreadcrumbs: boolean;
  sidebarDefaultCollapsed: boolean;
  animationsEnabled: boolean;
}

export interface GeneralConfig {
  systemName: string;
  systemDisplayName: string;
  systemLogo: string;
  systemSidebarCollapsedLogo?: string;
  systemFavicon: string;
  systemFooter: string;
  navigationLabelOverrides?: Record<string, string>;
  adminEmail: string;
  maintenanceMode: boolean;
  dateTimeFormat: string;
  timeZone: string;
  companyInfo: CompanyInfo;
  backupSettings: BackupSettings;
  locale: LocaleSettings;
  appearance: AppearanceSettings;
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
  provider: 'local' | 'aws-s3' | 'azure-blob' | 'google-cloud' | 'minio' | 'nas' | 'google-drive' | 'onedrive' | 'sharepoint' | 'dropbox';
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
  msTenantId?: string;
  msClientId?: string;
  msClientSecret?: string;
  msSiteId?: string;
  msDriveId?: string;
  msLibraryFolder?: string;
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
