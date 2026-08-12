import React, { useMemo, useState } from "react";
import { ToggleLeft, CheckCircle2, XCircle, AlertTriangle, ChevronDown } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Badge } from "@/components/ui/badge/Badge";
import { cn } from "@/components/ui/utils";
import type { FeatureFlag } from "../types";
import { IconCheck, IconX } from "@tabler/icons-react";

interface FeaturesTabProps {
  features: FeatureFlag[];
  onChange: (features: FeatureFlag[]) => void;
}

const SettingsCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, icon, children, className }) => (
  <div className={cn("bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden", className)}>
    <div className="flex items-center gap-2.5 px-4 md:px-5 py-4 border-b border-slate-100">
      <span className="text-emerald-600">{icon}</span>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    </div>
    <div className="p-4 md:p-5">{children}</div>
  </div>
);

export const FeaturesTab: React.FC<FeaturesTabProps> = ({ features, onChange }) => {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    features.filter(f => !f.parentId).forEach(f => {
      const hasChildren = features.some(c => c.parentId === f.id);
      if (hasChildren) {
        initial[f.id] = true;
      }
    });
    return initial;
  });

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const shouldReduceMotion = useReducedMotion();
  const transitionConfig = useMemo(() => shouldReduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 90, damping: 16 }, [shouldReduceMotion]);

  const handleToggle = (id: string) => {
    const updatedFeatures = features.map((f) =>
      f.id === id ? { ...f, enabled: !f.enabled } : f
    );
    onChange(updatedFeatures);
  };

  const enabledCount = features.filter(f => {
    if (f.parentId) {
      const parent = features.find(p => p.id === f.parentId);
      return f.enabled && (!parent || parent.enabled);
    }
    return f.enabled;
  }).length;
  const disabledCount = features.length - enabledCount;

  return (
    <div className="p-4 md:p-5 space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Total Features</p>
              <p className="text-2xl font-bold text-slate-900">{features.length}</p>
            </div>
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-slate-100">
              <ToggleLeft className="h-5 w-5 text-slate-500" />
            </div>
          </div>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4 md:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-600 mb-1">Enabled / Active</p>
              <p className="text-2xl font-bold text-emerald-800">{enabledCount}</p>
            </div>
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-100">
              <IconCheck className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Disabled / Inactive</p>
              <p className="text-2xl font-bold text-slate-700">{disabledCount}</p>
            </div>
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-slate-100">
              <IconX className="h-5 w-5 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Features List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 md:px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <span className="text-emerald-600">
            <ToggleLeft className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold text-slate-900">Module Capabilities</h3>
        </div>

        <div className="divide-y divide-slate-100">
          {features.length > 0 ? (
            features.filter(f => !f.parentId).map((rootFeature) => {
              const children = features.filter(f => f.parentId === rootFeature.id);
              const isExpanded = !!expandedIds[rootFeature.id];
              return (
                <div key={rootFeature.id} className="divide-y divide-slate-50">
                  {/* Root Feature */}
                  <div
                    className={cn(
                      "flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors cursor-pointer group",
                      !rootFeature.enabled && "opacity-70 bg-slate-50/20"
                    )}
                    onClick={() => handleToggle(rootFeature.id)}
                  >
                    {/* Accordion Chevron */}
                    {children.length > 0 ? (
                      <button
                        type="button"
                        onClick={(e) => toggleExpand(rootFeature.id, e)}
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                      >
                        <ChevronDown className={cn(
                          "h-4 w-4 transition-transform duration-200",
                          !isExpanded && "-rotate-90"
                        )} />
                      </button>
                    ) : (
                      <div className="flex-shrink-0 w-6 h-6" />
                    )}

                    <div className="flex-shrink-0">
                      <Checkbox
                        checked={rootFeature.enabled}
                        id={`feature-${rootFeature.id}`}
                        onChange={() => handleToggle(rootFeature.id)}
                        className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={`feature-${rootFeature.id}`}
                          className={cn(
                            "block text-xs sm:text-sm font-medium cursor-pointer",
                            rootFeature.enabled ? "text-slate-900" : "text-slate-500"
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {rootFeature.name}
                        </label>
                      </div>
                    </div>

                    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ToggleLeft className={cn(
                        "h-4 w-4 transition-colors",
                        rootFeature.enabled ? "text-emerald-500" : "text-slate-300"
                      )} />
                    </div>
                  </div>

                  {/* Children Features */}
                  <AnimatePresence initial={false}>
                    {isExpanded && children.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={transitionConfig}
                        className="overflow-hidden bg-slate-50/10 ml-[3.5rem]"
                      >
                        {children.map((childFeature) => {
                          const parentDisabled = !rootFeature.enabled;
                          return (
                            <div
                              key={childFeature.id}
                              className={cn(
                                "flex items-center gap-4 pl-6 pr-5 py-3 hover:bg-slate-50/50 transition-colors cursor-pointer group relative",
                                parentDisabled ? "opacity-45 bg-slate-50/30 cursor-not-allowed" : !childFeature.enabled && "opacity-70"
                              )}
                              onClick={() => {
                                if (!parentDisabled) {
                                  handleToggle(childFeature.id);
                                }
                              }}
                            >
                              <div className="flex-shrink-0">
                                <Checkbox
                                  checked={parentDisabled ? false : childFeature.enabled}
                                  disabled={parentDisabled}
                                  id={`feature-${childFeature.id}`}
                                  onChange={() => {
                                    if (!parentDisabled) {
                                      handleToggle(childFeature.id);
                                    }
                                  }}
                                  className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <label
                                    htmlFor={`feature-${childFeature.id}`}
                                    className={cn(
                                      "block text-xs sm:text-sm font-medium cursor-pointer",
                                      parentDisabled
                                        ? "text-slate-400 cursor-not-allowed"
                                        : childFeature.enabled
                                          ? "text-slate-900"
                                          : "text-slate-500"
                                    )}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {childFeature.name}
                                  </label>
                                  {parentDisabled && (
                                    <span className="text-2xs text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                      Parent Disabled
                                    </span>
                                  )}
                                </div>
                              </div>

                              {!parentDisabled && (
                                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <ToggleLeft className={cn(
                                    "h-4 w-4 transition-colors",
                                    childFeature.enabled ? "text-emerald-500" : "text-slate-300"
                                  )} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-400 italic">No features found in the system.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
