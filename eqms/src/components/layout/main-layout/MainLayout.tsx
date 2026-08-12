import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { ROUTES } from '@/app/routes.constants';
import { Sidebar } from '@/components/layout/sidebar/Sidebar';
import { Header } from '@/components/layout/header/Header';
import { Footer } from '@/components/layout/footer/Footer';
import { NetworkStatusMonitor } from '@/components/layout/NetworkStatusMonitor';
import { ScrollToTop } from '@/components/ui/scroll-to-top/ScrollToTop';
import { useResponsiveSidebar } from './useResponsiveSidebar';
import { useNavigation } from './useNavigation';
import { resetViewportZoom, isIOSSafari } from '@/utils/viewport';
import { SessionTimeoutModal } from '@/features/auth/components';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/services/api/auth';
import { settingsApi } from '@/services/api/settings';
import { SECURITY_CONFIG_STORAGE_KEY } from '@/config/security';

export const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSidebarCollapsed, isMobileMenuOpen, toggleSidebar, closeMobileMenu } = useResponsiveSidebar();
  const { user, logout, isAuthenticated } = useAuth();
  const { activeId, handleNavigate } = useNavigation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const heartbeatInFlightRef = useRef<Promise<void> | null>(null);
  const lastHeartbeatAtRef = useRef(0);
  const sessionLockedRef = useRef(false);
  const HEARTBEAT_THROTTLE_MS = 30_000;

  // Page title in header (shown when scrolled past page h1)
  const [headerTitle, setHeaderTitle] = useState('');
  const [showHeaderTitle, setShowHeaderTitle] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Scroll to top on route change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [location.pathname]);

  // Observe page title (h1) visibility for sticky header title
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    setShowHeaderTitle(false);
    setHeaderTitle('');

    let intersectionObserver: IntersectionObserver | null = null;
    let currentH1: Element | null = null;
    let currentTitle = '';

    const syncTitle = () => {
      const h1 = scrollContainer.querySelector('main h1');
      if (h1) {
        const newTitle = h1.textContent?.trim() || '';
        if (newTitle !== currentTitle) {
          currentTitle = newTitle;
          setHeaderTitle(newTitle);
        }

        if (h1 !== currentH1) {
          currentH1 = h1;
          intersectionObserver?.disconnect();
          intersectionObserver = new IntersectionObserver(
            ([entry]) => {
              setShowHeaderTitle(!entry.isIntersecting);
            },
            { root: scrollContainer, threshold: 0 }
          );
          intersectionObserver.observe(h1);
        }
      } else if (currentH1) {
        currentH1 = null;
        currentTitle = '';
        setHeaderTitle('');
        setShowHeaderTitle(false);
        setScrollProgress(0);
        intersectionObserver?.disconnect();
      }
    };

    syncTitle();

    const domObserver = new MutationObserver(syncTitle);
    domObserver.observe(scrollContainer, { childList: true, subtree: true, characterData: true });

    const handleScrollProgress = () => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const scrollHeight = container.scrollHeight - container.clientHeight;
      if (scrollHeight > 0) {
        const progress = (container.scrollTop / scrollHeight) * 100;
        setScrollProgress(progress);
      }
    };

    scrollContainer.addEventListener('scroll', handleScrollProgress);

    return () => {
      domObserver.disconnect();
      intersectionObserver?.disconnect();
      scrollContainer.removeEventListener('scroll', handleScrollProgress);
    };
  }, [location.pathname]);

  // Reset viewport zoom on iOS Safari
  useEffect(() => {
    if (isIOSSafari()) {
      const timer = setTimeout(() => {
        resetViewportZoom();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let isActive = true;

    const hydrateSecurityConfig = async () => {
      try {
        const config = await settingsApi.getSystemConfiguration();
        if (!isActive) {
          return;
        }
        window.localStorage.setItem(SECURITY_CONFIG_STORAGE_KEY, JSON.stringify(config));
        window.dispatchEvent(new Event('eqms:security-config-updated'));
      } catch {
        // Keep using any previously cached configuration if the request fails.
      }
    };

    void hydrateSecurityConfig();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated]);

  const sendHeartbeat = useCallback(async (force = false) => {
    if (!isAuthenticated || sessionLockedRef.current) {
      return;
    }

    const now = Date.now();
    if (!force && now - lastHeartbeatAtRef.current < HEARTBEAT_THROTTLE_MS) {
      return;
    }

    if (heartbeatInFlightRef.current) {
      return heartbeatInFlightRef.current;
    }

    const heartbeatPromise = authApi
      .touchSession()
      .catch((error) => {
        if (import.meta.env.DEV) {
          console.error('Heartbeat failed:', error);
        }
      })
      .finally(() => {
        heartbeatInFlightRef.current = null;
        lastHeartbeatAtRef.current = Date.now();
      });

    heartbeatInFlightRef.current = heartbeatPromise;
    return heartbeatPromise;
  }, [isAuthenticated]);

  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(() => {
    try {
      const raw = localStorage.getItem(SECURITY_CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const val = Number(parsed?.security?.sessionTimeoutMinutes);
        if (Number.isFinite(val) && val >= 1 && val <= 1440) {
          return val;
        }
      }
    } catch {
      // ignore
    }
    return 30;
  });
  const lastActivityAtRef = useRef(Date.now());

  useEffect(() => {
    const handleConfigUpdated = () => {
      try {
        const raw = localStorage.getItem(SECURITY_CONFIG_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const val = Number(parsed?.security?.sessionTimeoutMinutes);
          if (Number.isFinite(val) && val >= 1 && val <= 1440) {
            setSessionTimeoutMinutes(val);
          }
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("eqms:security-config-updated", handleConfigUpdated);
    return () => window.removeEventListener("eqms:security-config-updated", handleConfigUpdated);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const checkInactivity = setInterval(() => {
      if (sessionLockedRef.current) {
        return;
      }
      const elapsedMinutes = (Date.now() - lastActivityAtRef.current) / (1000 * 60);
      if (elapsedMinutes >= sessionTimeoutMinutes) {
        sessionLockedRef.current = true;
        window.dispatchEvent(new Event("eqms:session-locked"));
      }
    }, 5000);

    return () => clearInterval(checkInactivity);
  }, [isAuthenticated, sessionTimeoutMinutes]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    sessionLockedRef.current = false;
    lastActivityAtRef.current = Date.now();
    lastHeartbeatAtRef.current = Date.now();
    void sendHeartbeat(true);

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'pointerdown', 'input', 'click'];
    const handleActivity = () => {
      lastActivityAtRef.current = Date.now();
      void sendHeartbeat();
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        lastActivityAtRef.current = Date.now();
        void sendHeartbeat(true);
      }
    };
    const handleSessionLocked = () => {
      sessionLockedRef.current = true;
    };
    const handleSessionUnlocked = () => {
      sessionLockedRef.current = false;
      lastActivityAtRef.current = Date.now();
      lastHeartbeatAtRef.current = Date.now();
    };

    window.addEventListener('eqms:session-locked', handleSessionLocked as EventListener);
    window.addEventListener('eqms:session-unlocked', handleSessionUnlocked as EventListener);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    activityEvents.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      window.removeEventListener('eqms:session-locked', handleSessionLocked as EventListener);
      window.removeEventListener('eqms:session-unlocked', handleSessionUnlocked as EventListener);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      activityEvents.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [isAuthenticated, location.pathname, sendHeartbeat]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  }, [logout, navigate]);

  return (
    <div className="fixed inset-0 flex h-full w-full font-sans text-slate-900 overflow-hidden bg-white">
      <NetworkStatusMonitor />

      <SessionTimeoutModal
        isAuthenticated={isAuthenticated}
        username={user?.username}
        logout={logout}
      />

      <Sidebar
        isCollapsed={isSidebarCollapsed}
        activeId={activeId}
        onNavigate={handleNavigate}
        isMobileOpen={isMobileMenuOpen}
        onClose={closeMobileMenu}
        onToggleSidebar={toggleSidebar}
      />

      <div id="main-content-wrapper" className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          onToggleSidebar={toggleSidebar}
          isSidebarCollapsed={isSidebarCollapsed}
          isMobileMenuOpen={isMobileMenuOpen}
          onNavigateToProfile={() => navigate(ROUTES.PROFILE)}
          onLogout={handleLogout}
          headerTitle={headerTitle}
          showHeaderTitle={showHeaderTitle}
          scrollProgress={scrollProgress}
        />

        <div
          id="main-scroll-container"
          tabIndex={-1}
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar bg-gray-100/50"
          style={{
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <main className="w-full px-4 pt-2 pb-6 md:px-6 md:pt-3 lg:px-8 lg:pt-4">
            <div className="w-full max-w-[1920px] mx-auto space-y-4 md:space-y-6">
              <Outlet />
            </div>
          </main>
        </div>

        <Footer />
      </div>

      <ScrollToTop
        scrollContainerRef={scrollContainerRef}
        isMobileMenuOpen={isMobileMenuOpen}
      />
    </div>
  );
};
