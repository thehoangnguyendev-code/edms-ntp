import React from "react";
import { getApiErrorMessage } from '@/utils/apiError';
import { useNavigate } from "react-router-dom";
import { Archive, BookOpen, CalendarClock, FileDigit, FileSignature, GitBranch, Shield, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form/FormSection";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Select } from "@/components/ui/select/Select";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { settingsApi } from "@/services/api/settings";
import { documentNameFormatApi } from "@/services/api";
import { documentProperties } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { ROUTES } from "@/app/routes.constants";
import type { DocumentNameFormatItem } from "./documentNameFormatTypes";
import { IconApiBook, IconFileTextShield } from "@tabler/icons-react";

type RevisionSeed = "0.0.1" | "0.1";
type EffectiveDateBasis = "AFTER_APPROVAL" | "AFTER_TRAINING" | "AFTER_PUBLISH";

const EFFECTIVE_DATE_BASIS_OPTIONS: { value: EffectiveDateBasis; label: string }[] = [
  { value: "AFTER_APPROVAL", label: "After Approval (last Approver completes)" },
  { value: "AFTER_TRAINING", label: "After Training completion" },
  { value: "AFTER_PUBLISH", label: "After DCO Publish" },
];

interface DocumentPolicy {
  maxFileSizeMB: number;
  enableWatermark: boolean;
  allowDownload: boolean;
  revisionNumberSeed?: RevisionSeed;
  /** Fallback Document Name Format used when a Document Type has none of its own assigned. */
  defaultDocumentNameFormatId?: string | null;
  /** Zero-padding width for the Serial Number component (e.g. 4 → "0007"). Defaults to 4 when
   *  unset. Only affects new document numbers generated going forward. */
  serialNumberDigits?: number;
  /** When true, every assigned Reviewer may act in any order instead of the default
   *  one-at-a-time sequence. The mode is frozen on each Revision when it is submitted, so
   *  toggling it only affects Revisions submitted afterwards. */
  parallelReviewEnabled?: boolean;
  /** Days a pending Review/Approval may wait before the assignee is reminded (0 = off, default 3). */
  workflowReminderAfterDays?: number;
  /** Days a pending Review/Approval may wait before Document Control is told (0 = off, default 7). */
  workflowEscalationAfterDays?: number;
  /** How many documents each Knowledge portal card (Featured / Most Useful / Most Viewed) lists (default 5). */
  knowledgePortalTopCount?: number;
  /** Days of views counted for "Most Viewed" in the Knowledge portal (default 30). */
  knowledgePortalViewsWindowDays?: number;
  /** What event the Effective Date is counted from (default AFTER_APPROVAL). */
  effectiveDateBasis?: EffectiveDateBasis;
  /** Calendar days added to that event to get the Effective Date (0-365, default 0). */
  effectiveDateOffsetDays?: number;
  /** One independent on/off setting per Document Master participant role: when true, a user
   *  REMOVED from that specific role (e.g. via "Edit Revision for Upgrade") keeps read-only
   *  visibility of the Document afterwards, based on a permanent record of everyone who was ever
   *  assigned it. Each off by default -- matches existing behavior where a removed participant with
   *  no other footprint on the Document loses visibility immediately. */
  retainVisibilityForRemovedAuthor?: boolean;
  retainVisibilityForRemovedCoAuthor?: boolean;
  retainVisibilityForRemovedReviewer?: boolean;
  retainVisibilityForRemovedApprover?: boolean;
  [key: string]: unknown;
}

const RETAIN_VISIBILITY_ROLE_FIELDS = [
  "retainVisibilityForRemovedAuthor",
  "retainVisibilityForRemovedCoAuthor",
  "retainVisibilityForRemovedReviewer",
  "retainVisibilityForRemovedApprover",
] as const satisfies readonly (keyof DocumentPolicy)[];

const RETAIN_VISIBILITY_ROLE_OPTIONS: { field: (typeof RETAIN_VISIBILITY_ROLE_FIELDS)[number]; label: string }[] = [
  { field: "retainVisibilityForRemovedAuthor", label: "Author" },
  { field: "retainVisibilityForRemovedCoAuthor", label: "Co-Author" },
  { field: "retainVisibilityForRemovedReviewer", label: "Reviewer" },
  { field: "retainVisibilityForRemovedApprover", label: "Approver" },
];

const REVISION_SEED_OPTIONS = [
  { value: "0.0.1", label: "0.0.1  — three-part (0.0.1 → 0.0.2 … approve → 1.0.0)" },
  { value: "0.1", label: "0.1  — two-part (0.1 → 0.2 … approve → 1.0)" },
];

const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="min-w-0 space-y-3 rounded-lg border border-slate-200 p-3.5">
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
    {children}
  </div>
);

