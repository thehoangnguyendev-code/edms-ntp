/**
 * UI Standards Configuration
 * Centralized styling constants and presets for consistent UI across the project
 * 
 * Usage: Import and use in components
 * Example: className={cn("p-4 md:p-5", PADDING.formField)}
 */

// ============================================================================
// SPACING LADDER (4px base unit)
// ============================================================================
export const SPACING = {
  xs: '2px',       // 0.5 rem
  sm: '4px',       // 1 rem
  md: '6px',       // 1.5 rem
  base: '8px',     // 2 rem
  lg: '12px',      // 3 rem
  xl: '16px',      // 4 rem
  '2xl': '20px',   // 5 rem
  '3xl': '24px',   // 6 rem
};

// ============================================================================
// PADDING PRESETS
// ============================================================================
export const PADDING = {
  // Form fields and filter sections
  formField: 'p-4 md:p-5',
  formFieldCompact: 'p-3 md:p-4',
  
  // Cards
  card: 'p-4 md:p-5',
  cardCompact: 'p-3 md:p-4',
  cardLoose: 'p-5 md:p-6',
  
  // Table and list cells (PRIMARY STANDARD)
  tableCell: 'py-2.5 px-2 md:py-3 md:px-4',
  tableCellCompact: 'py-2 px-2 md:py-2.5 md:px-3',
  
  // Modals and dialogs
  modal: 'p-5 md:p-6',
  modalHeader: 'px-5 md:px-6 py-4',
  
  // Buttons
  buttonStandard: 'px-4 py-2',
  buttonCompact: 'px-3 py-1.5',
  
  // Badge elements
  badge: 'px-2.5 py-1',
  badgeCompact: 'px-2 py-0.5',
  
  // List items
  listItem: 'px-3 py-2',
};

// ============================================================================
// MARGIN & GAP PRESETS
// ============================================================================
export const MARGIN = {
  labelSpacing: 'mb-1.5',
  sectionSpacing: 'mb-6',
  componentGap: 'gap-3 md:gap-4',
  componentGapDense: 'gap-2 md:gap-3',
  breadcrumbGap: 'gap-1.5',
};

// ============================================================================
// TYPOGRAPHY PRESETS
// ============================================================================
export const TYPOGRAPHY = {
  // Page headers
  pageTitle: 'text-2xl sm:text-3xl font-bold text-slate-900',
  
  // Section headers
  sectionTitle: 'text-lg font-bold text-slate-900',
  sectionSubtitle: 'text-xs sm:text-sm font-medium text-slate-700',
  
  // Modal headers
  modalTitle: 'text-lg font-bold text-slate-900',
  modalSubtitle: 'text-xs sm:text-sm font-medium text-slate-700',
  
  // Table headers (PRIMARY STANDARD)
  tableHeader: 'text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider',
  
  // Body text
  bodyText: 'text-sm text-slate-700',
  bodyTextSmall: 'text-xs text-slate-600',
  
  // Form labels (PRIMARY STANDARD)
  formLabel: 'text-xs sm:text-sm font-medium text-slate-700',
  
  // Table body cells (PRIMARY STANDARD)
  tableBody: 'text-xs md:text-sm text-slate-700',
  
  // Stat/metric numbers in summary cards
  statNumber: 'text-2xl font-bold text-slate-900',
  
  // Sub-detail text (secondary line under a title)
  subDetail: 'text-[10px] md:text-xs text-slate-500',
  
  // Section title inside a card/panel
  cardSectionTitle: 'text-sm font-semibold text-slate-900',
  
  // Panel/drawer title
  panelTitle: 'text-base md:text-lg font-semibold text-slate-900',
  
  // Badge text
  badgeText: 'text-xs font-medium',
  
  // Help text
  helpText: 'text-xs text-slate-500',
};

// ============================================================================
// COLOR STANDARDS
// ============================================================================
export const COLORS = {
  text: {
    primary: 'text-slate-900',
    secondary: 'text-slate-700',
    tertiary: 'text-slate-600',
    muted: 'text-slate-500',
    light: 'text-slate-400',
    subHeading: 'text-slate-800',  // intermediate heading level (between primary and secondary)
  },
  bg: {
    primary: 'bg-white',
    secondary: 'bg-slate-50',
    hover: 'hover:bg-slate-50',
    active: 'active:bg-slate-100',
    disabled: 'bg-slate-100',
  },
  border: {
    default: 'border-slate-200',
    light: 'border-slate-100',
    divider: 'border-b border-slate-100',
    dividerEmphasis: 'border-b border-slate-200',
  },
};

// ============================================================================
// BORDER RADIUS STANDARDS
// ============================================================================
export const BORDER_RADIUS = {
  formElement: 'rounded-lg',      // Form inputs, 8px
  card: 'rounded-xl',             // Cards/containers (PRIMARY)
  modal: 'rounded-xl',            // Modals
  emphasis: 'rounded-2xl',        // Emphasis containers
  pill: 'rounded-full',           // Badges, pills
};

// ============================================================================
// SHADOW STANDARDS
// ============================================================================
export const SHADOW = {
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
};

// ============================================================================
// COMPONENT PRESETS (Ready-to-use combinations)
// ============================================================================
export const COMPONENT_PRESETS = {
  // INPUT/SEARCH FIELD (PRIMARY STANDARD)
  searchInput: 'h-9 pl-10 pr-10 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm placeholder:text-slate-400 transition-colors',
  
  // BADGE STANDARD
  badgeStandard: 'px-2.5 py-1 rounded-full text-xs font-medium border',
  badgeSmall: 'px-2 py-0.5 rounded-full text-xs font-medium border',
  badgeLarge: 'px-3 py-1.5 rounded-full text-xs font-medium border',
  
  // TABLE CELL (PRIMARY STANDARD)
  tableCell: 'py-2.5 px-2 md:py-3 md:px-4 text-xs md:text-sm',
  tableHeader: 'py-2.5 px-2 md:py-3.5 md:px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap',
  tableHeaderSticky: 'sticky right-0 bg-slate-50 px-2 py-2.5 md:px-4 md:py-3.5 lg:px-6 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider z-20 whitespace-nowrap',
  
  // CARD CONTAINERS
  card: 'bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm',
  cardCompact: 'bg-white p-3 md:p-4 rounded-lg border border-slate-200 shadow-sm',
  
  // ICON BUTTON SIZES
  iconButtonSmall: 'h-7 w-7 rounded-lg',
  iconButtonStandard: 'h-8 w-8 rounded-lg',
  iconButtonLarge: 'h-9 w-9 rounded-lg',
  iconButtonHover: 'hover:bg-slate-100 transition-colors',
  
  // DROPDOWN ITEM (PRIMARY STANDARD)
  dropdownItem: 'px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors',
  
  // MODAL HEADER
  modalHeader: 'px-5 md:px-6 py-4 border-b border-slate-100',
  
  // FORM LABEL (PRIMARY STANDARD)
  formLabel: 'text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block',
  
  // DIVIDERS (PRIMARY STANDARD)
  divider: 'border-b border-slate-100',
  dividerEmphasis: 'border-b border-slate-200',
};

// ============================================================================
// EXPORT ALL STANDARDS
// ============================================================================
export const UI_STANDARDS = {
  SPACING,
  PADDING,
  MARGIN,
  TYPOGRAPHY,
  COLORS,
  BORDER_RADIUS,
  SHADOW,
  COMPONENT_PRESETS,
};

export default UI_STANDARDS;
