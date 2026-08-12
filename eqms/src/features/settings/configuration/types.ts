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
  officeOnline: OfficeOnlineStorageConfig;
}

export interface OfficeOnlineStorageConfig {
  enabled: boolean;
  graphBaseUrl: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  clientSecretConfigured?: boolean;
  clientSecretMasked?: string;
  clearClientSecret?: boolean;
  siteId: string;
  driveId: string;
  libraryFolder: string;
  shareLinkScope: string;
  reviewLinksEnabled?: boolean;
}

export interface LocaleSettings {
  language: string;
  numberFormat: string;
}

export interface AppearanceSettings {
  systemSidebarCollapsedLogo?: string;
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

export interface VersionControl {
  enableAutoVersioning: boolean;
  maxVersionsToKeep: number;
  compareVersionsEnabled: boolean;
  requireVersionNotes: boolean;
  majorMinorVersioning: boolean;
}

export interface ESignatureSettings {
  enableESignature: boolean;
  requirePasswordForSigning: boolean;
  allowDigitalCertificates: boolean;
  signingMethods: ('password' | 'otp' | 'biometric' | 'certificate')[];
  enforceSigningOrder: boolean;
  signatureValidityDays: number;
}

export interface DocumentConfig {
  defaultRetentionPeriodDays: number;
  enableWatermark: boolean;
  allowDownload: boolean;
  maxFileSizeMB: number;
  versionControl: VersionControl;
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
  provider: 'saml' | 'oidc' | 'ldap' | 'azure-ad';
  entityId: string;
  ssoUrl: string;
  certificate: string;
  autoProvisionUsers: boolean;
  defaultRole: string;
}

export interface LdapConfig {
  enableLdap: boolean;
  serverUrl: string;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  userSearchFilter: string;
  groupSearchFilter: string;
  syncSchedule: 'hourly' | 'daily' | 'manual';
  lastSyncDate: string;
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
  ldap: LdapConfig;
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
