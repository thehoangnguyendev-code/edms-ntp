/**
 * Responsive Configuration
 * Breakpoints và utilities cho responsive design
 */

export const BREAKPOINTS = {
  // Mobile: < 768px (không ưu tiên trong dự án này)
  mobile: '0px',
  
  // Tablet Portrait (iPad Mini, iPad dọc)
  tabletPortrait: '768px',
  
  // Tablet Landscape (iPad ngang)
  tabletLandscape: '1024px',
  
  // Desktop
  desktop: '1280px',
  
  // Desktop Large
  desktopLarge: '1920px',
} as const;

export const MEDIA_QUERIES = {
  tabletPortrait: `@media (min-width: ${BREAKPOINTS.tabletPortrait})`,
  tabletLandscape: `@media (min-width: ${BREAKPOINTS.tabletLandscape})`,
  desktop: `@media (min-width: ${BREAKPOINTS.desktop})`,
  desktopLarge: `@media (min-width: ${BREAKPOINTS.desktopLarge})`,
} as const;

/**
 * Tailwind CSS breakpoint mapping:
 * - md: 768px  -> Tablet Portrait
 * - lg: 1024px -> Tablet Landscape  
 * - xl: 1280px -> Desktop
 * - 2xl: 1536px -> Desktop Large (if needed)
 */

export const LAYOUT_SIZES = {
  // Sidebar widths
  sidebarCollapsed: 80,
  sidebarExpanded: 280,
  
  // Header heights
  headerMobile: 64,
  headerDesktop: 72,
  
  // Content padding
  contentPaddingMobile: 16,
  contentPaddingTablet: 24,
  contentPaddingDesktop: 32,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;
