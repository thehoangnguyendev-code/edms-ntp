import React, { useState, useMemo, useEffect } from "react";
import {
  ToggleLeft,
  ToggleRight,
  Shield,
  Plus,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Briefcase,
  FileText,
  RotateCcw,
  Link2,
  Timer,
  Settings,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Select } from "@/components/ui/select/Select";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/utils";
import { Switch, Button } from "@/components/ui";
import { SectionLoading, FullPageLoading } from "@/components/ui/loading";
import { useNavigateWithLoading } from "@/hooks";
import breadcrumbs from "@/components/ui/breadcrumb/breadcrumbs.config";
import { complianceTrackingRepository } from "../../repository";
import {
  TRIGGER_LABELS,
  type AutoAssignmentRule,
  type AssignmentTrigger,
} from "../../../types/assignment.types";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";

// ─── Trigger metadata ──────────────────────────────────────────────────────────
const TRIGGER_META: Record<AssignmentTrigger, {
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  description: string;
  regulation: string;
}> = {
  manual: {
    icon: Plus,
    color: "text-slate-600",
    bg: "bg-slate-100",
    border: "border-slate-200",
    description: "Manually assigned by Manager or QA. Not an auto-trigger — managed via Assignment Queue.",
    regulation: "No specific regulatory trigger",
  },
  new_employee: {
    icon: UserPlus,
    color: "text-blue-600",
    bg: "bg-blue-100",
    border: "border-blue-200",
    description: "Automatically assign mandatory courses when a new employee is created in the system.",
    regulation: "EU-GMP Chapter 2.8 — Training before task authorization",
  },
  role_change: {
    icon: Briefcase,
    color: "text-purple-600",
    bg: "bg-purple-100",
    border: "border-purple-200",
    description: "Trigger training when an employee's role or department changes.",
    regulation: "EU-GMP Chapter 2.9 — Role-appropriate training",
  },
  doc_revision: {
    icon: FileText,
    color: "text-emerald-600",
    bg: "bg-emerald-100",
    border: "border-emerald-200",
    description: "Assign retraining when a linked SOP/document is revised and published.",
    regulation: "ICH Q10 §3.2 — Retraining on doc revision",
  },
  expiry_retraining: {
    icon: Timer,
    color: "text-amber-600",
    bg: "bg-amber-100",
    border: "border-amber-200",
    description: "Re-assign training before qualification expiry to maintain competency records.",
    regulation: "FDA 21 CFR 211.25 — Recurrent qualification",
  },
  recurrence: {
    icon: RotateCcw,
    color: "text-orange-600",
    bg: "bg-orange-100",
    border: "border-orange-200",
    description: "Schedule periodic recurring training at defined intervals (e.g., annual GMP refresher).",
    regulation: "EU-GMP Annex 11 §2 — Annual training review",
  },
  capa_linked: {
    icon: Link2,
    color: "text-red-600",
    bg: "bg-red-100",
    border: "border-red-200",
    description: "Automatically assign training when a CAPA or deviation is linked to a knowledge gap.",
    regulation: "ICH Q10 §3.4 — CAPA effectiveness evidence",
  },
  audit_finding: {
    icon: AlertTriangle,
    color: "text-rose-600",
    bg: "bg-rose-100",
    border: "border-rose-200",
    description: "Automatically assign training in response to an internal or external audit finding.",
    regulation: "ISO 9001:2015 Clause 9.2",
  },
  process_change: {
    icon: Settings,
    color: "text-cyan-600",
    bg: "bg-cyan-100",
    border: "border-cyan-200",
    description: "Trigger training when a manufacturing or business process is changed.",
    regulation: "ICH Q10 Clause 3.2.3",
  },
  regulatory_update: {
    icon: Shield,
    color: "text-indigo-600",
    bg: "bg-indigo-100",
    border: "border-indigo-200",
    description: "Assign training due to newly published regulatory requirements or pharmacopeia updates.",
    regulation: "EU-GMP Chapter 1 — Pharmaceutical Quality System",
  },
};

// ─── Rule Card ──────────────────────────────────────────────────────────────── 
interface RuleCardProps {
  rule: AutoAssignmentRule;
  onToggle: (id: string, isActive: boolean) => void;
}

