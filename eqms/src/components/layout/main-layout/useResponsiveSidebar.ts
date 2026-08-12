import { useState, useEffect, useCallback, useRef } from 'react';

// Breakpoint constants for consistency
const MOBILE_BREAKPOINT = 768; // Mobile phones
const TABLET_BREAKPOINT = 1024; // Tablets/iPad
const DESKTOP_BREAKPOINT = 1280; // Desktop

// Debounce utility for resize events
const debounce = <T extends (...args: any[]) => void>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Custom hook to manage responsive sidebar behavior
 * - Mobile (< 768px): Off-canvas overlay menu
 * - Tablet/iPad (768px - 1279px): Collapsed sidebar with icons only (user can toggle)
 * - Desktop (≥ 1280px): Collapsible sidebar (user controlled)
 * 
 * @returns Sidebar state and control functions
 */
export const useResponsiveSidebar = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1280;
    // Auto-collapse on tablet, expanded on desktop
    return width >= MOBILE_BREAKPOINT && width < DESKTOP_BREAKPOINT;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isDesktopRef = useRef(typeof window !== 'undefined' ? window.innerWidth >= DESKTOP_BREAKPOINT : true);
  const previousBreakpointRef = useRef<'mobile' | 'tablet' | 'desktop'>(
    (() => {
      const width = typeof window !== 'undefined' ? window.innerWidth : 1280;
      if (width < MOBILE_BREAKPOINT) return 'mobile';
      if (width < DESKTOP_BREAKPOINT) return 'tablet';
      return 'desktop';
    })()
  );

  useEffect(() => {
    // Optimized resize handler with debounce
    const handleResize = debounce(() => {
      const width = window.innerWidth;
      const isDesktop = width >= DESKTOP_BREAKPOINT;
      const isTablet = width >= MOBILE_BREAKPOINT && width < DESKTOP_BREAKPOINT;
      const isMobile = width < MOBILE_BREAKPOINT;
      
      // Determine current breakpoint
      const currentBreakpoint: 'mobile' | 'tablet' | 'desktop' = 
        isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';
      const previousBreakpoint = previousBreakpointRef.current;
      
      // Update refs
      isDesktopRef.current = isDesktop;
      
      // Only update state when crossing breakpoint boundaries
      if (currentBreakpoint !== previousBreakpoint) {
        previousBreakpointRef.current = currentBreakpoint;
        
        if (isMobile) {
          // Entered mobile: Close sidebar, reset collapse
          setIsMobileMenuOpen(false);
          setIsSidebarCollapsed(false);
        } else if (isTablet) {
          // Entered tablet: Auto-collapse sidebar, close mobile menu
          setIsMobileMenuOpen(false);
          setIsSidebarCollapsed(true);
        } else {
          // Entered desktop: Close mobile menu, keep collapse state
          setIsMobileMenuOpen(false);
          // Don't change collapse state - user controls it
        }
      }
    }, 150); // 150ms debounce for smooth performance

    // Initial check - already set in useState, just update refs
    const initialWidth = window.innerWidth;
    const isInitialDesktop = initialWidth >= DESKTOP_BREAKPOINT;
    isDesktopRef.current = isInitialDesktop;

    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Memoized toggle function to prevent re-renders
  const toggleSidebar = useCallback(() => {
    const width = window.innerWidth;
    const isDesktop = width >= DESKTOP_BREAKPOINT;
    const isMobile = width < MOBILE_BREAKPOINT;
    
    if (isMobile) {
      // Mobile: toggle menu visibility (off-canvas)
      setIsMobileMenuOpen(prev => !prev);
    } else {
      // Tablet & Desktop: toggle collapse state
      setIsSidebarCollapsed(prev => !prev);
    }
  }, []);

  // Memoized close function
  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  return {
    isSidebarCollapsed,
    isMobileMenuOpen,
    toggleSidebar,
    setIsMobileMenuOpen,
    closeMobileMenu,
  };
};
