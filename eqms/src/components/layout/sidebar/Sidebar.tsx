import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { NavItem } from "@/types";
import { NAV_CONFIG, QUALITY_NAV_CONFIG, findNodeByPath, ICON_MAP } from "@/app/constants";
import { isTransactionalRoute } from "@/app/routes.constants";
import { documentApi, navigationApi } from "@/services/api";
import { invalidateNavigationCache } from "@/services/api/navigation";
import { cn } from "@/components/ui/utils";
import { useAuth } from "@/contexts/AuthContext";
import { SearchDropdown } from "../header/SearchDropdown";
import { NavigationGuardModal } from "@/components/ui/modal/NavigationGuardModal";
import { BrandLogo } from "@/components/branding/BrandLogo";
import "./Sidebar.module.css";
import { resolvePermissionAliasCodes } from "@/features/settings/permissionCatalog";
import { notificationApi } from "@/services/api/notifications";
import { subscribeNotificationsChanged } from "@/features/notifications/events";
import { IconPointFilled } from "@tabler/icons-react";

// Constants
const BASE_PADDING = 12;
const LEVEL_PADDING = 16;
const MENU_WIDTH = 300;
const MENU_GAP = 8;
const SAFE_PADDING = 8;
const MAX_MENU_HEIGHT = 400;
// The server is the primary navigation authority. This local fallback deliberately
// evaluates permission codes only: an Access Profile's display name can change
// without changing which navigation nodes a user can see.
const filterNavByPermissions = (items: NavItem[], userPermissions: string[] = []): NavItem[] => {
  const normalizedPermissions = new Set(
    userPermissions
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim().toUpperCase())
  );
  // Super admin: backend returns the "*" wildcard instead of an expanded permission list
  const hasWildcard = normalizedPermissions.has('*');

  return items
    .filter(
      (item) =>
        (!item.allowedPermissions ||
          hasWildcard ||
          item.allowedPermissions.some((permission) =>
            resolvePermissionAliasCodes(permission).some((code) => normalizedPermissions.has(code.trim().toUpperCase()))
          )),
    )
    .map((item) => {
      if (item.children) {
        return { ...item, children: filterNavByPermissions(item.children, userPermissions) };
      }
      return item;
    });
};

// The server is the authority for which navigation nodes are exposed. The local
// configuration supplies presentation details (icons, workspace actions and routes)
// only; it must never re-introduce a node the server did not return.
const filterNavByServerDecision = (items: NavItem[], allowedIds: Set<string>): NavItem[] =>
  items.flatMap((item) => {
    const children = item.children ? filterNavByServerDecision(item.children, allowedIds) : undefined;
    if (!allowedIds.has(item.id) && (!children || children.length === 0)) return [];
    return [{ ...item, ...(children ? { children } : {}) }];
  });

const flattenNavigationIds = (items: NavItem[]): Set<string> => {
  const ids = new Set<string>();
  const visit = (nodes: NavItem[]) => nodes.forEach((node) => {
    ids.add(node.id);
    if (node.children) visit(node.children);
  });
  visit(items);
  return ids;
};

const flattenNavigationLabels = (items: NavItem[], labels = new Map<string, string>()): Map<string, string> => {
  items.forEach((item) => {
    labels.set(item.id, item.label);
    if (item.children) flattenNavigationLabels(item.children, labels);
  });
  return labels;
};

const applyNavigationLabels = (items: NavItem[], labels: Map<string, string>): NavItem[] =>
  items.map((item) => ({
    ...item,
    label: labels.get(item.id) || item.label,
    ...(item.children ? { children: applyNavigationLabels(item.children, labels) } : {}),
  }));


// Helper function to find parent IDs of active item
const findParentIds = (
  items: NavItem[],
  targetId: string,
  path: string[] = [],
): string[] => {
  for (const item of items) {
    if (item.id === targetId) return path;
    if (item.children) {
      const result = findParentIds(item.children, targetId, [...path, item.id]);
      if (
        result.length > 0 ||
        (result.length === 0 && item.children.some((c) => c.id === targetId))
      ) {
        return [...path, item.id];
      }
    }
  }
  return [];
};

interface SidebarProps {
  isCollapsed: boolean;
  activeId: string;
  onNavigate: (id: string) => void;
  isMobileOpen: boolean;
  onClose: () => void;
  onToggleSidebar: () => void; // Add toggle function
}

interface HoverMenuState {
  isOpen: boolean;
  item: NavItem | null;
  position: { top: number; left: number; showAbove: boolean };
  expandedSubItems: string[];
}

interface TooltipState {
  isVisible: boolean;
  label: string;
  position: { top: number; left: number };
}

