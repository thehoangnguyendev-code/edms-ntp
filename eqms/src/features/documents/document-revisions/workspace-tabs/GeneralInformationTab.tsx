import React from "react";
import { Popover } from "@/components/ui/popover/Popover";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { formatDocumentTypeSelectLabel } from "@/features/documents/shared/documentTypeDisplay";
import { formatDate } from "@/utils/format";

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
  /** Set when the revision is published (Effective); empty before that. */
  effectiveDate?: string | null;
  validUntil?: string | null;
}

/** Dates arrive as ISO strings; unset or unparsable values show as empty rather than "Invalid Date". */
const formatOptionalDate = (value?: string | null) => {
  if (!value) return "";
  const formatted = formatDate(value);
  return formatted === "Invalid Date" ? String(value) : formatted;
};

interface GeneralInformationTabProps {
  document: GeneralInformationDocumentDetail;
  isReadOnly?: boolean;
  onFormChange?: (formData: GeneralInformationDocumentDetail) => void;
  /** Legacy Import reference-only info -- present only for a revision created via Legacy Import.
   *  Never a real electronic signature; see the Reviewers/Approvers tabs for the historical
   *  Reviewer/Approver annotations, and Signatures for the actual e-signature that authorized
   *  the import. */
  legacyImportInfo?: {
    legacyJustification?: string | null;
    historicalAuthoredDate?: string | null;
  } | null;
}

export const GeneralInformationTab: React.FC<GeneralInformationTabProps> = ({
  document,
  isReadOnly = false,
  onFormChange,
  legacyImportInfo,
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

  const readonlyInputClassName = CONTROL_STATE_CLASSES.readonlyField;
  const readonlyTextareaClassName = CONTROL_STATE_CLASSES.readonlyTextarea;

  const coAuthorDisplayNames = Array.isArray(document.coAuthor)
    ? document.coAuthor.filter(Boolean)
    : Array.isArray(document.coAuthorDisplayNames)
      ? document.coAuthorDisplayNames.filter(Boolean)
      // Review/Approval views pass co-author names in `coAuthors` (already mapped to fullName);
      // without this fallback the read-only field showed "Select Co-Authors..." even when the
      // revision had co-authors.
      : Array.isArray(document.coAuthors)
        ? document.coAuthors.filter((v): v is string => typeof v === "string" && v.trim() !== "" && !/^[0-9a-f-]{36}$/i.test(v))
        : [];
  const visibleCoAuthors = coAuthorDisplayNames.slice(0, 2);
  const hiddenCoAuthors = coAuthorDisplayNames.slice(2);

  return (
    <div className="space-y-4 md:space-y-5">
      {legacyImportInfo && (
        <>
          <WarningBanner
            variant="warning"
            title="Legacy Import"
            description="This revision was brought into the system from an existing (e.g. paper-based) original -- the fields below are reference-only, recorded from the paper record, not electronic signatures. See the Reviewers/Approvers tabs for the historical names, and Signatures for the actual e-signature that authorized this import."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-medium text-slate-700">Historical Authored Date</label>
              <input type="text" value={legacyImportInfo.historicalAuthoredDate || "-"} readOnly className={CONTROL_STATE_CLASSES.readonlyField} />
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-1">
              <label className="text-xs sm:text-sm font-medium text-slate-700">Migration Justification</label>
              <input type="text" value={legacyImportInfo.legacyJustification || "-"} readOnly className={CONTROL_STATE_CLASSES.readonlyField} />
            </div>
          </div>
        </>
      )}
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
            <input
              type="text"
              value={document.author || "-"}
              readOnly
              className={readonlyInputClassName}
              placeholder=""
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Co-Author(s)
            </label>
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
                  <span className="text-slate-400 text-left truncate">—</span>
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
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Business Unit<span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={document.businessUnit}
            readOnly
            className={readonlyInputClassName}
            placeholder=""
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Department
          </label>
          <input
            type="text"
            value={document.department}
            readOnly
            className={readonlyInputClassName}
            placeholder=""
          />
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

        {/* The document type is fixed for the document, so it is always shown as read-only text. */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Document Type<span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={document.type ? formatDocumentTypeSelectLabel(document.type) : "-"}
            readOnly
            className={readonlyInputClassName}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            Sub-Type
          </label>
          <input
            type="text"
            value={document.subType || "-"}
            readOnly
            className={readonlyInputClassName}
            placeholder=""
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Effective Date</label>
          <input
            type="text"
            value={formatOptionalDate(document.effectiveDate)}
            readOnly
            className={readonlyInputClassName}
            placeholder="Set when approved"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Valid Until</label>
          <input
            type="text"
            value={formatOptionalDate(document.validUntil)}
            readOnly
            className={readonlyInputClassName}
            placeholder="Set when approved"
          />
        </div>

        {/* Everyone can see whether the document is a template; it is set on the document, not on the revision. */}
        {/* <div className="flex items-center gap-3 md:col-span-2">
          <label className="text-xs sm:text-sm font-medium text-slate-700">Is Template?</label>
          <Checkbox id="revisionIsTemplate" checked={Boolean(document.isTemplate)} disabled />
        </div> */}

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
