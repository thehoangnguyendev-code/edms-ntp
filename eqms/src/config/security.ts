/**
 * Security Configuration & Best Practices
 * Central security settings for the EQMS application
 */

/**
 * Content Security Policy Configuration
 * Add this to your index.html or configure via backend headers
 */
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'"], // Remove unsafe-inline in production
  // Application fonts are bundled locally; do not allow runtime font downloads.
  'style-src': ["'self'", "'unsafe-inline'"],
  'font-src': ["'self'"],
  'img-src': ["'self'", 'data:', 'https:'],
  'connect-src': ["'self'", import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'],
  'frame-ancestors': ["'none'"], // Prevent clickjacking
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'upgrade-insecure-requests': [],
};

/**
 * Security Headers (Configure these in backend/nginx)
 */
export const SECURITY_HEADERS = {
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // XSS Protection
  'X-XSS-Protection': '1; mode=block',
  
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Referrer Policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Permissions Policy
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  
  // HSTS (HTTP Strict Transport Security)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
};

/**
 * Password Policy
 */
export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventUserInfo: true, // No username/email in password
  expiryDays: 90, // Force password change every 90 days
  historyCount: 5, // Cannot reuse last 5 passwords
};

/**
 * Session Configuration
 */
export const SESSION_CONFIG = {
  timeout: 30, // minutes
  warningBeforeTimeout: 5, // minutes
  maxConcurrentSessions: 1, // Single session per user
  enforceIPCheck: true, // Validate IP consistency
  enforceDeviceFingerprint: false, // Optional: check device fingerprint
};

export const SECURITY_CONFIG_STORAGE_KEY = 'eqms.settings.system-config';
export const BROWSER_TAB_TITLE_STORAGE_KEY = 'eqms.settings.browser-tab-title';

/**
 * Rate Limiting Configuration
 */
export const RATE_LIMITS = {
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    lockoutDuration: 30 * 60 * 1000, // 30 minutes
  },
  api: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },
  fileUpload: {
    maxFiles: 10,
    maxSizeMB: 10,
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
    ],
  },
};

/**
 * Encryption Configuration
 */
export const ENCRYPTION_CONFIG = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  saltLength: 16,
  iterations: 100000,
};

/**
 * CSRF Protection Configuration
 */
export const CSRF_CONFIG = {
  enabled: true,
  tokenName: 'X-CSRF-Token',
  cookieName: 'csrf_token',
  headerName: 'X-CSRF-Token',
  methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
};

/**
 * Allowed Origins for CORS (Backend configuration)
 */
export const CORS_CONFIG = {
  allowedOrigins: [
    'http://localhost:5173', // Vite dev server
    'http://localhost:3000',
    import.meta.env.VITE_APP_URL || '',
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Time'],
  credentials: true,
};

/**
 * Security Best Practices Checklist
 */
export const SECURITY_CHECKLIST = {
  frontend: [
    '✅ Implement XSS protection (DOMPurify)',
    '✅ Use secure token storage (encrypted)',
    '✅ Implement CSRF protection',
    '✅ Add rate limiting',
    '✅ Validate all inputs',
    '✅ Sanitize outputs',
    '✅ Implement session timeout',
    '✅ Use HTTPS only',
    '✅ Add security headers',
    '✅ Prevent clickjacking',
    '✅ Secure sensitive data',
  ],
  backend: [
    '⚠️ Implement JWT with refresh tokens',
    '⚠️ Hash passwords (bcrypt/argon2)',
    '⚠️ Use parameterized queries (SQL injection)',
    '⚠️ Implement rate limiting',
    '⚠️ Add input validation',
    '⚠️ Set security headers',
    '⚠️ Use CORS properly',
    '⚠️ Encrypt sensitive data at rest',
    '⚠️ Use environment variables for secrets',
  ],
};

/**
 * Initialize security features on app start
 */
export const initializeSecurity = () => {
  // Prevent clickjacking
  if (window.self !== window.top) {
    window.top!.location.href = window.self.location.href;
  }

  // Add CSP meta tag if not set by server
  if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = Object.entries(CSP_DIRECTIVES)
      .map(([key, values]) => `${key} ${values.join(' ')}`)
      .join('; ');
    document.head.appendChild(meta);
  }

  // Log security initialization (dev only)
  if (import.meta.env.DEV) {
    console.log('🔒 Security features initialized');
  }

  // Check HTTPS in production
  if (import.meta.env.PROD && window.location.protocol !== 'https:') {
    // Silently handle - don't expose to console in prod
  }
};

/**
 * Security recommendations for deployment
 */
export const DEPLOYMENT_CHECKLIST = `
# Security Deployment Checklist

## Environment Variables
- [ ] Set VITE_API_BASE_URL to production API
- [ ] Use strong encryption keys
- [ ] Never commit secrets to Git
- [ ] Use .env.production for production config

## Backend Configuration
- [ ] Enable HTTPS/TLS
- [ ] Configure CORS properly
- [ ] Set security headers (Helmet.js for Node.js)
- [ ] Enable rate limiting
- [ ] Use Web Application Firewall (WAF)

## Database Security
- [ ] Use parameterized queries
- [ ] Encrypt sensitive data at rest
- [ ] Regular backups
- [ ] Implement row-level security
- [ ] Audit database access

## Monitoring & Logging
- [ ] Set up error tracking (Sentry)
- [ ] Monitor suspicious activity
- [ ] Set up alerts for security events
- [ ] Regular security audits

## Compliance (GxP)
- [ ] Implement 21 CFR Part 11 controls
- [ ] Electronic signatures
- [ ] Data integrity (ALCOA+)
- [ ] User access controls (RBAC)
- [ ] Regular compliance reviews
`;

export default {
  CSP_DIRECTIVES,
  SECURITY_HEADERS,
  PASSWORD_POLICY,
  SESSION_CONFIG,
  RATE_LIMITS,
  ENCRYPTION_CONFIG,
  CSRF_CONFIG,
  CORS_CONFIG,
  SECURITY_CHECKLIST,
  DEPLOYMENT_CHECKLIST,
  initializeSecurity,
};
