import { LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon?: LucideIcon | any;
  /** Custom icon color class (e.g., 'text-blue-500') */
  iconColor?: string;
  children?: NavItem[];
  path?: string; // Route path for navigation
  /** Show horizontal divider after this item */
  showDividerAfter?: boolean;
  /** Show horizontal divider before this item */
  showDividerBefore?: boolean;
  /** Restrict visibility to users holding at least one of these permission codes. */
  allowedPermissions?: string[];
  /** Optional numeric badge or count to display next to the label */
  count?: number;
  /** Optional contextual action rendered next to a top-level sidebar item. */
  sidebarAction?: { id: string; ariaLabel: string };
  /** Enables a per-user drag handle for dynamic sidebar children. */
  sidebarDraggable?: boolean;
}

export interface BreadcrumbItem {
  label: string;
  id: string;
}

export interface AppState {
  currentViewId: string;
  breadcrumbs: BreadcrumbItem[];
}
