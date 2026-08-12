/**
 * Security Monitoring Hooks
 * Detect suspicious activity and monitor sessions.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { auditLog, SessionManager } from '@/utils/security';

/**
 * Hook to monitor session timeout
 */
export const useSessionMonitor = (
  timeoutMinutes: number = 30,
  warningMinutes: number = 5
) => {
  const { logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(timeoutMinutes * 60);
  const sessionManager = useRef<SessionManager | null>(null);

  useEffect(() => {
    sessionManager.current = new SessionManager(
      timeoutMinutes,
      warningMinutes,
      () => {
        auditLog.log('session_timeout');
        logout();
      },
      () => {
        setShowWarning(true);
        auditLog.log('session_warning');
      }
    );

    sessionManager.current.start();

    // Countdown timer when warning is shown
    let interval: NodeJS.Timeout;
    if (showWarning) {
      interval = setInterval(() => {
        setRemainingTime((prev) => Math.max(0, prev - 1));
      }, 1000);
    }

    return () => {
      sessionManager.current?.stop();
      if (interval) clearInterval(interval);
    };
  }, [timeoutMinutes, warningMinutes, logout, showWarning]);

  const extendSession = useCallback(() => {
    sessionManager.current?.reset();
    setShowWarning(false);
    setRemainingTime(timeoutMinutes * 60);
    auditLog.log('session_extended');
  }, [timeoutMinutes]);

  return {
    showWarning,
    remainingTime,
    extendSession,
  };
};

/**
 * Hook to detect suspicious activity
 */
export const useSuspiciousActivityDetector = () => {
  const [alerts, setAlerts] = useState<string[]>([]);
  const failedAttempts = useRef<Map<string, number>>(new Map());

  const reportActivity = useCallback((activity: string, details?: any) => {
    const key = activity;
    const attempts = (failedAttempts.current.get(key) || 0) + 1;
    failedAttempts.current.set(key, attempts);

    // Alert if too many failed attempts
    if (attempts >= 3) {
      const alert = `Suspicious activity detected: ${activity}`;
      setAlerts((prev) => [...prev, alert]);
      auditLog.log('suspicious_activity', { activity, attempts, details });
    }
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
    failedAttempts.current.clear();
  }, []);

  return {
    alerts,
    reportActivity,
    clearAlerts,
  };
};

/**
 * Hook to monitor network security
 */
export const useNetworkSecurityMonitor = () => {
  const [isSecure, setIsSecure] = useState(true);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    // Check HTTPS
    if (window.location.protocol !== 'https:' && import.meta.env.PROD) {
      setIsSecure(false);
      setWarnings((prev) => [...prev, 'Connection is not secure (HTTPS required)']);
      auditLog.log('insecure_connection');
    }

    // Check for mixed content
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.startsWith('http:') && window.location.protocol === 'https:') {
          setWarnings((prev) => [...prev, 'Mixed content detected']);
          auditLog.log('mixed_content_detected', { resource: entry.name });
        }
      }
    });

    observer.observe({ entryTypes: ['resource'] });

    return () => observer.disconnect();
  }, []);

  return {
    isSecure,
    warnings,
  };
};

/**
 * Hook for Content Security Policy monitoring
 */
export const useCSPMonitor = () => {
  const [violations, setViolations] = useState<SecurityPolicyViolationEvent[]>([]);

  useEffect(() => {
    const handleViolation = (e: SecurityPolicyViolationEvent) => {
      setViolations((prev) => [...prev, e]);
      auditLog.log('csp_violation', {
        blockedURI: e.blockedURI,
        violatedDirective: e.violatedDirective,
        sourceFile: e.sourceFile,
        lineNumber: e.lineNumber,
      });
    };

    document.addEventListener('securitypolicyviolation', handleViolation as any);

    return () => {
      document.removeEventListener('securitypolicyviolation', handleViolation as any);
    };
  }, []);

  return { violations };
};

/**
 * Hook to detect developer tools (basic detection)
 */