export const Sidebar: React.FC<SidebarProps> = React.memo(
  ({
    isCollapsed,
    activeId,
    onNavigate,
    isMobileOpen,
    onClose,
    onToggleSidebar,
  }) => {
    const shouldReduceMotion = useReducedMotion();
    const springConfig = React.useMemo(
      () =>
        shouldReduceMotion
          ? { duration: 0 }
          : { type: "spring" as const, stiffness: 65, damping: 18, mass: 0.9 },
      [shouldReduceMotion],
    );
    const sidebarExpandTransition = React.useMemo(
      () =>
        shouldReduceMotion
          ? { duration: 0 }
          : { duration: 0.36, ease: [0.22, 1, 0.36, 1] as const },
      [shouldReduceMotion],
    );

    const [expandedItems, setExpandedItems] = useState<string[]>([]);

    const [navCounts, setNavCounts] = useState<Record<string, number>>({
      'notifications': 12,
      'pending-review': 0,
      'pending-approval': 0,
      'training-pending-review': 2,
      'training-pending-approval': 4,
    });
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const { user } = useAuth();
    const [authorizedNavigationIds, setAuthorizedNavigationIds] = useState<Set<string> | null>(null);
    const [navigationLabels, setNavigationLabels] = useState<Map<string, string>>(new Map());
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
      let cancelled = false;
      const loadNavigation = () => void navigationApi.getNavigation()
        .then((items) => {
          if (!cancelled) {
            setAuthorizedNavigationIds(flattenNavigationIds(items));
            setNavigationLabels(flattenNavigationLabels(items));
          }
        })
        .catch(() => {
          // Keep the previous server decision if one exists. On an initial temporary
          // outage, local filtering keeps navigation usable; every route/API remains
          // server-authorized and the next mount retries this read-only request.
          if (!cancelled) setAuthorizedNavigationIds(null);
        });
      loadNavigation();
      const refreshInterval = window.setInterval(() => {
        if (!document.hidden) loadNavigation();
      }, 30_000);
      const handleVisibility = () => {
        if (!document.hidden) loadNavigation();
      };
      const handleBrandingUpdated = () => {
        invalidateNavigationCache();
        loadNavigation();
      };
      window.addEventListener('eqms:branding-updated', handleBrandingUpdated);
      document.addEventListener('visibilitychange', handleVisibility);
      return () => {
        cancelled = true;
        window.clearInterval(refreshInterval);
        window.removeEventListener('eqms:branding-updated', handleBrandingUpdated);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }, [user?.id]);

    useEffect(() => {
      let isMounted = true;
      const fetchCounts = async () => {
        try {
          const counts = await documentApi.getPendingCounts();
          if (isMounted) {
            setNavCounts((prev) => ({
              ...prev,
              'pending-review': counts.pendingReview,
              'pending-approval': counts.pendingApproval,
            }));
          }
        } catch (error) {
          console.error("Failed to fetch pending counts:", error);
        }
      };

      fetchCounts();
      return () => {
        isMounted = false;
      };
    }, [location.pathname]);

    useEffect(() => {
      let cancelled = false;
      const loadNotificationSummary = async () => {
        try {
          const summary = await notificationApi.getSummary();
          if (cancelled) return;
          setNavCounts((prev) => ({
            ...prev,
            notifications: summary.unread,
          }));
        } catch (error) {
          console.error("Failed to fetch notification summary:", error);
        }
      };

      void loadNotificationSummary();
      const unsubscribe = subscribeNotificationsChanged(() => {
        void loadNotificationSummary();
      });
      const interval = window.setInterval(() => {
        if (!document.hidden) void loadNotificationSummary();
      }, 30000);
      const handleVisibility = () => {
        if (!document.hidden) void loadNotificationSummary();
      };
      document.addEventListener('visibilitychange', handleVisibility);
      return () => {
        cancelled = true;
        unsubscribe();
        window.clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }, []);

    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [pendingNavId, setPendingNavId] = useState<string | null>(null);
    const [pendingNavLabel, setPendingNavLabel] = useState<string>("");
    const [pendingPageTitle, setPendingPageTitle] = useState<string>("");

    // Backend navigation is the visibility authority; local RBAC is only a temporary
    // availability fallback while its read-only navigation request is unavailable.
    const qualityNav = useMemo(
      () => {
        if (authorizedNavigationIds) {
          return applyNavigationLabels(filterNavByServerDecision(QUALITY_NAV_CONFIG, authorizedNavigationIds), navigationLabels);
        }
        return applyNavigationLabels(filterNavByPermissions(QUALITY_NAV_CONFIG, user?.permissions ?? []), navigationLabels);
      },
      [user?.permissions, authorizedNavigationIds, navigationLabels],
    );
    const [hoverMenu, setHoverMenu] = useState<HoverMenuState>({
      isOpen: false,
      item: null,
      position: { top: 0, left: 0, showAbove: false },
      expandedSubItems: [],
    });
    const [tooltip, setTooltip] = useState<TooltipState>({
      isVisible: false,
      label: "",
      position: { top: 0, left: 0 },
    });

    const currentScreenLabel = useMemo(() => {
      const item = findNodeByPath(NAV_CONFIG, location.pathname);
      return item?.label || "";
    }, [location.pathname]);

    /** Lấy title hiện tại của trang: ưu tiên h1 trong main, rồi document.title, cuối cùng nav label. */
    const getCurrentPageTitle = useCallback(() => {
      const h1 = document.querySelector("main h1");
      const fromH1 = h1?.textContent?.trim();
      const fromDoc =
        typeof document !== "undefined" ? document.title?.trim() : "";
      return fromH1 || fromDoc || currentScreenLabel || "";
    }, [currentScreenLabel]);

    // Auto-expand parent items when activeId changes
    useEffect(() => {
      const parentIds = findParentIds(NAV_CONFIG, activeId);
      if (parentIds.length > 0) {
        setExpandedItems((prev) =>
          Array.from(new Set([...prev, ...parentIds])),
        );
      }
    }, [activeId]);

    // Lock body scroll when mobile sidebar is open
    useEffect(() => {
      if (isMobileOpen) {
        // Save current scroll position
        const scrollY = window.scrollY;
        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = "100%";
        document.body.style.overflow = "hidden";
      } else {
        // Restore scroll position
        const scrollY = document.body.style.top;
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        document.body.style.overflow = "";
        if (scrollY) {
          window.scrollTo(0, parseInt(scrollY || "0") * -1);
        }
      }

      // Cleanup on unmount
      return () => {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        document.body.style.overflow = "";
      };
    }, [isMobileOpen]);

    // Calculate menu position to prevent viewport overflow
    const calculateMenuPosition = useCallback((rect: DOMRect) => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Menu dimensions
      const menuWidth = MENU_WIDTH;
      const menuMaxHeight = MAX_MENU_HEIGHT;
      const safeMargin = SAFE_PADDING;

      // Check available space around the button
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const spaceRight = viewportWidth - rect.right;
      const spaceLeft = rect.left;

      // Determine if menu should show above based on available space
      const shouldShowAbove =
        spaceBelow < menuMaxHeight && spaceAbove > spaceBelow;

      // Horizontal positioning - always to the right of sidebar with gap
      let left: number;
      if (spaceRight >= menuWidth + MENU_GAP) {
        // Show on right side (default)
        left = rect.right + MENU_GAP + window.scrollX;
      } else if (spaceLeft >= menuWidth + MENU_GAP) {
        // Show on left side if no space on right
        left = rect.left - menuWidth - MENU_GAP + window.scrollX;
      } else {
        // Center in viewport if no space on either side
        left = Math.max(
          safeMargin + window.scrollX,
          (viewportWidth - menuWidth) / 2 + window.scrollX,
        );
      }

      // Ensure menu doesn't overflow horizontally
      if (left + menuWidth > viewportWidth + window.scrollX - safeMargin) {
        left = viewportWidth - menuWidth - safeMargin + window.scrollX;
      }
      if (left < safeMargin + window.scrollX) {
        left = safeMargin + window.scrollX;
      }

      // Vertical positioning - align with button center, adjust if needed
      let top: number;

      if (shouldShowAbove) {
        // When showing above, position so bottom of menu aligns near bottom of button
        top = rect.bottom + window.scrollY + safeMargin;
      } else {
        // When showing below, align menu top with button top
        top = rect.top + window.scrollY;
      }

      // Ensure menu stays within viewport bounds
      const menuEstimatedHeight = Math.min(
        menuMaxHeight,
        viewportHeight - 2 * safeMargin,
      );

      if (shouldShowAbove) {
        // For showAbove mode, ensure there's enough space above
        const menuBottom = top;
        const menuTop = menuBottom - menuEstimatedHeight;

        if (menuTop < window.scrollY + safeMargin) {
          // Not enough space above, adjust to fit
          top = window.scrollY + safeMargin + menuEstimatedHeight;
        }
      } else {
        // For normal mode, ensure menu doesn't overflow bottom
        const menuBottom = top + menuEstimatedHeight;

        if (menuBottom > viewportHeight + window.scrollY - safeMargin) {
          // Adjust to fit within viewport
          top = Math.max(
            window.scrollY + safeMargin,
            viewportHeight + window.scrollY - menuEstimatedHeight - safeMargin,
          );
        }
      }

      return { top, left, showAbove: shouldShowAbove };
    }, []);

    // Handle click on menu item (collapsed mode)
    const handleMenuItemClick = useCallback(
      (item: NavItem, event: React.MouseEvent<HTMLButtonElement>) => {
        if (!isCollapsed || !item.children?.length) return;

        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const position = calculateMenuPosition(rect);

        setHoverMenu((prev) => {
          // Toggle: close if same item, open if different
          if (prev.isOpen && prev.item?.id === item.id) {
            return { ...prev, isOpen: false };
          }
          return {
            isOpen: true,
            item,
            position,
            expandedSubItems: [],
          };
        });
      },
      [isCollapsed, calculateMenuPosition],
    );

    // Memoized item click handler
    const handleItemClick = useCallback(
      (item: NavItem) => {
        if (item.children && !isCollapsed) {
          setExpandedItems((prev) =>
            prev.includes(item.id)
              ? prev.filter((i) => i !== item.id)
              : [...prev, item.id],
          );
          return;
        }

        const currentPath = location.pathname;
        const targetPath = item.path
          ? item.path.startsWith("/")
            ? item.path
            : `/${item.path}`
          : null;

        // If no path or same path, just navigate normally
        if (!targetPath || targetPath === currentPath) {
          onNavigate(item.id);
          onClose();
          return;
        }

        // Heuristic: warn when leaving transactional screens (review/new/edit/approval/etc.)
        const shouldWarn = isTransactionalRoute(currentPath);

        if (shouldWarn) {
          setPendingNavId(item.id);
          setPendingNavLabel(item.label);
          setPendingPageTitle(getCurrentPageTitle());
          setShowLeaveModal(true);
          return;
        }

        onNavigate(item.id);
        onClose();
      },
      [isCollapsed, location.pathname, onNavigate, onClose, getCurrentPageTitle, setPendingNavId, setPendingNavLabel, setPendingPageTitle, setShowLeaveModal],
    );

    // Handle tooltip show
    const handleTooltipShow = useCallback(
      (label: string, event: React.MouseEvent<HTMLButtonElement>) => {
        if (!isCollapsed) return;

        const rect = event.currentTarget.getBoundingClientRect();
        setTooltip({
          isVisible: true,
          label,
          position: {
            top: rect.top + rect.height / 2,
            left: rect.right + 8,
          },
        });
      },
      [isCollapsed],
    );

    // Handle tooltip hide
    const handleTooltipHide = useCallback(() => {
      setTooltip((prev) => ({ ...prev, isVisible: false }));
    }, []);

    // Memoized menu item renderer
    const renderMenuItem = useCallback(
      (item: NavItem, level: number = 0, index: number = 0) => {
        const hasChildren = Boolean(item.children?.length);
        const isExpanded = expandedItems.includes(item.id);
        const isActive = activeId === item.id || item.path === location.pathname;
        const rawIcon = item.icon;
        const Icon = typeof rawIcon === "string" ? ICON_MAP[rawIcon] : rawIcon;
        const submenuId = `sidebar-submenu-${item.id}`;
        const paddingLeft = isCollapsed
          ? 0
          : level === 0
            ? BASE_PADDING
            // A shallower third level leaves enough room for operational menu labels.
            : level === 1
              ? BASE_PADDING + LEVEL_PADDING
              : BASE_PADDING + LEVEL_PADDING * 1.5;

        return (
          <>
            {/* Divider before item if specified */}
            {level === 0 && item.showDividerBefore && (
              <div className={cn("my-0.5 md:my-1", isCollapsed ? "mx-3" : "mx-3 md:mx-4")}>
                <div className="h-px bg-slate-200" />
              </div>
            )}
            <div key={item.id} className="w-full relative group/navitem">
              {!isCollapsed && level > 0 && (
                <div
                  className="absolute top-0 bottom-0 border-l border-slate-200 w-px z-0"
                  // Align level two with its parent icon axis; nest level three only as far as
                  // needed to distinguish hierarchy without truncating its label.
                  style={{ left: `${level === 1 ? BASE_PADDING + 4 : BASE_PADDING + LEVEL_PADDING}px` }}
                />
              )}
              <button
                type="button"
                onClick={(e) => {
                  if (isCollapsed && hasChildren) {
                    handleMenuItemClick(item, e);
                  } else {
                    handleItemClick(item);
                  }
                }}
                onMouseEnter={(e) =>
                  level === 0 && handleTooltipShow(item.label, e)
                }
                onMouseLeave={handleTooltipHide}
                aria-expanded={hasChildren ? isExpanded : undefined}
                aria-controls={hasChildren && !isCollapsed ? submenuId : undefined}
                className={cn(
                  "w-full flex items-center group relative overflow-visible z-10 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20",
                  "h-11 md:h-11",
                  isCollapsed ? "justify-center px-0" : "justify-start pr-3",
                  isActive
                    ? "text-emerald-700"
                    : "text-slate-600 hover:text-slate-900 active:bg-slate-100",
                  !isCollapsed && level === 0 && "mx-1.5 md:mx-2",
                )}
                style={{
                  paddingLeft: isCollapsed ? 0 : `${paddingLeft}px`,
                }}
              >
                {/* Sliding active background indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className={cn(
                      "absolute inset-0 z-0 rounded-lg",
                      level === 0
                        ? "bg-emerald-50/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_1px_2px_rgba(16,185,129,0.05),0_0_12px_rgba(16,185,129,0.08)]"
                        : "bg-emerald-50",
                    )}
                    transition={{ type: "tween", duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}

                {/* Active left border indicator (root items only) */}
                {level === 0 && isActive && !isCollapsed && (
                  <motion.div
                    layoutId="activeNavBorder"
                    className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-600 rounded-r-full z-10"
                    transition={{ type: "tween", duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}

                {/* Icon or inherited bullet */}
                <div
                  className={cn(
                    "flex items-center justify-center relative z-10 shrink-0",
                    isCollapsed ? "w-full" : "w-5",
                  )}
                >
                  {Icon && (
                    <motion.div
                      animate={isActive ? { scale: [1, 1.12, 1] } : {}}
                      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5 transition-colors duration-200",
                          isActive
                            ? "text-emerald-700"
                            : item.iconColor
                              ? `${item.iconColor} group-hover:opacity-80`
                              : "text-slate-500 group-hover:text-slate-900",
                        )}
                      />
                    </motion.div>
                  )}
                  {!Icon && level > 0 && !isCollapsed && (
                    <IconPointFilled
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-colors duration-200",
                        isActive ? "text-emerald-600" : "text-slate-300 group-hover:text-slate-900",
                      )}
                    />
                  )}
                </div>

                {/* Label */}
                <div
                  className={cn(
                    "overflow-hidden flex-1 relative z-10",
                    isCollapsed
                      ? "max-w-0 opacity-0 ml-0 transition-all duration-300 ease-in"
                      : "opacity-100 ml-2 transition-all duration-500 ease-out delay-150",
                  )}
                  style={{
                    willChange: isCollapsed ? "auto" : "opacity, max-width",
                  }}
                >
                  <span
                    className={cn(
                      "flex items-center w-full text-left whitespace-nowrap leading-tight",
                      "overflow-hidden",
                      "text-sm",
                      isActive
                        ? "font-semibold text-emerald-700"
                        : "font-medium",
                    )}
                  >
                    <span className="truncate">{item.label}</span>

                    {/* Display count from config, mock state, or auto-detect Pending */}
                    {(() => {
                      const val = item.count ?? navCounts[item.id];
                      if (val === undefined || val <= 0) return null;
                      return (
                        <span
                          className={cn(
                            "ml-auto mr-1.5 text-xs font-semibold text-slate-500",
                            isActive
                              ? "text-emerald-700"
                              : "group-hover/navitem:text-slate-800"
                          )}
                        >
                          ({val})
                        </span>
                      );
                    })()}
                  </span>
                </div>

                {/* Chevron or Star icon */}
                {hasChildren && !isCollapsed && (
                  <div
                    className="ml-auto rounded-lg flex items-center justify-center h-6 w-6 relative z-10 pointer-events-none"
                    aria-hidden="true"
                  >
                    <motion.div
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={sidebarExpandTransition}
                      style={{ display: "flex", originX: "50%", originY: "50%" }}
                    >
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </motion.div>
                  </div>
                )}

              </button>

              {/* Expanded children (only in expanded sidebar) */}
              <AnimatePresence initial={false}>
                {hasChildren && !isCollapsed && isExpanded && (
                  <motion.div
                    id={submenuId}
                    key={`submenu-${item.id}`}
                    initial={{ height: 0, opacity: 0, y: -4 }}
                    animate={{ height: "auto", opacity: 1, y: 0 }}
                    exit={{ height: 0, opacity: 0, y: -4 }}
                    transition={{
                      height: sidebarExpandTransition,
                      opacity: { duration: shouldReduceMotion ? 0 : 0.24 },
                      y: sidebarExpandTransition,
                    }}
                    className="overflow-hidden will-change-[height,opacity,transform]"
                  >
                    <div className="pl-3 py-1">
                      {item.children?.map((child, childIndex) =>
                        renderMenuItem(child, level + 1, childIndex),
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Divider after item if specified */}
            {level === 0 && item.showDividerAfter && (
              <div className={cn("my-0.5 md:my-1", isCollapsed ? "mx-3" : "mx-3 md:mx-4")}>
                <div className="h-px bg-slate-200" />
              </div>
            )}
          </>
        );
      },
      [
        expandedItems,
        activeId,
        isCollapsed,
        handleItemClick,
        handleMenuItemClick,
        handleTooltipShow,
        handleTooltipHide,
        hoverMenu.isOpen,
        hoverMenu.item,
        setHoverMenu,
        onNavigate,
        onClose,
        navCounts,
      ],
    );

    // Close collapsed flyout with Escape for keyboard users
    useEffect(() => {
      if (!hoverMenu.isOpen) return;
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          setHoverMenu((prev) => ({ ...prev, isOpen: false }));
        }
      };
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }, [hoverMenu.isOpen]);

    // Tooltip portal component
    const TooltipPortal = () => {
      if (!tooltip.isVisible || !isCollapsed) return null;

      return createPortal(
        <div
          className="fixed z-[60] px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap pointer-events-none shadow-lg"
          style={{
            top: `${tooltip.position.top}px`,
            left: `${tooltip.position.left}px`,
            transform: "translateY(-50%)",
          }}
        >
          {tooltip.label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-[6px] border-transparent border-r-slate-900" />
        </div>,
        document.body,
      );
    };

    // Handle hover menu sub-item click
    const handleSubItemClick = useCallback(
      (item: NavItem, hasChildren: boolean) => {
        if (hasChildren) {
          setHoverMenu((prev) => ({
            ...prev,
            expandedSubItems: prev.expandedSubItems.includes(item.id)
              ? prev.expandedSubItems.filter((id) => id !== item.id)
              : [...prev.expandedSubItems, item.id],
          }));
          return;
        }

        const currentPath = location.pathname;
        const targetPath = item.path
          ? item.path.startsWith("/")
            ? item.path
            : `/${item.path}`
          : null;

        if (!targetPath || targetPath === currentPath) {
          onNavigate(item.id);
          setHoverMenu((prev) => ({ ...prev, isOpen: false }));
          onClose();
          return;
        }

        if (isTransactionalRoute(currentPath)) {
          setPendingNavId(item.id);
          setPendingNavLabel(item.label);
          setPendingPageTitle(getCurrentPageTitle());
          setShowLeaveModal(true);
          setHoverMenu((prev) => ({ ...prev, isOpen: false }));
          return;
        }

        onNavigate(item.id);
        setHoverMenu((prev) => ({ ...prev, isOpen: false }));
        onClose();
      },
      [onNavigate, onClose, location.pathname, getCurrentPageTitle, isCollapsed, setPendingNavId, setPendingNavLabel, setPendingPageTitle, setShowLeaveModal],
    );

    // Render hover menu sub-item
    const renderHoverSubItem = useCallback(
      (item: NavItem, level: number = 1) => {
        const hasChildren = Boolean(item.children?.length);
        const isExpanded = hoverMenu.expandedSubItems.includes(item.id);
        const isActive = activeId === item.id;

        return (
          <div key={item.id} className="w-full">
            <button
              type="button"
              onClick={() => handleSubItemClick(item, hasChildren)}
              className={cn(
                "w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors group",
                isActive
                  ? "text-emerald-700 bg-emerald-50 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              {level >= 2 && (
                <IconPointFilled
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-colors duration-200",
                    isActive
                      ? "text-emerald-600"
                      : "text-slate-300 group-hover:text-slate-900",
                  )}
                />
              )}
              <span
                className={cn(
                  "flex items-center gap-1.5 flex-1 text-left break-words leading-tight",
                  level >= 2 ? "ml-0" : "ml-3",
                )}
              >
                <span className="truncate">{item.label}</span>
                {(() => {
                  const val = item.count ?? navCounts[item.id];
                  if (val === undefined || val <= 0) return null;
                  return (
                    <span
                      className={cn(
                        "ml-auto text-xs px-1.5 py-0.5 rounded-full font-semibold mr-1.5 min-w-[20px] text-center",
                        isActive
                          ? "bg-emerald-200 text-emerald-900"
                          : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                      )}
                    >
                      {val}
                    </span>
                  );
                })()}
              </span>
              {hasChildren && (
                <div className="rounded-lg flex items-center justify-center h-6 w-6 shrink-0">
                  <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={springConfig}
                    style={{ display: "flex", originX: "50%", originY: "50%" }}
                  >
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </motion.div>
                </div>
              )}
            </button>

            <AnimatePresence initial={false}>
              {hasChildren && isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0, y: -4 }}
                  animate={{ height: "auto", opacity: 1, y: 0 }}
                  exit={{ height: 0, opacity: 0, y: -4 }}
                  transition={{
                    height: sidebarExpandTransition,
                    opacity: { duration: shouldReduceMotion ? 0 : 0.24 },
                    y: sidebarExpandTransition,
                  }}
                  className="overflow-hidden bg-slate-50/50 will-change-[height,opacity,transform]"
                >
                  <div className="pl-3 py-1">
                    {item.children?.map((child) =>
                      renderHoverSubItem(child, level + 1),
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      },
      [hoverMenu.expandedSubItems, activeId, handleSubItemClick, navCounts, shouldReduceMotion, sidebarExpandTransition],
    );

    // Hover menu portal component
    const HoverMenuPortal = () => {
      if (!isCollapsed) return null;

      return createPortal(
        <>
          {/* Invisible backdrop to detect outside clicks */}
          {hoverMenu.isOpen && hoverMenu.item && (
            <div
              className="fixed inset-0 z-40"
              onClick={() => setHoverMenu((prev) => ({ ...prev, isOpen: false }))}
              aria-hidden="true"
            />
          )}

          {/* Animated menu */}
          <AnimatePresence>
            {hoverMenu.isOpen && hoverMenu.item && (
              <div
                key="hover-menu"
                className="fixed z-50"
                style={{
                  top: `${hoverMenu.position.top}px`,
                  left: `${hoverMenu.position.left}px`,
                  transform: hoverMenu.position.showAbove ? "translateY(-100%)" : undefined,
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, x: -6 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95, x: -6 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="min-w-[240px] max-w-[280px] bg-white/90 backdrop-blur-md rounded-xl border border-slate-200 shadow-2xl"
                  style={{
                    transformOrigin: hoverMenu.position.showAbove ? "left bottom" : "left top",
                    maxHeight: "calc(100vh - 32px)",
                    overflow: "hidden",
                  }}
                >
                  {/* Menu header */}
                  <div className="px-4 py-3 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const rawIcon = hoverMenu.item.icon;
                        const Icon = typeof rawIcon === "string" ? ICON_MAP[rawIcon] : rawIcon;
                        if (!Icon) return null;
                        return (
                          <Icon
                            className={cn(
                              "h-5 w-5",
                              hoverMenu.item.iconColor || "text-slate-600",
                            )}
                          />
                        );
                      })()}
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {hoverMenu.item.label}
                      </span>
                      {(() => {
                        const val = hoverMenu.item.count ?? navCounts[hoverMenu.item.id];
                        if (val === undefined || val <= 0) return null;
                        return (
                          <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-600">
                            {val}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Menu items */}
                  <div
                    className="py-1 overflow-y-auto"
                    style={{ maxHeight: "calc(100vh - 120px)", scrollbarWidth: "none" }}
                  >
                    {hoverMenu.item.children?.map((child) =>
                      renderHoverSubItem(child),
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>,
        document.body,
      );
    };

    return (
      <>
        {/* Tooltip Portal */}
        {TooltipPortal()}

        {/* Hover Menu Portal */}
        {HoverMenuPortal()}

        {/* Mobile Overlay Backdrop - Only show on mobile (<768px) */}
        <AnimatePresence>
          {isMobileOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-40 md:hidden"
              onClick={onClose}
              aria-hidden="true"
              style={{
                WebkitTapHighlightColor: "transparent",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside
          className={cn(
            "bg-white border-r border-slate-200 flex flex-col sidebar-mobile",
            "fixed top-0 left-0 bottom-0 z-50",
            "md:sticky md:top-0 md:z-50 md:h-screen",

            isCollapsed
              ? "w-16 md:w-20"
              : "w-[272px] max-w-[92vw]",

            "md:translate-x-0",
            isMobileOpen
              ? "translate-x-0"
              : "-translate-x-full md:translate-x-0",
          )}
          style={{
            transition: "transform 460ms cubic-bezier(0.22, 1, 0.36, 1), width 560ms cubic-bezier(0.22, 1, 0.36, 1)",
            willChange: "transform, width",
            // Safe area for notch/Dynamic Island (top) and landscape edges
            // Bottom is NOT set here - handled by nav container padding for proper scroll
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingLeft: "env(safe-area-inset-left, 0px)",
            // Use dvh for iOS Safari
            height: "100dvh",
            minHeight: "100vh",
          }}
        >
          {/* Header / Logo Area */}
          <div
            className={cn(
              "flex items-center border-b border-slate-100 bg-white relative shrink-0",
              "transition-all duration-500 ease-in-out",
              // Mobile: Higher header with close button
              "h-14 md:h-14",
              isCollapsed ? "justify-center px-0" : "justify-between px-5",
            )}
          >
            {/* Logo */}
            <div
              className={cn(
                "flex items-center justify-center overflow-hidden",
                isCollapsed
                  ? "w-full transition-all duration-350 ease-in"
                  : "flex-1 transition-all duration-500 ease-out",
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center shrink-0",
                  isCollapsed ? "h-10 w-10" : "h-9 w-auto",
                )}
              >
                <BrandLogo
                  className="h-full w-full object-contain"
                  variant={isCollapsed ? "collapsedSidebar" : "default"}
                />
              </div>
            </div>

            {/* Close button for mobile */}
            {!isCollapsed && (
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  "md:hidden flex items-center justify-center h-10 w-10 rounded-lg",
                  "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
                  "transition-colors duration-200 active:scale-95",
                  "-mr-2",
                )}
                aria-label="Close sidebar"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}

            {/* Desktop collapse toggle aligned on right vertical divider */}
            <div className="hidden md:block absolute inset-y-0 right-0 pointer-events-none">
              <div className="absolute inset-y-0 right-0 bg-slate-200" aria-hidden="true" />
              <button
                type="button"
                onClick={onToggleSidebar}
                className={cn(
                  "absolute top-1/2 right-0 z-10 -translate-y-1/2 translate-x-1/2 pointer-events-auto",
                  "relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-lg border border-slate-300 bg-white",
                  "text-slate-600 hover:text-slate-900 hover:border-slate-400 hover:bg-slate-50",
                  "transition-colors duration-200",
                )}
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <motion.div
                  className="absolute will-change-transform"
                  animate={{
                    opacity: isCollapsed ? 1 : 0,
                    rotate: isCollapsed ? 0 : -90,
                    scale: isCollapsed ? 1 : 0.86,
                  }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { duration: 0.52, ease: [0.22, 1, 0.36, 1] }
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </motion.div>
                <motion.div
                  className="absolute will-change-transform"
                  animate={{
                    opacity: isCollapsed ? 0 : 1,
                    rotate: isCollapsed ? 90 : 0,
                    scale: isCollapsed ? 0.86 : 1,
                  }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { duration: 0.52, ease: [0.22, 1, 0.36, 1] }
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </motion.div>
              </button>
            </div>
          </div>

          {/* Search Bar - Only show when expanded, hidden on mobile & tablet */}
          {!isCollapsed && (
            <div className="block px-3 py-3 border-b border-slate-100 shrink-0">
              <SearchDropdown onCloseSidebar={onClose} />
            </div>
          )}

          {/* Navigation Menu */}
          <div
            ref={scrollContainerRef}
            className={cn(
              "sidebar-navigation-scroll flex-1 overflow-y-auto overflow-x-hidden scroll-smooth",
              // Mobile: More padding for easier scrolling
              "pt-1 md:pt-3 md:pb-3",
            )}
            style={{
              // Smooth scrolling on mobile with momentum
              WebkitOverflowScrolling: "touch",
              // Thin and light scrollbar
              scrollbarWidth: "thin",
              scrollbarColor: "#e2e8f0 transparent",
              // Ensure scroll works properly
              overscrollBehavior: "contain",
              // GPU acceleration for smoother scrolling
              willChange: "scroll-position",
              transform: "translateZ(0)",
              // Safe area padding bottom for iPad/iPhone
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
            }}
          >
            <nav
              aria-label="Sidebar navigation"
              className={cn(
                // Mobile: Larger spacing between items
                "space-y-[-1px] md:space-y-0.5",
              )}
            >
              <AnimatePresence initial={false}>
                <motion.div
                  key="sidebar-navigation"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                >
                  {qualityNav.map((item, index) =>
                    renderMenuItem(item, 0, index),
                  )}
                </motion.div>
              </AnimatePresence>
            </nav>

            {/* Extra spacer at bottom for mobile/tablet to ensure last items are accessible */}
            <div
              className="md:hidden shrink-0"
              style={{
                height: "calc(env(safe-area-inset-bottom, 0px) + 40px)",
                minHeight: "40px",
              }}
              aria-hidden="true"
            />
          </div>

        </aside>

        <NavigationGuardModal
          isOpen={showLeaveModal}
          onClose={() => {
            setShowLeaveModal(false);
            setPendingNavId(null);
            setPendingNavLabel("");
            setPendingPageTitle("");
          }}
          onConfirm={() => {
            if (pendingNavId) {
              onNavigate(pendingNavId);
              onClose();
            }
            setShowLeaveModal(false);
            setPendingNavId(null);
            setPendingNavLabel("");
            setPendingPageTitle("");
          }}
          currentPageTitle={pendingPageTitle || currentScreenLabel || "this screen"}
          destinationLabel={pendingNavLabel || "another page"}
        />
      </>
    );
  },
);
