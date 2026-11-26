import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search, X } from 'lucide-react';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { Badge } from '@/components/ui/badge/Badge';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/components/ui/utils';
import { useAuth } from '@/contexts/AuthContext';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsap';
import type { GlobalSearchItem } from '@/services/api/search';
import { readableCode } from '@/utils/machineText';
import { STATUS_LABEL as TRAINING_STATUS_LABEL } from '@/features/training-activities/shared/trainingLabels';
import { getStatusBadgeColor } from '@/utils/status';
import {
  GLOBAL_SEARCH_ICONS,
  MIN_GLOBAL_SEARCH_LENGTH,
  clearRecentSearches,
  globalSearchRoute,
  readRecentSearches,
  rememberSearchResult,
  type RecentSearchItem,
} from './globalSearchModel';
import { useGlobalSearch } from './useGlobalSearch';
import { useQuickPlaces } from './useQuickPlaces';
import { tr, trFormat } from "@/i18n";

gsap.registerPlugin(ScrollToPlugin);

/** The rows that arrive in one go are staggered; past this many the later ones would come after the person has started reading. */
const MAX_ANIMATED_ROWS = 10;

interface Row {
  /** Which heading the row sits under. */
  sectionKey: string;
  sectionLabel: string;
  /** The kind of record (or of quick place): decides the icon and where a result opens. */
  groupKey: string;
  groupLabel: string;
  item: GlobalSearchItem;
  /** Set for a quick place, which opens a page of the menu directly. */
  path?: string;
  /** What a quick place shows on the right instead of a status. */
  count?: number;
  /** A result of a search, as opposed to a quick place: only these are remembered. */
  remember: boolean;
  /** The id of the option in the list, for the screen readers. */
  optionId: string;
}

/**
 * The status a person reads. A list that sends a machine value (IN_PROGRESS) is shown by the label of its own screen where there is one (Training), and
 * otherwise by the same words made readable; a status that already is a label ("Pending Training") is left as it is. Display only, never sent back.
 */
const statusLabel = (groupKey: string, badge: string): string => {
  if (groupKey === 'training' && TRAINING_STATUS_LABEL[badge]) return TRAINING_STATUS_LABEL[badge];
  return /^[A-Z][A-Z0-9_]*$/.test(badge) ? readableCode(badge) : badge;
};

const rowElement = (id: string | undefined) => (id ? (document.getElementById(id) as HTMLElement | null) : null);

/**
 * The search box in the middle of the screen. With nothing typed it offers what waits for the person, the results they opened last and a few pages;
 * from two characters on it shows what the server found, a few of each kind they may open. Arrow keys move, Enter opens, Esc closes.
 *
 * Motion (GSAP, off with "reduce motion"): the box rises out of a soft blur and settles, and leaves quicker; the rows that are new rise in one after the other;
 * the highlight is one block that slides from row to row while the list scrolls to it with the same ease.
 */
