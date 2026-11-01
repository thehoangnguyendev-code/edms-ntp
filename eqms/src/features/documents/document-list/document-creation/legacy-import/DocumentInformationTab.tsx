import React from "react";
import { Check, X as XIcon, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { MultiSelect } from "@/components/ui/select/MultiSelect";
import { cn } from "@/components/ui/utils";
import { DocumentRelationships, type ParentDocument, type RelatedDocument } from "../new-tabs";
import { Field } from "./LegacyField";
import {
  FIELD_INPUT,
  FIELD_TEXTAREA,
  LANGUAGE_OPTIONS,
  type DocumentFormState,
  type DocumentTypeOption,
  type SubTypeOption,
  type UserOption,
} from "./legacyImportModel";

export interface DocumentInformationTabProps {
  form: DocumentFormState;
  setField: <K extends keyof DocumentFormState>(key: K, value: DocumentFormState[K]) => void;
  showValidation: boolean;
  documentTypeOptions: DocumentTypeOption[];
  searchDocumentTypeOptions: (query: string) => Promise<SelectOption[]>;
  loadingLookups: boolean;
  subTypeOptionsForSelectedDocumentType: SubTypeOption[];
  documentNumberPrefix: string;
  documentNumber: string;
  documentNumberSuffixExample: string;
  serialNumberDigits: number;
  isDocumentNumberSuffixFormatValid: (value: string) => boolean;
  numberStatus: { checking: boolean; available: boolean | null };
  isDuplicateNumber: boolean;
  businessUnitOptions: SelectOption[];
  searchBusinessUnitOptions: (query: string) => Promise<SelectOption[]>;
  filteredDepartmentOptions: SelectOption[];
  userOptions: UserOption[];
  loadingUsers: boolean;
  searchUsers: (query: string) => Promise<SelectOption[]>;
  relatedDocuments: RelatedDocument[];
  onRelatedDocumentsChange: (documents: RelatedDocument[]) => void;
  correlatedDocuments: ParentDocument[];
  onCorrelatedDocumentsChange: (documents: ParentDocument[]) => void;
  documentTypeName: string;
}

/** Tab "Document Information" of the Legacy Import form: the document as it is on paper, and who reviews and approves it from now on. */
export const DocumentInformationTab: React.FC<DocumentInformationTabProps> = ({
  form,
  setField,
  showValidation,
  documentTypeOptions,
  searchDocumentTypeOptions,
  loadingLookups,
  subTypeOptionsForSelectedDocumentType,
  documentNumberPrefix,
  documentNumber,
  documentNumberSuffixExample,
  serialNumberDigits,
  isDocumentNumberSuffixFormatValid,
  numberStatus,
  isDuplicateNumber,
  businessUnitOptions,
  searchBusinessUnitOptions,
  filteredDepartmentOptions,
  userOptions,
  loadingUsers,
  searchUsers,
  relatedDocuments,
  onRelatedDocumentsChange,
  correlatedDocuments,
  onCorrelatedDocumentsChange,
  documentTypeName,
}) => (
  <div className="space-y-4 md:space-y-5">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
      <Field label="Document Type" required>
        <Select
          value={form.documentType}
          onChange={(v) => {
            setField("documentType", String(v));
            setField("documentSubType", "");
          }}
          options={documentTypeOptions}
          onSearch={searchDocumentTypeOptions}
          isLoading={loadingLookups}
          placeholder="Select document type..."
        />
        {showValidation && !form.documentType && (
          <p className="text-xs text-red-600 mt-1">
            Document Type is required.
          </p>
        )}
      </Field>
      <Field
        label="Sub-Type"
      >
        <Select
          value={form.documentSubType}
          onChange={(v) => setField("documentSubType", String(v))}
          options={subTypeOptionsForSelectedDocumentType}
          placeholder={
            form.documentType
              ? "Select sub-type (optional)..."
              : "Select Document Type first"
          }
          disabled={!form.documentType}
        />
      </Field>
      <Field
        label="Document Number"
        hint={
          documentNumberPrefix
            ? `Digits of the Serial Number is set to ${serialNumberDigits} (Settings > Document Properties).`
            : undefined
        }
      >
        {(() => {
          const suffixHasValue =
            form.documentNumberSuffix.trim().length > 0;
          const isFormatInvalid =
            suffixHasValue &&
            !isDocumentNumberSuffixFormatValid(form.documentNumberSuffix);
          return (
            <>
              <div className="flex items-center gap-2">
                {documentNumberPrefix && (
                  <span className="shrink-0 h-9 px-3 inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 text-sm font-medium text-slate-600">
                    {documentNumberPrefix}
                  </span>
                )}
                <div className="relative flex-1">
                  <input
                    className={cn(
                      FIELD_INPUT,
                      "pr-8",
                      (isDuplicateNumber || isFormatInvalid) &&
                        "border-red-400 focus:ring-red-400 focus:border-red-400",
                    )}
                    value={form.documentNumberSuffix}
                    onChange={(e) =>
                      setField("documentNumberSuffix", e.target.value)
                    }
                    placeholder={
                      documentNumberPrefix
                        ? documentNumberSuffixExample
                        : "Select a Document Type first"
                    }
                    disabled={!form.documentType}
                    aria-invalid={isDuplicateNumber || isFormatInvalid}
                  />
                  {documentNumberPrefix &&
                    suffixHasValue &&
                    !isFormatInvalid && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                        {numberStatus.checking ? (
                          <Loader2
                            className="h-4 w-4 animate-spin text-slate-400"
                            aria-label="Checking availability"
                          />
                        ) : numberStatus.available === true ? (
                          <Check
                            className="h-4 w-4 text-emerald-600"
                            aria-label="Available"
                          />
                        ) : numberStatus.available === false ? (
                          <XIcon
                            className="h-4 w-4 text-red-500"
                            aria-label="Already in use"
                          />
                        ) : null}
                      </span>
                    )}
                </div>
              </div>
              {showValidation && !suffixHasValue && (
                <p className="text-xs text-red-600 mt-1">
                  Document Number is required.
                </p>
              )}
              {isFormatInvalid && (
                <p className="text-xs text-red-600 mt-1">
                  Must be exactly {serialNumberDigits} digit(s), e.g. "
                  {documentNumberPrefix}
                  {documentNumberSuffixExample}".
                </p>
              )}
              {!isFormatInvalid &&
                suffixHasValue &&
                !numberStatus.checking &&
                numberStatus.available === false && (
                  <p className="text-xs text-red-600 mt-1">
                    "{documentNumber}" is already in use by another
                    document.
                  </p>
                )}
              {!isFormatInvalid &&
                suffixHasValue &&
                !numberStatus.checking &&
                numberStatus.available === true && (
                  <p className="text-xs text-emerald-600 mt-1">
                    "{documentNumber}" is available.
                  </p>
                )}
            </>
          );
        })()}
      </Field>
      <Field label="Document Name" required>
        <input
          className={FIELD_INPUT}
          value={form.documentName}
          onChange={(e) => setField("documentName", e.target.value)}
          placeholder="Document name as on the existing document"
        />
        {showValidation && !form.documentName.trim() && (
          <p className="text-xs text-red-600 mt-1">
            Document Name is required.
          </p>
        )}
      </Field>
      <div className="flex items-center gap-3">
        <label
          htmlFor="legacyIsTemplate"
          className="text-xs sm:text-sm font-medium text-slate-700"
        >
          Is Template?
        </label>
        <Checkbox
          id="legacyIsTemplate"
          checked={form.isTemplate}
          onChange={(checked) => setField("isTemplate", checked)}
        />
      </div>
      <Field label="Title in Local Language">
        <input
          className={FIELD_INPUT}
          value={form.titleLocalLanguage}
          onChange={(e) => setField("titleLocalLanguage", e.target.value)}
          placeholder="Optional"
        />
      </Field>
      <Field label="Business Unit" required>
        <Select
          value={form.businessUnit}
          onChange={(v) => {
            setField("businessUnit", String(v));
            setField("department", "");
          }}
          options={businessUnitOptions}
          onSearch={searchBusinessUnitOptions}
          isLoading={loadingLookups}
          placeholder="Select business unit..."
        />
        {showValidation && !form.businessUnit && (
          <p className="text-xs text-red-600 mt-1">
            Business Unit is required.
          </p>
        )}
      </Field>
      <Field label="Department" required>
        <Select
          value={form.department}
          onChange={(v) => setField("department", String(v))}
          options={filteredDepartmentOptions}
          isLoading={loadingLookups}
          placeholder={
            form.businessUnit
              ? "Select department..."
              : "Select Business Unit first"
          }
          disabled={!form.businessUnit}
        />
        {showValidation && !form.department && (
          <p className="text-xs text-red-600 mt-1">
            Department is required.
          </p>
        )}
      </Field>
      <Field
        label="Reviewer(s)"
        required
        hint="Who reviews this document going forward, starting with its NEXT revision (via Upgrade Revision) -- not the historical paper reviewer recorded per revision below."
      >
        <MultiSelect
          value={form.reviewerIds}
          onChange={(values) => setField("reviewerIds", values.map(String))}
          options={userOptions}
          isLoading={loadingUsers}
          onSearch={searchUsers}
          placeholder="Select reviewer(s)..."
        />
        {showValidation && form.reviewerIds.length === 0 && (
          <p className="text-xs text-red-600 mt-1">Reviewer(s) is required.</p>
        )}
      </Field>
      <Field
        label="Approver"
        required
        hint="Who approves this document going forward, starting with its NEXT revision -- not the historical paper approver recorded per revision below."
      >
        <Select
          value={form.approverId}
          onChange={(v) => setField("approverId", String(v))}
          options={userOptions}
          isLoading={loadingUsers}
          onSearch={searchUsers}
          placeholder="Select approver..."
        />
        {showValidation && !form.approverId && (
          <p className="text-xs text-red-600 mt-1">Approver is required.</p>
        )}
      </Field>
      <Field label="Periodic Review Cycle (Months)" required>
        <input
          type="number"
          min="1"
          className={FIELD_INPUT}
          value={form.periodicReviewCycle}
          onKeyDown={(e) => {
            if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault();
          }}
          onChange={(e) => setField("periodicReviewCycle", e.target.value)}
          placeholder="Enter review cycle in months"
        />
        {showValidation && !form.periodicReviewCycle.trim() && (
          <p className="text-xs text-red-600 mt-1">Periodic Review Cycle is required.</p>
        )}
      </Field>
      <Field label="Periodic Review Notification (Days)" required>
        <input
          type="number"
          min="1"
          className={FIELD_INPUT}
          value={form.periodicReviewNotification}
          onKeyDown={(e) => {
            if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault();
          }}
          onChange={(e) => setField("periodicReviewNotification", e.target.value)}
          placeholder="Enter notification days before review"
        />
        {showValidation && !form.periodicReviewNotification.trim() && (
          <p className="text-xs text-red-600 mt-1">Periodic Review Notification is required.</p>
        )}
      </Field>
      <div className="md:col-span-2">
        <Field label="Language">
          <Select
            value={form.language}
            onChange={(v) => setField("language", String(v))}
            options={LANGUAGE_OPTIONS}
            enableSearch={false}
          />
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field
          label="Migration Justification"
          required
        >
          <textarea
            rows={3}
            className={FIELD_TEXTAREA}
            value={form.legacyJustification}
            onChange={(e) =>
              setField("legacyJustification", e.target.value)
            }
            placeholder="Migrated from Document Control paper archive, box #12"
          />
          {showValidation && !form.legacyJustification.trim() && (
            <p className="text-xs text-red-600 mt-1">
              Migration Justification is required.
            </p>
          )}
        </Field>
      </div>
    </div>

    <DocumentRelationships
      currentDocumentId={null}
      relatedDocuments={relatedDocuments}
      onRelatedDocumentsChange={onRelatedDocumentsChange}
      correlatedDocuments={correlatedDocuments}
      onCorrelatedDocumentsChange={onCorrelatedDocumentsChange}
      documentType={documentTypeName}
    />
  </div>
);
