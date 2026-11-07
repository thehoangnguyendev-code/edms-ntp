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

    /**
     * The signature placeholders, one for each step (Prepared, Reviewed, Approved, Published). A signature is written in a document in one way only, the Standard frame: the name of the
     * signer, "Electronically" and the meaning, then the date and time (see {@link SignaturePlaceholderName}).
     */
    private java.util.List<PublishingPlaceholderGroupResponse> signatureGroups() {
        String[][] steps = {
                {"PREPARED", "Prepared (the Author's submission signature)"}, {"REVIEWED", "Reviewed"}, {"APPROVED", "Approved"}, {"PUBLISHED", "Published"}
        };
        String frame = "Name, then Electronically and the meaning (Electronically approved), then the date and time.";
        java.util.List<PublishingPlaceholderItemResponse> items = new java.util.ArrayList<>();
        for (String[] step : steps) {
            items.add(item("{{" + step[0] + "_SIGNATURE}}", step[1] + " signature. " + frame));
        }
        java.util.List<PublishingPlaceholderGroupResponse> groups = new java.util.ArrayList<>();
        groups.add(new PublishingPlaceholderGroupResponse("Signature", frame + " Every signature of a document is written this way, and all of them are drawn from the electronic signature record.", java.util.List.copyOf(items)));
        // several reviewers or approvers: all of them in the order of the workflow, or one by its number
        java.util.List<PublishingPlaceholderItemResponse> several = new java.util.ArrayList<>();
        several.add(item("{{REVIEWER_SIGNATURES}}", "All reviewers, one signature under another in the order of the workflow. One reviewer: the same as a single signature."));
        several.add(item("{{APPROVER_SIGNATURES}}", "All approvers, one signature under another in the order of the workflow."));
        groups.add(new PublishingPlaceholderGroupResponse("Signature - Several Reviewers or Approvers", "Use these when a document has more than one reviewer or approver. To put each person in a cell of their own, number the placeholder: {{REVIEWER_SIGNATURE_1}}, {{REVIEWER_SIGNATURE_2}}, {{APPROVER_SIGNATURE_1}} and so on. A number with no person leaves the cell empty.", java.util.List.copyOf(several)));
        return groups;
    }

    private boolean matches(PublishingPlaceholderItemResponse item, String needle) {
        String value = item.value() == null ? "" : item.value().toLowerCase(Locale.ROOT);
        String description = item.description() == null ? "" : item.description().toLowerCase(Locale.ROOT);
        return value.contains(needle) || description.contains(needle);
    }

    private PublishingPlaceholderCatalogResponse getAllPlaceholders() {
        List<PublishingPlaceholderGroupResponse> groups = new java.util.ArrayList<>(List.of(
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
                                item("{{approvedOn}}", "Timestamp when the approval step was completed.")
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
                        "Controlled Copy",
                        "Filled in by the system for each controlled copy from the copy's own record (recipient details are captured when the copy is distributed). Shown as \"-\" in a published document; use the placeholder's visibility option to show it only in controlled copies.",
                        List.of(
                                item("{{recipientName}}", "Full name of the person receiving this copy. For an external recipient this is the e-mail address."),
                                item("{{recipientEmail}}", "E-mail address of the recipient."),
                                item("{{recipientJobTitle}}", "Job title of the recipient when the copy was distributed. Empty for an external recipient."),
                                item("{{recipientDepartment}}", "Department of the recipient when the copy was distributed. Empty for an external recipient."),
                                item("{{totalCopies}}", "Total number of copies issued in the same request."),
                                item("{{copyExpiryDate}}", "Date until which this copy is valid."),
                                item("{{distributedBy}}", "Name of the person who distributed the copy."),
                                item("{{distributionDate}}", "Date the copy was distributed."),
                                item("{{requestedBy}}", "Name of the person who requested the copy."),
                                item("{{requestPurpose}}", "Reason given when the copy was requested."),
                                item("{{copyLocation}}", "Location the copy is issued to.")
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
                                item("{{reviewHistory}}", "Review history section or log. Alias: {{reviewEvaluate}}."),
                                item("{{parentDocumentLine}}", "Footer sentence of a related document (a form or appendix listed as Related by a SOP): Issue and append to the document \u201C<parent name>\u201D/ code : <parent number>. Empty when the document has no parent. Alias: {{parent_document_line}}."),
                                item("{{parentDocumentName}}", "Name of the document that lists this one as a Related Document. Empty when there is none. Alias: {{parent_document_name}}."),
                                item("{{parentDocumentNumber}}", "Document number of that parent, for example SOP.0007 (no revision number). Empty when there is none. Alias: {{parent_document_number}}.")
                        )
                )
        ));
        // the signature placeholders follow the group of the sign-off fields
        int signOff = 0;
        for (int i = 0; i < groups.size(); i++) {
            if ("Sign-off and Workflow".equals(groups.get(i).title())) signOff = i + 1;
        }
        groups.addAll(signOff, signatureGroups());
        return new PublishingPlaceholderCatalogResponse(List.copyOf(groups));
    }

    private PublishingPlaceholderItemResponse item(String value, String description) {
        return new PublishingPlaceholderItemResponse(value, description);
    }
}