export const GlobalSearchDialog: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const seenRows = useRef<Set<string>>(new Set());
  const highlightPlaced = useRef(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<RecentSearchItem[]>([]);
  /** The box stays in the page while it plays its closing motion, when `isOpen` already says it is closed. */
  const [present, setPresent] = useState(false);
  const { groups, loading, answered, failed } = useGlobalSearch(query, isOpen);
  const quick = useQuickPlaces(isOpen);

  const searching = query.trim().length >= MIN_GLOBAL_SEARCH_LENGTH;

  useLayoutEffect(() => {
    if (isOpen) setPresent(true);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActive(0);
    setRecent(readRecentSearches(user?.id));
    const focus = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(focus);
  }, [isOpen, user?.id]);

  const rows = useMemo<Row[]>(() => {
    if (searching) {
      return groups.flatMap((group) => group.items.map((item) => ({
        sectionKey: group.key,
        sectionLabel: tr(group.label),
        groupKey: group.key,
        groupLabel: tr(group.label),
        item,
        remember: true,
        optionId: `${listId}-${group.key}-${item.id}`,
      })));
    }
    const recentRows: Row[] = recent.map((entry) => ({
      sectionKey: 'recent', sectionLabel: tr('Recent'), groupKey: entry.groupKey, groupLabel: tr(entry.groupLabel), item: entry.item,
      remember: true, optionId: `${listId}-recent-${entry.groupKey}-${entry.item.id}`,
    }));
    const attentionRows: Row[] = quick.attention.map((place) => ({
      sectionKey: 'attention', sectionLabel: tr('Needs attention'), groupKey: 'attention', groupLabel: tr('Needs attention'),
      item: { id: place.id, title: place.title }, path: place.path, count: place.count, remember: false, optionId: `${listId}-attention-${place.id}`,
    }));
    const goToRows: Row[] = quick.goTo.map((place) => ({
      sectionKey: 'goto', sectionLabel: tr('Go to'), groupKey: 'goto', groupLabel: tr('Go to'),
      item: { id: place.id, title: place.title }, path: place.path, remember: false, optionId: `${listId}-goto-${place.id}`,
    }));
    return [...attentionRows, ...recentRows, ...goToRows];
  }, [searching, groups, recent, quick, listId]);

  useEffect(() => setActive(0), [rows.length, searching]);

  const open = useCallback((row: Row) => {
    const route = row.path ?? globalSearchRoute(row.groupKey, row.item);
    if (!route) return;
    if (row.remember) rememberSearchResult(user?.id, { groupKey: row.groupKey, groupLabel: row.groupLabel, item: row.item });
    onClose();
    navigate(route);
  }, [navigate, onClose, user?.id]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (rows.length > 0) setActive((index) => (index + 1) % rows.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (rows.length > 0) setActive((index) => (index - 1 + rows.length) % rows.length);
    } else if (event.key === 'Enter' && rows[active]) {
      event.preventDefault();
      open(rows[active]);
    }
  };

  // The highlight slides from row to row and the list scrolls to the active row with the same ease, so the arrow keys move smoothly.
  useLayoutEffect(() => {
    const list = listRef.current;
    const inner = innerRef.current;
    const highlight = highlightRef.current;
    const row = rowElement(rows[active]?.optionId);
    if (!isOpen || !list || !inner || !highlight || !row) {
      if (highlight) gsap.set(highlight, { opacity: 0 });
      highlightPlaced.current = false;
      return;
    }
    const rowBox = row.getBoundingClientRect();
    const top = rowBox.top - inner.getBoundingClientRect().top;
    const target = { y: top, height: rowBox.height, opacity: 1 };
    if (!highlightPlaced.current || prefersReducedMotion()) {
      gsap.set(highlight, target);
      highlightPlaced.current = true;
    } else {
      gsap.to(highlight, { ...target, duration: 0.18, ease: 'power2.out', overwrite: 'auto' });
    }
    // keep the active row in view, with a little air around it (and the heading of its section when it is the first of it)
    const margin = 10;
    const viewTop = list.scrollTop;
    const viewBottom = viewTop + list.clientHeight;
    let scrollTo: number | null = null;
    if (top < viewTop + margin) scrollTo = Math.max(0, top - (row.previousElementSibling ? margin : 40));
    else if (top + rowBox.height > viewBottom - margin) scrollTo = top + rowBox.height - list.clientHeight + margin;
    if (scrollTo !== null) {
      if (prefersReducedMotion()) list.scrollTop = scrollTo;
      else gsap.to(list, { scrollTo: { y: scrollTo, autoKill: true }, duration: 0.28, ease: 'power2.out', overwrite: 'auto' });
    }
  }, [active, rows, isOpen]);

  // New words bring a new list: it starts again from the top, smoothly.
  const wordsKey = query.trim().toLowerCase();
  useEffect(() => {
    const list = listRef.current;
    if (!isOpen || !list || list.scrollTop === 0) return;
    if (prefersReducedMotion()) list.scrollTop = 0;
    else gsap.to(list, { scrollTo: { y: 0, autoKill: true }, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
  }, [wordsKey, isOpen]);

  // Opening and closing: the veil fades, the box rises out of a soft blur and settles; closing is the same, quicker, and only then the box leaves the page.
  useGSAP(() => {
    const backdrop = backdropRef.current;
    const panel = panelRef.current;
    if (!backdrop || !panel) {
      if (!isOpen) setPresent(false);
      return;
    }
    timeline.current?.kill();
    if (isOpen) {
      seenRows.current = new Set();
      highlightPlaced.current = false;
    }
    if (prefersReducedMotion()) {
      gsap.set([backdrop, panel], { clearProps: 'all' });
      if (!isOpen) setPresent(false);
      return;
    }
    if (isOpen) {
      timeline.current = gsap.timeline()
        .fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.28, ease: 'power1.out' }, 0)
        .fromTo(panel, { opacity: 0, y: -22, scale: 0.955, filter: 'blur(8px)' }, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.42, ease: 'power3.out', clearProps: 'filter' }, 0.02);
    } else {
      timeline.current = gsap.timeline({ onComplete: () => setPresent(false) })
        .to(panel, { opacity: 0, y: -12, scale: 0.975, duration: 0.2, ease: 'power2.in' }, 0)
        .to(backdrop, { opacity: 0, duration: 0.22, ease: 'power1.in' }, 0.02);
    }
  }, { dependencies: [isOpen], scope: rootRef, revertOnUpdate: false });

  // The rows that were not there a moment ago rise in one after the other; a move of the highlight or a refresh of the same rows moves nothing.
  const rowSignature = rows.map((row) => row.optionId).join('\u0001');
  useGSAP(() => {
    if (!isOpen || rows.length === 0) return;
    const fresh = rows.map((row) => row.optionId).filter((id) => !seenRows.current.has(id));
    rows.forEach((row) => seenRows.current.add(row.optionId));
    if (fresh.length === 0 || prefersReducedMotion()) return;
    const elements = fresh.slice(0, MAX_ANIMATED_ROWS).map((id) => rowElement(id)).filter((el): el is HTMLElement => !!el);
    if (elements.length === 0) return;
    gsap.fromTo(elements, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.32, ease: 'power2.out', stagger: { each: 0.03, amount: 0.24 }, clearProps: 'opacity,transform', delay: 0.1 });
  }, { dependencies: [rowSignature, isOpen], scope: rootRef });

  const unavailable = searching ? groups.filter((group) => group.unavailable) : [];
  const emptyAnswer = searching && answered && !loading && rows.length === 0 && unavailable.length === 0;

  // Consecutive rows of one section are drawn under one heading; the same order drives the arrow keys.
  const sections: { key: string; label: string; rows: Row[] }[] = [];
  for (const row of rows) {
    const last = sections[sections.length - 1];
    if (last && last.key === row.sectionKey) last.rows.push(row);
    else sections.push({ key: row.sectionKey, label: row.sectionLabel, rows: [row] });
  }

  if (!isOpen && !present) return null;

  return createPortal(
    // The box is centred by this flex row, not by a translate: GSAP animates `transform`, which would replace one.
    <div ref={rootRef} className="fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[10vh] md:pt-[16vh]" onKeyDown={onKeyDown}>
      <div ref={backdropRef} className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={tr("Search")}
        className="relative flex max-h-[76vh] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-[0_24px_64px_-12px_rgba(15,23,42,0.45),0_6px_16px_-4px_rgba(15,23,42,0.15)] will-change-transform"
      >
        <div className="relative flex shrink-0 items-center gap-3 border-b border-slate-200 px-4">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tr("Search documents, users, trainings, pages…")}
            aria-label={tr("Search")}
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls={listId}
            aria-activedescendant={rows[active]?.optionId}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            maxLength={100}
            className="h-14 min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600" aria-label={tr("Clear search")}>
              <X className="h-4 w-4" />
            </button>
          )}
          <Kbd keys={['escape']} className="hidden md:inline-flex" />
          {loading && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 animate-pulse bg-emerald-500" />}
        </div>

        <div ref={listRef} id={listId} role="listbox" aria-label={tr("Results")} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 [scrollbar-gutter:stable] scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300">
          <div ref={innerRef} className="relative">
            <div ref={highlightRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 rounded-xl bg-slate-100 opacity-0" />
            {sections.map((section) => (
              <div key={section.key} role="group" aria-label={section.label} className="relative mb-1">
                <div className="flex items-center justify-between px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-slate-500">
                  <span>{section.label}</span>
                  {section.key === 'recent' && (
                    <button type="button" onClick={() => { clearRecentSearches(user?.id); setRecent([]); }} className="font-medium normal-case tracking-normal text-slate-500 hover:text-emerald-700 hover:underline">
                      {tr("Clear")}
                    </button>
                  )}
                </div>
                {section.rows.map((row) => {
                  const Icon = GLOBAL_SEARCH_ICONS[row.groupKey] ?? Search;
                  const index = rows.indexOf(row);
                  const isActive = index === active;
                  const badge = row.item.badge ? statusLabel(row.groupKey, row.item.badge) : null;
                  const color = badge ? getStatusBadgeColor(badge) : undefined;
                  const rawSubtitle = row.sectionKey === 'recent' ? `${row.groupLabel}${row.item.subtitle ? ' · ' : ''}${row.item.subtitle ?? ''}` : row.item.subtitle;
                  const subtitle = rawSubtitle?.split(' > ').map((part) => tr(part)).join(' > ');
                  return (
                    <div
                      key={row.optionId}
                      id={row.optionId}
                      role="option"
                      aria-selected={isActive}
                      onMouseMove={() => { if (!isActive) setActive(index); }}
                      onClick={() => open(row)}
                      className="relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5"
                    >
                      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors duration-150', isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-50 text-emerald-700')}>
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          {row.item.code && <code className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-800">{row.item.code}</code>}
                          <span className="block min-w-0 truncate text-sm font-semibold text-slate-900">{tr(row.item.title)}</span>
                        </span>
                        {subtitle && <span className="mt-0.5 block truncate text-xs text-slate-500">{subtitle}</span>}
                      </span>
                      {typeof row.count === 'number' && <Badge color="amber" size="xs">{row.count}</Badge>}
                      {badge && <Badge color={color ?? 'slate'} size="xs">{badge}</Badge>}
                      <CornerDownLeft className={cn('hidden h-4 w-4 shrink-0 text-slate-400 transition-opacity duration-150 md:block', isActive ? 'opacity-100' : 'opacity-0')} />
                    </div>
                  );
                })}
              </div>
            ))}

            {unavailable.map((group) => (
              <p key={group.key} className="relative px-3 py-2 text-xs text-amber-700">{group.label} {tr("could not be searched just now. Try again.")}</p>
            ))}

            {failed && !loading && rows.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-slate-500">{tr("The search is not available right now. Try again in a moment.")}</p>
            )}
            {emptyAnswer && !failed && (
              <div className="px-3 py-10 text-center">
                <p className="text-sm font-medium text-slate-700">{trFormat("No results for “{query}”", { query: query.trim() })}</p>
                <p className="mt-1 text-xs text-slate-500">{tr("Check the spelling, or try a number, a name or part of a title.")}</p>
              </div>
            )}
            {!searching && rows.length === 0 && (
              <div className="px-3 py-10 text-center">
                <p className="text-sm font-medium text-slate-700">{tr("Search everything you can open")}</p>
                <p className="mt-1 text-xs text-slate-500">{trFormat("Type at least {count} characters: a document number, a name, a training number or a page.", { count: MIN_GLOBAL_SEARCH_LENGTH })}</p>
              </div>
            )}
            {searching && loading && rows.length === 0 && !failed && (
              <div className="space-y-2 p-3" aria-hidden="true">
                {[0, 1, 2].map((i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100" />)}
              </div>
            )}
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-4 border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-2xs text-slate-500 md:flex">
          <span className="inline-flex items-center gap-1.5"><span className="inline-flex gap-0.5"><Kbd keys={['up']} size="sm" className="bg-slate-200/70" /><Kbd keys={['down']} size="sm" className="bg-slate-200/70" /></span>{tr("to move")}</span>
          <span className="inline-flex items-center gap-1.5"><Kbd keys={['enter']} size="sm" className="bg-slate-200/70" />{tr("to open")}</span>
          <span className="inline-flex items-center gap-1.5"><Kbd keys={['escape']} size="sm" className="bg-slate-200/70" />{tr("to close")}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
};
