import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, ChevronLeft, ChevronRight, Eye, Home, LayoutPanelLeft, Star, ThumbsUp } from "lucide-react";
import { BrandLogo } from "@/components/branding/BrandLogo";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/components/ui/utils";
import type { KnowledgePortalOverview } from "@/services/api/knowledge";
import { FOCUS_RING, GROUP_LABEL } from "./explorerStyles";
import { folderColor, type ExplorerNav, type SmartKey } from "./explorerModel";

interface ExplorerSidebarProps {
  overview: KnowledgePortalOverview | null;
  nav: ExplorerNav;
  onGo: (nav: ExplorerNav) => void;
  onHierarchyChange: (id: string) => void;
  onOpenClassic: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const QUICK: { key: SmartKey | "home"; label: string; Icon: React.ElementType }[] = [
  { key: "home", label: "Home", Icon: Home },
  { key: "featured", label: "Featured", Icon: Star },
  { key: "viewed", label: "Most viewed", Icon: Eye },
  { key: "useful", label: "Most helpful", Icon: ThumbsUp },
  { key: "subscribed", label: "Subscribed", Icon: Bell },
];

const itemClass = (active: boolean) =>
  cn(
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors md:text-sm",
    FOCUS_RING,
    active ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
  );

export const ExplorerSidebar: React.FC<ExplorerSidebarProps> = ({ overview, nav, onGo, onHierarchyChange, onOpenClassic, collapsed = false, onToggleCollapsed }) => {
  const reduceMotion = useReducedMotion();
  const counts: Partial<Record<SmartKey, number>> = {
    featured: overview?.featured.length ?? 0,
    viewed: overview?.mostViewed.length ?? 0,
    useful: overview?.mostUseful.length ?? 0,
    subscribed: overview?.knowledgeBases.filter((kb) => kb.subscribed).length ?? 0,
  };
  const activeKbKey = nav.kind === "kb" ? nav.kb.key : null;
  const isActive = (key: SmartKey | "home") => (key === "home" ? nav.kind === "home" : nav.kind === "smart" && nav.key === key);

  return (
    <nav aria-label="Knowledge Base navigation" className="relative z-10 flex h-full min-h-0 flex-col overflow-visible bg-white">
      {/* Same header as the application sidebar: the logo configured under Settings > Configuration > General. */}
      <div className={cn("relative flex h-14 shrink-0 items-center justify-center border-b border-slate-100 transition-all duration-300", collapsed ? "px-2" : "px-5")}>
        <div className={cn("flex items-center justify-center overflow-hidden", collapsed ? "h-10 w-10" : "h-9 w-full")}>
          <BrandLogo className="h-full w-full object-contain" variant={collapsed ? "collapsedSidebar" : "default"} />
        </div>
        {onToggleCollapsed && (
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden md:block">
            <div className="absolute inset-y-0 right-0 w-px bg-slate-200" />
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              title={collapsed ? "Expand navigation" : "Collapse navigation"}
              className="pointer-events-auto absolute right-0 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 translate-x-1/2 items-center justify-center overflow-hidden rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
            >
              <motion.div
                className="absolute will-change-transform"
                animate={{ opacity: collapsed ? 1 : 0, rotate: collapsed ? 0 : -90, scale: collapsed ? 1 : 0.86 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <ChevronRight className="h-4 w-4" />
              </motion.div>
              <motion.div
                className="absolute will-change-transform"
                animate={{ opacity: collapsed ? 0 : 1, rotate: collapsed ? 90 : 0, scale: collapsed ? 0.86 : 1 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <ChevronLeft className="h-4 w-4" />
              </motion.div>
            </button>
          </div>
        )}
      </div>

      <div className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-3.5 custom-scrollbar", collapsed ? "px-2" : "px-2.5")}>
        {!collapsed && <h2 className="px-2.5 text-sm font-semibold text-slate-900">Knowledge Base</h2>}

        <div>
          {!collapsed && <p className={cn(GROUP_LABEL, "px-2.5 pb-1")}>Quick access</p>}
          <ul className="space-y-0.5">
            {QUICK.map(({ key, label, Icon }) => {
              const count = key === "home" ? undefined : counts[key];
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => onGo(key === "home" ? { kind: "home" } : { kind: "smart", key })}
                    aria-current={isActive(key) ? "page" : undefined}
                    className={cn(itemClass(isActive(key)), collapsed && "justify-center px-2")}
                    title={collapsed ? label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
                    {!collapsed && count !== undefined && <span className="text-2xs tabular-nums text-slate-400 md:text-xs">{count}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {collapsed ? (
          <div className="border-t border-slate-100 pt-3" aria-label="Knowledge Bases">
            <ul className="space-y-1">
              {overview?.knowledgeBases.map((kb) => {
                const active = activeKbKey === kb.key;
                return (
                  <li key={kb.key}>
                    <button
                      type="button"
                      onClick={() => onGo({ kind: "kb", kb: { key: kb.key, label: kb.label }, path: [] })}
                      aria-current={active ? "page" : undefined}
                      aria-label={`Open ${kb.label}`}
                      title={kb.label}
                      className={cn(
                        "flex w-full justify-center rounded-lg p-2 transition-colors",
                        FOCUS_RING,
                        active ? "bg-emerald-50" : "hover:bg-slate-50",
                      )}
                    >
                      <span
                        className={cn("h-3 w-3 rounded-[4px] ring-1 ring-inset ring-black/5", active && "ring-2 ring-emerald-500 ring-offset-1")}
                        style={{ backgroundColor: folderColor(kb.label) }}
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : <div className="min-h-0">
          <p className={cn(GROUP_LABEL, "px-2.5 pb-1")}>
            Library{overview?.determinatorLabel ? ` · by ${overview.determinatorLabel}` : ""}
          </p>
          {(overview?.hierarchies.length ?? 0) > 1 && (
            <div className="px-1 pb-2">
              <Select
                label="Hierarchy"
                value={overview?.selectedHierarchyId ?? ""}
                onChange={(value) => onHierarchyChange(String(value))}
                options={(overview?.hierarchies ?? []).map((h) => ({ label: h.isDefault ? `${h.name} (default)` : h.name, value: h.id }))}
                enableSearch={false}
              />
            </div>
          )}
          {!overview?.selectedHierarchyId ? (
            <p className="px-2.5 py-2 text-xs text-slate-500">No hierarchy is configured yet.</p>
          ) : overview.knowledgeBases.length === 0 ? (
            <p className="px-2.5 py-2 text-xs text-slate-500">No documents yet.</p>
          ) : (
            <ul className="space-y-0.5">
              <AnimatePresence initial={false}>
                {overview.knowledgeBases.map((kb) => (
                  <motion.li
                    key={kb.key}
                    initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.18 }}
                  >
                    <button
                      type="button"
                      onClick={() => onGo({ kind: "kb", kb: { key: kb.key, label: kb.label }, path: [] })}
                      aria-current={activeKbKey === kb.key ? "page" : undefined}
                      className={itemClass(activeKbKey === kb.key)}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: folderColor(kb.label) }} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{kb.label}</span>
                      {kb.subscribed && <Bell className="h-3 w-3 shrink-0 text-emerald-600" aria-label="Subscribed" />}
                      <span className="text-2xs tabular-nums text-slate-400 md:text-xs">{kb.documentCount}</span>
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>}
      </div>

      <div className={cn("shrink-0 border-t border-slate-100", collapsed ? "p-2" : "p-2.5")}>
        <Button variant="outline" size="sm" fullWidth={!collapsed} onClick={onOpenClassic} aria-label="Open classic view" title={collapsed ? "Open classic view" : undefined} className={cn("gap-2", collapsed && "w-full px-0")}>
          <LayoutPanelLeft className="h-4 w-4" aria-hidden="true" />
          {!collapsed && "Open classic view"}
        </Button>
      </div>
    </nav>
  );
};
