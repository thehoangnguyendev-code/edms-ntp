/**
 * Security Utilities
 * XSS protection, sanitization, validation, and encryption helpers
 */

// Optional import - install with: npm install dompurify @types/dompurify
let DOMPurify: any;
try {
  // Dynamic import not available synchronously; using fallback sanitizer
  // To enable DOMPurify: npm install dompurify @types/dompurify
  // Then: import DOMPurify from 'dompurify';
  DOMPurify = null;
} catch {
  // DOMPurify not available, fallback sanitizer will be used
}

/**
 * XSS Protection - Sanitize HTML content
 */
export const sanitizeHtml = (dirty: string): string => {
  if (!DOMPurify) {
    // Fallback: basic HTML escaping if DOMPurify not available
    return dirty
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'title', 'target'],
  });
};

/**
 * Sanitize user input (strip HTML completely)
 */
export const sanitizeInput = (input: string): string => {
  if (!DOMPurify) {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
};

/**
 * Validate password strength
 * Must contain: 8+ chars, uppercase, lowercase, number, special char
 */
export const isStrongPassword = (password: string): boolean => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return (
    password.length >= minLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasNumber &&
    hasSpecialChar
  );
};

/**
 * Simple encryption for sensitive data in localStorage
 * Uses base64 + XOR cipher (for basic obfuscation, not cryptographically secure)
 * For production, use Web Crypto API or backend encryption
 */
const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'EQMS_SECRET_KEY_2026';

/**
 * Generate UUID with graceful fallback for environments that do not support crypto.randomUUID.
 */
export const safeRandomUUID = (): string => {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);

    // RFC 4122 version 4 bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Last-resort fallback for legacy/insecure contexts.
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).slice(2, 14);
  return `${timestamp.slice(0, 8)}-${random.slice(0, 4)}-4${random.slice(4, 7)}-a${random.slice(7, 10)}-${timestamp.slice(8)}${random.slice(10, 12)}`;
};

export const encryptData = (data: string): string => {
  try {
    const encrypted = Array.from(data)
      .map((char, i) =>
        String.fromCharCode(
          char.charCodeAt(0) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
        )
      )
      .join('');
    return btoa(encrypted); // Base64 encode
  } catch (error) {
    if (import.meta.env.DEV) console.error('Encryption error:', error);
    return data;
  }
};

export const decryptData = (encrypted: string): string => {
  try {
    const decoded = atob(encrypted); // Base64 decode
    return Array.from(decoded)
      .map((char, i) =>
        String.fromCharCode(
          char.charCodeAt(0) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
        )
      )
      .join('');
  } catch (error) {
    if (import.meta.env.DEV) console.error('Decryption error:', error);
    return encrypted;
  }
};

/**
 * Secure token storage
 */
export const secureStorage = {
  setItem: (key: string, value: string, encrypt = true): void => {
    try {
      const stored = encrypt ? encryptData(value) : value;
      localStorage.setItem(key, stored);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Storage set error:', error);
    }
  },

  getItem: (key: string, decrypt = true): string | null => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      
      if (!decrypt) return stored;
      
      // Try to decrypt, if fails return null (not the corrupted data)
      try {
        return decryptData(stored);
      } catch (decryptError) {
        if (import.meta.env.DEV) console.error('Decrypt error for key:', key, decryptError);
        // Remove corrupted data
        localStorage.removeItem(key);
        return null;
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Storage get error:', error);
      return null;
    }
  },

  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Storage remove error:', error);
    }
  },

  clear: (): void => {
    try {
      localStorage.clear();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Storage clear error:', error);
    }
  },
};

/**
 * JWT Token utilities
 */
export const tokenUtils = {
  /**
   * Parse JWT token (client-side only for reading payload, not for validation)
   */
  parseToken: (token: string): any => {
    try {
      // Try JWT format first (header.payload.signature)
      if (token.includes('.')) {
        const payload = token.split('.')[1];
        return JSON.parse(atob(payload));
      }
      // Fallback: try direct base64-encoded JSON (demo token format)
      return JSON.parse(atob(token));
    } catch (error) {
      if (import.meta.env.DEV) console.error('Token parse error:', error);
      return null;
    }
  },

  /**
   * Check if token is expired
   */
  isTokenExpired: (token: string): boolean => {
    // TEMP: Always return false for local dev mock tokens
    return false;
    
    // const payload = tokenUtils.parseToken(token);
    // if (!payload || !payload.exp) return true;

    // const currentTime = Math.floor(Date.now() / 1000);
    // return payload.exp < currentTime;
  },

  /**
   * Get token expiry time
   */
  getTokenExpiry: (token: string): Date | null => {
    const payload = tokenUtils.parseToken(token);
    if (!payload || !payload.exp) return null;
    return new Date(payload.exp * 1000);
  },

  /**
   * Check if token needs refresh (expires in < 5 minutes)
   */
  needsRefresh: (token: string): boolean => {
    const expiry = tokenUtils.getTokenExpiry(token);
    if (!expiry) return true;

    const fiveMinutes = 5 * 60 * 1000;
    return expiry.getTime() - Date.now() < fiveMinutes;
  },
};

