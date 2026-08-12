import React, { useMemo } from "react";
import { LinkIcon } from "lucide-react";
import { Select } from "@/components/ui/select/Select";
import { MultiSelect } from "@/components/ui/select/MultiSelect";
import { Popover } from "@/components/ui/popover/Popover";

const CO_AUTHOR_OPTIONS = [
  { label: "Shani Rosenbilt", value: "Shani Rosenbilt" },
  { label: "John Smith", value: "John Smith" },
  { label: "Mary Williams", value: "Mary Williams" },
  { label: "Robert Brown", value: "Robert Brown" },
];
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { cn } from "@/components/ui/utils";
import type { DocumentType } from "@/features/documents/types";
import { DOCUMENT_TYPES } from "@/features/documents/types";
import { formatDocumentTypeSelectLabel } from "@/features/documents/shared/documentTypeDisplay";

// Business Unit → Department mapping for document forms
const DOCUMENT_BU_DEPARTMENTS: Record<string, string[]> = {
  "Operation Unit": ["Production", "Warehouse", "Logistics", "Maintenance"],
  "QA Unit": ["Quality Assurance", "Regulatory Affairs"],
  "QC Unit": ["Quality Control", "Laboratory"],
  "HR Unit": ["Human Resources & Administrator", "IT Department", "Finance", "Legal"],
};

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
}) => {
  const setFormData = (data: Partial<FormData>) => {
    onFormChange({ ...formData, ...data });
  };

  // Department options based on selected Business Unit
  const departmentOptions = useMemo(() => {
    if (!formData.businessUnit) return [];
    const departments = DOCUMENT_BU_DEPARTMENTS[formData.businessUnit] || [];
    return departments.map((dept) => ({ label: dept, value: dept }));
  }, [formData.businessUnit]);

  const coAuthorDisplayNames = useMemo(() => {
    const optionLookup = new Map(CO_AUTHOR_OPTIONS.map((option) => [String(option.value), option.label]));
    return (formData.coAuthors || [])
      .map((value) => optionLookup.get(String(value)) || String(value))
      .filter(Boolean);
  }, [formData.coAuthors]);

  const visibleCoAuthors = coAuthorDisplayNames.slice(0, 2);
  const hiddenCoAuthors = coAuthorDisplayNames.slice(2);

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
            className="w-full h-9 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 cursor-default"
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
            className="w-full h-9 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 cursor-default"
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
              className="w-full h-9 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 cursor-default"
              placeholder="Auto-generated after Next Step"
            />
          </div>
          {/* Author (Select) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Author<span className="text-red-500 ml-1">*</span>
            </label>
            {lockAllEditableFields ? (
              <input
                type="text"
                readOnly
                value={formData.author}
                placeholder="—"
                className="w-full h-9 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 cursor-default"
              />
            ) : (
              <Select
                value={formData.author}
                onChange={(value) =>
                  !isObsoleted && setFormData({ author: value })
                }
                options={[
                  { label: "Shani Rosenbilt", value: "Shani Rosenbilt" },
                  { label: "John Smith", value: "John Smith" },
                  { label: "Mary Williams", value: "Mary Williams" },
                  { label: "Robert Brown", value: "Robert Brown" },
                ]}
                enableSearch={true}
                placeholder="Select author..."
                disabled={isObsoleted}
              />
            )}
          </div>

          {/* Co-Authors (MultiSelect) */}
          <div className="flex flex-col gap-1.5 font-sans">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Co-Author(s)
            </label>
            {lockAllEditableFields ? (
              <div className="flex w-full items-center justify-between rounded-lg border bg-slate-50 px-3 text-sm h-9 border-slate-200 text-slate-700 cursor-default">
                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                  {coAuthorDisplayNames.length > 0 ? (
                    <>
                      {visibleCoAuthors.map((name) => (
                        <span
                          key={name}
                          className="inline-flex min-w-0 max-w-full shrink items-center gap-1 rounded-full py-0 pl-1.5 pr-0.5 text-2xs bg-emerald-50 text-emerald-700 border border-emerald-100"
                        >
                          <span className="truncate">{name}</span>
                        </span>
                      ))}
                    </>
                  ) : (
                    <span className="text-slate-400 text-left truncate">Select Co-Authors...</span>
                  )}
                </div>
                <div className="ml-1 flex shrink-0 items-center gap-1.5">
                  {hiddenCoAuthors.length > 0 && (
                    <Popover
                      title="Selected"
                      placement="top"
                      triggerAriaLabel={`View ${hiddenCoAuthors.length} more selected items`}
                      trigger={<span className="text-2xs font-medium">+{hiddenCoAuthors.length}</span>}
                      triggerClassName="inline-flex items-center rounded-lg bg-slate-100 px-1.5 py-0.5 text-2xs font-medium whitespace-nowrap text-slate-500 hover:bg-slate-200"
                      contentClassName="min-w-[180px] max-w-[280px]"
                      content={
                        <div className="space-y-0.5">
                          {hiddenCoAuthors.map((name) => (
                            <div key={name} className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-50">
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                              <span className="truncate pr-2 text-xs font-medium text-slate-700">{name}</span>
                            </div>
                          ))}
                        </div>
                      }
                    />
                  )}
                </div>
              </div>
            ) : (
              <MultiSelect
                value={formData.coAuthors}
                onChange={(values) =>
                  !isObsoleted && setFormData({ coAuthors: values })
                }
                options={CO_AUTHOR_OPTIONS}
                enableSearch={true}
                placeholder="Select Co-Authors..."
                maxVisibleTags={2}
                disabled={isObsoleted}
              />
            )}
          </div>
        </div>

        {/* Business Unit (Select) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Business Unit<span className="text-red-500 ml-1">*</span>
          </label>
          {lockedAfterSave ? (
            <input
              type="text"
              readOnly
              value={formData.businessUnit}
              placeholder="—"
              className="w-full h-9 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 cursor-default"
            />
          ) : (
            <Select
              value={formData.businessUnit}
              onChange={(value) =>
                !isObsoleted && setFormData({ businessUnit: value, department: "" })
              }
              options={Object.keys(DOCUMENT_BU_DEPARTMENTS).map((bu) => ({
                label: bu,
                value: bu,
              }))}
              enableSearch={true}
              disabled={isObsoleted}
            />
          )}
        </div>

        {/* Department (Select) - depends on Business Unit */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Department
          </label>
          {lockedAfterSave ? (
            <input
              type="text"
              readOnly
              value={formData.department}
              placeholder="—"
              className="w-full h-9 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 cursor-default"
            />
          ) : (
            <Select
              value={formData.department}
              onChange={(value) =>
                !isObsoleted && setFormData({ department: value })
              }
              options={departmentOptions}
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
              !isObsoleted && !lockAllEditableFields && setFormData({ documentName: e.target.value })
            }
            placeholder="Enter document name"
            readOnly={isObsoleted || lockAllEditableFields}
            className={cn(
              "w-full h-9 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 read-only:focus:ring-0",
              (isObsoleted || lockAllEditableFields) && "bg-slate-50 cursor-default text-slate-500",
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
              !isObsoleted && !lockAllEditableFields && setFormData({ titleLocalLanguage: e.target.value })
            }
            placeholder="Enter title in local language..."
            readOnly={isObsoleted || lockAllEditableFields}
            className={cn(
              "w-full h-9 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 read-only:focus:ring-0",
              (isObsoleted || lockAllEditableFields) && "bg-slate-50 cursor-default text-slate-500",
            )}
          />
        </div>

        {/* Is Template */}
        {!isTemplateMode && (
          <div className="flex items-center gap-3">
            <label
              htmlFor="isTemplate"
              className={cn(
                "text-xs sm:text-sm font-medium text-slate-700",
                !isObsoleted && "cursor-pointer",
              )}
            >
              Is Template?
            </label>
            <Checkbox
              id="isTemplate"
              checked={formData.isTemplate}
              onChange={(checked) =>
                !isObsoleted && !lockAllEditableFields && !lockedAfterSave && setFormData({ isTemplate: checked })
              }
              disabled={isObsoleted || lockAllEditableFields || lockedAfterSave}
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
            value={formData.knowledgeBase}
            onChange={(e) =>
              !isObsoleted && !lockedAfterSave && setFormData({ knowledgeBase: e.target.value })
            }
            placeholder="Enter knowledge base"
            readOnly={isObsoleted || lockedAfterSave}
            className={cn(
              "w-full h-9 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 read-only:focus:ring-0",
              (isObsoleted || lockedAfterSave) && "bg-slate-50 cursor-default text-slate-500",
            )}
          />
        </div>

        {/* Document Type (Select) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Document Type<span className="text-red-500 ml-1">*</span>
          </label>
          {lockedAfterSave ? (
            <input
              type="text"
              readOnly
              value={formData.type}
              placeholder="—"
              className="w-full h-9 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 cursor-default"
            />
          ) : (
            <Select
              value={formData.type}
              onChange={(value) =>
                !isObsoleted && setFormData({ type: value as DocumentType })
              }
              options={DOCUMENT_TYPES.map((type) => ({
                label: formatDocumentTypeSelectLabel(type),
                value: type,
              }))}
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
            options={[
              { label: "-- None --", value: "" },
              { label: "Template", value: "Template" },
              { label: "Guideline", value: "Guideline" },
              { label: "Checklist", value: "Checklist" },
            ]}
            enableSearch={true}
            placeholder="Select sub-type..."
            disabled={isObsoleted}
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
              if (isObsoleted || lockAllEditableFields) return;
              const val = parseInt(e.target.value);
              if (e.target.value === "" || val > 0) {
                setFormData({
                  periodicReviewCycle: e.target.value === "" ? 0 : val,
                });
              }
            }}
            placeholder="Enter review cycle in months"
            readOnly={isObsoleted || lockAllEditableFields}
            className={cn(
              "w-full h-9 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 read-only:focus:ring-0",
              (isObsoleted || lockAllEditableFields) && "bg-slate-50 cursor-default text-slate-500",
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
              if (isObsoleted || lockAllEditableFields) return;
              const val = parseInt(e.target.value);
              if (e.target.value === "" || val > 0) {
                setFormData({
                  periodicReviewNotification: e.target.value === "" ? 0 : val,
                });
              }
            }}
            placeholder="Enter notification days before review"
            readOnly={isObsoleted || lockAllEditableFields}
            className={cn(
              "w-full h-9 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 read-only:focus:ring-0",
              (isObsoleted || lockAllEditableFields) && "bg-slate-50 cursor-default text-slate-500",
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
            className="w-full h-9 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 cursor-default"
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
            className="w-full h-9 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 cursor-default"
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
            disabled={isObsoleted}
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
              className="w-full h-9 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 cursor-default placeholder:text-slate-400"
            />
          ) : (
            <DateTimePicker
              value={formData.reviewDate || ""}
              onChange={(value) =>
                !isObsoleted && setFormData({ reviewDate: value })
              }
              placeholder="Select review date"
              disabled={isObsoleted}
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
              !isObsoleted && setFormData({ description: e.target.value })
            }
            placeholder="Enter document description"
            rows={4}
            readOnly={isObsoleted}
            className={cn(
              "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 resize-none read-only:focus:ring-0",
              isObsoleted && "bg-slate-50 cursor-default text-slate-500",
            )}
          />
        </div>
      </div>
    </div>
  );
};
