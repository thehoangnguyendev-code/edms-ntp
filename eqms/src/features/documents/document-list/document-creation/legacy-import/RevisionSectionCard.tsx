import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { MultiSelect } from "@/components/ui/select/MultiSelect";
import { cn } from "@/components/ui/utils";
import { LegacyTrainingEvidence } from "../legacy-import-tabs/LegacyTrainingEvidence";
import { Field } from "./LegacyField";
import { SectionFileField } from "./SectionFileField";
import {
  FIELD_INPUT,
  FIELD_TEXTAREA,
  getSectionDateErrors,
  type DocumentFormState,
  type RevisionSection,
  type UpdateSection,
  type UserOption,
} from "./legacyImportModel";

export interface RevisionSectionCardProps {
  section: RevisionSection;
  index: number;
  sectionCount: number;
  form: DocumentFormState;
  trainingRequired: boolean;
  showValidation: boolean;
  collapseTransition: object;
  updateSection: UpdateSection;
  toggleCollapsed: (key: string) => void;
  applyFirstSectionRolesToRest: () => void;
  userOptions: UserOption[];
  loadingUsers: boolean;
  searchUsers: (query: string) => Promise<SelectOption[]>;
  maxFileSizeMB: number;
  isRevisionNumberFormatValid: (value: string) => boolean;
}

