import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ArrowUp, LayoutGrid, List, LayoutDashboard, Menu, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/components/ui/utils";
import { SORT_OPTIONS, type Crumb, type ExplorerNav, type SortKey, type ViewMode } from "./explorerModel";
import { FOCUS_RING, ICON_BUTTON } from "./explorerStyles";
import { ExplorerSearchBox } from "./ExplorerSearchBox";
import { ExplorerOptionsSheet } from "./ExplorerOptionsSheet";
import type { DocumentSuggestion } from "@/services/api/knowledge";
import { useLanguage } from "@/i18n";

interface ExplorerToolbarProps {
  crumbs: Crumb[];
  canBack: boolean;
  canForward: boolean;
  canUp: boolean;
  search: string;
  sort: SortKey;
  view: ViewMode;
  widgetsVisible: boolean;
  widgetsAvailable: boolean;
  searchInputRef: React.Ref<HTMLInputElement>;
  onBack: () => void;
  onForward: () => void;
  onUp: () => void;
  onCrumb: (nav: ExplorerNav) => void;
  onSearch: (value: string) => void;
  /** Search all documents for the typed text now (Enter), without waiting for the pause. */
  onSubmitSearch: () => void;
  onOpenSuggestion: (suggestion: DocumentSuggestion) => void;
  onSort: (value: SortKey) => void;
  onView: (value: ViewMode) => void;
  onToggleWidgets: () => void;
  onOpenMenu: () => void;
}

export const ExplorerToolbar: React.FC<ExplorerToolbarProps> = ({
  crumbs, canBack, canForward, canUp, search, sort, view, widgetsVisible, widgetsAvailable, searchInputRef,
  onBack, onForward, onUp, onCrumb, onSearch, onSubmitSearch, onOpenSuggestion, onSort, onView, onToggleWidgets, onOpenMenu,
}) => {
  const { t, tLabel } = useLanguage();
  const pathRef = useRef<HTMLElement | null>(null);
  const pathSignature = crumbs.map((c) => c.label).join("/");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const currentLabel = crumbs[crumbs.length - 1]?.label ?? "";
  // A long path scrolls, and the folder you are in is always the part that must stay visible.
  useEffect(() => {
    const el = pathRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [pathSignature]);

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 border-b border-slate-200 bg-white px-3 py-2.5 md:px-4">
      <Button variant="ghost" size="icon-sm" onClick={onOpenMenu} aria-label={t("knowledge.openNavigation", "Open navigation")} className={cn(ICON_BUTTON, "md:hidden")}>
        <Menu className="h-[18px] w-[18px]" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onBack} disabled={!canBack} aria-label={t("knowledge.back", "Back")} className={ICON_BUTTON}>
        <ChevronLeft className="h-[18px] w-[18px]" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onForward} disabled={!canForward} aria-label={t("knowledge.forward", "Forward")} className={cn(ICON_BUTTON, "hidden sm:inline-flex")}>
        <ChevronRight className="h-[18px] w-[18px]" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onUp} disabled={!canUp} aria-label={t("knowledge.upOneLevel", "Up one level")} className={ICON_BUTTON}>
        <ArrowUp className="h-4 w-4" />
      </Button>

      {/* A phone has no room for a full path: the folder in view is the title, Back and Up do the rest. */}
      <span className="min-w-0 flex-1 truncate px-1 text-sm font-semibold text-slate-900 sm:hidden" title={currentLabel}>
        {currentLabel}
      </span>

      <nav
        ref={pathRef}
        aria-label={t("knowledge.location", "Location")}
        className="hidden h-9 min-w-0 items-center overflow-x-auto rounded-lg border border-slate-200 bg-white px-1.5 [scrollbar-width:none] sm:mx-1 sm:flex sm:min-w-[16rem] sm:flex-1"
      >
        {crumbs.map((crumb, index) => (
          <React.Fragment key={`${index}-${crumb.label}`}>
            {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden="true" />}
            {crumb.nav ? (
              <button
                type="button"
                onClick={() => crumb.nav && onCrumb(crumb.nav)}
                className={cn("max-w-[12rem] shrink-0 truncate whitespace-nowrap rounded-md px-2 py-1 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-emerald-700", FOCUS_RING)}
              >
                {crumb.label}
              </button>
            ) : (
              <span aria-current="page" className="max-w-[16rem] shrink-0 truncate whitespace-nowrap px-2 py-1 text-sm font-semibold text-slate-900">{crumb.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>

      <div className="flex w-full items-center gap-2 border-t border-slate-100 pt-2">
        <Select
          value={sort}
          onChange={(value) => onSort(value as SortKey)}
          options={SORT_OPTIONS.map((o) => ({ label: tLabel(o.label), value: o.value }))}
          enableSearch={false}
          className="hidden w-36 shrink-0 sm:block"
        />

        <ExplorerSearchBox
          value={search}
          onChange={onSearch}
          inputRef={searchInputRef}
          onSubmit={onSubmitSearch}
          onOpenSuggestion={onOpenSuggestion}
        />

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setOptionsOpen(true)}
          aria-label={t("knowledge.options", "Sort and view options")}
          className={cn(ICON_BUTTON, "h-10 w-10 sm:hidden")}
        >
          <SlidersHorizontal className="h-[18px] w-[18px]" />
        </Button>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <div role="group" aria-label={t("knowledge.view", "View mode")} className="flex rounded-lg bg-slate-100 p-0.5">
            {([["grid", LayoutGrid, t("knowledge.gridView", "Grid view")], ["list", List, t("knowledge.listView", "List view")]] as const).map(([mode, Icon, label]) => (
              <Button
                key={mode}
                variant={view === mode ? "outline-emerald" : "ghost"}
                size="icon-sm"
                onClick={() => onView(mode)}
                aria-label={label}
                aria-pressed={view === mode}
                className={cn("h-10 w-10 md:h-8 md:w-8", view === mode ? "border-transparent bg-white shadow-sm" : "text-slate-500 hover:text-slate-800")}
              >
                <Icon className="h-4 w-4" />
              </Button>
            ))}
          </div>

          {widgetsAvailable && (
            <Button
              variant={widgetsVisible ? "outline-emerald" : "ghost"}
              size="icon-sm"
              onClick={onToggleWidgets}
              aria-label={t("knowledge.showWidgets", "Show widgets")}
              aria-pressed={widgetsVisible}
              className={cn("hidden h-10 w-10 shrink-0 sm:inline-flex md:h-8 md:w-8", widgetsVisible ? "border-transparent bg-emerald-50" : "text-slate-500 hover:text-slate-900")}
            >
              <LayoutDashboard className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <ExplorerOptionsSheet
        open={optionsOpen}
        sort={sort}
        view={view}
        widgetsVisible={widgetsVisible}
        widgetsAvailable={widgetsAvailable}
        onSort={onSort}
        onView={onView}
        onToggleWidgets={onToggleWidgets}
        onClose={() => setOptionsOpen(false)}
      />
    </div>
  );
};
