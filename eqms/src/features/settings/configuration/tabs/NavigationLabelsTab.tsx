import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Menu, RotateCcw, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge/Badge';
import { Button } from '@/components/ui/button/Button';
import { Switch } from '@/components/ui/switch/Switch';
import { cn } from '@/components/ui/utils';
import { NAVIGATION_LABEL_OPTIONS } from '@/app/navigation';
import { GeneralConfig } from '../types';

interface NavigationLabelsTabProps {
  config: GeneralConfig;
  onChange: (config: GeneralConfig) => void;
}

export const NavigationLabelsTab: React.FC<NavigationLabelsTabProps> = ({ config, onChange }) => {
  const [search, setSearch] = useState('');
  const [showOnlyCustomized, setShowOnlyCustomized] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const overrides = config.navigationLabelOverrides || {};
  const overrideCount = Object.keys(overrides).length;

  const handleNavigationLabelChange = (menuId: string, defaultLabel: string, value: string) => {
    // Keep the raw value while editing so spaces can be entered naturally. Values are
    // normalized on blur/save instead of on every keystroke.
    const normalized = value.slice(0, 80);
    const next = { ...overrides };
    if (normalized === defaultLabel) {
      delete next[menuId];
    } else {
      next[menuId] = normalized;
    }
    onChange({ ...config, navigationLabelOverrides: next });
  };

  const handleNavigationLabelBlur = (menuId: string, defaultLabel: string, value: string) => {
    const normalized = value.trim().slice(0, 80);
    const next = { ...overrides };
    if (!normalized || normalized === defaultLabel) {
      delete next[menuId];
    } else {
      next[menuId] = normalized;
    }
    onChange({ ...config, navigationLabelOverrides: next });
  };

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const map = new Map<string, typeof NAVIGATION_LABEL_OPTIONS>();
    NAVIGATION_LABEL_OPTIONS.forEach((option) => {
      const isCustomized = Boolean(overrides[option.id]);
      if (showOnlyCustomized && !isCustomized) return;
      if (query && !option.hierarchy.toLowerCase().includes(query) && !option.id.includes(query)) return;
      const groupName = option.hierarchy.split(' › ')[0] || 'Other';
      if (!map.has(groupName)) map.set(groupName, []);
      map.get(groupName)!.push(option);
    });
    return Array.from(map.entries());
  }, [search, showOnlyCustomized, overrides]);

  // While searching or filtering, expand every matching group so results are never hidden
  // behind a collapsed accordion the user hasn't opened yet.
  const effectiveOpenGroups = useMemo(() => {
    if (search.trim() || showOnlyCustomized) {
      return new Set(groups.map(([name]) => name));
    }
    return openGroups;
  }, [groups, openGroups, search, showOnlyCustomized]);

  const toggleGroup = (name: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const totalMatches = groups.reduce((sum, [, items]) => sum + items.length, 0);

  return (
    <div className="p-4 md:p-5 space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 md:px-5 py-4 border-b border-slate-100">
          <span className="text-emerald-600"><Menu className="h-4 w-4" /></span>
          <h3 className="text-sm font-semibold text-slate-900">Navigation, Breadcrumbs &amp; Page Titles</h3>
        </div>

        <div className="p-4 md:p-5 space-y-4">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 text-xs sm:text-sm text-slate-700">
            <p>Set the display name used by the sidebar, matching breadcrumbs and page titles across the system. Routes, permissions, icons and menu hierarchy are not changed.</p>
            <p className="mt-1 text-slate-500">Leave a name unchanged to use the built-in default. Changes apply after Save and are loaded from the server for every user. The Dashboard breadcrumb icon is fixed and cannot be changed.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
              <span className="text-xs font-medium text-slate-500">Total menus</span>
              <Badge color="slate">{NAVIGATION_LABEL_OPTIONS.length}</Badge>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5">
              <span className="text-xs font-medium text-emerald-700">Customized</span>
              <Badge color="emerald">{overrideCount}</Badge>
            </div>
            <label className="ml-auto flex items-center gap-2 text-xs sm:text-sm text-slate-700 cursor-pointer select-none">
              <Switch checked={showOnlyCustomized} onChange={setShowOnlyCustomized} />
              Show customized only
            </label>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              id="sidebar-menu-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by menu name or key..."
              className="block h-9 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-9 text-sm placeholder:text-slate-400 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-[36rem] overflow-y-auto pr-1">
            {groups.map(([groupName, items]) => {
              const isOpen = effectiveOpenGroups.has(groupName);
              const customizedInGroup = items.filter((item) => overrides[item.id]).length;
              return (
                <div key={groupName} className="rounded-lg border border-slate-200 bg-slate-50/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleGroup(groupName)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-100/70"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800">{groupName}</p>
                      {customizedInGroup > 0 && <Badge color="emerald">{customizedInGroup} customized</Badge>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge color="slate">{items.length}</Badge>
                      <ChevronDown
                        className={cn("h-4 w-4 text-slate-400 transition-transform duration-300", isOpen && "rotate-180")}
                      />
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 90, damping: 16 }}
                        className="overflow-hidden"
                      >
                        <div className="divide-y divide-slate-100 border-t border-slate-200 bg-white">
                          {items.map((option) => {
                            const override = overrides[option.id];
                            const currentLabel = override ?? option.defaultLabel;
                            const segments = option.hierarchy.split(' › ');
                            return (
                              <div
                                key={option.id}
                                className="grid grid-cols-1 gap-2 p-3 md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.9fr)_auto] md:items-center"
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
                                    {segments.map((segment, index) => (
                                      <React.Fragment key={`${option.id}-${index}`}>
                                        {index > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
                                        <span className={index === segments.length - 1 ? "font-medium text-slate-800" : ""}>
                                          {segment}
                                        </span>
                                      </React.Fragment>
                                    ))}
                                  </div>
                                  <p className="mt-0.5 text-2xs text-slate-400">Menu key: {option.id}</p>
                                </div>
                                <input
                                  value={currentLabel}
                                  maxLength={80}
                                  onChange={(event) => handleNavigationLabelChange(option.id, option.defaultLabel, event.target.value)}
                                  onBlur={(event) => handleNavigationLabelBlur(option.id, option.defaultLabel, event.target.value)}
                                  aria-label={`Display name for ${option.hierarchy}`}
                                  className={cn(
                                    "h-9 w-full rounded-lg border bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:border-emerald-500 focus:ring-emerald-500",
                                    override ? "border-emerald-300" : "border-slate-200",
                                  )}
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={!override}
                                  onClick={() => handleNavigationLabelChange(option.id, option.defaultLabel, option.defaultLabel)}
                                  className="gap-1.5"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Reset
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            {totalMatches === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">No sidebar menu matches this search.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
