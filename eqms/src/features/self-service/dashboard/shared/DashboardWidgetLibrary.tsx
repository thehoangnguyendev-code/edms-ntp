import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { Drawer } from "@/components/ui/drawer/Drawer";
import { SearchInput } from "@/components/ui/form/SearchInput";
import { cn } from "@/components/ui/utils";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";
import { DASHBOARD_WIDGET_INFO, WIDGET_MODULES, type WidgetModule } from "./dashboardWidgetCatalog";
import type { DashboardWidgetSetting } from "./dashboardLayout";
import { useLanguage } from "@/i18n";

type Props = {
  /** Every card this person may have, on the dashboard (visible) or in the library (not visible). */
  items: DashboardWidgetSetting[];
  disabled?: boolean;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
};

const infoOf = (id: string) => DASHBOARD_WIDGET_INFO[id] ?? { module: "Document Control" as WidgetModule, description: "" };

type SectionProps = {
  module: string;
  all: DashboardWidgetSetting[];
  shown: DashboardWidgetSetting[];
  expanded: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
};

/**
 * One module of the library. GSAP opens and closes it: the list grows from nothing to its height while it fades in, and shrinks back
 * the same way, the chevron turning with it. The list is in the page only while it is open or moving, so a closed module costs nothing.
 * For people who ask their system for reduced motion it opens and closes at once.
 */
function ModuleSection({ module, all, shown, expanded, disabled, onToggle, onAdd, onRemove }: SectionProps) {
  const { t, tLabel, language } = useLanguage();
  const outer = useRef<HTMLDivElement>(null);
  const chevron = useRef<SVGSVGElement>(null);
  const [mounted, setMounted] = useState(expanded);
  /** The list is fully open and still: a change inside it (a card added) must not play the opening again. */
  const settled = useRef(expanded);

  useEffect(() => {
    if (expanded) setMounted(true);
  }, [expanded]);

  useGSAP(
    () => {
      const still = prefersReducedMotion();
      gsap.to(chevron.current, { rotation: expanded ? 180 : 0, duration: still ? 0 : 0.25, ease: "power2.out" });
      const panel = outer.current?.querySelector<HTMLElement>("[data-accordion-panel]");
      if (expanded && panel && !settled.current) {
        gsap.killTweensOf(panel);
        if (still) {
          settled.current = true;
          return;
        }
        gsap.set(panel, { overflow: "hidden" });
        gsap.fromTo(
          panel,
          { height: 0, opacity: 0 },
          {
            height: "auto",
            opacity: 1,
            duration: 0.28,
            ease: "power2.out",
            onComplete: () => {
              settled.current = true;
              gsap.set(panel, { clearProps: "height,opacity,overflow" });
            },
          },
        );
      } else if (!expanded && mounted) {
        settled.current = false;
        if (!panel || still) {
          setMounted(false);
          return;
        }
        gsap.killTweensOf(panel);
        gsap.set(panel, { overflow: "hidden" });
        gsap.to(panel, { height: 0, opacity: 0, duration: 0.22, ease: "power2.in", onComplete: () => setMounted(false) });
      }
    },
    { scope: outer, dependencies: [expanded, mounted] },
  );

  const on = all.filter((item) => item.visible).length;
  const panelId = `widget-module-${module.replace(/\W+/g, "-").toLowerCase()}`;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" data-widget-module={module}>
      <h3>
        <Button
          variant="ghost"
          fullWidth
          aria-expanded={expanded}
          aria-controls={mounted ? panelId : undefined}
          onClick={onToggle}
          className="h-auto justify-between gap-3 rounded-none px-3.5 py-3 text-left font-normal"
        >
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{tLabel(module)}</span>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-2xs font-medium", on > 0 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>
            {language === "vi" ? `${on}/${all.length} đã thêm` : `${on} of ${all.length} added`}
          </span>
          <ChevronDown ref={chevron} className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        </Button>
      </h3>
      <div ref={outer}>
        {mounted && (
          <div data-accordion-panel>
            <ul id={panelId} className="divide-y divide-slate-100 border-t border-slate-100 px-3.5" aria-label={`${tLabel(module)} ${t("dashboard.widgets", "widgets")}`}>
              {shown.map((item) => {
                const info = infoOf(item.id);
                return (
                  <li key={item.id} className="flex items-start justify-between gap-3 py-3" data-widget-library-item={item.id}>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                        {tLabel(item.label)}
                        {item.visible && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-2xs font-medium text-emerald-700">{t("dashboard.onDashboard", "On dashboard")}</span>}
                      </p>
                      {info.description && <p className="mt-0.5 text-xs text-slate-500">{tLabel(info.description)}</p>}
                    </div>
                    {item.visible ? (
                      <Button size="sm" variant="outline" disabled={disabled} aria-label={language === "vi" ? `Xoá ${item.label}` : `Remove ${item.label}`} onClick={() => onRemove(item.id)} className="shrink-0 gap-1.5">
                        <X className="h-4 w-4 text-slate-400" />
                        {t("common.remove", "Remove")}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline-emerald" disabled={disabled} aria-label={language === "vi" ? `Thêm ${item.label}` : `Add ${item.label}`} onClick={() => onAdd(item.id)} className="shrink-0 gap-1.5">
                        <Plus className="h-4 w-4" />
                        {t("common.add", "Add")}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * The widget library: one accordion section per module, named as its menu is, each holding the cards of that module.
 * Adding puts a card at the end of the dashboard. A search opens every module that has a match.
 */
export function DashboardWidgetLibrary({ items, disabled, onAdd, onRemove, onClose }: Props) {
  const { t, language } = useLanguage();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const needle = query.trim().toLowerCase();

  const sections = useMemo(
    () =>
      WIDGET_MODULES.map((module) => {
        const all = items.filter((item) => infoOf(item.id).module === module);
        const shown = needle ? all.filter((item) => `${item.label} ${infoOf(item.id).description}`.toLowerCase().includes(needle)) : all;
        return { module, all, shown };
      }).filter((section) => section.all.length > 0 && section.shown.length > 0),
    [items, needle],
  );
  const toggle = (module: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(module)) next.add(module);
      return next;
    });
  const added = items.filter((item) => item.visible).length;

  return (
    <Drawer
      title={t("dashboard.widgetLibrary", "Widget Library")}
      subtitle={language === "vi" ? `${added}/${items.length} thẻ đang có trên bảng điều khiển.` : `${added} of ${items.length} cards are on your dashboard.`}
      subtitlePlacement="below"
      onClose={onClose}
      footer={
        <Button variant="outline" className="w-full" onClick={onClose} size="sm">
          {t("dashboard.done", "Done")}
        </Button>
      }
    >
      <div className="space-y-4">
        <SearchInput value={query} onChange={setQuery} placeholder={t("dashboard.searchCards", "Search cards…")} ariaLabel={t("dashboard.searchCards", "Search cards")} />
        {sections.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">{t("dashboard.noCardMatch", "No card matches.")}</p>
        ) : (
          <div className="space-y-2">
            {sections.map(({ module, all, shown }) => (
              <ModuleSection
                key={module}
                module={module}
                all={all}
                shown={shown}
                expanded={needle ? true : open.has(module)}
                disabled={disabled}
                onToggle={() => toggle(module)}
                onAdd={onAdd}
                onRemove={onRemove}
              />
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}