/** One historical revision of the import: the dates and people of the paper process, the paper training, and the source file. */
export const RevisionSectionCard: React.FC<RevisionSectionCardProps> = ({
  section,
  index,
  sectionCount,
  form,
  trainingRequired,
  showValidation,
  collapseTransition,
  updateSection,
  toggleCollapsed,
  applyFirstSectionRolesToRest,
  userOptions,
  loadingUsers,
  searchUsers,
  maxFileSizeMB,
  isRevisionNumberFormatValid,
}) => {
  const isLast = index === sectionCount - 1;
  const sectionDateErrors = getSectionDateErrors(section);
  return (
      <div
        // CSS-only "active section" highlight via :focus-within -- deliberately NOT
        // React state driven by onFocus/onBlur: that previously forced a re-render of
        // this whole (portal-based, click-outside-detecting) dropdown subtree on every
        // focus/blur, which could eat the very first click on a Select/MultiSelect
        // option (had to click twice to actually select a value). CSS has no such
        // re-render, so this can never race a click.
        className="group rounded-xl border border-slate-200 overflow-hidden transition-colors focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500"
      >
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b bg-slate-50 border-slate-200 transition-colors group-focus-within:bg-emerald-50/60 group-focus-within:border-emerald-200">
          <button
            type="button"
            onClick={() => toggleCollapsed(section.key)}
            className="flex items-center gap-2 min-w-0 flex-1 text-left"
            aria-expanded={!section.collapsed}
          >
            <motion.span
              className="flex-shrink-0"
              animate={{ rotate: section.collapsed ? -90 : 0 }}
              transition={collapseTransition}
            >
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </motion.span>
            <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">
              Revision {section.revisionNumber || index + 1}
            </span>
            {isLast ? (
              <Badge color="emerald" size="xs">
                Becomes Effective
              </Badge>
            ) : (
              <Badge color="amber" size="xs">
                Becomes Obsoleted
              </Badge>
            )}
          </button>
        </div>
        <AnimatePresence initial={false}>
          {!section.collapsed && (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={collapseTransition}
              className="overflow-hidden"
            >
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <Field label="Revision Number" required>
                  <input
                    className={cn(
                      FIELD_INPUT,
                      section.revisionNumber.trim() &&
                        !isRevisionNumberFormatValid(
                          section.revisionNumber,
                        ) &&
                        "border-red-400 focus:ring-red-400 focus:border-red-400",
                    )}
                    value={section.revisionNumber}
                    onChange={(e) =>
                      updateSection(
                        section.key,
                        "revisionNumber",
                        e.target.value,
                      )
                    }
                  />
                  {showValidation &&
                    !section.revisionNumber.trim() && (
                      <p className="text-xs text-red-600 mt-1">
                        Revision Number is required.
                      </p>
                    )}
                </Field>
                <Field
                  label="Effective Date"
                  required
                >
                  <DateTimePicker
                    value={section.effectiveDate}
                    onChange={(v) =>
                      updateSection(section.key, "effectiveDate", v)
                    }
                    placeholder="Select date"
                  />
                  {showValidation && !section.effectiveDate && (
                    <p className="text-xs text-red-600 mt-1">
                      Effective Date is required.
                    </p>
                  )}
                  {sectionDateErrors.effective && (
                    <p className="text-xs text-red-600 mt-1">
                      {sectionDateErrors.effective}
                    </p>
                  )}
                </Field>
                <Field
                  label="Author"
                  required
                >
                  <Select
                    value={section.authorId}
                    onChange={(v) =>
                      updateSection(section.key, "authorId", String(v))
                    }
                    options={userOptions}
                    isLoading={loadingUsers}
                    onSearch={searchUsers}
                    placeholder="Select author..."
                  />
                  {showValidation && !section.authorId && (
                    <p className="text-xs text-red-600 mt-1">
                      Author is required.
                    </p>
                  )}
                </Field>
                <Field
                  label="Authored Date"
                  required
                >
                  <DateTimePicker
                    value={section.legacyHistoricalAuthoredDate}
                    onChange={(v) =>
                      updateSection(
                        section.key,
                        "legacyHistoricalAuthoredDate",
                        v,
                      )
                    }
                    placeholder="Select date"
                  />
                  {showValidation &&
                    !section.legacyHistoricalAuthoredDate && (
                      <p className="text-xs text-red-600 mt-1">
                        Authored Date is required.
                      </p>
                    )}
                  {sectionDateErrors.authored && (
                    <p className="text-xs text-red-600 mt-1">
                      {sectionDateErrors.authored}
                    </p>
                  )}
                </Field>
                <Field label="Historical Reviewer(s)" required>
                  <MultiSelect
                    value={section.legacyHistoricalReviewerIds}
                    onChange={(values) =>
                      updateSection(
                        section.key,
                        "legacyHistoricalReviewerIds",
                        values.map(String),
                      )
                    }
                    options={userOptions}
                    isLoading={loadingUsers}
                    onSearch={searchUsers}
                    placeholder="Select reviewer(s)..."
                  />
                  {showValidation &&
                    section.legacyHistoricalReviewerIds.length ===
                      0 && (
                      <p className="text-xs text-red-600 mt-1">
                        Historical Reviewer(s) is required.
                      </p>
                    )}
                </Field>
                <Field label="Historical Review Date" required>
                  <DateTimePicker
                    value={section.legacyHistoricalReviewDate}
                    onChange={(v) =>
                      updateSection(
                        section.key,
                        "legacyHistoricalReviewDate",
                        v,
                      )
                    }
                    placeholder="Select date"
                  />
                  {showValidation &&
                    !section.legacyHistoricalReviewDate && (
                      <p className="text-xs text-red-600 mt-1">
                        Historical Review Date is required.
                      </p>
                    )}
                  {sectionDateErrors.review && (
                    <p className="text-xs text-red-600 mt-1">
                      {sectionDateErrors.review}
                    </p>
                  )}
                </Field>
                <Field label="Historical Approver" required>
                  <Select
                    value={section.legacyHistoricalApproverId}
                    onChange={(v) =>
                      updateSection(
                        section.key,
                        "legacyHistoricalApproverId",
                        String(v),
                      )
                    }
                    options={userOptions}
                    isLoading={loadingUsers}
                    onSearch={searchUsers}
                    placeholder="Select approver..."
                  />
                  {showValidation &&
                    !section.legacyHistoricalApproverId && (
                      <p className="text-xs text-red-600 mt-1">
                        Historical Approver is required.
                      </p>
                    )}
                </Field>
                <Field label="Historical Approval Date" required>
                  <DateTimePicker
                    value={section.legacyHistoricalApprovalDate}
                    onChange={(v) =>
                      updateSection(
                        section.key,
                        "legacyHistoricalApprovalDate",
                        v,
                      )
                    }
                    placeholder="Select date"
                  />
                  {showValidation &&
                    !section.legacyHistoricalApprovalDate && (
                      <p className="text-xs text-red-600 mt-1">
                        Historical Approval Date is required.
                      </p>
                    )}
                  {sectionDateErrors.approval && (
                    <p className="text-xs text-red-600 mt-1">
                      {sectionDateErrors.approval}
                    </p>
                  )}
                </Field>
                {index === 0 && sectionCount > 1 && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5">
                    <p className="text-xs text-slate-600">
                      Applies this Author / Historical Reviewer(s) / Historical Approver to the other {sectionCount - 1} revision(s) below. Every revision stays individually editable afterward.
                    </p>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="whitespace-nowrap shrink-0"
                      onClick={applyFirstSectionRolesToRest}
                      disabled={
                        !section.authorId ||
                        section.legacyHistoricalReviewerIds.length === 0 ||
                        !section.legacyHistoricalApproverId
                      }
                    >
                      Apply to all revisions
                    </Button>
                  </div>
                )}
                {trainingRequired && (
                  <Field
                    label="Training Number (if any)"
                    hint="The number written on the paper training record of this revision, if there is one. It is kept as typed so the paper record can be found from the system later."
                  >
                    <input
                      type="text"
                      maxLength={40}
                      className={FIELD_INPUT}
                      value={section.trainingNumber}
                      placeholder="e.g. TRN/QA/19-012"
                      onChange={(e) =>
                        updateSection(section.key, "trainingNumber", e.target.value)
                      }
                    />
                  </Field>
                )}
                {trainingRequired && (
                  <Field
                    label="Historical Training Completion Date"
                    required
                    hint="When employees completed training for this revision. Must be on or before this revision's Effective Date. Feeds the same Training tracking field a normal revision uses."
                  >
                    <DateTimePicker
                      value={section.trainingCompletionDate}
                      onChange={(v) =>
                        updateSection(
                          section.key,
                          "trainingCompletionDate",
                          v,
                        )
                      }
                      placeholder="Select date"
                    />
                    {showValidation &&
                      !section.trainingCompletionDate && (
                        <p className="text-xs text-red-600 mt-1">
                          Historical Training Completion Date is
                          required.
                        </p>
                      )}
                    {sectionDateErrors.training && (
                      <p className="text-xs text-red-600 mt-1">
                        {sectionDateErrors.training}
                      </p>
                    )}
                  </Field>
                )}
                {trainingRequired && !form.isTemplate && (
                  <div className="md:col-span-2">
                    <LegacyTrainingEvidence
                      revisionLabel={section.revisionNumber || String(index + 1)}
                      trainingNumber={section.trainingNumber}
                      value={section.training}
                      onChange={(value) => updateSection(section.key, "training", value)}
                      onNumberState={(state) => {
                        updateSection(section.key, "trainingNumberJoins", state.joins);
                        updateSection(section.key, "trainingNumberProblem", state.problem);
                      }}
                      showValidation={showValidation}
                    />
                  </div>
                )}
                <div className="md:col-span-2">
                  <Field
                    label="Change Description"
                    hint="What changed in this revision, if known."
                  >
                    <textarea
                      rows={2}
                      className={FIELD_TEXTAREA}
                      value={section.changeDescription}
                      onChange={(e) =>
                        updateSection(
                          section.key,
                          "changeDescription",
                          e.target.value,
                        )
                      }
                    />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field
                    label="Source File"
                    required={isLast || form.isTemplate}
                    hint={
                      section.fileError
                        ? undefined
                        : form.isTemplate
                          ? `The DOCX (Word) file for this template revision. PDF is not accepted. Maximum file size: ${maxFileSizeMB} MB. Required for every revision.`
                          : `The DOCX/PDF for this revision. Maximum file size: ${maxFileSizeMB} MB.${isLast ? " Required — this revision becomes Effective." : ""}`
                    }
                  >
                    <SectionFileField
                      file={section.file}
                      onChange={(file) => {
                        updateSection(section.key, "fileError", "");
                        updateSection(section.key, "file", file);
                      }}
                      onOversize={(message) => {
                        updateSection(section.key, "file", null);
                        updateSection(
                          section.key,
                          "fileError",
                          message,
                        );
                      }}
                      maxFileSizeMB={maxFileSizeMB}
                      docxOnly={form.isTemplate}
                    />
                    {section.fileError && (
                      <p className="text-xs text-red-600 mt-1">
                        {section.fileError}
                      </p>
                    )}
                    {showValidation &&
                      !section.fileError &&
                      !section.file &&
                      (isLast || form.isTemplate) && (
                        <p className="text-xs text-red-600 mt-1">
                          {form.isTemplate
                            ? "A DOCX file is required for every revision of a template."
                            : "Source file is required for the most recent revision."}
                        </p>
                      )}
                  </Field>
                  {!section.file && !isLast && !form.isTemplate && (
                    <div className="mt-2">
                      <Field
                        label="No File Justification"
                        required
                        hint="Required when no source file is attached (e.g. the original scan could not be located)."
                      >
                        <input
                          className={FIELD_INPUT}
                          value={section.noFileJustification}
                          onChange={(e) =>
                            updateSection(
                              section.key,
                              "noFileJustification",
                              e.target.value,
                            )
                          }
                          placeholder="Original scan not located in the paper archive"
                        />
                        {showValidation &&
                          !section.noFileJustification.trim() && (
                            <p className="text-xs text-red-600 mt-1">
                              No File Justification is required.
                            </p>
                          )}
                      </Field>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
  );
};
