import React, { useMemo } from "react";
import { Select } from "@/components/ui/select/Select";
import { MultiSelect } from "@/components/ui/select/MultiSelect";
import { Popover } from "@/components/ui/popover/Popover";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";

const DOCUMENT_BU_DEPARTMENTS: Record<string, string[]> = {
  "Operation Unit": ["Production", "Warehouse", "Logistics", "Maintenance"],
  "QA Unit": ["Quality Assurance", "Regulatory Affairs"],
  "QC Unit": ["Quality Control", "Laboratory"],
  "HR Unit": [
    "Human Resources & Administrator",
    "IT Department",
    "Finance",
    "Legal",
  ],
};

const AUTHOR_OPTIONS = [
  { label: "Shani Rosenbilt", value: "Shani Rosenbilt" },
  { label: "John Smith", value: "John Smith" },
  { label: "Mary Williams", value: "Mary Williams" },
  { label: "Robert Brown", value: "Robert Brown" },
];

export interface GeneralInformationDocumentDetail {
  documentNumber: string;
  documentName: string;
  revisionNumber?: string;
  revisionName?: string;
  created: string;
  openedBy: string;
  author: string;
  coAuthors: (string | number)[];
  coAuthor?: string[];
  coAuthorDisplayNames?: string[];
  isTemplate: boolean;
  businessUnit: string;
  department: string;
  knowledgeBase: string;
  periodicReviewCycle: number;
  periodicReviewNotification: number;
  language: string;
  description: string;
  titleLocalLanguage?: string;
  type?: any;
  subType?: string;
}

interface GeneralInformationTabProps {
  document: GeneralInformationDocumentDetail;
  isReadOnly?: boolean;
  onFormChange?: (formData: GeneralInformationDocumentDetail) => void;
}

