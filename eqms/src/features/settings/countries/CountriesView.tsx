import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Globe2, Search, X, Check, RefreshCw } from "lucide-react";
import { Select } from "@/components/ui/select/Select";
import { cn } from "@/components/ui/utils";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { countries as countriesBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { usePortalDropdown } from "@/hooks";
import {
  FilterDrawer,
  FilterAccordionItem,
} from "@/components/ui/filter/FilterDrawer";
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
  const [regionFilter, setRegionFilter] = useState(
    () => searchParams.get("region") ?? "All",
  );
  const [regionOptions, setRegionOptions] = useState<string[]>([]);
  useEffect(() => {
    void countriesApi
      .filterOptions()
      .then((result) => setRegionOptions(result.regions))
      .catch(() => setRegionOptions([]));
  }, []);
  usePortalDropdown();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("settings.country.manage");

  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["region"]),
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { showToast } = useToast();

  const {
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    totalItems,
    items,
    isLoading,
    sortConfig,
    handleSort,
    reload,
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
    if (params.toString() !== searchParams.toString())
      setSearchParams(params, { replace: true });
  }, [regionFilter, searchParams, setSearchParams]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [regionFilter, setCurrentPage]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await countriesApi.refresh();
      reload();
      showToast({
        type: "success",
        title: "Countries Refreshed",
        message: "Latest data pulled from REST Countries.",
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "Refresh Failed",
        message: extractApiMessage(
          error,
          "Unable to refresh countries from REST Countries.",
        ),
      });
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
    cn(
      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all",
      isActive
        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
    );

  const columns: DataTableColumn<CountryItem>[] = [
    {
      id: "rowNumber",
      header: "No.",
      headerClassName: "w-16 text-center",
      cellClassName: "text-center",
      cell: (_, index) => (currentPage - 1) * itemsPerPage + index + 1,
    },
    {
      id: "flag",
      header: "Flag",
      cell: (item) =>
        item.flagUrl ? (
          <img
            src={item.flagUrl}
            alt={`${item.name} flag`}
            className="h-4 w-6 object-cover rounded-sm border border-slate-200"
          />
        ) : (
          <span className="text-slate-300">-</span>
        ),
    },
    {
      id: "name",
      header: "Country Name",
      sort: {
        direction: sortConfig.key === "name" ? sortConfig.direction : undefined,
        onSort: () => handleSort("name"),
      },
      cellClassName: "font-medium text-slate-900",
      cell: (item) => item.name,
    },
    {
      id: "iso2Code",
      header: "ISO 2",
      sort: {
        direction:
          sortConfig.key === "iso2Code" ? sortConfig.direction : undefined,
        onSort: () => handleSort("iso2Code"),
      },
      cell: (item) => item.iso2Code || "-",
    },
    {
      id: "iso3Code",
      header: "ISO 3",
      sort: {
        direction:
          sortConfig.key === "iso3Code" ? sortConfig.direction : undefined,
        onSort: () => handleSort("iso3Code"),
      },
      cell: (item) => item.iso3Code || "-",
    },
    {
      id: "region",
      header: "Region",
      sort: {
        direction:
          sortConfig.key === "region" ? sortConfig.direction : undefined,
        onSort: () => handleSort("region"),
      },
      cell: (item) => item.region || "-",
    },
    {
      id: "capital",
      header: "Capital",
      sort: {
        direction:
          sortConfig.key === "capital" ? sortConfig.direction : undefined,
        onSort: () => handleSort("capital"),
      },
      cell: (item) => item.capital || "-",
    },
    {
      id: "dialCode",
      header: "Dial Code",
      sort: {
        direction:
          sortConfig.key === "dialCode" ? sortConfig.direction : undefined,
        onSort: () => handleSort("dialCode"),
      },
      cell: (item) => item.dialCode || "-",
    },
    {
      id: "population",
      header: "Population",
      sort: {
        direction:
          sortConfig.key === "population" ? sortConfig.direction : undefined,
        onSort: () => handleSort("population"),
      },
      cell: (item) => item.population?.toLocaleString() || "-",
    },
    {
      id: "area",
      header: "Area (km²)",
      sort: {
        direction: sortConfig.key === "area" ? sortConfig.direction : undefined,
        onSort: () => handleSort("area"),
      },
      cell: (item) => item.area?.toLocaleString() || "-",
    },
  ];

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title="Countries"
        breadcrumbItems={countriesBreadcrumb(navigate)}
        actions={
          canManage ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw
                className={cn("h-4 w-4", isRefreshing && "animate-spin")}
              />
              {isRefreshing ? "Refreshing..." : "Refresh from REST Countries"}
            </Button>
          ) : undefined
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col flex-1">
        <div className="px-4 pt-4 md:p-5 flex flex-col">
          <div className="px-1.5 -mx-1.5 pb-1.5 -mb-1.5">
            <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
              <label className="text-xs sm:text-sm font-medium text-slate-700 block">
                Search
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search countries..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full h-10 pl-10 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setCurrentPage(1);
                      }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setIsFilterDrawerOpen(true)}
                  className="whitespace-nowrap gap-2"
                >
                  <IconFilter2 className="h-4 w-4" />
                  Filters
                </Button>
              </div>
            </div>

            <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              <div className="w-full">
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search countries..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full h-9 pl-10 pr-4 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="w-full">
                <Select
                  label="Region"
                  value={regionFilter}
                  onChange={setRegionFilter}
                  options={[
                    { label: "All Regions", value: "All" },
                    ...regionOptions.map((region) => ({
                      label: region,
                      value: region,
                    })),
                  ]}
                  placeholder="All Regions"
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-5 pb-4 md:pb-5 flex-1 flex flex-col relative">
          <DataTable
            rows={items}
            columns={columns}
            getRowKey={(item) => item.id}
            isLoading={isLoading}
            loadingContent={
              <SectionLoading
                text={searchQuery ? "Searching..." : "Loading countries..."}
                minHeight="150px"
              />
            }
            emptyState={
              <TableEmptyState
                title="No countries found"
                description="Try adjusting your search"
              />
            }
            scrollerRef={scrollerRef}
            scrollProps={dragEvents}
            pagination={
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            }
          />
        </div>
      </div>

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={clearFilters}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        <FilterAccordionItem
          label="Region"
          isExpanded={expandedSections.has("region")}
          onToggle={() => toggleSection("region")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[
              { label: "All Regions", value: "All" },
              ...regionOptions.map((region) => ({
                label: region,
                value: region,
              })),
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRegionFilter(opt.value)}
                className={getOptionClassName(regionFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {regionFilter === opt.value && (
                  <Check size={16} className="text-emerald-500" />
                )}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
};
