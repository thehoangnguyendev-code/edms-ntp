import React from "react";
import { Select } from '@/components/ui/select/Select';
import { MultiSelect } from '@/components/ui/select/MultiSelect';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { Popover } from "@/components/ui/popover/Popover";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";

interface DocumentDetail {
  documentNumber: string;
  documentName: string;
  type: string;
  created: string;
  openedBy: string;
  author: string;
  authorId?: string | null;
  coAuthorNames?: string[];
  coAuthors?: Array<{
    id: string;
    fullName?: string;
    username?: string;
  }>;
  isTemplate: boolean;
  businessUnit: string;
  department: string;
  knowledgeBase: string;
  subType: string;
  periodicReviewCycle: number | null;
  periodicReviewNotification: number | null;
  effectiveDate: string;
  validUntil: string;
  reviewDate: string;
  language: string;
  description: string;
}

interface WorkflowUserSelectOption {
  label: string;
  value: string;
}

interface GeneralInformationTabProps {
  document: DocumentDetail;
  isReadOnly?: boolean;
  canEditReviewDate?: boolean;
  reviewDateInputValue?: string;
  onDocumentChange?: (document: DocumentDetail) => void;
  /** Gates Author/Co-Author(s)/Periodic Review Cycle/Periodic Review Notification/Description --
   *  separate from canEditReviewDate for clarity, though both currently map to the same
   *  documents.document.edit_metadata backend permission. */
  canEditMetadata?: boolean;
  onAuthorChange?: (authorId: string) => void;
  onCoAuthorsChange?: (coAuthorIds: string[]) => void;
  authorOptions?: WorkflowUserSelectOption[];
  coAuthorOptions?: WorkflowUserSelectOption[];
  onSearchWorkflowUsers?: (query: string) => Promise<WorkflowUserSelectOption[]>;
}

