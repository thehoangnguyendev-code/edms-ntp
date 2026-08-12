import React, { useMemo } from "react";
import { LinkIcon } from "lucide-react";
import { Select } from "@/components/ui/select/Select";
import { MultiSelect } from "@/components/ui/select/MultiSelect";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { Popover } from "@/components/ui/popover/Popover";
import { cn } from "@/components/ui/utils";
import type { DocumentType } from "@/features/documents/types";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";

type SelectOption = { label: string; value: string };
type DepartmentOption = SelectOption & { businessUnit?: string };

// Export FormData interface to be reused by parent components
export interface GeneralTabFormData {
  documentName: string;
  titleLocalLanguage: string;
  type: DocumentType;
  author: string;
  coAuthors: (string | number)[];
  businessUnit: string;
  department: string;
  knowledgeBase: string;
  subType: string;
  periodicReviewCycle: number;
  periodicReviewNotification: number;
  language: string;
  reviewDate: string;
  description: string;
  isTemplate: boolean;
}

// Alias for backward compatibility
type FormData = GeneralTabFormData;

interface GeneralTabProps {
  formData: FormData;
  onFormChange: (data: FormData) => void;
  isTemplateMode?: boolean;
  hideTemplateCheckbox?: boolean;
  suggestedDocumentCode?: string; // Suggested code from parent document
  documentNumber?: string; // Auto-generated document number
  createdDateTime?: string; // Auto-generated created date/time
  openedBy?: string; // Auto-generated opened by user
  isObsoleted?: boolean;
  readOnlyReviewDate?: boolean;
  lockedAfterSave?: boolean;
  lockAllEditableFields?: boolean;
  authorOptions?: { label: string; value: string }[];
  coAuthorOptions?: { label: string; value: string }[];
  /** Debounced server-side search for the Author/Co-Author pickers, falling back to
   * client-side filtering of authorOptions/coAuthorOptions when not provided. */
  onSearchWorkflowUsers?: (query: string) => Promise<{ label: string; value: string }[]>;
  /** Server-resolved {id, fullName} for each co-author — used for the read-only
   * badge display so it never depends on the (possibly not-yet-loaded or
   * filtered) coAuthorOptions lookup falling back to a raw user id. */
  coAuthorDisplayItems?: { id: string; fullName: string }[];
  businessUnitOptions?: SelectOption[];
  departmentOptions?: DepartmentOption[];
  documentTypeOptions?: SelectOption[];
  subTypeOptions?: SelectOption[];
  coAuthorReadOnly?: boolean;
  /** Only DCO may create or manage controlled document templates. */
  canManageTemplates?: boolean;
  onAuthorChange?: (author: string) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  formData,
  onFormChange,
  isTemplateMode = false,
  hideTemplateCheckbox = false,
  suggestedDocumentCode = "",
  documentNumber = "",
  createdDateTime = "",
  openedBy = "",
  isObsoleted = false,
  readOnlyReviewDate = false,
  lockedAfterSave = false,
  lockAllEditableFields = false,
  authorOptions,
  coAuthorOptions,
  onSearchWorkflowUsers,
  coAuthorDisplayItems,
  businessUnitOptions = [],
  departmentOptions = [],
  documentTypeOptions = [],
  subTypeOptions = [],
  coAuthorReadOnly = false,
  canManageTemplates = false,
  onAuthorChange,
}) => {
  const setFormData = (data: Partial<FormData>) => {
    onFormChange({ ...formData, ...data });
  };

  // Once the document has been saved, every field below (not just Business Unit/
  // Department/Document Type) becomes read-only for everyone — a document's
  // identity metadata should not keep changing after it exists in the system.
  const isLocked = lockedAfterSave || lockAllEditableFields;

  // Department options based on selected Business Unit
  const filteredDepartmentOptions = useMemo(() => {
    if (!formData.businessUnit) return [];
    return departmentOptions
      .filter((dept) => !dept.businessUnit || dept.businessUnit === formData.businessUnit)
      .map((dept) => ({ label: dept.label, value: dept.value }));
  }, [departmentOptions, formData.businessUnit]);

  const getOptionLabel = (options: SelectOption[], value: string) =>
    options.find((option) => option.value === value || option.label === value)?.label || value || "—";

  const authorDisplayValue = useMemo(
    () => getOptionLabel(authorOptions ?? [], formData.author),
    [authorOptions, formData.author],
  );

  const businessUnitDisplayValue = useMemo(
    () => getOptionLabel(businessUnitOptions ?? [], formData.businessUnit),
    [businessUnitOptions, formData.businessUnit],
  );

  const departmentDisplayValue = useMemo(
    () => getOptionLabel(filteredDepartmentOptions, formData.department) || getOptionLabel(departmentOptions, formData.department),
    [departmentOptions, filteredDepartmentOptions, formData.department],
  );

  const knowledgeBaseDisplayValue = useMemo(
    () =>
      getOptionLabel(departmentOptions, formData.knowledgeBase) ||
      getOptionLabel(filteredDepartmentOptions, formData.knowledgeBase) ||
      formData.knowledgeBase ||
      "—",
    [departmentOptions, filteredDepartmentOptions, formData.knowledgeBase],
  );

  const documentTypeDisplayValue = useMemo(
    () => getOptionLabel(documentTypeOptions ?? [], formData.type),
    [documentTypeOptions, formData.type],
  );

  const subTypeDisplayOptions = useMemo(() => {
    const baseOptions = subTypeOptions.length > 0
      ? subTypeOptions
      : [];
    const currentValue = String(formData.subType || "");
    const hasCurrentValue = baseOptions.some((option) => String(option.value) === currentValue || option.label === currentValue);
    if (!currentValue || hasCurrentValue) {
      return baseOptions;
    }
    return [
      ...baseOptions,
      { label: currentValue, value: currentValue },
    ];
  }, [formData.subType, subTypeOptions]);

  const coAuthorDisplayNames = useMemo(() => {
    const serverLookup = new Map((coAuthorDisplayItems ?? []).map((item) => [item.id, item.fullName]));
    const optionLookup = new Map((coAuthorOptions ?? []).map((option) => [String(option.value), option.label]));
    return (formData.coAuthors || [])
      .map((value) => serverLookup.get(String(value)) || optionLookup.get(String(value)) || String(value))
      .filter(Boolean);
  }, [coAuthorDisplayItems, coAuthorOptions, formData.coAuthors]);

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {/* Document Number (read-only, auto-generated) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Document Number
          </label>
          <input
            type="text"
            value={documentNumber}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
            placeholder="Auto-generated after Next Step"
          />
        </div>

        {/* Created (read-only, auto-generated) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Created Time
          </label>
          <input
            type="text"
            value={createdDateTime}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
            placeholder="Auto-generated after Next Step"
          />
        </div>

        {/* Suggested Document Code (if parent is selected) */}
        {suggestedDocumentCode && (
          <div className="md:col-span-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-blue-900">
                  Gợi ý mã tài liệu con:
                </p>
                <p className="text-sm font-bold text-blue-700 mt-0.5">
                  {suggestedDocumentCode}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Author, Co-Author & Opened by - Same row with 2-1-1 ratio */}
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
          {/* Opened by (read-only, auto-generated) */}
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Opened by
            </label>
            <input
              type="text"
              value={openedBy}
              readOnly
              className={CONTROL_STATE_CLASSES.readonlyField}
              placeholder="Auto-generated after Next Step"
            />
          </div>
          {/* Author (Select) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Author<span className="text-red-500 ml-1">*</span>
            </label>
            {isLocked ? (
              <input
                type="text"
                readOnly
                value={authorDisplayValue}
                placeholder="—"
                className={CONTROL_STATE_CLASSES.readonlyField}
              />
            ) : (
              <Select
                value={formData.author}
                onChange={(value) => {
                  if (isObsoleted) return;
                  setFormData({ author: value });
                  onAuthorChange?.(value);
                }}
                options={authorOptions ?? []}
                enableSearch={true}
                onSearch={onSearchWorkflowUsers}
                placeholder="Select author..."
                disabled={isObsoleted}
              />
            )}
          </div>

          {/* Co-Authors (MultiSelect) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Co-Author(s)
            </label>
            {isLocked ? (
              coAuthorDisplayNames.length === 0 ? (
                <input
                  type="text"
                  readOnly
                  value=""
                  placeholder="—"
                  className={CONTROL_STATE_CLASSES.readonlyField}
                />
              ) : (
                <div className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2 py-1">
                  {coAuthorDisplayNames.slice(0, 2).map((name, index) => (
                    <span
                      key={`${name}-${index}`}
                      className="inline-flex min-w-0 max-w-full shrink items-center rounded-xl bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600"
                    >
                      <span className="truncate">{name}</span>
                    </span>
                  ))}
                  {coAuthorDisplayNames.length > 2 && (
                    <Popover
                      title="Co-Author(s)"
                      placement="top"
                      triggerAriaLabel={`View ${coAuthorDisplayNames.length - 2} more co-authors`}
                      trigger={<span className="text-[10px] font-medium">+{coAuthorDisplayNames.length - 2}</span>}
                      triggerClassName="inline-flex items-center rounded-lg bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-slate-500 hover:bg-slate-300"
                      contentClassName="min-w-[180px] max-w-[280px]"
                      content={
                        <div className="space-y-0.5">
                          {coAuthorDisplayNames.slice(2).map((name, index) => (
                            <div key={`${name}-${index}`} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-50">
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                              <span className="truncate pr-2 text-xs font-medium text-slate-700">{name}</span>
                            </div>
                          ))}
                        </div>
                      }
                    />
                  )}
                </div>
              )
            ) : (
              <MultiSelect
                value={formData.coAuthors}
                onChange={(values) =>
                  !isObsoleted && !coAuthorReadOnly && setFormData({ coAuthors: values })
                }
                options={coAuthorOptions ?? []}
                enableSearch={true}
                onSearch={onSearchWorkflowUsers
                  ? async (query) => {
                      const results = await onSearchWorkflowUsers(query);
                      return results.filter((option) => option.value !== formData.author);
                    }
                  : undefined}
                placeholder="Select Co-Authors..."
                maxVisibleTags={2}
                disabled={isObsoleted || coAuthorReadOnly}
              />
            )}
          </div>
        </div>

        {/* Business Unit (Select) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Business Unit<span className="text-red-500 ml-1">*</span>
          </label>
            {isLocked ? (
              <input
                type="text"
                readOnly
                value={businessUnitDisplayValue}
                placeholder="—"
                className={CONTROL_STATE_CLASSES.readonlyField}
              />
            ) : (
            <Select
              value={formData.businessUnit}
              onChange={(value) =>
                !isObsoleted && setFormData({ businessUnit: value, department: "", knowledgeBase: "" })
              }
              options={businessUnitOptions}
              enableSearch={true}
              placeholder="Select business unit..."
              disabled={isObsoleted}
            />
          )}
        </div>

        {/* Department (Select) - depends on Business Unit */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Department<span className="text-red-500 ml-1">*</span>
          </label>
            {isLocked ? (
              <input
                type="text"
                readOnly
                value={departmentDisplayValue}
                placeholder="—"
                className={CONTROL_STATE_CLASSES.readonlyField}
              />
            ) : (
              <Select
                value={formData.department}
                onChange={(value) => {
                  if (isObsoleted) return;
                  const selectedDepartment = departmentOptions.find((dept) => dept.value === value || dept.label === value);
                  setFormData({
                    department: value,
                    knowledgeBase: selectedDepartment?.label || "",
                  });
                }}
                options={filteredDepartmentOptions}
                enableSearch={true}
                placeholder={formData.businessUnit ? "Select department..." : "Select Business Unit first"}
                disabled={isObsoleted || !formData.businessUnit}
              />
          )}
        </div>

        {/* Document Name - Full width */}
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Document Name<span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={formData.documentName}
            onChange={(e) =>
              !isObsoleted && !isLocked && setFormData({ documentName: e.target.value })
            }
            placeholder="Enter document name"
            readOnly={isObsoleted || isLocked}
            className={cn(
              "w-full h-9 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 read-only:focus:ring-0",
              (isObsoleted || isLocked) && CONTROL_STATE_CLASSES.readonly,
            )}
          />
        </div>

        {/* Title in Local Language - Full width */}
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Title in Local Language
            <span className="text-slate-400 text-xs font-normal ml-1.5">(optional)</span>
          </label>
          <input
            type="text"
            value={formData.titleLocalLanguage}
            onChange={(e) =>
              !isObsoleted && !isLocked && setFormData({ titleLocalLanguage: e.target.value })
            }
            placeholder="Enter title in local language..."
            readOnly={isObsoleted || isLocked}
            className={cn(
              "w-full h-9 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 read-only:focus:ring-0",
              (isObsoleted || isLocked) && CONTROL_STATE_CLASSES.readonly,
            )}
          />
        </div>

        {/* Is Template */}
        {!isTemplateMode && (canManageTemplates || formData.isTemplate) && (
          <div className="flex items-center gap-3">
            <label
              htmlFor="isTemplate"
              className={cn(
                "text-xs sm:text-sm font-medium text-slate-700",
                !isObsoleted && canManageTemplates && "cursor-pointer",
              )}
            >
              Is Template?
            </label>
            <Checkbox
              id="isTemplate"
              checked={formData.isTemplate}
              onChange={(checked) =>
                !isObsoleted && !isLocked && canManageTemplates && setFormData({ isTemplate: checked })
              }
              disabled={isObsoleted || isLocked || !canManageTemplates}
            />
          </div>
        )}

        {/* Knowledge Base */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Knowledge Base
          </label>
          <input
            type="text"
            value={knowledgeBaseDisplayValue}
            readOnly
            placeholder="Auto-filled after Next Step"
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
        </div>

        {/* Document Type (Select) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Document Type<span className="text-red-500 ml-1">*</span>
          </label>
          {isLocked ? (
            <input
              type="text"
              readOnly
              value={documentTypeDisplayValue}
              placeholder="—"
              className={CONTROL_STATE_CLASSES.readonlyField}
            />
          ) : (
            <Select
              value={formData.type}
              onChange={(value) =>
                !isObsoleted && setFormData({ type: value as DocumentType })
              }
              options={documentTypeOptions}
              enableSearch={true}
              placeholder="Select document type..."
              disabled={isObsoleted}
            />
          )}
        </div>

        {/* Sub-Type (Select) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Sub-Type</label>
          <Select
            value={formData.subType}
            onChange={(value) =>
              !isObsoleted && setFormData({ subType: value })
            }
            options={subTypeDisplayOptions}
            enableSearch={true}
            placeholder="Select sub-type..."
            disabled={isObsoleted || isLocked}
          />
        </div>

        {/* Periodic Review Cycle */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Periodic Review Cycle (Months)
            <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={formData.periodicReviewCycle || ""}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-", "."].includes(e.key)) {
                e.preventDefault();
              }
            }}
            onChange={(e) => {
              if (isObsoleted || isLocked) return;
              const val = parseInt(e.target.value);
              if (e.target.value === "" || val > 0) {
                setFormData({
                  periodicReviewCycle: e.target.value === "" ? 0 : val,
                });
              }
            }}
            placeholder="Enter review cycle in months"
            readOnly={isObsoleted || isLocked}
            className={cn(
              "w-full h-9 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 read-only:focus:ring-0",
              (isObsoleted || isLocked) && CONTROL_STATE_CLASSES.readonly,
            )}
          />
        </div>

        {/* Periodic Review Notification */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Periodic Review Notification (Days)
            <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={formData.periodicReviewNotification || ""}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-", "."].includes(e.key)) {
                e.preventDefault();
              }
            }}
            onChange={(e) => {
              if (isObsoleted || isLocked) return;
              const val = parseInt(e.target.value);
              if (e.target.value === "" || val > 0) {
                setFormData({
                  periodicReviewNotification: e.target.value === "" ? 0 : val,
                });
              }
            }}
            placeholder="Enter notification days before review"
            readOnly={isObsoleted || isLocked}
            className={cn(
              "w-full h-9 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 read-only:focus:ring-0",
              (isObsoleted || isLocked) && CONTROL_STATE_CLASSES.readonly,
            )}
          />
        </div>

        {/* Effective Date (read-only, auto-generated) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Effective Date
          </label>
          <input
            type="text"
            value={""}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
            placeholder="Set when approved"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Valid Until
          </label>
          <input
            type="text"
            value={""}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
            placeholder="Set when approved"
          />
        </div>

        {/* Language */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Language</label>
          <Select
            value={formData.language}
            onChange={(value) =>
              !isObsoleted && setFormData({ language: value })
            }
            options={[
              { label: "English", value: "English" },
              { label: "Vietnamese", value: "Vietnamese" },
            ]}
            enableSearch={false}
            disabled={isObsoleted || isLocked}
          />
        </div>

        {/* Review Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Review Date
          </label>
          {readOnlyReviewDate ? (
            <input
              type="text"
              readOnly
              value={formData.reviewDate || ""}
              placeholder="—"
              className={CONTROL_STATE_CLASSES.readonlyField}
            />
          ) : (
            <DateTimePicker
              value={formData.reviewDate || ""}
              onChange={(value) =>
                !isObsoleted && setFormData({ reviewDate: value })
              }
              placeholder="Auto-generated after publish"
              disabled={isObsoleted || isLocked}
            />
          )}
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              !isObsoleted && !isLocked && setFormData({ description: e.target.value })
            }
            placeholder="Enter document description"
            rows={4}
            readOnly={isObsoleted || isLocked}
            className={
              isObsoleted || isLocked
                ? CONTROL_STATE_CLASSES.readonlyTextarea
                : "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 resize-none read-only:focus:ring-0 bg-white"
            }
          />
        </div>
      </div>
    </div>
  );
};

