import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Bell, ChevronLeft, ChevronRight, Eye, Home, Star, ThumbsUp } from "lucide-react";
import { BrandLogo } from "@/components/branding/BrandLogo";
import { Select } from "@/components/ui/select";
import { cn } from "@/components/ui/utils";
import type { KnowledgePortalOverview } from "@/services/api/knowledge";
import { ExplorerLibraryTree } from "./ExplorerLibraryTree";
import { FOCUS_RING, GROUP_LABEL } from "./explorerStyles";
import { type ExplorerNav, type SmartKey } from "./explorerModel";
import { useFolderColor } from "./ExplorerIcons";

interface ExplorerSidebarProps {
  overview: KnowledgePortalOverview | null;
  nav: ExplorerNav;
  onGo: (nav: ExplorerNav) => void;
  onHierarchyChange: (id: string) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const QUICK: { key: SmartKey | "home"; label: string; Icon: React.ElementType }[] = [
  { key: "home", label: "Home", Icon: Home },
  { key: "featured", label: "Featured", Icon: Star },
  { key: "viewed", label: "Most Viewed", Icon: Eye },
  { key: "useful", label: "Most Helpful", Icon: ThumbsUp },
  { key: "subscribed", label: "Subscribed", Icon: Bell },
];

const itemClass = (active: boolean) =>
  cn(
    "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors md:gap-2.5 md:px-2.5 md:py-2",
    FOCUS_RING,
    active ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-emerald-50/70 hover:text-emerald-700",
  );

export const ExplorerSidebar: React.FC<ExplorerSidebarProps> = ({ overview, nav, onGo, onHierarchyChange, collapsed = false, onToggleCollapsed }) => {
  const reduceMotion = useReducedMotion();
  const colorOf = useFolderColor();
  // each press of a Quick access button shakes its icon once (the number of presses is the key, so the animation starts again)
  const [shakes, setShakes] = useState<Record<string, number>>({});
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
        <h2 className={cn("overflow-hidden whitespace-nowrap px-2.5 text-base font-semibold text-slate-900 transition-[max-height,opacity,margin] duration-300 md:text-sm", collapsed ? "-mb-4 max-h-0 opacity-0" : "max-h-8 opacity-100 delay-100")}>Knowledge Base</h2>

        <div>
          <p className={cn(GROUP_LABEL, "overflow-hidden whitespace-nowrap px-2.5 transition-[max-height,opacity,padding] duration-300", collapsed ? "max-h-0 pb-0 opacity-0" : "max-h-6 pb-1 opacity-100 delay-100")}>Quick access</p>
          <ul className="space-y-0.5">
            {QUICK.map(({ key, label, Icon }) => {
              const count = key === "home" ? undefined : counts[key];
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => { setShakes((current) => ({ ...current, [key]: (current[key] ?? 0) + 1 })); onGo(key === "home" ? { kind: "home" } : { kind: "smart", key }); }}
                    aria-current={isActive(key) ? "page" : undefined}
                    className={cn(itemClass(isActive(key)), collapsed && "justify-center gap-0 px-2 md:gap-0 md:px-2")}
                    title={collapsed ? label : undefined}
                  >
                    <span key={shakes[key] ?? 0} className={cn("inline-flex shrink-0", shakes[key] && "explorer-icon-shake")}>
                      <Icon className="h-5 w-5 shrink-0 md:h-4 md:w-4" aria-hidden="true" />
                    </span>
                    <span className={cn("min-w-0 truncate whitespace-nowrap transition-[max-width,opacity] duration-300", collapsed ? "max-w-0 flex-none opacity-0" : "max-w-[16rem] flex-1 opacity-100 delay-100")}>{label}</span>
                    {count !== undefined && <span className={cn("overflow-hidden text-xs tabular-nums text-slate-400 transition-[max-width,opacity] duration-300", collapsed ? "max-w-0 opacity-0" : "max-w-[4rem] opacity-100 delay-100")}>{count}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {collapsed && (
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
                        active ? "bg-emerald-50" : "hover:bg-emerald-50/70",
                      )}
                    >
                      <span
                        className={cn("h-3 w-3 rounded-[4px] ring-1 ring-inset ring-black/5", active && "ring-2 ring-emerald-500 ring-offset-1")}
                        style={{ backgroundColor: colorOf(kb.key, kb.label) }}
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <div className={cn("min-h-0", collapsed && "hidden")}>
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
            <ExplorerLibraryTree overview={overview} nav={nav} onGo={onGo} />
          )}
        </div>
      </div>
    </nav>
  );
};
