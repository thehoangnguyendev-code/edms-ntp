import React, { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, Search, Users, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar/Avatar";
import { Button } from "@/components/ui/button/Button";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { FormModal } from "@/components/ui/modal/FormModal";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { cn } from "@/components/ui/utils";
import { useDebounce, useTableDragScroll } from "@/hooks";
import { metadataApi } from "@/services/api/metadata";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

export interface SimulatorActor {
  id: string;
  fullName: string;
  email?: string;
  employeeCode?: string;
  department?: string;
  position?: string;
}

interface ActorPickerModalProps {
  isOpen: boolean;
  selectedActor: SimulatorActor | null;
  onClose: () => void;
  onSelect: (actor: SimulatorActor) => void;
}

const PAGE_SIZE = 5;
type SortField = "fullName" | "department" | "position";
type SortDir = "asc" | "desc";
const SORTABLE_COLUMNS: { field: SortField; label: string }[] = [
  { field: "fullName", label: "User" },
  { field: "department", label: "Department" },
  { field: "position", label: "Position" },
];

export const ActorPickerModal: React.FC<ActorPickerModalProps> = ({
  isOpen,
  selectedActor,
  onClose,
  onSelect,
}) => {
  const [actors, setActors] = useState<SimulatorActor[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>("fullName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [isLoading, setIsLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const debouncedQuery = useDebounce(query, 300);
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setIsLoading(true);
    setError(null);
    metadataApi.getUsersLookupPaged({
      page,
      limit: PAGE_SIZE,
      search: debouncedQuery.trim() || undefined,
      sortBy,
      sortDir,
    })
      .then((response) => {
        if (!active) return;
        setActors(response.data.map((user) => ({
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          employeeCode: user.employeeCode,
          department: user.department,
          position: user.position,
        })));
        setTotalItems(response.pagination.total);
        setTotalPages(response.pagination.totalPages);
      })
      .catch(() => {
        if (active) setError("Unable to load active users. Please try again.");
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => { active = false; };
  }, [debouncedQuery, isOpen, page, refreshKey, sortBy, sortDir]);

  const updateQuery = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const toggleSort = (field: SortField) => {
    if (field === sortBy) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(1);
  };

  const retry = () => {
    setRefreshKey((current) => current + 1);
  };

  const chooseActor = (actor: SimulatorActor) => {
    onSelect(actor);
    onClose();
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Choose actor"
      description="Select an active user to evaluate. This does not perform an action as that user."
      size="2xl"
      showFooter={false}
      className="max-w-4xl"
    >
      <div className="space-y-4">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Search name, email, employee code, department..."
            className="block w-full pl-10 pr-10 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => updateQuery("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {selectedActor && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar name={selectedActor.fullName} tone="brand" className="h-8 w-8 text-2xs" />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-emerald-900">Selected: {selectedActor.fullName}</p>
                {selectedActor.email && <p className="truncate text-2xs text-emerald-700">{selectedActor.email}</p>}
              </div>
            </div>
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
          </div>
        )}

        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center transition-all duration-300">
              <SectionLoading text="Searching..." minHeight="150px" />
            </div>
          )}
          <div
            className={cn(
              "border border-slate-200 rounded-xl overflow-hidden flex flex-col bg-white transition-all duration-300",
              isLoading && "blur-[2px] opacity-80",
            )}
          >
            {error ? (
              <div className="py-2">
                <TableEmptyState
                 
                  title="Could not load users"
                  description={error}
                />
                <div className="flex justify-center pb-6"><Button size="sm" variant="outline" onClick={retry}>Try again</Button></div>
              </div>
            ) : actors.length === 0 ? (
              <TableEmptyState
               
                title="No users found"
                description={query ? "Try a different name, email, employee code, or department." : "There are no active users available."}
              />
            ) : (
              <>
                <div
                  ref={scrollerRef}
                  className={cn(
                    "overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400",
                    isDragging ? "cursor-grabbing select-none" : "cursor-grab",
                  )}
                  {...dragEvents}
                >
                  <TableMarkup.Root className="w-full min-w-max border-spacing-0 text-left">
                    <TableMarkup.Head className="sticky top-0 z-30">
                      <TableMarkup.Row>
                        <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell29}>No.</TableMarkup.HeaderCell>
                        {SORTABLE_COLUMNS.map((col) => {
                          const isSorted = sortBy === col.field;
                          return (
                            <TableMarkup.HeaderCell
                              key={col.field}
                              onClick={() => toggleSort(col.field)}
                              className={TABLE_STYLES.headerCell30}
                            >
                              <div className="flex items-center justify-between gap-2 w-full">
                                <span className="truncate">{col.label}</span>
                                <div className="flex flex-col text-slate-500 flex-shrink-0 group-hover:text-slate-700 transition-colors">
                                  <ChevronUp className={cn("h-3 w-3 -mb-1", isSorted && sortDir === "asc" ? "text-emerald-600" : "")} />
                                  <ChevronDown className={cn("h-3 w-3", isSorted && sortDir === "desc" ? "text-emerald-600" : "")} />
                                </div>
                              </div>
                            </TableMarkup.HeaderCell>
                          );
                        })}
                        <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell24}>
                          Action
                        </TableMarkup.HeaderCell>
                      </TableMarkup.Row>
                    </TableMarkup.Head>
                    <TableMarkup.Body className="divide-y divide-slate-200 bg-white">
                      {actors.map((actor, index) => {
                        const selected = selectedActor?.id === actor.id;
                        const tdClass = "py-3 px-4 text-xs sm:text-sm text-slate-700 whitespace-nowrap";
                        return (
                          <TableMarkup.Row key={actor.id} className={cn("transition-colors group", selected ? "bg-emerald-50/70" : "hover:bg-slate-50/80")}>
                            <TableMarkup.Cell className={cn(tdClass, "text-center")}>
                              <span className="text-slate-500 font-medium">{(page - 1) * PAGE_SIZE + index + 1}</span>
                            </TableMarkup.Cell>
                            <TableMarkup.Cell className={tdClass}>
                              <div className="flex items-center gap-2.5">
                                <Avatar name={actor.fullName || "User"} tone="brand" className="h-8 w-8" />
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-900">{actor.fullName}</p>
                                  <p className="text-xs text-slate-500">{actor.email || actor.employeeCode || "No email on file"}</p>
                                </div>
                              </div>
                            </TableMarkup.Cell>
                            <TableMarkup.Cell className={tdClass}>{actor.department || "-"}</TableMarkup.Cell>
                            <TableMarkup.Cell className={tdClass}>{actor.position || "-"}</TableMarkup.Cell>
                            <TableMarkup.Cell className={cn(
                              "sticky right-0 z-10 py-3 px-4 text-center whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] transition-colors",
                              selected ? "bg-emerald-50" : "bg-white group-hover:bg-slate-50",
                            )}>
                              <Button
                                size="sm"
                                variant={selected ? "secondary" : "outline"}
                                onClick={() => chooseActor(actor)}
                                className="h-7 min-w-16 px-2.5 text-2xs sm:h-8 sm:min-w-20 sm:px-3 sm:text-xs"
                              >
                                {selected ? "Selected" : "Choose"}
                              </Button>
                            </TableMarkup.Cell>
                          </TableMarkup.Row>
                        );
                      })}
                    </TableMarkup.Body>
                  </TableMarkup.Root>
                </div>
                {totalItems > 0 && (
                  <TablePagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={PAGE_SIZE}
                    onPageChange={setPage}
                    showItemsPerPageSelector={false}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </FormModal>
  );
};
