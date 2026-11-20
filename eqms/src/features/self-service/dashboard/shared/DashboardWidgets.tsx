import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SlidersHorizontal, Check, X, RotateCcw, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { DashboardWidgetLibrary } from "./DashboardWidgetLibrary";
import { DashboardWidgetTile } from "./DashboardWidgetTile";
import { useDashboardEntrance } from "./useDashboardEntrance";
import { DragDropProvider } from "@dnd-kit/react";
import { Feedback } from "@dnd-kit/dom";
import { LayoutGroup, useReducedMotion } from "framer-motion";
import {
  applyDashboardDrop,
  moveDashboardWidget,
  type DashboardWidgetSetting,
} from "./dashboardLayout";
import styles from "./DashboardWidgets.module.css";
import { expandDashboardWidgets } from "./dashboardWidgetCatalog";
import { useToast } from "@/components/ui/toast/Toast";
import { api } from "@/services/api/client";
import {
  DASHBOARD_LAYOUT_PREFERENCE,
  userUiPreferencesApi,
  type DashboardLayoutPreference,
} from "@/services/api/userUiPreferences";

export type DashboardWidget = {
  id: string;
  label: string;
  width: "half" | "full";
  content: ReactNode;
  /** false: the card is in the widget library and appears on the dashboard only once a person adds it. */
  defaultVisible?: boolean;
};
type Widget = DashboardWidget;
type Setting = DashboardWidgetSetting;

