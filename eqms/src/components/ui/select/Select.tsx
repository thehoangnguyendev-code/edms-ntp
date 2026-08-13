import React, { useState, useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../utils';
import { InlineLoading } from '../loading/Loading';
import { useTranslation } from '@/i18n';

export interface SelectOption {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}

export interface SelectOptionGroup {
  groupLabel: string;
  options: SelectOption[];
}

export interface SelectProps {
  label?: React.ReactNode;
  value: string | number;
  onChange: (value: any) => void;
  options: SelectOption[];
  /** Grouped options (alternative to options) */
  groups?: SelectOptionGroup[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  triggerClassName?: string;
  enableSearch?: boolean;
  disabled?: boolean;
  maxVisibleRows?: number;
  rowHeight?: number;
  isLoading?: boolean;
  loadingText?: string;
  /** Async search function - called when user types */
  onSearch?: (query: string) => Promise<SelectOption[]>;
  /** Debounce delay for async search (ms) */
  debounceMs?: number;
  /** Minimum characters before triggering search */
  minSearchLength?: number;
}

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
  groups,
  placeholder,
  searchPlaceholder,
  className,
  triggerClassName,
  enableSearch = true,
  disabled = false,
  maxVisibleRows = 5,
  rowHeight = 40,
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
  const [asyncOptions, setAsyncOptions] = useState<SelectOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Flatten groups to options for internal use
  const safeOptions = options.filter(Boolean) as SelectOption[];
  const safeGroups = groups
    ?.filter(Boolean)
    .map((group) => ({
      ...group,
      options: group.options.filter(Boolean) as SelectOption[],
    }));
  const allOptions = safeGroups ? safeGroups.flatMap(g => g.options) : safeOptions;

  const displayOptions = onSearch && asyncOptions.length > 0 ? asyncOptions : allOptions;

  const filteredOptions = enableSearch && !onSearch
    ? displayOptions.filter((opt) =>
      opt.label.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : displayOptions;

  // Filter groups based on search
  const filteredGroups = safeGroups && enableSearch && !onSearch
    ? safeGroups.map(g => ({
      ...g,
      options: g.options.filter(opt =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter(g => g.options.length > 0)
    : safeGroups;

  const selectedOption = displayOptions.find((opt) => opt.value === value);

  // Debounced async search
  useEffect(() => {
    if (!onSearch || !isOpen) return;

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Check min length
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

  // Calculate dropdown position
  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Estimate dropdown height
      const searchHeight = enableSearch ? 56 : 0;
      const maxHeight = maxVisibleRows * rowHeight + searchHeight + 8;
      const estimatedDropdownHeight = maxHeight;

      // Determine if dropdown should open above or below
      const shouldShowAbove = spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow;

      setPosition({
        top: shouldShowAbove ? rect.top - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        showAbove: shouldShowAbove,
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

  const handleSelect = (optionValue: string | number) => {
    onChange(optionValue);
    handleClose();
  };

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
          handleSelect(filteredOptions[focusedIndex].value);
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

  const searchHeight = enableSearch ? 56 : 0;
  const dropdownMaxHeight = maxVisibleRows * rowHeight + searchHeight + 8;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {label && (
        <label htmlFor={`${selectId}-trigger`} className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
          {typeof label === "string" && /\*\s*$/.test(label) ? (
            <>
              {label.replace(/\s*\*\s*$/, "")} <span className="text-red-500">*</span>
            </>
          ) : (
            label
          )}
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
          "flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2.5 text-sm transition-colors focus:outline-none",
          "h-9 min-h-[36px]",
          disabled
            ? "bg-slate-100 text-slate-600 cursor-default border-slate-200"
            : isOpen
              ? "border-emerald-500 ring-1 ring-emerald-500"
              : "border-slate-200 hover:border-slate-300 focus-visible:ring-1 focus-visible:ring-emerald-500 focus-visible:border-emerald-500",
          triggerClassName
        )}
      >
        <span className={cn(
          "min-w-0 flex-1 truncate text-left",
          selectedOption ? (disabled ? "text-slate-600 font-medium" : "text-slate-700 font-medium") : "text-slate-400",
        )}>
          {selectedOption ? selectedOption.label : resolvedPlaceholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-slate-400 transition-transform shrink-0 ml-2",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={dropdownRef}
              role="listbox"
              id={`${selectId}-listbox`}
              initial={{ opacity: 0, y: position.showAbove ? 10 : -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: position.showAbove ? 10 : -10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.85 }}
              className="fixed bg-white rounded-xl border border-slate-200 shadow-[0_20px_60px_rgba(15,23,42,0.14)] overflow-hidden"
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
                <div className="p-2 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={resolvedSearchPlaceholder}
                      className="w-full h-9 pl-9 pr-3 text-[16px] sm:text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                    />
                  </div>
                </div>
              )}

              {/* Options */}
              <div
                className="overflow-y-auto overscroll-contain custom-scrollbar"
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
                ) : groups && filteredGroups ? (
                  // Render grouped options
                  filteredGroups.map((group, groupIndex) => (
                    <div key={group.groupLabel} className="py-1">
                      <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200">
                        {group.groupLabel}
                      </div>
                      {group.options.map((option, optionIndex) => {
                        const flatIndex = filteredGroups
                          .slice(0, groupIndex)
                          .reduce((sum, g) => sum + g.options.length, 0) + optionIndex;
                        const isSelected = value === option.value;
                        const isFocused = flatIndex === focusedIndex;
                        return (
                          <button
                            key={option.value}
                            ref={el => { optionRefs.current[flatIndex] = el; }}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => handleSelect(option.value)}
                            className={cn(
                              "flex w-full items-center px-3 text-sm transition-colors",
                              "min-h-[44px] hover:bg-slate-50 active:bg-slate-100",
                              isSelected && "bg-emerald-50 text-emerald-700",
                              isFocused && "bg-slate-100 ring-1 ring-inset ring-slate-300"
                            )}
                            style={{ height: rowHeight }}
                          >
                            <span className="flex-1 text-left">{option.label}</span>
                            <span className="flex items-center gap-2 shrink-0 ml-2">
                              {option.icon}
                              {isSelected && (
                                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))
                ) : (
                  // Render flat options
                  filteredOptions.map((option, index) => {
                    const isSelected = value === option.value;
                    const isFocused = index === focusedIndex;
                    return (
                      <button
                        key={option.value}
                        ref={el => { optionRefs.current[index] = el; }}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(option.value)}
                        className={cn(
                          "flex w-full items-center px-3 text-sm transition-colors",
                          "min-h-[44px] hover:bg-slate-50 active:bg-slate-100",
                          isSelected && "bg-emerald-50 text-emerald-700",
                          isFocused && "bg-slate-100 ring-1 ring-inset ring-slate-300"
                        )}
                        style={{ height: rowHeight }}
                      >
                        <span className="flex-1 text-left">{option.label}</span>
                        <span className="flex items-center gap-2 shrink-0 ml-2">
                          {option.icon}
                          {isSelected && (
                            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                          )}
                        </span>
                      </button>
                    );
                  }))
                }
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
