import { useMemo } from "react";
import { validateTrainingTab, type TrainingConfig } from "../new-tabs/TrainingTab";
import {
  CONFIRM_THRESHOLD,
  LEGACY_TRAINING_NUMBER,
  getSectionDateErrors,
  parseDateTimePickerValue,
  type DocumentFormState,
  type FormTabId,
  type RevisionSection,
} from "./legacyImportModel";

interface Input {
  form: DocumentFormState;
  sections: RevisionSection[];
  trainingConfig: TrainingConfig;
  isDuplicateNumber: boolean;
  numberStatus: { checking: boolean };
  serialNumberDigits: number;
  bulkConfirmed: boolean;
  isTwoPartRevisionSeed: boolean;
  isRevisionNumberFormatValid: (value: string) => boolean;
  isDocumentNumberSuffixFormatValid: (value: string) => boolean;
}

/** What is still missing before the import can be signed, in the order the person meets it, and the tab it is on. */
export function useLegacyImportValidation({
  form,
  sections,
  trainingConfig,
  isDuplicateNumber,
  numberStatus,
  serialNumberDigits,
  bulkConfirmed,
  isTwoPartRevisionSeed,
  isRevisionNumberFormatValid,
  isDocumentNumberSuffixFormatValid,
}: Input) {
  // Revision numbers must be strictly increasing across sections, matching the backend's own
  // validation -- checked live so a manual edit that breaks the order is caught before Submit.
  const sectionOrderError = useMemo(() => {
    for (let i = 1; i < sections.length; i++) {
      const prevValue = sections[i - 1].revisionNumber.trim();
      const curValue = sections[i].revisionNumber.trim();
      if (
        !isRevisionNumberFormatValid(prevValue) ||
        !isRevisionNumberFormatValid(curValue)
      )
        continue;
      const prevMajor = parseFloat(prevValue);
      const curMajor = parseFloat(curValue);
      if (curMajor <= prevMajor) {
        return `Revision numbers must be strictly increasing (section ${i + 1}: "${curValue}" must be greater than "${prevValue}").`;
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  const effectiveDateOrderError = useMemo(() => {
    for (let i = 1; i < sections.length; i++) {
      const prevTime = parseDateTimePickerValue(sections[i - 1].effectiveDate);
      const curTime = parseDateTimePickerValue(sections[i].effectiveDate);
      if (prevTime === null || curTime === null) continue;
      if (curTime <= prevTime) {
        return `Effective Date must be strictly increasing across revisions (section ${i + 1} must be after section ${i}).`;
      }
    }
    return null;
  }, [sections]);

  const missingField = useMemo((): {
    message: string;
    tab: FormTabId;
  } | null => {
    if (!form.documentType) return { message: "Document Type", tab: "document" };
    if (!form.documentNumberSuffix.trim())
      return { message: "Document Number", tab: "document" };
    if (!isDocumentNumberSuffixFormatValid(form.documentNumberSuffix)) {
      return {
        message: `Document Number (must be exactly ${serialNumberDigits} digit(s))`,
        tab: "document",
      };
    }
    if (isDuplicateNumber)
      return { message: "Document Number (already in use)", tab: "document" };
    if (numberStatus.checking)
      return {
        message: "Document Number (still checking availability)",
        tab: "document",
      };
    if (!form.documentName.trim())
      return { message: "Document Name", tab: "document" };
    if (!form.businessUnit)
      return { message: "Business Unit", tab: "document" };
    if (!form.department) return { message: "Department", tab: "document" };
    if (!form.legacyJustification.trim())
      return { message: "Migration Justification", tab: "document" };
    if (form.reviewerIds.length === 0)
      return { message: "Reviewer(s)", tab: "document" };
    if (!form.approverId)
      return { message: "Approver", tab: "document" };
    if (!form.periodicReviewCycle.trim())
      return { message: "Periodic Review Cycle", tab: "document" };
    if (!form.periodicReviewNotification.trim())
      return { message: "Periodic Review Notification", tab: "document" };
    if (!form.isTemplate) {
      const trainingValidation = validateTrainingTab(trainingConfig);
      if (!trainingValidation.isValid) {
        return {
          message: trainingConfig.isRequired
            ? "Training Period (Days)"
            : "Reason for skipping training",
          tab: "training",
        };
      }
    }
    if (sections.length === 0)
      return {
        message:
          "At least one revision section (enter the Revision Number and click Generate)",
        tab: "revisions",
      };
    if (sections.length > CONFIRM_THRESHOLD && !bulkConfirmed) {
      return {
        message: `Confirm creating ${sections.length} revisions (checkbox below the revision list)`,
        tab: "revisions",
      };
    }
    if (sectionOrderError) return { message: sectionOrderError, tab: "revisions" };
    if (effectiveDateOrderError)
      return { message: effectiveDateOrderError, tab: "revisions" };
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const isLast = i === sections.length - 1;
      if (
        !section.revisionNumber.trim() ||
        !isRevisionNumberFormatValid(section.revisionNumber)
      ) {
        return {
          message: `Revision Number for section ${i + 1} (must be in ${isTwoPartRevisionSeed ? "X.Y" : "X.Y.Z"} format)`,
          tab: "revisions",
        };
      }
      if (!section.authorId)
        return {
          message: `Author for revision ${section.revisionNumber}`,
          tab: "revisions",
        };
      if (!section.legacyHistoricalAuthoredDate)
        return {
          message: `Authored Date for revision ${section.revisionNumber}`,
          tab: "revisions",
        };
      if (section.legacyHistoricalReviewerIds.length === 0)
        return {
          message: `Historical Reviewer(s) for revision ${section.revisionNumber}`,
          tab: "revisions",
        };
      if (!section.legacyHistoricalReviewDate)
        return {
          message: `Historical Review Date for revision ${section.revisionNumber}`,
          tab: "revisions",
        };
      if (!section.legacyHistoricalApproverId)
        return {
          message: `Historical Approver for revision ${section.revisionNumber}`,
          tab: "revisions",
        };
      if (!section.legacyHistoricalApprovalDate)
        return {
          message: `Historical Approval Date for revision ${section.revisionNumber}`,
          tab: "revisions",
        };
      if (!section.effectiveDate)
        return {
          message: `Effective Date for revision ${section.revisionNumber}`,
          tab: "revisions",
        };
      {
        const dateErrors = getSectionDateErrors(section);
        if (dateErrors.authored)
          return { message: `Authored Date for revision ${section.revisionNumber} (${dateErrors.authored})`, tab: "revisions" };
        if (dateErrors.review)
          return { message: `Historical Review Date for revision ${section.revisionNumber} (${dateErrors.review})`, tab: "revisions" };
        if (dateErrors.approval)
          return { message: `Historical Approval Date for revision ${section.revisionNumber} (${dateErrors.approval})`, tab: "revisions" };
        if (dateErrors.effective)
          return { message: `Effective Date for revision ${section.revisionNumber} (${dateErrors.effective})`, tab: "revisions" };
      }
      if (form.isTemplate && !section.file) {
        return {
          message: `DOCX file for revision ${section.revisionNumber} -- required for every revision of a template`,
          tab: "revisions",
        };
      }
      if (!section.file && !section.noFileJustification.trim()) {
        return {
          message: `Source file or a "no file" justification for revision ${section.revisionNumber}`,
          tab: "revisions",
        };
      }
      if (section.fileError)
        return {
          message: `Source file for revision ${section.revisionNumber} (exceeds max size)`,
          tab: "revisions",
        };
      if (isLast && !section.file)
        return {
          message: `Source file for the most recent revision (${section.revisionNumber}) -- required`,
          tab: "revisions",
        };
      if (trainingConfig.isRequired && section.trainingNumber.trim() && !LEGACY_TRAINING_NUMBER.test(section.trainingNumber.trim())) {
        return {
          message: `Training Number for revision ${section.revisionNumber} (letters, digits, / . _ - only, up to 40 characters)`,
          tab: "revisions",
        };
      }
      if (trainingConfig.isRequired && !section.trainingCompletionDate) {
        return {
          message: `Historical Training Completion Date for revision ${section.revisionNumber}`,
          tab: "revisions",
        };
      }
      if (trainingConfig.isRequired) {
        const trainingError = getSectionDateErrors(section).training;
        if (trainingError) {
          return {
            message: `Historical Training Completion Date for revision ${section.revisionNumber} (${trainingError})`,
            tab: "revisions",
          };
        }
      }
      if (trainingConfig.isRequired && !form.isTemplate) {
        if (section.trainingNumberProblem)
          return { message: `Training Number for revision ${section.revisionNumber} (${section.trainingNumberProblem})`, tab: "revisions" };
        if (!section.trainingNumberJoins) {
          const evidence = section.training;
          if (evidence.notEvidenced && !evidence.noEvidenceReason.trim())
            return { message: `Why there is no paper training evidence for revision ${section.revisionNumber}`, tab: "revisions" };
          if (!evidence.notEvidenced && !evidence.scan)
            return { message: `Scan of the paper training record (APD.0108 or APD.0117) for revision ${section.revisionNumber}, or declare that it is lost`, tab: "revisions" };
          if (!evidence.notEvidenced && section.trainingNumber.trim()) {
            if (!evidence.topic.trim()) return { message: `Training Topic of the paper training of revision ${section.revisionNumber}`, tab: "revisions" };
            if (!evidence.trainer.trim()) return { message: `Trainer of the paper training of revision ${section.revisionNumber}`, tab: "revisions" };
            if (!evidence.method) return { message: `Mode of the paper training of revision ${section.revisionNumber}`, tab: "revisions" };
          }
        }
      }
    }
    return null;
  }, [
    form,
    sections,
    trainingConfig,
    isDuplicateNumber,
    numberStatus.checking,
    serialNumberDigits,
    bulkConfirmed,
    sectionOrderError,
    effectiveDateOrderError,
    isTwoPartRevisionSeed,
  ]);

  return { missingField, sectionOrderError, effectiveDateOrderError };
}
