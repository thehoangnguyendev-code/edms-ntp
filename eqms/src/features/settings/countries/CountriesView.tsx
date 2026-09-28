import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Globe2, Search, X, Check, RefreshCw, ChevronUp, ChevronDown } from "lucide-react";
import { Select } from "@/components/ui/select/Select";
import { cn } from "@/components/ui/utils";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { countries as countriesBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { usePortalDropdown } from "@/hooks";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { IconFilter2 } from "@tabler/icons-react";
import { countriesApi } from "@/services/api";
import { useToast } from "@/components/ui/toast";
import { extractApiMessage } from "../shared/utils";
import { useServerTable } from "../shared/hooks/useServerTable";
import { usePermissions } from "@/hooks/usePermissions";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import type { CountryItem } from "./types";

/** Application Settings > Countries -- world countries/territories with dial code, continent, and
 *  IANA (ccTLD) suffix. Live-sourced from REST Countries v5 (https://restcountries.com) via the
 *  backend (RestCountriesClient/CountryManagementService) -- read-only, no local create/edit/
 *  delete/status. Its own top-level menu entry, not part of the "Dictionaries" group. */
export const CountriesView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { scrollerRef, dragEvents } = useTableDragScroll();
  const navigate = useNavigate();
  const [regionFilter, setRegionFilter] = useState(() => searchParams.get("region") ?? "All");
  const [regionOptions, setRegionOptions] = useState<string[]>([]);
  useEffect(() => { void countriesApi.filterOptions().then((result) => setRegionOptions(result.regions)).catch(() => setRegionOptions([])); }, []);
  usePortalDropdown();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("settings.country.manage");

  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["region"]));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { showToast } = useToast();

  const {
    searchQuery, setSearchQuery, currentPage, setCurrentPage, itemsPerPage, setItemsPerPage,
    totalPages, totalItems, items, isLoading, sortConfig, handleSort, reload,
  } = useServerTable<CountryItem>({
    fetcher: countriesApi.page,
    defaultSortBy: "name",
    extraParams: { region: regionFilter === "All" ? undefined : regionFilter },
  });

  React.useLayoutEffect(() => {
    setRegionFilter(searchParams.get("region") ?? "All");
  }, [searchParams]);

  React.useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (regionFilter === "All") params.delete("region");
    else params.set("region", regionFilter);
    if (params.toString() !== searchParams.toString()) setSearchParams(params, { replace: true });
  }, [regionFilter, searchParams, setSearchParams]);

  React.useEffect(() => { setCurrentPage(1); }, [regionFilter, setCurrentPage]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await countriesApi.refresh();
      reload();
      showToast({ type: "success", title: "Countries Refreshed", message: "Latest data pulled from REST Countries." });
    } catch (error) {
      showToast({ type: "error", title: "Refresh Failed", message: extractApiMessage(error, "Unable to refresh countries from REST Countries.") });
    } finally {
      setIsRefreshing(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setRegionFilter("All");
    setCurrentPage(1);
  };
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(section) ? next.delete(section) : next.add(section);
      return next;
    });
  };
  const getOptionClassName = (isActive: boolean) =>
    cn("w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all",
      isActive ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50");

  const columns = [
    { label: "Flag", id: "flag", sortable: false },
    { label: "Country Name", id: "name" },
    { label: "ISO 2", id: "iso2Code" },
    { label: "ISO 3", id: "iso3Code" },
    { label: "Region", id: "region" },
    { label: "Capital", id: "capital" },
    { label: "Dial Code", id: "dialCode" },
    { label: "Population", id: "population" },
    { label: "Area (km²)", id: "area" },
  ];

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title="Countries"
        breadcrumbItems={countriesBreadcrumb(navigate)}
        actions={
          canManage ? (
            <Button size="sm" variant="outline" onClick={() => void handleRefresh()} disabled={isRefreshing} className="gap-2">
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              {isRefreshing ? "Refreshing..." : "Refresh from REST Countries"}
            </Button>
          ) : undefined
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col flex-1">
        <div className="px-4 pt-4 md:p-5 flex flex-col">
          <div className="px-1.5 -mx-1.5 pb-1.5 -mb-1.5">
          <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
            <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" placeholder="Search countries..." value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full h-10 pl-10 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500" />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(""); setCurrentPage(1); }} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button variant="outline" onClick={() => setIsFilterDrawerOpen(true)} className="whitespace-nowrap gap-2">
                <IconFilter2 className="h-4 w-4" />Filters
              </Button>
            </div>
          </div>

          <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              <div className="w-full">
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="text" placeholder="Search countries..." value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-full h-9 pl-10 pr-4 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500" />
                </div>
              </div>
              <div className="w-full">
                <Select label="Region" value={regionFilter}
                  onChange={setRegionFilter}
                  options={[{ label: "All Regions", value: "All" }, ...regionOptions.map((region) => ({ label: region, value: region }))]}
                  placeholder="All Regions" />
              </div>
            <div className="flex items-end">
              <Button variant="outline" size="sm" onClick={clearFilters} className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap">Clear Filters</Button>
            </div>
          </div>
        </div>
        </div>

        <div className="px-4 md:px-5 pb-4 md:pb-5 flex-1 flex flex-col relative">
          {isLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-[4px]">
              <SectionLoading text={searchQuery ? "Searching..." : "Loading countries..."} minHeight="150px" />
            </div>
          )}
        <div className={cn("flex-1 overflow-hidden border border-slate-200 rounded-xl bg-white flex flex-col transition-all duration-300", isLoading && "blur-[2px] opacity-80")}>
          <div ref={scrollerRef} {...dragEvents} className="flex-1 overflow-x-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-30">
                <tr>
                  <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-16">No.</th>
                  {columns.map((col) => {
                    const isSorted = sortConfig.key === col.id;
                    const isSortable = col.sortable !== false;
                    return (
                      <th key={col.id} onClick={() => isSortable && handleSort(col.id)}
                        className={cn(
                          "sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors group",
                          isSortable && "cursor-pointer hover:bg-slate-100 hover:text-slate-700",
                        )}>
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span className="truncate">{col.label}</span>
                          {isSortable && (
                            <div className="flex flex-col text-slate-500 flex-shrink-0 group-hover:text-slate-700 transition-colors">
                              <ChevronUp className={cn("h-3 w-3 -mb-1", isSorted && sortConfig.direction === "asc" ? "text-emerald-600 font-bold" : "")} />
                              <ChevronDown className={cn("h-3 w-3", isSorted && sortConfig.direction === "desc" ? "text-emerald-600 font-bold" : "")} />
                            </div>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {isLoading ? (
                  <tr><td colSpan={columns.length + 1} className="py-14 text-center text-slate-500">Loading countries...</td></tr>
                ) : items.length > 0 ? (
                  items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700 text-center">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.flagUrl ? (
                          <img src={item.flagUrl} alt={`${item.name} flag`} className="h-4 w-6 object-cover rounded-sm border border-slate-200" />
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap font-medium text-slate-900">{item.name}</td>
                      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">{item.iso2Code || "-"}</td>
                      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">{item.iso3Code || "-"}</td>
                      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">{item.region || "-"}</td>
                      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">{item.capital || "-"}</td>
                      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">{item.dialCode || "-"}</td>
                      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">{item.population?.toLocaleString() || "-"}</td>
                      <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">{item.area?.toLocaleString() || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length + 1} className="p-0">
                      <TableEmptyState
                       
                        title="No countries found"
                        description="Try adjusting your search"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!isLoading && totalItems > 0 && (
            <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
          )}
        </div>
      </div>
      </div>

      <FilterDrawer isOpen={isFilterDrawerOpen} onClose={() => setIsFilterDrawerOpen(false)} onClear={clearFilters} onApply={() => setIsFilterDrawerOpen(false)}>
        <FilterAccordionItem label="Region" isExpanded={expandedSections.has("region")} onToggle={() => toggleSection("region")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[{ label: "All Regions", value: "All" }, ...regionOptions.map((region) => ({ label: region, value: region }))].map((opt) => (
              <button key={opt.value} onClick={() => setRegionFilter(opt.value)} className={getOptionClassName(regionFilter === opt.value)}>
                <span className="text-xs">{opt.label}</span>
                {regionFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
};
