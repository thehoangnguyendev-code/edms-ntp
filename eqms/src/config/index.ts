/**
 * Application Configuration
 * Central place for all app configs
 */

export const config = {
  // API Configuration
  api: {
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
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

  // PDF Viewer
  pdf: {
    workerUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
  },

  // Date Formats
  dateFormats: {
    display: 'MMM DD, YYYY',
    iso: 'dd/MM/yyyy',
    full: 'MMMM DD, YYYY HH:mm:ss',
  },
} as const;

export type Config = typeof config;

// Re-export sub-configurations
export * from './responsive';
export * from './security';
export * from './ui-standards';