export const GeneralInformationTab: React.FC<GeneralInformationTabProps> = ({
  document,
  isReadOnly = false,
  onFormChange,
}) => {
  const revisionDisplayName =
    String(document.revisionName ?? '').trim() ||
    [String(document.documentName ?? '').trim(), String(document.revisionNumber ?? '').trim()]
      .filter(Boolean)
      .join('_') ||
    '—';

  const handleChange = (
    field: keyof GeneralInformationDocumentDetail,
    value: any,
  ) => {
    if (isReadOnly) return;
    const updatedDocument = { ...document, [field]: value };
    onFormChange?.(updatedDocument);
  };

  const handleChanges = (patch: Partial<GeneralInformationDocumentDetail>) => {
    if (isReadOnly) return;
    onFormChange?.({ ...document, ...patch });
  };

  const departmentOptions = useMemo(() => {
    if (!document.businessUnit) return [];
    const departments = DOCUMENT_BU_DEPARTMENTS[document.businessUnit] || [];
    return departments.map((dept) => ({ label: dept, value: dept }));
  }, [document.businessUnit]);

  const readonlyInputClassName = CONTROL_STATE_CLASSES.readonlyField;
  const readonlyTextareaClassName = CONTROL_STATE_CLASSES.readonlyTextarea;

  const coAuthorDisplayNames = Array.isArray(document.coAuthor)
    ? document.coAuthor.filter(Boolean)
    : Array.isArray(document.coAuthorDisplayNames)
      ? document.coAuthorDisplayNames.filter(Boolean)
    : [];
  const visibleCoAuthors = coAuthorDisplayNames.slice(0, 2);
  const hiddenCoAuthors = coAuthorDisplayNames.slice(2);

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Revision Number
          </label>
          <input
            type="text"
            value={document.revisionNumber || document.documentNumber || "-"}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
            placeholder="Auto-generated after save"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Created Time
          </label>
          <input
            type="text"
            value={document.created || "-"}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
            placeholder="Auto-generated after save"
          />
        </div>

        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Opened by
            </label>
            <input
              type="text"
              value={document.openedBy || "-"}
              readOnly
              className={CONTROL_STATE_CLASSES.readonlyField}
              placeholder="Auto-generated after save"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Author<span className="text-red-500 ml-1">*</span>
            </label>
            {isReadOnly ? (
              <input
                type="text"
                value={document.author || "-"}
                readOnly
                className={readonlyInputClassName}
                placeholder=""
              />
            ) : (
              <Select
                value={document.author}
                onChange={(value) => handleChange("author", value)}
                options={AUTHOR_OPTIONS}
                enableSearch={true}
                placeholder="Select author..."
                disabled={isReadOnly}
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Co-Author(s)
            </label>
            {isReadOnly ? (
              <div className={CONTROL_STATE_CLASSES.readonlyContainer}>
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
                value={document.coAuthors}
                onChange={(values) => handleChange("coAuthors", values)}
                options={AUTHOR_OPTIONS}
                enableSearch={true}
                placeholder="Select Co-Authors..."
                maxVisibleTags={2}
                disabled={isReadOnly}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Business Unit<span className="text-red-500 ml-1">*</span>
          </label>
          {isReadOnly ? (
            <input
              type="text"
              value={document.businessUnit}
              readOnly
              className={readonlyInputClassName}
              placeholder=""
            />
          ) : (
            <Select
              value={document.businessUnit}
              onChange={(value) => handleChanges({ businessUnit: value, department: "" })}
              options={Object.keys(DOCUMENT_BU_DEPARTMENTS).map((bu) => ({
                label: bu,
                value: bu,
              }))}
              enableSearch={true}
              disabled={isReadOnly}
            />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Department
          </label>
          {isReadOnly ? (
            <input
              type="text"
              value={document.department}
              readOnly
              className={readonlyInputClassName}
              placeholder=""
            />
          ) : (
            <Select
              value={document.department}
              onChange={(value) => handleChange("department", value)}
              options={departmentOptions}
              enableSearch={true}
              placeholder={document.businessUnit ? "Select department..." : "Select Business Unit first"}
              disabled={isReadOnly || !document.businessUnit}
            />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Sub-Type
          </label>
          {isReadOnly ? (
            <input
              type="text"
              value={document.subType || "-"}
              readOnly
              className={readonlyInputClassName}
              placeholder=""
            />
          ) : (
            <Select
              value={document.subType || ""}
              onChange={(value) => handleChange("subType", value)}
              options={[
                { label: "Guideline", value: "Guideline" },
                { label: "Manual", value: "Manual" },
                { label: "Procedure", value: "Procedure" },
                { label: "Work Instruction", value: "Work Instruction" },
                { label: "Form", value: "Form" },
                { label: "Specification", value: "Specification" },
                { label: "Site Master File", value: "Site Master File" },
                { label: "Addendum / Annex / Appendix", value: "Addendum / Annex / Appendix" },
                { label: "User Requirement Specification", value: "User Requirement Specification" },
                { label: "Design Qualification Protocol and Report", value: "Design Qualification Protocol and Report" },
                { label: "Factory Acceptance / Site Acceptance Protocol and Report", value: "Factory Acceptance / Site Acceptance Protocol and Report" },
                { label: "Installation Qualification Protocol and Report", value: "Installation Qualification Protocol and Report" },
                { label: "Operational Qualification Protocol and Report", value: "Operational Qualification Protocol and Report" },
                { label: "Performance Qualification Protocol and Report", value: "Performance Qualification Protocol and Report" },
                { label: "Process Validation Protocol and Report", value: "Process Validation Protocol and Report" },
                { label: "Cleaning Validation Protocol and Report", value: "Cleaning Validation Protocol and Report" },
                { label: "Record", value: "Record" },
                { label: "Contamination Control Strategy", value: "Contamination Control Strategy" },
                { label: "Risk Management", value: "Risk Management" },
              ]}
              enableSearch={true}
              placeholder="Select sub-type..."
              disabled={isReadOnly}
            />
          )}
        </div>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Revision Name<span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={revisionDisplayName}
            onChange={(e) => handleChange("revisionName", e.target.value)}
            readOnly={isReadOnly}
            className={
              isReadOnly
                ? readonlyInputClassName
                : "w-full h-9 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            }
          />
        </div>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Title in Local Language
            <span className="text-slate-400 text-xs font-normal ml-1.5">
              (optional)
            </span>
          </label>
          <input
            type="text"
            value={document.titleLocalLanguage ?? ""}
            onChange={(e) => handleChange("titleLocalLanguage", e.target.value)}
            readOnly={isReadOnly}
            placeholder=""
            className={
              isReadOnly
                ? readonlyInputClassName
                : "w-full h-9 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            }
          />
        </div>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Note <span className="text-red-500">*</span>
          </label>
          <textarea
            value={document.description}
            onChange={(e) => handleChange("description", e.target.value)}
            readOnly={isReadOnly}
            placeholder="Enter note for this revision..."
            rows={4}
            className={
              isReadOnly
                ? readonlyTextareaClassName
                : "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            }
          />
        </div>
      </div>
    </div>
  );
};
