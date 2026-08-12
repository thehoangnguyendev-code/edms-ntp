/**
 * Viewport utilities for iOS Safari zoom fix
 * 
 * iOS Safari auto-zooms when user focuses on input with font-size < 16px.
 * Even with CSS fixes, the zoom state can persist after navigation.
 * This utility helps reset the viewport to normal scale.
 */

declare global {
  interface Window {
    __resetViewportZoom?: () => void;
  }
}

/**
 * Reset viewport zoom to 1.0 scale
 * Useful after login or navigation where iOS Safari may have auto-zoomed
 */
export const resetViewportZoom = (): void => {
  // Use the global function injected in index.html if available
  if (typeof window !== 'undefined' && window.__resetViewportZoom) {
    window.__resetViewportZoom();
    return;
  }

  // Fallback: manually reset viewport
  if (typeof document !== 'undefined') {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      const originalContent = viewport.getAttribute('content') || '';
      
      // Temporarily allow scaling
      viewport.setAttribute(
        'content',
        'width=device-width, initial-scale=1.0, maximum-scale=10.0, user-scalable=yes, viewport-fit=cover'
      );
      
      // Reset back after a short delay
      setTimeout(() => {
        viewport.setAttribute(
          'content',
          'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
        );
      }, 100);
    }
  }
};

/**
 * Check if the device is iOS Safari
 */
export const isIOSSafari = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  
  return isIOS && isSafari;
};

/**
 * Blur all focused inputs to prevent iOS zoom issues
 */
export const blurActiveInput = (): void => {
  if (typeof document !== 'undefined') {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.tagName === 'SELECT'
    )) {
      activeElement.blur();
    }
  }
};