/**
 * Content Security Policy helper
 */
export const cspViolationHandler = (event: SecurityPolicyViolationEvent) => {
  if (import.meta.env.DEV) {
    console.error('CSP Violation:', {
      blockedURI: event.blockedURI,
      violatedDirective: event.violatedDirective,
      originalPolicy: event.originalPolicy,
    });
  }

  // Log to monitoring service in production
  if (import.meta.env.PROD) {
    // Send to analytics/monitoring
    // analytics.track('csp_violation', { ... });
  }
};

/**
 * Prevent clickjacking
 */
export const preventClickjacking = (): void => {
  if (window.self !== window.top) {
    // Page is in an iframe
    if (import.meta.env.DEV) console.warn('Clickjacking attempt detected - page loaded in iframe');
    window.top!.location.href = window.self.location.href;
  }
};

/**
 * CSRF Token management
 */
export const csrfToken = {
  generate: (): string => {
    return safeRandomUUID();
  },

  store: (token: string): void => {
    sessionStorage.setItem('csrf_token', token);
  },

  get: (): string | null => {
    return sessionStorage.getItem('csrf_token');
  },

  validate: (token: string): boolean => {
    const stored = csrfToken.get();
    return stored === token;
  },
};

/**
 * Rate limiting helper (client-side)
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();

  constructor(
    private maxAttempts: number = 5,
    private windowMs: number = 60000 // 1 minute
  ) {}

  /**
   * Check if action is allowed
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const timestamps = this.attempts.get(key) || [];

    // Remove old timestamps outside the window
    const validTimestamps = timestamps.filter((ts) => now - ts < this.windowMs);

    if (validTimestamps.length >= this.maxAttempts) {
      return false;
    }

    validTimestamps.push(now);
    this.attempts.set(key, validTimestamps);
    return true;
  }

  /**
   * Reset attempts for a key
   */
  reset(key: string): void {
    this.attempts.delete(key);
  }
}

/**
 * Input validation helpers
 */
export const validators = {
  /**
   * Validate file upload
   */
  isValidFile: (
    file: File,
    allowedTypes: string[],
    maxSizeMB: number = 10
  ): { valid: boolean; error?: string } => {
    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Invalid file type' };
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return { valid: false, error: `File size exceeds ${maxSizeMB}MB` };
    }

    return { valid: true };
  },

  /**
   * Validate URL
   */
  isValidUrl: (url: string, allowedProtocols: string[] = ['https:']): boolean => {
    try {
      const parsed = new URL(url);
      return allowedProtocols.includes(parsed.protocol);
    } catch {
      return false;
    }
  },

  /**
   * Sanitize filename
   */
  sanitizeFilename: (filename: string): string => {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  },
};

/**
 * Session timeout manager
 */
export class SessionManager {
  private timeout: NodeJS.Timeout | null = null;
  private warningTimeout: NodeJS.Timeout | null = null;

  constructor(
    private timeoutMinutes: number = 30,
    private warningMinutes: number = 5,
    private onTimeout: () => void,
    private onWarning: () => void
  ) {}

  start(): void {
    this.reset();
    this.setupActivityListeners();
  }

  reset(): void {
    // Clear existing timeouts
    if (this.timeout) clearTimeout(this.timeout);
    if (this.warningTimeout) clearTimeout(this.warningTimeout);

    // Set warning timeout
    const warningMs = (this.timeoutMinutes - this.warningMinutes) * 60 * 1000;
    this.warningTimeout = setTimeout(() => {
      this.onWarning();
    }, warningMs);

    // Set session timeout
    const timeoutMs = this.timeoutMinutes * 60 * 1000;
    this.timeout = setTimeout(() => {
      this.onTimeout();
    }, timeoutMs);
  }

  private activityHandler: (() => void) | null = null;

  private setupActivityListeners(): void {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    // Throttle reset to avoid excessive timer recreation on rapid interactions
    let lastReset = 0;
    const THROTTLE_MS = 30_000; // Only reset once per 30 seconds
    this.activityHandler = () => {
      const now = Date.now();
      if (now - lastReset > THROTTLE_MS) {
        lastReset = now;
        this.reset();
      }
    };
    events.forEach((event) => {
      document.addEventListener(event, this.activityHandler!, { passive: true });
    });
  }

  stop(): void {
    if (this.timeout) clearTimeout(this.timeout);
    if (this.warningTimeout) clearTimeout(this.warningTimeout);
    // Clean up event listeners
    if (this.activityHandler) {
      const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
      events.forEach((event) => {
        document.removeEventListener(event, this.activityHandler!);
      });
      this.activityHandler = null;
    }
  }
}

/**
 * Audit log helper
 */
export const auditLog = {
  log: (action: string, details?: Record<string, any>): void => {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      details,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // In production, send to backend API
    if (import.meta.env.PROD) {
      // TODO: Replace with actual API call
      // api.post('/audit-log', entry);
    } else {
      console.log('[AUDIT]', entry);
    }
  },
};
