import React, { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowUp, LayoutGrid, List, LayoutDashboard, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/form/SearchInput";
import { Select } from "@/components/ui/select";
import { cn } from "@/components/ui/utils";
import { SORT_OPTIONS, type Crumb, type ExplorerNav, type SortKey, type ViewMode } from "./explorerModel";
import { FOCUS_RING } from "./explorerStyles";

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
  onSort: (value: SortKey) => void;
  onView: (value: ViewMode) => void;
  onToggleWidgets: () => void;
  onOpenMenu: () => void;
}

const iconButton = "shrink-0 text-slate-500 hover:text-slate-900 disabled:opacity-40";

export const ExplorerToolbar: React.FC<ExplorerToolbarProps> = ({
  crumbs, canBack, canForward, canUp, search, sort, view, widgetsVisible, widgetsAvailable, searchInputRef,
  onBack, onForward, onUp, onCrumb, onSearch, onSort, onView, onToggleWidgets, onOpenMenu,
}) => {
  const pathRef = useRef<HTMLElement | null>(null);
  const pathSignature = crumbs.map((c) => c.label).join("/");
  // A long path scrolls, and the folder you are in is always the part that must stay visible.
  useEffect(() => {
    const el = pathRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [pathSignature]);

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 border-b border-slate-200 bg-white px-3 py-2.5 md:px-4">
      <Button variant="ghost" size="icon-sm" onClick={onOpenMenu} aria-label="Open navigation" className={cn(iconButton, "md:hidden")}>
        <Menu className="h-[18px] w-[18px]" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onBack} disabled={!canBack} aria-label="Back" className={iconButton}>
        <ChevronLeft className="h-[18px] w-[18px]" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onForward} disabled={!canForward} aria-label="Forward" className={cn(iconButton, "hidden sm:inline-flex")}>
        <ChevronRight className="h-[18px] w-[18px]" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onUp} disabled={!canUp} aria-label="Up one level" className={iconButton}>
        <ArrowUp className="h-4 w-4" />
      </Button>

      <nav
        ref={pathRef}
        aria-label="Location"
        className="order-4 flex h-9 min-w-0 basis-full items-center overflow-x-auto rounded-lg border border-slate-200 bg-white px-1.5 [scrollbar-width:none] md:order-none md:mx-1 md:min-w-[16rem] md:flex-1 md:basis-[16rem]"
      >
        {crumbs.map((crumb, index) => (
          <React.Fragment key={`${index}-${crumb.label}`}>
            {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden="true" />}
            {crumb.nav ? (
              <button
                type="button"
                onClick={() => crumb.nav && onCrumb(crumb.nav)}
                className={cn("max-w-[12rem] shrink-0 truncate whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-emerald-700 md:text-sm", FOCUS_RING)}
              >
                {crumb.label}
              </button>
            ) : (
              <span aria-current="page" className="max-w-[16rem] shrink-0 truncate whitespace-nowrap px-2 py-1 text-xs font-semibold text-slate-900 md:text-sm">{crumb.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>

      <div className="order-5 flex w-full items-center gap-2 border-t border-slate-100 pt-2 md:order-none md:basis-full">
        <Select
          value={sort}
          onChange={(value) => onSort(value as SortKey)}
          options={SORT_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
          enableSearch={false}
          className="hidden w-36 shrink-0 sm:block"
        />

        <SearchInput
          value={search}
          onChange={onSearch}
          placeholder="Search all documents"
          ariaLabel="Search all documents"
          inputRef={searchInputRef}
          className="min-w-0 flex-1"
        />

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <div role="group" aria-label="View mode" className="flex rounded-lg bg-slate-100 p-0.5">
            {([["grid", LayoutGrid, "Grid view"], ["list", List, "List view"]] as const).map(([mode, Icon, label]) => (
              <Button
                key={mode}
                variant={view === mode ? "outline-emerald" : "ghost"}
                size="icon-sm"
                onClick={() => onView(mode)}
                aria-label={label}
                aria-pressed={view === mode}
                className={cn("h-9 w-9 md:h-8 md:w-8", view === mode ? "border-transparent bg-white shadow-sm" : "text-slate-500 hover:text-slate-800")}
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
              aria-label="Show widgets"
              aria-pressed={widgetsVisible}
              className={cn("shrink-0", widgetsVisible ? "border-transparent bg-emerald-50" : "text-slate-500 hover:text-slate-900")}
            >
              <LayoutDashboard className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
