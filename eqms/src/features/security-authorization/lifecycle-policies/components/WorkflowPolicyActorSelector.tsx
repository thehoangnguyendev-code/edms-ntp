import React from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { cn } from "@/components/ui/utils";
import type { ActorCodeOption, WorkflowActionPolicyActorRequest, WorkflowActorType, WorkflowActorTypeOption } from "../types";
function resolveRequiresCode(actorType: WorkflowActorType, options: WorkflowActorTypeOption[]): boolean {
  const opt = options.find((t) => t.value === actorType);
  return Boolean(opt?.requiresActorCode);
}

interface WorkflowPolicyActorSelectorProps {
  actors: WorkflowActionPolicyActorRequest[];
  onChange: (actors: WorkflowActionPolicyActorRequest[]) => void;
  /** Actor types allowed for the currently selected action (from options.actions[].allowedActorTypes). */
  allowedActorTypes: WorkflowActorTypeOption[];
  /** Selectable actor codes per actor type (from options.actorCodeOptions) — renders a picker instead of a text input. */
  actorCodeOptions?: Record<string, ActorCodeOption[]>;
  /** Indices of actor rows whose actorType is not in allowedActorTypes. */
  invalidIndices?: number[];
  disabled?: boolean;
  error?: string;
}

export const WorkflowPolicyActorSelector: React.FC<WorkflowPolicyActorSelectorProps> = ({
  actors,
  onChange,
  allowedActorTypes,
  actorCodeOptions,
  invalidIndices = [],
  disabled,
  error,
}) => {
  const actorTypeOptions: SelectOption[] = allowedActorTypes.map((t) => ({
    label: t.label,
    value: t.value,
  }));

  const invalidSet = new Set(invalidIndices);

  const removeActor = (index: number) => {
    onChange(actors.filter((_, i) => i !== index));
  };

  const updateActorType = (index: number, actorType: WorkflowActorType) => {
    onChange(
      actors.map((a, i) => {
        if (i !== index) return a;
        return { actorType, actorCode: resolveRequiresCode(actorType, allowedActorTypes) ? a.actorCode : null };
      }),
    );
  };

  const updateActorCode = (index: number, actorCode: string) => {
    onChange(actors.map((a, i) => (i === index ? { ...a, actorCode: actorCode || null } : a)));
  };

  return (
    <div className="flex flex-col gap-2">
      {actors.length === 0 && (
        <p className="text-xs text-slate-400 italic py-2">
          No actors defined. At least one actor is required.
        </p>
      )}

      {allowedActorTypes.length === 0 && !disabled && (
        <p className="text-xs text-amber-600 italic py-2">
          Select an action first to see allowed actor types.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {actors.map((actor, index) => {
          const needsCode = resolveRequiresCode(actor.actorType, allowedActorTypes);
          const isInvalid = invalidSet.has(index);

          // For invalid rows: show the current actorType as a read-only label since it's not in the filtered options
          const rowOptions: SelectOption[] = isInvalid
            ? [{ label: `${actor.actorType} (not allowed)`, value: actor.actorType }]
            : actorTypeOptions;

          return (
            <div
              key={index}
              className={cn(
                "flex items-end gap-2 rounded-lg border p-2.5",
                isInvalid
                  ? "bg-red-50 border-red-300"
                  : "bg-slate-50 border-slate-200",
                disabled && "opacity-60",
              )}
            >
              {isInvalid && (
                <AlertTriangle className="mt-2.5 h-4 w-4 shrink-0 self-start text-red-500" />
              )}
              <div className={cn("min-w-0 flex-1", needsCode ? "grid grid-cols-1 gap-2 sm:grid-cols-2" : "")}>
                <Select
                  label="Actor Type"
                  value={actor.actorType}
                  onChange={(v) => updateActorType(index, v as WorkflowActorType)}
                  options={rowOptions}
                  placeholder="Select actor type"
                  disabled={disabled || isInvalid}
                />
                {needsCode && (() => {
                  const codeOptions = actorCodeOptions?.[actor.actorType] ?? [];
                  const knownCode = codeOptions.some((o) => o.value === actor.actorCode);
                  return (
                    <div className="flex flex-col">
                      <label className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm">
                        Actor Code <span className="text-red-500">*</span>
                      </label>
                      {codeOptions.length > 0 ? (
                        <Select
                          label=""
                          value={actor.actorCode ?? ""}
                          onChange={(v) => updateActorCode(index, String(v))}
                          options={[
                            // Keep an unknown legacy code selectable so editing an old policy doesn't wipe it.
                            ...(actor.actorCode && !knownCode
                              ? [{ label: `${actor.actorCode} (unknown)`, value: actor.actorCode }]
                              : []),
                            ...codeOptions.map((o) => ({ label: o.label, value: o.value })),
                          ]}
                          placeholder="Select..."
                          enableSearch
                          disabled={disabled}
                        />
                      ) : (
                        <input
                          type="text"
                          value={actor.actorCode ?? ""}
                          onChange={(e) => updateActorCode(index, e.target.value)}
                          placeholder="Enter actor code"
                          disabled={disabled}
                          className={cn(
                            "h-9 w-full border rounded-lg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white disabled:bg-slate-50 disabled:opacity-60",
                            !actor.actorCode ? "border-amber-300" : "border-slate-200",
                          )}
                        />
                      )}
                      {!actor.actorCode && !disabled && (
                        <p className="text-[10px] text-amber-600 mt-0.5">Actor code is required for this actor type.</p>
                      )}
                    </div>
                  );
                })()}
                {isInvalid && (
                  <p className="text-[10px] text-red-600 mt-1">
                    This actor type is not allowed for the selected action.
                  </p>
                )}
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeActor(index)}
                  className="mb-0.5 shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

    </div>
  );
};
