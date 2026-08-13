import React, { useState, useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../utils';
import { InlineLoading } from '../loading/Loading';
import { Button } from '../button/Button';
import { Checkbox } from '../checkbox/Checkbox';
import { Popover } from '../popover/Popover';
import { useTranslation } from '@/i18n';

export interface MultiSelectOption {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}

export interface MultiSelectProps {
  label?: string;
  value: (string | number)[];
  onChange: (values: (string | number)[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  triggerClassName?: string;
  enableSearch?: boolean;
  disabled?: boolean;
  maxVisibleRows?: number;
  rowHeight?: number;
  maxVisibleTags?: number;
  isLoading?: boolean;
  loadingText?: string;
  /** Async search function - called (debounced) when user types, instead of client-side filtering. */
  onSearch?: (query: string) => Promise<MultiSelectOption[]>;
  /** Debounce delay for async search (ms) */
  debounceMs?: number;
  /** Minimum characters before triggering search */
  minSearchLength?: number;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  className,
  triggerClassName,
  enableSearch = true,
  disabled = false,
  maxVisibleRows = 5,
  rowHeight = 36,
  maxVisibleTags = 2,
  isLoading = false,
  loadingText,
  onSearch,
  debounceMs = 300,
  minSearchLength = 0,
}) => {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('select.placeholder');
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('select.searchPlaceholder');
  const resolvedLoadingText = loadingText ?? t('select.loadingOptions');
  const selectId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, showAbove: false });
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [asyncOptions, setAsyncOptions] = useState<MultiSelectOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const safeOptions = options.filter(Boolean) as MultiSelectOption[];

  // When onSearch is provided, options come from the server (already filtered) — merge in
  // whatever's currently selected so previously-picked tags/checkboxes stay visible even if
  // they've scrolled out of the latest search result page.
  const displayOptions = onSearch
    ? (() => {
        const merged = new Map<string | number, MultiSelectOption>();
        for (const opt of asyncOptions) merged.set(opt.value, opt);
        for (const opt of safeOptions) {
          if (value.includes(opt.value) && !merged.has(opt.value)) merged.set(opt.value, opt);
        }
        return Array.from(merged.values());
      })()
    : safeOptions;

  const filteredOptions = enableSearch && !onSearch
    ? displayOptions.filter((opt) =>
      opt.label.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : displayOptions;

  // Debounced async search
  useEffect(() => {
    if (!onSearch || !isOpen) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (searchQuery.length < minSearchLength) {
      setAsyncOptions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await onSearch(searchQuery);
        setAsyncOptions(results);
      } catch (error) {
        console.error('Search failed:', error);
        setAsyncOptions([]);
      } finally {
        setIsSearching(false);
      }
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, onSearch, debounceMs, minSearchLength, isOpen]);

  const selectedOptions = displayOptions.filter((opt) => value.includes(opt.value));
  const visibleTags = selectedOptions.slice(0, maxVisibleTags);
  const remainingCount = selectedOptions.length - maxVisibleTags;
  const remainingOptions = selectedOptions.slice(maxVisibleTags);

  // Calculate dropdown position
  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = Math.min(maxVisibleRows * rowHeight + 100, 400); // Estimate dropdown height

      // Show above if not enough space below and more space above
      const showAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

      setPosition({
        top: showAbove ? rect.top - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        showAbove,
      });
    }
  };

  // Handle open/close
  const handleOpen = () => {
    if (disabled) return;
    updatePosition();
    setIsOpen(true);
    setSearchQuery("");
    setFocusedIndex(-1);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery("");
    setFocusedIndex(-1);
  };

  const handleToggleOption = (optionValue: string | number) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const handleRemoveTag = (optionValue: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== optionValue));
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      onChange([]);
    } else {
      onChange(filteredOptions.map(opt => opt.value));
    }
  };

  const isAllSelected = filteredOptions.length > 0 &&
    filteredOptions.every(opt => value.includes(opt.value));

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(filteredOptions.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
          handleToggleOption(filteredOptions[focusedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        handleClose();
        triggerRef.current?.focus();
        break;
      case 'Tab':
        handleClose();
        break;
    }
  };

  // Scroll focused option into view
  useEffect(() => {
    if (focusedIndex >= 0 && optionRefs.current[focusedIndex]) {
      optionRefs.current[focusedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [focusedIndex]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      handleClose();
    };

    // Delay to avoid catching the opening click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && enableSearch && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, enableSearch]);

  // Update position on scroll/resize
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  // Close other dropdowns
  useEffect(() => {
    const handleCloseOthers = (e: CustomEvent<{ id: string }>) => {
      if (e.detail.id !== selectId && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('select-open' as any, handleCloseOthers);
    return () => window.removeEventListener('select-open' as any, handleCloseOthers);
  }, [selectId, isOpen]);

  const handleTriggerClick = () => {
    if (isOpen) {
      handleClose();
    } else {
      window.dispatchEvent(new CustomEvent('select-open', { detail: { id: selectId } }));
      handleOpen();
    }
  };

  const searchHeight = enableSearch ? 62 : 0;
  const footerHeight = 56;
  const dropdownMaxHeight = maxVisibleRows * rowHeight + searchHeight + footerHeight + 10;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {label && (
        <label htmlFor={`${selectId}-trigger`} className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        ref={triggerRef}
        id={`${selectId}-trigger`}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${selectId}-listbox`}
        onClick={handleTriggerClick}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border bg-white px-3 text-sm transition-colors focus:outline-none",
          "h-9",
          disabled
            ? "bg-slate-100 text-slate-600 cursor-default border-slate-200"
            : isOpen
              ? "border-emerald-500 ring-1 ring-emerald-500"
              : "border-slate-200 hover:border-slate-300 focus-visible:ring-1 focus-visible:ring-emerald-500 focus-visible:border-emerald-500",
          triggerClassName
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          {selectedOptions.length === 0 ? (
            <span className="text-slate-400 text-left truncate">{resolvedPlaceholder}</span>
          ) : (
            <>
              {visibleTags.map((option) => (
                <span
                  key={option.value}
                  className={cn(
                    "inline-flex min-w-0 max-w-full shrink items-center gap-1 rounded-xl py-0 pl-1.5 pr-0.5 text-[10px]",
                    disabled
                      ? "bg-slate-100 text-slate-600 border border-slate-200"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveTag(option.value, e)}
                    className={cn(
                      "rounded-md p-0.5 flex items-center justify-center transition-colors",
                      disabled
                        ? "hover:bg-slate-200/70 text-slate-500"
                        : "hover:bg-emerald-200/50"
                    )}
                    aria-label={`Remove ${option.label}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </>
          )}
        </div>
        <div className="ml-1 flex shrink-0 items-center gap-1.5">
          {remainingCount > 0 && (
            <Popover
              title="Selected"
              placement="top"
              triggerAriaLabel={`View ${remainingCount} more selected items`}
              trigger={<span className="text-[10px] font-medium">+{remainingCount}</span>}
              triggerClassName="inline-flex items-center rounded-lg bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-slate-500 hover:bg-slate-200"
              contentClassName="min-w-[180px] max-w-[280px]"
              content={
                <div className="space-y-0.5">
                  {remainingOptions.map(opt => (
                    <div key={opt.value} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-50">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      <span className="truncate pr-2 text-xs font-medium text-slate-700">{opt.label}</span>
                    </div>
                  ))}
                </div>
              }
            />
          )}

          {selectedOptions.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label={t('select.clearAll')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-400 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Dropdown */}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={dropdownRef}
              className="fixed overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.14)]"
              role="listbox"
              aria-multiselectable="true"
              id={`${selectId}-listbox`}
              initial={{ opacity: 0, y: position.showAbove ? 10 : -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: position.showAbove ? 10 : -10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.85 }}
              style={{
                top: position.showAbove ? 'auto' : position.top,
                bottom: position.showAbove ? `${window.innerHeight - position.top}px` : 'auto',
                left: position.left,
                width: position.width,
                zIndex: 50,
                maxHeight: dropdownMaxHeight,
                transformOrigin: position.showAbove ? 'bottom center' : 'top center',
              }}
            >
              {/* Search */}
              {enableSearch && (
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={resolvedSearchPlaceholder}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[16px] outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 sm:text-sm"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                    />
                  </div>
                </div>
              )}

              {/* Options */}
              <div
                className="custom-scrollbar overflow-y-auto overscroll-contain p-2"
                style={{ maxHeight: maxVisibleRows * rowHeight }}
                onKeyDown={handleKeyDown}
              >
                {isLoading || isSearching ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-2">
                    <InlineLoading size="sm" />
                    <span className="text-sm text-slate-500">
                      {isSearching ? t('select.searching') : resolvedLoadingText}
                    </span>
                  </div>
                ) : filteredOptions.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">
                    No results found
                  </div>
                ) : (
                  <>
                    {/* Options List */}
                    {filteredOptions.map((option, index) => {
                      const isSelected = value.includes(option.value);
                      const isFocused = index === focusedIndex;
                      return (
                        <button
                          key={option.value}
                          ref={el => { optionRefs.current[index] = el; }}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleToggleOption(option.value)}
                          className={cn(
                            "mb-0.5 flex w-full items-center gap-1.5 rounded-lg px-2.5 text-sm transition-colors last:mb-0",
                            "min-h-[44px] sm:min-h-[36px] hover:bg-slate-100 active:bg-slate-200/70",
                            isSelected && "bg-emerald-50 text-emerald-700",
                            isFocused && "bg-slate-100 ring-1 ring-inset ring-slate-300"
                          )}
                          style={window.innerWidth >= 640 ? { height: rowHeight } : undefined}
                        >
                          <Checkbox checked={isSelected} className="min-h-0 shrink-0 pointer-events-none" />
                          {option.icon && <span className="shrink-0 text-slate-500">{option.icon}</span>}
                          <span className="flex-1 text-left font-medium text-slate-700">{option.label}</span>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearAll}
                  disabled={value.length === 0}
                  className="h-8 px-3"
                >
                  Reset
                </Button>

                <Button
                  type="button"
                  variant={isAllSelected ? 'outline-emerald' : 'default'}
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={filteredOptions.length === 0}
                  className="h-8 px-3"
                >
                  {isAllSelected ? t('select.deselectAll') : t('select.selectAll')}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
