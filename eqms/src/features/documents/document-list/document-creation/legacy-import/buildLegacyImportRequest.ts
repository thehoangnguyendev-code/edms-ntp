import type {
  documentApi,
  LegacyBatchRevisionSectionPayload,
} from "@/services/api/documents";

import type { TrainingConfig } from "../new-tabs/TrainingTab";
import type { ParentDocument, RelatedDocument } from "../new-tabs";
import type {
  DocumentFormState,
  RevisionSection,
  UserOption,
} from "./legacyImportModel";

/** The body of the document of the request, as the API client takes it. */
type DocumentDraftCreateRequest = Parameters<
  typeof documentApi.createLegacyImportDocumentAndRevisions
>[0];

interface Input {
  form: DocumentFormState;
  sections: RevisionSection[];
  trainingConfig: TrainingConfig;
  documentNumber: string;
  userOptions: UserOption[];
  relatedDocuments: RelatedDocument[];
  correlatedDocuments: ParentDocument[];
}

/** The document and the revision sections as the server takes them (one request, one transaction). */
export function buildLegacyImportRequest({
  form,
  sections,
  trainingConfig,
  documentNumber,
  userOptions,
  relatedDocuments,
  correlatedDocuments,
}: Input): {
  document: DocumentDraftCreateRequest;
  sections: LegacyBatchRevisionSectionPayload[];
} {
  return {
    document: {
      documentName: form.documentName.trim(),
      titleLocalLanguage: form.titleLocalLanguage.trim() || undefined,
      documentType: form.documentType,
      subType: form.documentSubType || undefined,
      author: sections[sections.length - 1]?.authorId || "",
      businessUnit: form.businessUnit,
      department: form.department,
      language: form.language,
      description: form.legacyJustification.trim(),
      relatedDocumentIds: relatedDocuments.map((d) => d.id),
      correlatedDocumentIds: correlatedDocuments.map((d) => d.id),
      reviewerUserIds: form.reviewerIds,
      approverUserIds: form.approverId ? [form.approverId] : [],
      periodicReviewCycle: form.periodicReviewCycle
        ? Number.parseInt(form.periodicReviewCycle, 10)
        : undefined,
      periodicReviewNotification: form.periodicReviewNotification
        ? Number.parseInt(form.periodicReviewNotification, 10)
        : undefined,
      legacyDocumentNumber: documentNumber,
      legacyOriginalEffectiveDate: sections[0]?.effectiveDate || undefined,
      legacyJustification: form.legacyJustification.trim(),
      isTemplate: form.isTemplate,
      requiresTraining: form.isTemplate ? false : trainingConfig.isRequired,
      trainingPeriodDays:
        !form.isTemplate && trainingConfig.isRequired
          ? (trainingConfig.trainingPeriodDays ?? undefined)
          : undefined,
      reasonForSkippingTraining:
        form.isTemplate || trainingConfig.isRequired
          ? undefined
          : trainingConfig.reasonForSkippingTraining.trim() || undefined,
    },
    sections: sections.map((section) => ({
      revisionNumber: section.revisionNumber.trim(),
      authorId: section.authorId || undefined,
      legacyHistoricalAuthoredDate:
        section.legacyHistoricalAuthoredDate || undefined,
      legacyHistoricalReviewers:
        section.legacyHistoricalReviewerIds
          .map((id) => userOptions.find((u) => u.value === id)?.label)
          .filter((label): label is string => Boolean(label))
          .join(", ") || undefined,
      legacyHistoricalApprover:
        userOptions.find((u) => u.value === section.legacyHistoricalApproverId)
          ?.label || undefined,
      legacyHistoricalReviewDate:
        section.legacyHistoricalReviewDate || undefined,
      legacyHistoricalApprovalDate:
        section.legacyHistoricalApprovalDate || undefined,
      changeDescription: section.changeDescription.trim() || undefined,
      effectiveDate: section.effectiveDate,
      trainingCompletionDate: section.trainingCompletionDate || undefined,
      trainingNumber: section.trainingNumber.trim() || undefined,
      file: section.file,
      noFileJustification: section.noFileJustification.trim() || undefined,
      legacyHistoricalReviewerIds: section.legacyHistoricalReviewerIds,
      legacyHistoricalApproverId:
        section.legacyHistoricalApproverId || undefined,
      ...(trainingConfig.isRequired &&
      !form.isTemplate &&
      !section.trainingNumberJoins
        ? {
            traineeIds: section.training.notEvidenced
              ? []
              : section.training.trainees.map((p) => p.personId),
                  trainingScan: section.training.notEvidenced
              ? null
              : section.training.scan,
            trainingTopic: section.training.notEvidenced ? undefined : section.training.topic.trim() || undefined,
      trainingTrainer: section.training.notEvidenced ? undefined : section.training.trainer.trim() || undefined,
      trainingMethod: section.training.notEvidenced ? undefined : section.training.method || undefined,
      trainingNotEvidenced: section.training.notEvidenced,
            trainingNoEvidenceReason:
              section.training.noEvidenceReason.trim() || undefined,
          }
        : {}),
    })),
  };
}
