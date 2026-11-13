/**
 * Application Configuration
 * Central place for all app configs
 */

export const config = {
  // API Configuration
  api: {
    // A build sets VITE_API_BASE_URL. Without it, the dev server talks to the local backend and any other build
    // uses the same address it was served from -- a localhost address is never baked into a built bundle.
    baseURL: import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api'),
    timeout: Number(import.meta.env.VITE_API_TIMEOUT) || 30000,
  },

  // Authentication Configuration
  auth: {
    tokenKey: import.meta.env.VITE_AUTH_TOKEN_KEY || 'authToken',
    sessionTimeout: Number(import.meta.env.VITE_SESSION_TIMEOUT) || 3600000, // 1 hour
  },

  // Feature Flags
  features: {
    auditTrail: import.meta.env.VITE_ENABLE_AUDIT_TRAIL === 'true',
    eSignature: import.meta.env.VITE_ENABLE_E_SIGNATURE === 'true',
    notifications: import.meta.env.VITE_ENABLE_NOTIFICATIONS === 'true',
  },

  // File Upload Configuration
  upload: {
    maxFileSize: Number(import.meta.env.VITE_MAX_FILE_SIZE) || 10485760, // 10MB
    allowedFileTypes: import.meta.env.VITE_ALLOWED_FILE_TYPES?.split(',') || [
      'pdf',
      'doc',
      'docx',
      'xls',
      'xlsx',
      'png',
      'jpg',
      'jpeg',
    ],
  },

  // Application Information
  app: {
    name: import.meta.env.VITE_APP_NAME || 'Quality Management System',
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    env: import.meta.env.VITE_APP_ENV || 'development',
  },

  // Pagination
  pagination: {
    defaultPageSize: 10,
    pageSizeOptions: [10, 20, 50, 100],
  },

  // OnlyOffice Document Server (browser-reachable address for the DocsAPI script + editor iframe)
  onlyOffice: {
    documentServerUrl: import.meta.env.VITE_ONLYOFFICE_URL || (import.meta.env.DEV ? 'http://localhost:8082' : '/onlyoffice'),
  },

} as const;

export type Config = typeof config;

// Re-export sub-configurations
export * from './responsive';
export * from './security';
export * from './ui-standards';
