package com.eqms.service;

import com.eqms.dto.publishing.PublishingPlaceholderCatalogResponse;
import com.eqms.dto.publishing.PublishingPlaceholderGroupResponse;
import com.eqms.dto.publishing.PublishingPlaceholderItemResponse;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;

@Service
public class PublishingPlaceholderCatalogService {

    public PublishingPlaceholderCatalogResponse getAvailablePlaceholders(String search) {
        PublishingPlaceholderCatalogResponse full = getAllPlaceholders();
        if (!StringUtils.hasText(search)) {
            return full;
        }
        String needle = search.trim().toLowerCase(Locale.ROOT);
        List<PublishingPlaceholderGroupResponse> filteredGroups = full.groups().stream()
                .map(group -> {
                    List<PublishingPlaceholderItemResponse> matchingItems = group.items().stream()
                            .filter(item -> matches(item, needle))
                            .toList();
                    return matchingItems.isEmpty()
                            ? null
                            : new PublishingPlaceholderGroupResponse(group.title(), group.description(), matchingItems);
                })
                .filter(group -> group != null)
                .toList();
        return new PublishingPlaceholderCatalogResponse(filteredGroups);
    }

    private boolean matches(PublishingPlaceholderItemResponse item, String needle) {
        String value = item.value() == null ? "" : item.value().toLowerCase(Locale.ROOT);
        String description = item.description() == null ? "" : item.description().toLowerCase(Locale.ROOT);
        return value.contains(needle) || description.contains(needle);
    }

