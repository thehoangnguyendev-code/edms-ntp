import { Button } from "@/components/ui/button/Button";
import { cn } from "@/components/ui/utils";

/**
 * What Clear Filters does on every list: it clears the search the person typed AND the filters of the screen. A screen gives the two parts, so none can
 * forget the search; use this function (or the button below) wherever a list offers Clear Filters, and do not write a clear function of your own.
 */
export const clearSearchAndFilters = (clearSearch: () => void, clearFilters: () => void) => () => {
  clearSearch();
  clearFilters();
};

/** The Clear Filters button of every list: the same look, and it always clears the search too. */
export function ClearFiltersButton({ onClearSearch, onClear, disabled, className }: {
  /** Empties the search box of the list. */
  onClearSearch: () => void;
  /** Resets the filters (dropdowns, dates) of the list. */
  onClear: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={clearSearchAndFilters(onClearSearch, onClear)}
      disabled={disabled}
      className={cn("h-9 gap-2 whitespace-nowrap px-4 font-medium transition-all duration-200 hover:border-red-600 hover:bg-red-600 hover:text-white disabled:opacity-40", className)}
    >
      Clear Filters
    </Button>
  );
}