export const useDevToolsDetector = () => {
  const [devToolsOpen, setDevToolsOpen] = useState(false);

  useEffect(() => {
    // Only in production
    if (!import.meta.env.PROD) return;

    const detectDevTools = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;

      if (widthThreshold || heightThreshold) {
        setDevToolsOpen(true);
        auditLog.log('devtools_detected');
      } else {
        setDevToolsOpen(false);
      }
    };

    window.addEventListener('resize', detectDevTools);
    detectDevTools();

    return () => window.removeEventListener('resize', detectDevTools);
  }, []);

  return { devToolsOpen };
};

/**
 * Hook to monitor clipboard security
 */
export const useClipboardSecurity = () => {
  const [clipboardAccess, setClipboardAccess] = useState<'granted' | 'denied' | 'unknown'>('unknown');

  useEffect(() => {
    const checkPermission = async () => {
      try {
        const result = await navigator.permissions.query({ name: 'clipboard-read' as any });
        setClipboardAccess(result.state as 'granted' | 'denied');
      } catch {
        setClipboardAccess('unknown');
      }
    };

    checkPermission();
  }, []);

  const preventSensitiveDataCopy = useCallback((elementId: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;

    const preventCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      auditLog.log('copy_prevented', { elementId });
    };

    element.addEventListener('copy', preventCopy);
    return () => element.removeEventListener('copy', preventCopy);
  }, []);

  return {
    clipboardAccess,
    preventSensitiveDataCopy,
  };
};

/**
 * Hook to monitor failed login attempts
 */
export const useLoginAttemptMonitor = () => {
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState<Date | null>(null);

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  const recordFailedAttempt = useCallback(() => {
    const newCount = failedAttempts + 1;
    setFailedAttempts(newCount);

    if (newCount >= MAX_ATTEMPTS) {
      setIsLocked(true);
      const unlockTime = new Date(Date.now() + LOCKOUT_DURATION);
      setLockoutTime(unlockTime);
      auditLog.log('account_locked', {
        attempts: newCount,
        unlockTime: unlockTime.toISOString(),
      });

      // Auto-unlock after duration
      setTimeout(() => {
        setIsLocked(false);
        setFailedAttempts(0);
        setLockoutTime(null);
        auditLog.log('account_unlocked');
      }, LOCKOUT_DURATION);
    } else {
      auditLog.log('failed_login_attempt', { attempts: newCount });
    }
  }, [failedAttempts]);

  const resetAttempts = useCallback(() => {
    setFailedAttempts(0);
    setIsLocked(false);
    setLockoutTime(null);
  }, []);

  return {
    failedAttempts,
    isLocked,
    lockoutTime,
    recordFailedAttempt,
    resetAttempts,
  };
};

/**
 * Hook for permission-based access control
 */
export const usePermissionGuard = (requiredPermissions: string[]) => {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (!user) {
      setHasAccess(false);
      return;
    }

    // Check if user has all required permissions
    const userPermissions = (user as any).permissions || [];
    const hasAllPermissions = requiredPermissions.every((perm) =>
      userPermissions.includes(perm)
    );

    setHasAccess(hasAllPermissions);

    if (!hasAllPermissions) {
      auditLog.log('permission_denied', {
        userId: user.id,
        required: requiredPermissions,
        actual: userPermissions,
      });
    }
  }, [user, requiredPermissions]);

  return { hasAccess };
};

const safeRandomUUID = (): string => {
  if (typeof window !== "undefined" && window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Hook to prevent multiple tabs/windows (optional, strict security)
 */
export const useSingleSessionEnforcement = () => {
  const [multipleSessionsDetected, setMultipleSessionsDetected] = useState(false);

  useEffect(() => {
    const sessionId = safeRandomUUID();
    sessionStorage.setItem('sessionId', sessionId);

    const channel = new BroadcastChannel('session_channel');

    // Send ping to other tabs
    channel.postMessage({ type: 'ping', sessionId });

    // Listen for other tabs
    channel.onmessage = (e) => {
      if (e.data.type === 'ping' && e.data.sessionId !== sessionId) {
        setMultipleSessionsDetected(true);
        auditLog.log('multiple_sessions_detected');
      }
    };

    return () => channel.close();
  }, []);

  return { multipleSessionsDetected };
};