/** Only caller-provided, authorized widgets can be rendered; a stored ID cannot grant data access. */
export function DashboardWidgets({ widgets }: { widgets: Widget[] }) {
  const defaults = useMemo(
    () =>
      widgets.map(({ id, label, width, defaultVisible }) => ({
        id,
        label,
        width,
        visible: defaultVisible !== false,
      })),
    [widgets],
  );
  const [saved, setSaved] = useState<DashboardLayoutPreference["widgets"]>();
  const [draft, setDraft] = useState<Setting[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [resizeVersion, setResizeVersion] = useState(0);
  const reduced = useReducedMotion();
  const gridRef = useRef<HTMLDivElement>(null);
  useDashboardEntrance(gridRef);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  useEffect(() => {
    let active = true;
    userUiPreferencesApi
      .get<DashboardLayoutPreference>(DASHBOARD_LAYOUT_PREFERENCE)
      .then(async (value) => {
        if (!Array.isArray(value.widgets)) {
          try {
            value = (
              await api.get<DashboardLayoutPreference>(
                "/dashboard/layout/default",
              )
            ).data;
          } catch {
            /* The built-in layout remains available if role defaults are unavailable. */
          }
        }
        if (active && Array.isArray(value.widgets)) setSaved(value.widgets);
      })
      .catch(() => {
        if (active)
          showToast({
            type: "error",
            title: "Dashboard settings unavailable",
            message: "The default layout is shown.",
          });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const ordered = useMemo(() => {
    if (!saved) return defaults;
    const lookup = new Map(defaults.map((item) => [item.id, item]));
    const result: Setting[] = [];
    for (const item of expandDashboardWidgets(saved)) {
      const original = lookup.get(item.id);
      if (
        original &&
        typeof item.visible === "boolean" &&
        (item.width === "half" || item.width === "full")
      ) {
        result.push({ ...original, visible: item.visible, width: item.width });
        lookup.delete(item.id);
      }
    }
    return [...result, ...lookup.values()];
  }, [defaults, saved]);
  const update = (id: string, patch: Partial<Setting>) =>
    setDraft((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  /** A card added from the library goes to the end of the dashboard, where it is seen. */
  const addFromLibrary = (id: string) =>
    setDraft((items) => {
      const card = items.find((item) => item.id === id);
      return card ? [...items.filter((item) => item.id !== id), { ...card, visible: true }] : items;
    });
  const move = (id: string, delta: number) =>
    setDraft((items) => {
      const visible = items.filter((item) => item.visible),
        index = visible.findIndex((item) => item.id === id);
      const target = visible[index + delta];
      return target ? moveDashboardWidget(items, id, target.id) : items;
    });
  const save = async () => {
    setSaving(true);
    try {
      const unrelated = (saved ?? []).filter(
        (item) => !defaults.some((allowed) => allowed.id === item.id),
      );
      const next = [
        ...draft.map(({ id, visible, width }) => ({ id, visible, width })),
        ...unrelated,
      ];
      await userUiPreferencesApi.save(DASHBOARD_LAYOUT_PREFERENCE, {
        widgets: next,
      });
      setSaved(next);
      setOpen(false);
      setEditing(false);
    } catch {
      showToast({
        type: "error",
        title: "Unable to save dashboard",
        message: "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };
  const reset = async () => {
    setSaving(true);
    try {
      await api.delete(`/user-ui-preferences/${DASHBOARD_LAYOUT_PREFERENCE}`);
      const fallback = await api
        .get<DashboardLayoutPreference>("/dashboard/layout/default")
        .catch(() => undefined);
      setSaved(
        Array.isArray(fallback?.data?.widgets)
          ? fallback.data.widgets
          : undefined,
      );
      setOpen(false);
      setEditing(false);
    } catch {
      showToast({
        type: "error",
        title: "Unable to reset dashboard",
        message: "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };
  const layout = editing ? draft : ordered;
  return (
    <div className="space-y-4">
      <div
        className={
          editing
            ? "sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-white p-3 shadow-sm"
            : "flex justify-end"
        }
      >
        {editing ? (
          <>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">
                Customize Dashboard
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Drag a card to move it. Choose Half or Full to resize. Add more cards from the Widget Library.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={saving || !!dragging}
                onClick={() => setOpen(true)}
              >
                <LayoutGrid className="mr-1.5 h-4 w-4" />
                Widget Library
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={saving || !!dragging}
                onClick={() => void reset()}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={saving || !!dragging}
                onClick={() => {
                  setOpen(false);
                  setEditing(false);
                }}
              >
                <X className="mr-1.5 h-4 w-4" />
                Cancel
              </Button>
              <Button
                size="sm"
                loading={saving}
                disabled={!!dragging}
                onClick={() => void save()}
              >
                <Check className="mr-1.5 h-4 w-4" />
                Save Layout
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              className="gap-2"
              onClick={() => {
                setDraft(ordered.map((item) => ({ ...item })));
                setEditing(true);
                setOpen(true);
              }}
            >
              <LayoutGrid className="h-4 w-4" />
              Add Widgets
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              className="gap-2"
              onClick={() => {
                setDraft(ordered.map((item) => ({ ...item })));
                setEditing(true);
                setOpen(false);
              }}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Customize Dashboard
            </Button>
          </div>
        )}
      </div>
      <DragDropProvider
        plugins={(defaults) => [
          ...defaults,
          Feedback.configure({
            dropAnimation: reduced
              ? null
              : { duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
          }),
        ]}
        onDragStart={(event) =>
          setDragging(String(event.operation.source?.id ?? ""))
        }
        onDragEnd={(event) => {
          setDragging(null);
          if (!event.canceled)
            setDraft((items) => applyDashboardDrop(items, event));
        }}
      >
        <LayoutGroup>
          <div ref={gridRef} className={styles.grid} aria-label="Dashboard widgets">
            {layout
              .filter((item) => item.visible)
              .map((item, index) => (
                <DashboardWidgetTile
                  key={item.id}
                  item={item}
                  index={index}
                  editing={editing}
                  disabled={saving}
                  sorting={!!dragging}
                  resizeVersion={resizeVersion}
                  onWidth={(width) => {
                    if (item.width !== width) {
                      update(item.id, { width });
                      setResizeVersion((version) => version + 1);
                    }
                  }}
                  onMove={(delta) => move(item.id, delta)}
                >
                  {widgets.find((widget) => widget.id === item.id)?.content}
                </DashboardWidgetTile>
              ))}
          </div>
        </LayoutGroup>
      </DragDropProvider>
      {!layout.some((item) => item.visible) && (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
          No card is on the dashboard. Open the Widget Library to add one.
        </div>
      )}
      {open && (
        <DashboardWidgetLibrary
          items={draft}
          disabled={saving}
          onAdd={addFromLibrary}
          onRemove={(id) => update(id, { visible: false })}
          onClose={() => setOpen(false)}
        />
      )}
      <span role="status" className="sr-only">
        {dragging
          ? "Moving dashboard card"
          : editing
            ? "Dashboard editing enabled. Focus a card handle. Space to pick up, arrow keys to move, Space to drop, Escape to cancel."
            : ""}
      </span>
    </div>
  );
}