    private PublishingPlaceholderCatalogResponse getAllPlaceholders() {
        return new PublishingPlaceholderCatalogResponse(List.of(
                new PublishingPlaceholderGroupResponse(
                        "Cover and Identity",
                        "Primary cover page fields for title blocks and code areas.",
                        List.of(
                                item("{{documentType}}", "Document type selected when creating the document. Aliases: {{doctype}}, {{document_type}}, {{type}}."),
                                item("{{documentNumber}}", "Document number of the parent document. Alias: {{document_number}}."),
                                item("{{documentName}}", "Document name entered on the document record."),
                                item("{{revisionNumber}}", "Current revision number in decimal format. Alias: {{revision_number}}."),
                                item("{{revisionName}}", "Revision display name from the revision record. Alias: {{revision_name}}."),
                                item("{{code}}", "Combined document code, usually document number plus major revision."),
                                item("{{page}}", "Current page label such as 1/1 or 1/12. Aliases: {{pageCount}}, {{page_count}}, {{pageLabel}}."),
                                item("{{effectiveDate}}", "Date when the revision becomes effective. Alias: {{effective_date}}."),
                                item("{{validUntil}}", "Expiry date or valid-until date of the revision. Alias: {{valid_until}}."),
                                item("{{reviewDate}}", "Scheduled review date of the revision. Alias: {{review_date}}."),
                                item("{{status}}", "Current workflow status of the revision or document. Alias: {{state}}.")
                        )
                ),
                new PublishingPlaceholderGroupResponse(
                        "Sign-off and Workflow",
                        "Use these in the status table and signature blocks.",
                        List.of(
                                item("{{authorName}}", "Full name of the author. Aliases (same field, do not add both): {{author}}, {{preparedBy}}."),
                                item("{{authorUsername}}", "Login username of the author. Alias: {{preparedByUsername}}."),
                                item("{{authorPosition}}", "Job title or position of the author. Alias: {{preparedByPosition}}."),
                                item("{{checkedByName}}", "Full name of the first reviewer. Aliases (same field): {{checkedBy}}, {{reviewedBy}}."),
                                item("{{checkedByUsername}}", "Login username of the first reviewer. Alias: {{reviewedByUsername}}."),
                                item("{{checkedByPosition}}", "Job title or position of the first reviewer. Alias: {{reviewedByPosition}}."),
                                item("{{approvedByName}}", "Full name of the first approver. Alias: {{approvedBy}}."),
                                item("{{approvedByUsername}}", "Login username of the first approver."),
                                item("{{approvedByPosition}}", "Job title or position of the first approver."),
                                item("{{submittedByUsername}}", "Login username of the user who submitted the revision for review."),
                                item("{{submittedOn}}", "Timestamp when the revision was submitted for review."),
                                item("{{reviewedOn}}", "Timestamp when the review step was completed."),
                                item("{{approvedOn}}", "Timestamp when the approval step was completed."),
                                item("{{PREPARED_SIGNATURE}}", "Electronic signature block for the Author/Co-Author complete editing step. Aliases (same block, do not add both): {{authorSignature}}, {{authorBlock}}."),
                                item("{{DCO_SIGNATURE}}", "Electronic signature block for the submit-for-review step. Aliases: {{submittedSignature}}, {{submittedBySignature}}, {{submittedForReviewSignature}}."),
                                item("{{REVIEWED_SIGNATURE}}", "Electronic signature block for the reviewer stage. Use with single reviewer flows."),
                                item("{{REVIEWER_SIGNATURES}}", "All reviewer signature blocks in sequence order."),
                                item("{{REVIEWER_SIGNATURE_1}}", "First reviewer signature block in sequence order. Repeat the same pattern for 3, 4, and so on."),
                                item("{{REVIEWER_SIGNATURE_2}}", "Second reviewer signature block in sequence order. Repeat the same pattern for 3, 4, and so on."),
                                item("{{APPROVED_SIGNATURE}}", "Electronic signature block for the approver stage. Use with single approver flows."),
                                item("{{APPROVER_SIGNATURES}}", "All approver signature blocks in sequence order."),
                                item("{{APPROVER_SIGNATURE_1}}", "First approver signature block in sequence order. Repeat the same pattern for 3, 4, and so on."),
                                item("{{APPROVER_SIGNATURE_2}}", "Second approver signature block in sequence order. Repeat the same pattern for 3, 4, and so on."),
                                item("{{PUBLISHED_SIGNATURE}}", "Electronic signature block for the published step."),
                                item("{{OBSOLETED_SIGNATURE}}", "Electronic signature block for the obsoleted step."),
                                item("{{CANCELLED_SIGNATURE}}", "Electronic signature block for the cancelled step.")
                        )
                ),
                new PublishingPlaceholderGroupResponse(
                        "Document Details",
                        "Supporting metadata and participant lists.",
                        List.of(
                                item("{{openedBy}}", "User or department who opened or created the document."),
                                item("{{openedByUsername}}", "Login username of the user who opened or created the document."),
                                item("{{businessUnit}}", "Business unit associated with the document."),
                                item("{{department}}", "Department associated with the document."),
                                item("{{description}}", "Document description or summary."),
                                item("{{language}}", "Language of the document."),
                                item("{{titleLocalLanguage}}", "Document title in local language."),
                                item("{{coAuthors}}", "List of co-authors assigned to the revision."),
                                item("{{reviewers}}", "Ordered reviewer list for the workflow."),
                                item("{{approvers}}", "Ordered approver list for the workflow."),
                                item("{{requiresTraining}}", "Whether training is required before publishing."),
                                item("{{trainingPlannedDate}}", "Scheduled training date."),
                                item("{{trainingPeriodEndDate}}", "Training period end date."),
                                item("{{trainingCompletionDate}}", "Training completion date.")
                        )
                ),
                new PublishingPlaceholderGroupResponse(
                        "Footer and Cover Notes",
                        "Useful for the footer row and the review summary section.",
                        List.of(
                                item("{{copyNo}}", "Controlled copy number. Alias: {{copy_no}}."),
                                item("{{issuedBy}}", "Person or department issuing the document."),
                                item("{{date}}", "Generic date field for footer use."),
                                item("{{distributionList}}", "Distribution list assigned to the controlled copy."),
                                item("{{reviewHistory}}", "Review history section or log. Alias: {{reviewEvaluate}}.")
                        )
                )
        ));
    }

    private PublishingPlaceholderItemResponse item(String value, String description) {
        return new PublishingPlaceholderItemResponse(value, description);
    }
}
