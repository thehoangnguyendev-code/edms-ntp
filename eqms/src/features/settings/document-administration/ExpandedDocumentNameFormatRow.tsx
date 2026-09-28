import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { documentNameFormatApi } from "@/services/api";
import type { DocumentComponentItem, DocumentNameFormatItem } from "./documentNameFormatTypes";

interface ExpandedDocumentNameFormatRowProps {
  format: DocumentNameFormatItem;
  isExpanded: boolean;
  visibleColumnsLength: number;
  /** Shared across every row so the component catalog (for the Description column) is only
   *  fetched once, not once per row expanded. */
  componentCatalog: Map<string, DocumentComponentItem> | null;
  onComponentCatalogLoaded: (catalog: Map<string, DocumentComponentItem>) => void;
}

/**
 * Expanded row for a Document Name Format -- shows the ordered Document Components that make it
 * up (Name / Value / Description / Order), mirroring ExpandedDocumentRow's layout, animation, and
 * nested-table styling from the Document List screen.
 */
export const ExpandedDocumentNameFormatRow: React.FC<ExpandedDocumentNameFormatRowProps> = ({
  format,
  isExpanded,
  visibleColumnsLength,
  componentCatalog,
  onComponentCatalogLoaded,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const transitionConfig = useMemo(
    () => (shouldReduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 90, damping: 16 }),
    [shouldReduceMotion],
  );

  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);

  useEffect(() => {
    if (!isExpanded || componentCatalog !== null) return;
    let isMounted = true;
    setIsLoadingCatalog(true);
    documentNameFormatApi
      .getComponents()
      .then((items) => {
        if (!isMounted) return;
        onComponentCatalogLoaded(new Map(items.map((c) => [c.id, c])));
      })
      .catch((error) => {
        console.error("Failed to load document components", error);
      })
      .finally(() => {
        if (isMounted) setIsLoadingCatalog(false);
      });
    return () => {
      isMounted = false;
    };
  }, [isExpanded, componentCatalog, onComponentCatalogLoaded]);

  const orderedComponents = useMemo(
    () => [...format.components].sort((a, b) => a.displayOrder - b.displayOrder),
    [format.components],
  );

  const hasComponents = orderedComponents.length > 0;

  return (
    <AnimatePresence initial={false}>
      {isExpanded && (
        <motion.tr
          key={`expanded-name-format-${format.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transitionConfig}
          className="bg-slate-50/50"
        >
          <td colSpan={visibleColumnsLength - 1} className="p-0 border-b border-slate-200">
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={transitionConfig}
              className="overflow-hidden"
            >
              <div className="p-4 md:p-5">
                <div className="ml-9 flex flex-col gap-4 items-start">
                  {isLoadingCatalog && (
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-medium py-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
                      Loading component details...
                    </div>
                  )}

                  {!isLoadingCatalog && hasComponents && (
                    <div className="w-full">
                      <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Document Components ({orderedComponents.length})
                      </p>
                      <div className="rounded-lg border border-slate-200 overflow-hidden inline-block max-w-full">
                        <table className="text-xs table-auto w-auto">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-200">
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Name
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Value
                              </th>
                              <th className="py-1.5 px-2.5 text-left text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Description
                              </th>
                              <th className="py-1.5 px-2.5 text-right text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">
                                Order
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {orderedComponents.map((component) => {
                              const detail = componentCatalog?.get(component.componentId);
                              return (
                                <tr key={component.componentId} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-1.5 px-2.5 font-medium text-emerald-700 whitespace-nowrap">
                                    {component.name}
                                  </td>
                                  <td className="py-1.5 px-2.5 whitespace-nowrap">
                                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{component.value}</code>
                                  </td>
                                  <td className="py-1.5 px-2.5 text-slate-700 whitespace-normal min-w-[220px] max-w-[360px]">
                                    {detail?.shortDescription || "-"}
                                  </td>
                                  <td className="py-1.5 px-2.5 text-slate-600 text-right whitespace-nowrap">
                                    {component.displayOrder}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {!isLoadingCatalog && !hasComponents && (
                    <p className="text-xs text-slate-500 py-2">This format has no components configured.</p>
                  )}
                </div>
              </div>
            </motion.div>
          </td>
          <td className="p-0 border-b border-slate-200 sticky right-0 z-10 bg-slate-50/50 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]"></td>
        </motion.tr>
      )}
    </AnimatePresence>
  );
};