const RuleCard: React.FC<RuleCardProps> = ({ rule, onToggle }) => {
  const [expanded, setExpanded] = useState(false);
  const meta = TRIGGER_META[rule.trigger];
  const Icon = meta.icon;

  return (
    <div className={cn("bg-white border rounded-lg shadow-sm overflow-hidden transition-all", rule.isActive ? "border-slate-200" : "border-slate-200 opacity-60")}>
      {/* Header */}
      <div className="p-4 md:p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={cn("h-11 w-11 rounded-lg flex items-center justify-center flex-shrink-0", meta.bg)}>
            <Icon className={cn("h-5 w-5", meta.color)} />
          </div>

          {/* Title + Status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{TRIGGER_LABELS[rule.trigger]}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{rule.ruleId}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {/* Toggle switch */}
                <div className="flex items-center justify-start md:justify-center gap-2 sm:gap-3">
                  <span className={cn("text-2xs sm:text-xs font-medium transition-colors", !rule.isActive ? "text-slate-700" : "text-slate-400")}>Disabled</span>
                  <Switch
                    checked={rule.isActive}
                    onChange={() => onToggle(rule.ruleId, !rule.isActive)}
                  />
                  <span className={cn("text-2xs sm:text-xs font-medium transition-colors", rule.isActive ? "text-emerald-700" : "text-slate-400")}>Active</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-slate-600 mt-2">{meta.description}</p>

            {/* Regulation */}
            <div className="flex items-center gap-1.5 mt-2">
              <Info className="h-3 w-3 text-blue-500 flex-shrink-0" />
              <span className="text-xs text-blue-600 font-medium">{meta.regulation}</span>
            </div>
          </div>
        </div>

        {/* Config summary chips */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
          <span className="text-2xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200 font-medium">
            Priority: {rule.priority}
          </span>
          <span className="text-2xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200 font-medium">
            Deadline: {rule.deadlineDays}d from trigger
          </span>
          <span className="text-2xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200 font-medium">
            Scope: {rule.targetScope.replace("_", " ")}
          </span>
          {rule.trainingBeforeAuthorized && (
            <span className="text-2xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 font-medium">
              Training Before Authorized
            </span>
          )}
          {rule.requiresESign && (
            <span className="text-2xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 font-medium">
              E-Sign Required
            </span>
          )}
          {rule.notifyManager && (
            <span className="text-2xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200 font-medium">
              Manager Notified
            </span>
          )}
          {rule.reminderDays && rule.reminderDays.length > 0 && (
            <span className="text-2xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200 font-medium">
              Reminders: {rule.reminderDays.map((d) => `${d}d`).join(", ")}
            </span>
          )}
        </div>

        {/* Expand toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          className="h-auto p-0 flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium mt-3 hover:bg-transparent"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? "Hide conditions" : "View trigger conditions"}
        </Button>
      </div>

      {/* Expanded conditions */}
      {expanded && (
        <div className="px-4 md:px-5 pb-4 md:pb-5 pt-0 border-t border-slate-100 bg-slate-50/50">
          <div className="pt-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Trigger Conditions</p>
            {Object.keys(rule.triggerConditions).length === 0 ? (
              <p className="text-xs text-slate-400 italic">No specific conditions configured — applies to all matching targets.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(rule.triggerConditions).map(([key, value]) => (
                  <div key={key} className="bg-white border border-slate-200 rounded-lg p-2.5">
                    <p className="text-2xs text-slate-400 uppercase tracking-wide font-medium">{key.replace(/_/g, " ")}</p>
                    <p className="text-xs font-semibold text-slate-700 mt-0.5">
                      {Array.isArray(value) ? value.join(", ") : String(value)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {rule.courseFilter && Object.keys(rule.courseFilter).length > 0 && (
              <>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide pt-1">Course Filter</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(rule.courseFilter).map(([key, value]) => (
                    <div key={key} className="bg-white border border-slate-200 rounded-lg p-2.5">
                      <p className="text-2xs text-slate-400 uppercase tracking-wide font-medium">{key.replace(/_/g, " ")}</p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">
                        {Array.isArray(value) ? value.join(", ") : String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Pending toggle for e-signature ───────────────────────────────────────────
interface PendingToggle {
  ruleId: string;
  label: string;
  toActive: boolean;
}

// ─── Main View ────────────────────────────────────────────────────────────────
export const AssignmentRulesView: React.FC = () => {
  const { navigateTo, isNavigating } = useNavigateWithLoading();
  const { showToast } = useToast();

  const [rules, setRules] = useState<AutoAssignmentRule[]>(complianceTrackingRepository.getAutoAssignmentRules());
  const [pendingToggle, setPendingToggle] = useState<PendingToggle | null>(null);
  const [isESignOpen, setIsESignOpen] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [triggerFilter, setTriggerFilter] = useState<AssignmentTrigger | "all">("all");

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const autoRules = useMemo(
    () => rules.filter((r) => r.trigger !== "manual"),
    [rules]
  );

  const activeCount = autoRules.filter((r) => r.isActive).length;

  const filteredRules = useMemo(
    () =>
      autoRules.filter((r) => {
        if (showActiveOnly && !r.isActive) return false;
        if (triggerFilter !== "all" && r.trigger !== triggerFilter) return false;
        return true;
      }),
    [autoRules, showActiveOnly, triggerFilter]
  );

  const TRIGGER_OPTIONS: (AssignmentTrigger | "all")[] = useMemo(
    () => [
      "all",
      ...(Object.keys(TRIGGER_LABELS) as AssignmentTrigger[]).filter(
        (t) => t !== "manual"
      ),
    ],
    []
  );

  const handleToggleRequest = (ruleId: string, toActive: boolean) => {
    const rule = rules.find((r) => r.ruleId === ruleId);
    if (!rule) return;
    // Both activation and deactivation require e-signature for EU-GMP / 21 CFR Part 11
    setPendingToggle({
      ruleId,
      label: TRIGGER_LABELS[rule.trigger],
      toActive,
    });
    setIsESignOpen(true);
  };

  const handleToggleAllRequest = (toActive: boolean) => {
    setPendingToggle({
      ruleId: "ALL",
      label: "All Auto-Trigger Rules",
      toActive,
    });
    setIsESignOpen(true);
  };

  const doToggle = (ruleId: string, toActive: boolean) => {
    setRules((prev) => prev.map((r) => r.ruleId === ruleId ? { ...r, isActive: toActive } : r));
    setPendingToggle(null);
    showToast({
      type: toActive ? "success" : "warning",
      title: toActive ? "Rule Activated" : "Rule Deactivated",
      message: toActive
        ? "Auto-assignment rule is now active. Assignments will be created automatically."
        : "Auto-assignment rule disabled. No new assignments will be triggered by this rule.",
    });
  };

  const activateAll = () => {
    setRules((prev) =>
      prev.map((r) =>
        r.trigger === "manual" ? r : { ...r, isActive: true }
      )
    );
    setPendingToggle(null);
    showToast({
      type: "success",
      title: "All Rules Activated",
      message: "All auto-assignment rules are now active.",
    });
  };

  const disableAll = () => {
    setRules((prev) =>
      prev.map((r) =>
        r.trigger === "manual" ? r : { ...r, isActive: false }
      )
    );
    setPendingToggle(null);
    showToast({
      type: "warning",
      title: "All Rules Disabled",
      message: "All auto-assignment rules have been disabled.",
    });
  };

  const handleESignConfirm = async () => {
    if (!pendingToggle) return;

    if (pendingToggle.ruleId === "ALL") {
      if (pendingToggle.toActive) {
        activateAll();
      } else {
        disableAll();
      }
    } else {
      doToggle(pendingToggle.ruleId, pendingToggle.toActive);
    }

    setIsESignOpen(false);
  };

  if (isLoading) return <SectionLoading minHeight="60vh" />;

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      {/* Header */}
      <PageHeader
        title="Auto-Assignment Rules"
        breadcrumbItems={breadcrumbs.assignmentRules(navigateTo)}
      />

      {/* Main Content Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 md:p-5 flex flex-col">
          {/* Rules grid header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-700 uppercase">
                Auto-Trigger Rules
                <span className="ml-2 text-xs font-normal normal-case text-slate-400">
                  ({autoRules.length} configured)
                </span>
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-bold uppercase tracking-wider border",
                  activeCount > 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-500 border-slate-200"
                )}
              >
                {activeCount > 0 ? (
                  <ToggleRight className="h-4 w-4" />
                ) : (
                  <ToggleLeft className="h-4 w-4" />
                )}
                {activeCount} Active Rules
              </span>

              <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

              <div className="flex items-center gap-3">
                <Button
                  variant={showActiveOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowActiveOnly((v) => !v)}
                  className="text-2xs"
                >
                  Active Only
                </Button>
                <div className="w-48 md:w-64">
                  <Select
                    label=""
                    value={triggerFilter}
                    onChange={(val) =>
                      setTriggerFilter(val as AssignmentTrigger | "all")
                    }
                    options={TRIGGER_OPTIONS.map((t) => ({
                      label: t === "all" ? "All Triggers" : TRIGGER_LABELS[t],
                      value: t,
                    }))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pl-3 ml-1 sm:ml-2 border-l border-slate-200">
                <span className={cn("text-2xs font-bold uppercase tracking-tight transition-colors", activeCount !== autoRules.length ? "text-slate-700" : "text-slate-400")}>Off All</span>
                <Switch
                  checked={activeCount === autoRules.length}
                  onChange={() => handleToggleAllRequest(activeCount < autoRules.length)}
                  size="sm"
                />
                <span className={cn("text-2xs font-bold uppercase tracking-tight transition-colors", activeCount === autoRules.length ? "text-emerald-700" : "text-slate-400")}>On All</span>
              </div>
            </div>
          </div>

          {filteredRules.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/60">
              <p className="text-sm font-medium text-slate-700 mb-1">
                No rules match the current filters
              </p>
              <p className="text-xs text-slate-500">
                Try disabling "Active Only" or selecting a different trigger.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-5">
              {filteredRules.map((rule) => (
                <RuleCard
                  key={rule.ruleId}
                  rule={rule}
                  onToggle={handleToggleRequest}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* E-Signature modal for enabling/disabling rules */}
      <ESignatureModal
        isOpen={isESignOpen && !!pendingToggle}
        onClose={() => {
          setIsESignOpen(false);
          setPendingToggle(null);
        }}
        onConfirm={handleESignConfirm}
        actionTitle={
          pendingToggle
            ? `${pendingToggle.toActive ? "Activate" : "Disable"} auto-assignment rule "${pendingToggle.label}"`
            : "Update auto-assignment rule"
        }
      />

      {isNavigating && <FullPageLoading text="Loading..." />}
    </div>
  );
};