/** Whole-number input that clamps to [min, max] and falls back when the field is emptied. */
const NumberField: React.FC<{
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  fallback: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}> = ({ label, hint, value, min, max, fallback, disabled, onChange }) => (
  <div className="min-w-0">
    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">{label}</label>
    <input
      type="number"
      min={min}
      max={max}
      disabled={disabled}
      value={value}
      onChange={(e) => {
        const parsed = parseInt(e.target.value, 10);
        onChange(Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback);
      }}
      className="w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50"
    />
    {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
  </div>
);

export const DocumentPropertiesView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("documents.admin.properties.manage");

  const [documents, setDocuments] = React.useState<DocumentPolicy | null>(null);
  const [original, setOriginal] = React.useState<DocumentPolicy | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [showSaveModal, setShowSaveModal] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [eligibleFormats, setEligibleFormats] = React.useState<DocumentNameFormatItem[]>([]);

  React.useEffect(() => {
    documentNameFormatApi
      .getFormats()
      .then((items) => setEligibleFormats(items.filter((f) => f.isActive && f.eligibleForDocumentNumber)))
      .catch(() => setEligibleFormats([]));
  }, []);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(false);
    settingsApi
      .getDocumentPropertiesConfig()
      .then((doc) => {
        setDocuments(doc as DocumentPolicy);
        setOriginal(JSON.parse(JSON.stringify(doc)));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const isDirty = JSON.stringify(documents) !== JSON.stringify(original);

  const patch = (next: Partial<DocumentPolicy>) =>
    setDocuments((prev) => (prev ? { ...prev, ...next } : prev));

  const save = async () => {
    if (!documents) return;
    setSaving(true);
    try {
      const doc = (await settingsApi.updateDocumentPropertiesConfig(documents)) as DocumentPolicy;
      setDocuments(doc);
      setOriginal(JSON.parse(JSON.stringify(doc)));
      setShowSaveModal(false);
      showToast({ type: "success", title: "Changes saved", message: "Document properties have been updated." });
    } catch {
      setShowSaveModal(false);
      showToast({ type: "error", title: "Save failed", message: getApiErrorMessage(error, "Unable to save document properties.") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title="Document Properties"
        breadcrumbItems={documentProperties(navigate)}
        actions={
          canManage && documents ? (
            <Button size="sm" variant="outline-emerald" disabled={!isDirty || saving} onClick={() => setShowSaveModal(true)}>
              Save Changes
            </Button>
          ) : undefined
        }
      />

      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <SectionLoading text="Loading document properties..." />
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-amber-800">Unable to load document properties.</p>
          <Button size="sm" variant="outline" onClick={load}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && documents && (
        <div className="space-y-4">
          {/* 1. How documents are identified and dated */}
          <FormSection
            title="Numbering & Effective Date"
            description="How new documents and revisions are numbered, and when a published revision becomes effective."
            icon={<FileDigit className="h-4 w-4" />}
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Group title="Document number">
                <div>
                  <Select
                    label="Default Document Number Format"
                    disabled={!canManage}
                    value={(documents.defaultDocumentNameFormatId as string) ?? ""}
                    onChange={(value) => patch({ defaultDocumentNameFormatId: value || null })}
                    options={[
                      { value: "", label: "— None (legacy TYPE.NNNN) —" },
                      ...eligibleFormats.map((f) => ({ value: f.id, label: f.name })),
                    ]}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Fallback when a Document Type has no format of its own. Only formats composed of Document Type + Serial
                    Number are eligible. Manage the full catalog under Document Name Formats.
                  </p>
                </div>
                <NumberField
                  label="Digits of the Serial Number"
                  hint='Zero-padding width (e.g. 4 → "0007"). Applies only to numbers generated after saving; existing numbers are never rewritten.'
                  value={documents.serialNumberDigits ?? 4}
                  min={1}
                  max={9}
                  fallback={4}
                  disabled={!canManage}
                  onChange={(v) => patch({ serialNumberDigits: v })}
                />
              </Group>

              <Group title="Revision number">
                <div>
                  <Select
                    label="Default Revision Number Format"
                    disabled={!canManage}
                    value={(documents.revisionNumberSeed as RevisionSeed) ?? "0.0.1"}
                    onChange={(value) => patch({ revisionNumberSeed: value as RevisionSeed })}
                    options={REVISION_SEED_OPTIONS}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Starting revision number for newly created documents. Existing documents keep their current numbering.
                  </p>
                </div>
              </Group>

              <div className="lg:col-span-2">
                <Group title="Effective date">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Select
                      label="Effective Date is counted from"
                      disabled={!canManage}
                      value={documents.effectiveDateBasis ?? "AFTER_APPROVAL"}
                      onChange={(value) => patch({ effectiveDateBasis: String(value) as EffectiveDateBasis })}
                      options={EFFECTIVE_DATE_BASIS_OPTIONS}
                    />
                    <NumberField
                      label="Number of days after that event"
                      value={documents.effectiveDateOffsetDays ?? 0}
                      min={0}
                      max={365}
                      fallback={0}
                      disabled={!canManage}
                      onChange={(v) => patch({ effectiveDateOffsetDays: v })}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Effective Date = the chosen event + this many calendar days (0 = the same day). It is fixed when the DCO
                    publishes, using the setting in force at that moment, and the rule used is recorded in the Audit Trail. If
                    a revision has no training, or no approval record, the date falls back to the approval date and then the
                    publish date. A date earlier than the publish day means the document is effective from before it was
                    published.
                  </p>
                </Group>
              </div>
            </div>
          </FormSection>

          {/* 2. Review / approval behaviour */}
          <FormSection title="Review & Approval Workflow" icon={<Users className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Group title="Review mode">
                <div className="space-y-2.5">
                  <Checkbox
                    id="parallelReviewEnabled"
                    label="Enable Parallel Review"
                    disabled={!canManage}
                    checked={!!documents.parallelReviewEnabled}
                    onChange={(checked) => patch({ parallelReviewEnabled: checked })}
                  />
                  <Checkbox
                    id="sequentialReviewEnabled"
                    label="Enable Sequential Review"
                    disabled={!canManage}
                    checked={!documents.parallelReviewEnabled}
                    onChange={(checked) => patch({ parallelReviewEnabled: !checked })}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Sequential (default): Reviewers act one at a time, in the order configured on the Revision. Parallel: any
                  assigned Reviewer may act in any order; the Revision still moves on only once every Reviewer has reviewed, and
                  a single Reject sends it back to Draft. The mode is fixed when a Revision is submitted, so a change only
                  affects Revisions submitted afterwards. Enabling one disables the other.
                </p>
              </Group>

              <Group title="Reminders & escalation">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <NumberField
                    label="Remind assignee after (days)"
                    value={documents.workflowReminderAfterDays ?? 3}
                    min={0}
                    max={365}
                    fallback={3}
                    disabled={!canManage}
                    onChange={(v) => patch({ workflowReminderAfterDays: v })}
                  />
                  <NumberField
                    label="Escalate to Document Control after (days)"
                    value={documents.workflowEscalationAfterDays ?? 7}
                    min={0}
                    max={365}
                    fallback={7}
                    disabled={!canManage}
                    onChange={(v) => patch({ workflowEscalationAfterDays: v })}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  A Reviewer/Approver who has not acted after the reminder period is reminded once; after the escalation period
                  Document Control is notified. Use 0 to switch either off.
                </p>
              </Group>
            </div>
            <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-800">
              Want to configure a rule that prevents duplicate Reviewers/Approvers (Segregation of Duties)? See at{" "}
              <button
                type="button"
                onClick={() => navigate(ROUTES.SECURITY.SOD)}
                className="font-medium underline underline-offset-2 hover:text-sky-900"
              >
                Security & Authorization &gt; Segregation of Duties
              </button>
              .
            </div>
          </FormSection>

          {/* 3. Files and what readers see */}
          <FormSection title="Storage & Knowledge Base" icon={<Archive className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Group title="Uploads">
                <NumberField
                  label="Max File Size (MB)"
                  // Same default (25) and 1-100 range the backend applies when the value is missing or out of range.
                  hint="Maximum file size for document uploads."
                  value={documents.maxFileSizeMB ?? 25}
                  min={1}
                  max={100}
                  fallback={25}
                  disabled={!canManage}
                  onChange={(v) => patch({ maxFileSizeMB: v })}
                />
              </Group>

              <Group title="Knowledge Base portal">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <NumberField
                    label="Documents listed per card"
                    value={documents.knowledgePortalTopCount ?? 5}
                    min={1}
                    max={20}
                    fallback={5}
                    disabled={!canManage}
                    onChange={(v) => patch({ knowledgePortalTopCount: v })}
                  />
                  <NumberField
                    label="Most Viewed window (days)"
                    value={documents.knowledgePortalViewsWindowDays ?? 30}
                    min={1}
                    max={365}
                    fallback={30}
                    disabled={!canManage}
                    onChange={(v) => patch({ knowledgePortalViewsWindowDays: v })}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Featured, Most Useful and Most Viewed are computed from recorded views, "helpful" votes and featured
                  documents. These values only change how many are shown and how far back views count.
                </p>
              </Group>
            </div>
          </FormSection>

          {/* 4. Access after removal */}
          <FormSection title="Protection & Distribution" icon={<IconFileTextShield className="h-4 w-4" />}>
            <Group title="Retain visibility for removed participants">
              <p className="text-xs text-slate-500">
                When a user is removed from one of these roles on a Document (e.g. via "Edit Revision for Upgrade"), they keep
                read-only visibility of it based on having held that role before. Pick which roles this applies to; each is
                independent. If none are checked, a removed participant with no other role on the Document loses visibility
                immediately (default).
              </p>
              {(() => {
                const checkedCount = RETAIN_VISIBILITY_ROLE_FIELDS.filter((field) => !!documents[field]).length;
                const allChecked = checkedCount === RETAIN_VISIBILITY_ROLE_FIELDS.length;
                return (
                  <>
                    <Checkbox
                      id="retainVisibilityForRemovedParticipants-all"
                      label="All roles"
                      disabled={!canManage}
                      checked={allChecked}
                      indeterminate={checkedCount > 0 && !allChecked}
                      onChange={(checked) =>
                        patch(Object.fromEntries(RETAIN_VISIBILITY_ROLE_FIELDS.map((field) => [field, checked])))
                      }
                    />
                    <div className="ml-7 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {RETAIN_VISIBILITY_ROLE_OPTIONS.map(({ field, label }) => (
                        <Checkbox
                          key={field}
                          id={field}
                          label={label}
                          disabled={!canManage}
                          checked={!!documents[field]}
                          onChange={(checked) => patch({ [field]: checked })}
                        />
                      ))}
                    </div>
                  </>
                );
              })()}
            </Group>
          </FormSection>
        </div>
      )}

      <AlertModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onConfirm={save}
        type="confirm"
        title="Save document properties?"
        description={
          <p className="text-sm text-slate-600">
            You are about to save changes to Document Properties. This action will be recorded in the Audit Trail.
          </p>
        }
        confirmText="Save Changes"
        cancelText="Cancel"
        isLoading={saving}
      />
    </div>
  );
};
