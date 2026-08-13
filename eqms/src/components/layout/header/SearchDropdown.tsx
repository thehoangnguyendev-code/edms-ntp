import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, AlertTriangle, Settings } from 'lucide-react';
import { cn } from '../../ui/utils';
import { ICON_MAP } from '@/app/constants';
import { navigationApi, FlatMenuItem } from '@/services/api';

interface SearchDropdownProps {
  className?: string;
  onCloseSidebar?: () => void;
}

export const SearchDropdown: React.FC<SearchDropdownProps> = ({ className, onCloseSidebar }) => {
  const navigate = useNavigate();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Debounce search query (300ms)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  const [filteredNavItems, setFilteredNavItems] = useState<FlatMenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch navigation search results from server when debouncedQuery changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setFilteredNavItems([]);
      return;
    }

    let isMounted = true;
    const fetchSearchResults = async () => {
      setIsLoading(true);
      try {
        const results = await navigationApi.searchNavigation(debouncedQuery);
        if (isMounted) {
          setFilteredNavItems(results);
        }
      } catch (error) {
        console.error("Failed to fetch search results from server:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchSearchResults();
    return () => {
      isMounted = false;
    };
  }, [debouncedQuery]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Close search dropdown with Escape
      if (e.key === 'Escape' && isSearchFocused) {
        setIsSearchFocused(false);
        searchInputRef.current?.blur();
      }
      // Search all results with Enter
      if (e.key === 'Enter' && isSearchFocused && debouncedQuery.trim()) {
        handleSearchAll();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchFocused, debouncedQuery]);

  // Close search dropdown when clicking outside
  useEffect(() => {
    if (!isSearchFocused) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      // Check if click is outside both the search container AND the dropdown
      if (searchContainerRef.current && !searchContainerRef.current.contains(target) &&
        searchDropdownRef.current && !searchDropdownRef.current.contains(target)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isSearchFocused]);

  const handleSearchAll = () => {
    console.log("Search all results for:", debouncedQuery);
    setIsSearchFocused(false);
    // TODO: Navigate to search results page or trigger global search
  };

  const handleRecentItemClick = (item: string) => {
    console.log("Navigate to:", item);
    setIsSearchFocused(false);
    setSearchQuery("");
    setDebouncedQuery("");
    // TODO: Navigate to specific document/deviation
  };

  const handleNavItemClick = (path: string) => {
    navigate(path);
    setIsSearchFocused(false);
    setSearchQuery("");
    setDebouncedQuery("");
    onCloseSidebar?.();
  };

  return (
    <>
      {/* Overlay */}
      {isSearchFocused && createPortal(
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsSearchFocused(false)}
        />,
        document.body
      )}

      <div ref={searchContainerRef} className={cn("relative z-50 w-full max-w-xl lg:max-w-2xl", className)}>
        {/* Input Wrapper */}
        <div className="relative z-50 group">
          <div className="absolute inset-y-0 left-0 pl-3 md:pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-slate-400" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "block w-full h-9 pl-9 sm:pl-10 py-2 md:py-2.5 rounded-lg border leading-5 transition-all duration-200",
              "text-sm md:text-[14px]",
              "placeholder-slate-400 focus:outline-none",
              isSearchFocused
                ? "bg-white ring-1 ring-emerald-500 border-emerald-500"
                : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
            )}
            placeholder="Search features, pages..."
            onFocus={() => setIsSearchFocused(true)}
          />
        </div>

        {/* Quick Results Dropdown - Only show when typing */}
        {isSearchFocused && debouncedQuery.trim() && createPortal(
          <div
            ref={searchDropdownRef}
            className="fixed z-[60] bg-white rounded-lg border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
            style={{
              top: `${searchContainerRef.current?.getBoundingClientRect().bottom! + window.scrollY + 8}px`,
              left: `${searchContainerRef.current?.getBoundingClientRect().left! + window.scrollX}px`,
              width: `${searchContainerRef.current?.getBoundingClientRect().width}px`
            }}
          >
            {/* Search Results */}
            <div className="max-h-[400px] overflow-y-auto">
              <div className="p-2">
                {isLoading ? (
                  <div className="px-3 py-8 text-center flex flex-col items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-500 border-t-transparent" />
                    <p className="text-xs text-slate-400">Searching...</p>
                  </div>
                ) : filteredNavItems.length > 0 ? (
                  <>
                    <div className="px-3 py-2 text-sm font-medium text-slate-500">
                      Features & Pages
                    </div>
                    {filteredNavItems.map((navItem) => {
                      const rawIcon = navItem.icon;
                      const Icon = typeof rawIcon === "string" ? ICON_MAP[rawIcon] : rawIcon;
                      return (
                        <button
                          type="button"
                          key={navItem.id}
                          onClick={() => handleNavItemClick(navItem.path)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-emerald-50 rounded-lg transition-colors text-left group"
                        >
                          <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                            {Icon && <Icon className="h-4 w-4 text-emerald-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 truncate">{navItem.label}</p>
                            {navItem.fullPath && navItem.fullPath !== navItem.label && (
                              <p className="text-xs text-slate-500 truncate">{navItem.fullPath}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </>
                ) : (
                  <div className="px-3 py-8 text-center">
                    <p className="text-sm text-slate-500">No results found for "{debouncedQuery}"</p>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">Try a different search term</p>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </>
  );
};
