import React, { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { legacyImport as legacyImportBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from "@/components/ui/button/Button";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { useToast } from "@/components/ui/toast";
import { ROUTES } from "@/app/routes.constants";
import { documentApi } from "@/services/api/documents";
import { REVISION_WORKFLOW_STEPS, DOCUMENT_WORKFLOW_STEPS } from "@/features/documents/shared/statusMapping";
import type { ParentDocument, RelatedDocument } from "./new-tabs";
import { TrainingTab, validateTrainingTab, type TrainingConfig } from "./new-tabs/TrainingTab";
import { LegacyImportTabNavigation } from "./legacy-import-tabs/LegacyImportTabNavigation";
import { DocumentInformationTab } from "./legacy-import/DocumentInformationTab";
import { RevisionHistoryTab } from "./legacy-import/RevisionHistoryTab";
import { LegacyImportProgressModal } from "./legacy-import/LegacyImportProgressModal";
import { buildLegacyImportRequest } from "./legacy-import/buildLegacyImportRequest";
import { useLegacyDocumentNumber } from "./legacy-import/useLegacyDocumentNumber";
import { useLegacyImportLookups } from "./legacy-import/useLegacyImportLookups";
import { useLegacyImportValidation } from "./legacy-import/useLegacyImportValidation";
import { useRevisionSections } from "./legacy-import/useRevisionSections";
import { EMPTY_DOCUMENT_FORM, SKIPPED_STEPS, errorMessage, type DocumentFormState, type FormTabId } from "./legacy-import/legacyImportModel";

// The model and the date rules live in legacy-import/legacyImportModel.ts; they stay importable from here.
export { emptySection, getSectionDateErrors, parseDateTimePickerValue, type RevisionSection } from "./legacy-import/legacyImportModel";

/**
 * Legacy Import: brings a document that already exists outside the system (e.g. a paper original)
 * straight in, publishing it directly as Effective without an electronic Review/Approval step. A
 * document may have had just one revision on paper, or several (e.g. 1.0 through 4.0) before being
 * digitized -- both cases are the SAME flow here: enter the most recent Revision Number and this
 * generates one section per historical revision (1 section when there was only ever one). Every
 * section but the last publishes straight to Obsoleted (superseded); only the last reaches
 * Effective. One electronic signature authorizes the whole import.
 *
 * This file keeps the state of the form and the signing; the tabs, the revision card, the lookups, the number check, the validation and
 * the request are in ./legacy-import/.
 */
export const LegacyImportView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const shouldReduceMotion = useReducedMotion();
  const collapseTransition = useMemo(
    () => (shouldReduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 90, damping: 16 }),
    [shouldReduceMotion],
  );

  const [form, setForm] = useState<DocumentFormState>(EMPTY_DOCUMENT_FORM);
  const setField = <K extends keyof DocumentFormState>(key: K, value: DocumentFormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const lookups = useLegacyImportLookups(form);
  const numbering = useLegacyDocumentNumber(form, lookups.documentTypeOptions, lookups.serialNumberDigits);
  const revisions = useRevisionSections(lookups.revisionNumberSeed);
  const { sections, setSections } = revisions;

  const [relatedDocuments, setRelatedDocuments] = useState<RelatedDocument[]>([]);
  const [correlatedDocuments, setCorrelatedDocuments] = useState<ParentDocument[]>([]);

  // Document-level, same field the normal New Document flow collects -- governs whether the LMS
  // must track training completions for this document going forward. Independent of whether
  // training already happened offline on paper before this document was brought into the system
  // (that historical fact, if you want it recorded, belongs in a section's "Change Description" or
  // the Migration Justification -- this checkbox is about future/ongoing training tracking).
  const [trainingConfig, setTrainingConfig] = useState<TrainingConfig>({
    isRequired: false,
    trainingPeriodDays: null,
    reasonForSkippingTraining: "",
  });

  const [showSignature, setShowSignature] = useState(false);
  // Only surface inline field-level errors after the first failed attempt to sign -- otherwise
  // every required field would show red before the user has even started filling the form.
  const [showValidation, setShowValidation] = useState(false);
  const [activeTab, setActiveTab] = useState<FormTabId>("document");
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<string>("");

  // A template is Word-only with no training obligation: keep the client state aligned with the
  // server rules (RevisionService#createLegacyImportRevisionsBatch) the moment it is switched on.
  useEffect(() => {
    if (!form.isTemplate) return;
    setTrainingConfig((current) =>
      current.isRequired || current.trainingPeriodDays || current.reasonForSkippingTraining
        ? { isRequired: false, trainingPeriodDays: null, reasonForSkippingTraining: "" }
        : current,
    );
    setActiveTab((tab) => (tab === "training" ? "document" : tab));
    setSections((current) =>
      current.some((section) => section.file && !section.file.name.toLowerCase().endsWith(".docx"))
        ? current.map((section) =>
            section.file && !section.file.name.toLowerCase().endsWith(".docx")
              ? { ...section, file: null, fileError: "A controlled document template accepts only a DOCX (Word) file." }
              : section,
          )
        : current,
    );
  }, [form.isTemplate, setSections]);

  const { missingField } = useLegacyImportValidation({
    form,
    sections,
    trainingConfig,
    isDuplicateNumber: numbering.isDuplicateNumber,
    numberStatus: numbering.numberStatus,
    serialNumberDigits: lookups.serialNumberDigits,
    bulkConfirmed: revisions.bulkConfirmed,
    isTwoPartRevisionSeed: revisions.isTwoPartRevisionSeed,
    isRevisionNumberFormatValid: revisions.isRevisionNumberFormatValid,
    isDocumentNumberSuffixFormatValid: numbering.isDocumentNumberSuffixFormatValid,
  });

  const openSignature = () => {
    if (missingField) {
      setShowValidation(true);
      setActiveTab(missingField.tab);
      showToast({
        type: "error",
        title: "Missing information",
        // Most entries are bare noun phrases ("Document Type") that read naturally with " is
        // required." appended; the date chronology messages above are already complete sentences
        // (e.g. "... (Must be on or after the Authored Date.)"), so skip the suffix for those.
        message: /must be|cannot be/i.test(missingField.message) ? missingField.message : `${missingField.message} is required.`,
      });
      return;
    }
    setShowSignature(true);
  };

  const runImport = async (signatureToken: string) => {
    setSubmitting(true);
    try {
      setSubmitStage(sections.length > 1 ? `Importing ${sections.length} historical revision(s)...` : "Importing the revision...");
      // Document creation and the revision batch are sent as ONE request (one backend
      // transaction): if the batch half fails, the document half rolls back too, instead of
      // leaving an orphaned Draft that permanently holds this document number and blocks every
      // retry with "Document number already in use".
      const request = buildLegacyImportRequest({
        form,
        sections,
        trainingConfig,
        documentNumber: numbering.documentNumber,
        userOptions: lookups.userOptions,
        relatedDocuments,
        correlatedDocuments,
      });
      const result = await documentApi.createLegacyImportDocumentAndRevisions(request.document, request.sections, form.legacyJustification.trim(), signatureToken);

      const publishedNumber = result.revisions[result.revisions.length - 1]?.documentNumber || numbering.documentNumber;
      showToast({
        type: "success",
        title: "Imported",
        message: `${publishedNumber} is now Effective${sections.length > 1 ? ` with ${sections.length} historical revision(s)` : ""}.`,
      });
      navigate(ROUTES.DOCUMENTS.ALL);
    } catch (error) {
      // The whole import is one all-or-nothing backend transaction (see the comment on
      // LegacyImportProgressModal): a failure here always means NOTHING was created -- never a
      // document left short some revisions -- so it's safe to just report the cause and let the
      // user fix it and resubmit from this same, still-filled-in form.
      showToast({
        type: "error",
        title: "Import failed -- nothing was created",
        message: errorMessage(error, "Unable to complete the Legacy Import. No document or revisions were saved; fix the issue below and try again."),
      });
      setSubmitting(false);
      setSubmitStage("");
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
      <LegacyImportProgressModal isOpen={submitting} sectionCount={sections.length} stage={submitStage} />
      <PageHeader
        title="Legacy Import"
        breadcrumbItems={legacyImportBreadcrumb(navigate)}
        actions={
          <>
            <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => navigate(ROUTES.DOCUMENTS.ALL)} disabled={submitting}>
              Cancel
            </Button>
            <Button size="sm" variant="default" className="whitespace-nowrap" onClick={openSignature} disabled={submitting}>
              Publish Document
            </Button>
          </>
        }
      />

      {activeTab === "document" && <WorkflowStepper steps={DOCUMENT_WORKFLOW_STEPS} currentStepIndex={0} />}
      {activeTab === "revisions" && (
        <div>
          <WorkflowStepper steps={REVISION_WORKFLOW_STEPS} currentStepIndex={0} skippedSteps={SKIPPED_STEPS} />
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <LegacyImportTabNavigation activeTab={activeTab} isTemplate={form.isTemplate} revisionCount={sections.length} onChange={setActiveTab} />

        <div className="p-4 md:p-5">
          {activeTab === "document" && (
            <DocumentInformationTab
              form={form}
              setField={setField}
              showValidation={showValidation}
              documentTypeOptions={lookups.documentTypeOptions}
              searchDocumentTypeOptions={lookups.searchDocumentTypeOptions}
              loadingLookups={lookups.loadingLookups}
              subTypeOptionsForSelectedDocumentType={lookups.subTypeOptionsForSelectedDocumentType}
              documentNumberPrefix={numbering.documentNumberPrefix}
              documentNumber={numbering.documentNumber}
              documentNumberSuffixExample={numbering.documentNumberSuffixExample}
              serialNumberDigits={lookups.serialNumberDigits}
              isDocumentNumberSuffixFormatValid={numbering.isDocumentNumberSuffixFormatValid}
              numberStatus={numbering.numberStatus}
              isDuplicateNumber={numbering.isDuplicateNumber}
              businessUnitOptions={lookups.businessUnitOptions}
              searchBusinessUnitOptions={lookups.searchBusinessUnitOptions}
              filteredDepartmentOptions={lookups.filteredDepartmentOptions}
              userOptions={lookups.userOptions}
              loadingUsers={lookups.loadingUsers}
              searchUsers={lookups.searchUsers}
              relatedDocuments={relatedDocuments}
              onRelatedDocumentsChange={setRelatedDocuments}
              correlatedDocuments={correlatedDocuments}
              onCorrelatedDocumentsChange={setCorrelatedDocuments}
              documentTypeName={lookups.documentTypeName}
            />
          )}

          {activeTab === "training" && (
            <div className="space-y-4 md:space-y-5">
              <p className="text-xs sm:text-sm text-slate-500">
                Whether employees must complete training for this document going forward, tracked by the Training module -- independent of any training already done
                offline on paper before this document was brought into the system.
              </p>
              <TrainingTab data={trainingConfig} onChange={setTrainingConfig} validationError={showValidation ? validateTrainingTab(trainingConfig).errors : undefined} showParticipants={false} />
              {trainingConfig.isRequired && (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:text-sm">
                  The persons who were trained on paper are chosen in the tab Revision History, in the section of each revision (they need the Training Number of the paper record). A document imported
                  from paper has no training that opens, so there is no list of people to propose here.
                </p>
              )}
            </div>
          )}

          {activeTab === "revisions" && (
            <RevisionHistoryTab
              sections={sections}
              form={form}
              trainingRequired={trainingConfig.isRequired}
              showValidation={showValidation}
              collapseTransition={collapseTransition}
              updateSection={revisions.updateSection}
              toggleCollapsed={revisions.toggleCollapsed}
              applyFirstSectionRolesToRest={revisions.applyFirstSectionRolesToRest}
              userOptions={lookups.userOptions}
              loadingUsers={lookups.loadingUsers}
              searchUsers={lookups.searchUsers}
              maxFileSizeMB={lookups.maxFileSizeMB}
              isRevisionNumberFormatValid={revisions.isRevisionNumberFormatValid}
              targetRevisionNumber={revisions.targetRevisionNumber}
              setTargetRevisionNumber={revisions.setTargetRevisionNumber}
              revisionNumberExample={revisions.revisionNumberExample}
              isTwoPartRevisionSeed={revisions.isTwoPartRevisionSeed}
              generateSections={revisions.generateSections}
              bulkConfirmed={revisions.bulkConfirmed}
              setBulkConfirmed={revisions.setBulkConfirmed}
            />
          )}
        </div>
      </div>

      <ESignatureModal
        isOpen={showSignature}
        onClose={() => setShowSignature(false)}
        onConfirm={async (data: { signatureToken: string }) => {
          setShowSignature(false);
          await runImport(data.signatureToken);
        }}
        deferConfirm
        actionTitle="Confirm Legacy Import"
        meaningCode="LEGACY_DOCUMENT_IMPORT"
        meaningDisplayName="Legacy Document Import"
        targetDetails={{
          code: numbering.documentNumber,
          title: form.documentName,
          revision: sections[sections.length - 1]?.revisionNumber,
        }}
        changes={[
          {
            action: "Import and publish",
            oldValue: "Not in system",
            newValue: `Effective${sections.length > 1 ? ` (${sections.length} revision(s))` : ""}`,
            category: "status",
          },
        ]}
      />
    </div>
  );
};