export const GeneralInformationTab: React.FC<GeneralInformationTabProps> = ({
  document,
  isReadOnly = false,
  canEditReviewDate = false,
  reviewDateInputValue,
  onDocumentChange,
  canEditMetadata = false,
  onAuthorChange,
  onCoAuthorsChange,
  authorOptions = [],
  coAuthorOptions = [],
  onSearchWorkflowUsers,
}) => {
  const coAuthorIds = (document.coAuthors ?? []).map((coAuthor) => coAuthor.id);
  const coAuthorNames = (document.coAuthorNames?.length
    ? document.coAuthorNames
    : (document.coAuthors ?? []).map((coAuthor) => coAuthor.fullName || coAuthor.username || "").filter(Boolean)
  );
  const visibleCoAuthors = coAuthorNames.slice(0, 2);
  const hiddenCoAuthors = coAuthorNames.slice(2);
  const canEditFields = !isReadOnly && canEditMetadata;

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {/* Document Number (read-only, auto-generated) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Document Number</label>
          <input
            type="text"
            value={document.documentNumber}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
            placeholder="Auto-generated after save"
          />
        </div>

        {/* Created (read-only, auto-generated) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Created Time</label>
          <input
            type="text"
            value={document.created}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
            placeholder="Auto-generated after save"
          />
        </div>

        {/* Opened by / Author / Co-Authors - 2 / 1 / 1 ratio */}
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
          {/* Opened by (read-only, auto-generated) */}
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-xs sm:text-sm font-medium text-slate-700">Opened by</label>
            <input
              type="text"
              value={document.openedBy}
              readOnly
              className={CONTROL_STATE_CLASSES.readonlyField}
              placeholder="Auto-generated after save"
            />
          </div>

          {/* Author */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">Author<span className="text-red-500 ml-1">*</span></label>
            {canEditFields ? (
              <Select
                value={document.authorId || ""}
                onChange={(value) => onAuthorChange?.(String(value))}
                options={authorOptions}
                enableSearch={true}
                onSearch={onSearchWorkflowUsers}
                placeholder="Select author..."
              />
            ) : (
              <input
                type="text"
                value={document.author}
                readOnly
                className={CONTROL_STATE_CLASSES.readonlyField}
              />
            )}
          </div>

          {/* Co-Authors */}
          <div className="flex flex-col gap-1.5 font-sans">
            <label className="text-xs sm:text-sm font-medium text-slate-700">Co-Author(s)</label>
            {canEditFields ? (
              <MultiSelect
                value={coAuthorIds}
                onChange={(values) => onCoAuthorsChange?.(values.map(String))}
                options={coAuthorOptions}
                enableSearch={true}
                onSearch={onSearchWorkflowUsers}
                placeholder="Select Co-Authors..."
                maxVisibleTags={2}
              />
            ) : (
              <div className={CONTROL_STATE_CLASSES.readonlyContainer}>
                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                  {coAuthorNames.length > 0 ? (
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
            )}
          </div>
        </div>

        {/* Business Unit */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Business Unit<span className="text-red-500 ml-1">*</span></label>
          <input
            type="text"
            value={document.businessUnit}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
        </div>

        {/* Department */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Department</label>
          <input
            type="text"
            value={document.department}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
        </div>

        {/* Document Name - Full width */}
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Document Name<span className="text-red-500 ml-1">*</span></label>
          <input
            type="text"
            value={document.documentName}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
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
            value={(document as any).titleLocalLanguage || ""}
            readOnly
            placeholder="—"
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
        </div>

        {/* Is Template */}
        <div className="flex items-center gap-3">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Is Template?</label>
          <Checkbox id="isTemplate" checked={document.isTemplate} disabled={true} />
        </div>

        {/* Knowledge Base */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Knowledge Base</label>
          <input
            type="text"
            value={document.knowledgeBase}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
        </div>

        {/* Document Type */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Document Type<span className="text-red-500 ml-1">*</span></label>
          <input
            type="text"
            value={document.type}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
        </div>

        {/* Sub-Type */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Sub-Type</label>
          <input
            type="text"
            value={document.subType || "-"}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
        </div>

        {/* Periodic Review Cycle */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Periodic Review Cycle (Months)<span className="text-red-500 ml-1">*</span></label>
          <input
            type="number"
            min={1}
            value={document.periodicReviewCycle ?? ""}
            readOnly={!canEditFields}
            onChange={(e) => {
              if (!canEditFields) return;
              const raw = e.target.value;
              onDocumentChange?.({
                ...document,
                periodicReviewCycle: raw === "" ? null : Number(raw),
              });
            }}
            className={
              canEditFields
                ? "w-full h-9 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                : CONTROL_STATE_CLASSES.readonlyField
            }
          />
        </div>

        {/* Periodic Review Notification */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Periodic Review Notification (Days)<span className="text-red-500 ml-1">*</span></label>
          <input
            type="number"
            min={1}
            value={document.periodicReviewNotification ?? ""}
            readOnly={!canEditFields}
            onChange={(e) => {
              if (!canEditFields) return;
              const raw = e.target.value;
              onDocumentChange?.({
                ...document,
                periodicReviewNotification: raw === "" ? null : Number(raw),
              });
            }}
            className={
              canEditFields
                ? "w-full h-9 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                : CONTROL_STATE_CLASSES.readonlyField
            }
          />
        </div>

        {/* Effective Date (read-only, auto-generated) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Effective Date</label>
          <input
            type="text"
            value={document.effectiveDate}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
            placeholder="Set when approved"
          />
        </div>

        {/* Valid Until (read-only, auto-generated) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Valid Until</label>
          <input
            type="text"
            value={document.validUntil}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
            placeholder="Set when approved"
          />
        </div>

        {/* Review Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Review Date</label>
          <DateTimePicker
            value={reviewDateInputValue ?? document.reviewDate}
            onChange={(value) => onDocumentChange?.({ ...document, reviewDate: value })}
            showTime={false}
            disabled={isReadOnly || !canEditReviewDate}
            placeholder="Select review date"
          />
          <p className="text-xs text-slate-500">
            Enter manually when preparing an upgraded revision. The system does not calculate this date automatically.
          </p>
        </div>

        {/* Language */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Language</label>
          <input
            type="text"
            value={document.language}
            readOnly
            className={CONTROL_STATE_CLASSES.readonlyField}
          />
        </div>

        {/* Description - Full width */}
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Description <span className="text-red-500">*</span></label>
          <textarea
            value={document.description}
            rows={4}
            readOnly={!canEditFields}
            onChange={(e) =>
              canEditFields && onDocumentChange?.({ ...document, description: e.target.value })
            }
            className={canEditFields ? "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500" : CONTROL_STATE_CLASSES.readonlyTextarea}
          />
        </div>
      </div>
    </div>
  );
};

const PopoverField = ({ label, value }: { label: string; value: string }) => (
  <div className="grid grid-cols-[110px_1fr] items-center gap-3">
    <label className="text-xs text-slate-500 text-right truncate" title={label}>{label}</label>
    <input
      type="text"
      value={value}
      readOnly
      className={CONTROL_STATE_CLASSES.readonlyFieldCompact}
    />
  </div>
);
