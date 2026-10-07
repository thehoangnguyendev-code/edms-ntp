import { useState } from "react";
import { IconFilter2 } from "@tabler/icons-react";
import { useBranding } from "@/components/branding/BrandLogo";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/form/SearchInput";
import { Select, type SelectOption } from "@/components/ui/select";
import { DesktopFilterPanel } from "@/components/ui/filter/DesktopFilterPanel";
import { FilterOptionList } from "@/components/ui/filter/FilterOptionList";
import {
  FilterDrawer,
  FilterAccordionItem,
} from "@/components/ui/filter/FilterDrawer";
import { FilterOptionButton } from "@/components/ui/filter/FilterOptionButton";

/** Only collects criteria; the parent sends every applied value to the server. */
export function ReportListFilters({
  search,
  onSearch,
  placeholder,
  values,
  defaults,
  groups,
  onApply,
}: {
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  values: Record<string, string>;
  defaults: Record<string, string>;
  groups: { id: string; label: string; options: SelectOption[] }[];
  onApply: (values: Record<string, string>) => void;
}) {
  const { compactDesktopFilters } = useBranding();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(values);
  const [expanded, setExpanded] = useState(groups[0]?.id);
  const searchInput = (
    <SearchInput value={search} onChange={onSearch} placeholder={placeholder} />
  );
  return (
    <>
      <div className="hidden md:block">
        {compactDesktopFilters ? (
          <DesktopFilterPanel
            search={searchInput}
            values={values}
            defaults={defaults}
            onApply={onApply}
            fields={groups.map((group) => ({
              id: group.id,
              label: group.label,
              render: (current, change, active) => (
                <FilterOptionList
                  label={group.label}
                  value={current[group.id] ?? ""}
                  options={group.options}
                  active={active}
                  onChange={(value) => change(group.id, value)}
                />
              ),
            }))}
          />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-end pb-4 md:pb-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Search
              </label>
              {searchInput}
            </div>
            {groups.map((group) => (
              <Select
                key={group.id}
                label={group.label}
                value={values[group.id]}
                options={group.options}
                onChange={(value) =>
                  onApply({ ...values, [group.id]: String(value) })
                }
              />
            ))}
            <div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-4 gap-2 font-medium hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap"
                onClick={() => {
                  onSearch("");
                  onApply(defaults);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        )}
      </div>
      <div className="md:hidden mb-4 space-y-1.5">
        <label className="block text-xs font-medium text-slate-700">
          Search
        </label>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">{searchInput}</div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={() => {
              setDraft(values);
              setOpen(true);
            }}
          >
            <IconFilter2 className="h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>
      <FilterDrawer
        isOpen={open}
        onClose={() => setOpen(false)}
        onClear={() => setDraft(defaults)}
        onApply={() => {
          onApply(draft);
          setOpen(false);
        }}
        applyLabel="Apply"
      >
        {groups.map((group) => (
          <FilterAccordionItem
            key={group.id}
            label={group.label}
            isExpanded={expanded === group.id}
            onToggle={() =>
              setExpanded(expanded === group.id ? undefined : group.id)
            }
          >
            <div className="flex flex-wrap gap-2 pb-3">
              {group.options.map((option) => (
                <FilterOptionButton
                  key={String(option.value)}
                  label={option.label}
                  isSelected={draft[group.id] === String(option.value)}
                  onClick={() =>
                    setDraft({ ...draft, [group.id]: String(option.value) })
                  }
                />
              ))}
            </div>
          </FilterAccordionItem>
        ))}
      </FilterDrawer>
    </>
  );
}
