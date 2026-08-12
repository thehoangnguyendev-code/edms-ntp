package com.eqms.service;

import com.eqms.dto.document.RevisionDetailResponse;
import com.eqms.dto.document.DocumentParticipantResponse;
import com.eqms.dto.publishing.PublishingTemplatePlaceholderMappingResponse;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class PublishingTemplatePlaceholderMapperService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.ROOT);

    public List<PublishingTemplatePlaceholderMappingResponse> mapPlaceholders(List<String> placeholders, RevisionDetailResponse revision) {
        if (placeholders == null || placeholders.isEmpty()) {
            return List.of();
        }
        Map<String, PublishingTemplatePlaceholderMappingResponse> mapped = new LinkedHashMap<>();
        for (String placeholder : placeholders) {
            PublishingPlaceholderSyntax.PlaceholderToken token = PublishingPlaceholderSyntax.parse(placeholder);
            if (token == null) {
                continue;
            }
            mapped.put(token.key(), buildMapping(token, revision));
        }
        return mapped.values().stream().toList();
    }

    private PublishingTemplatePlaceholderMappingResponse buildMapping(PublishingPlaceholderSyntax.PlaceholderToken token, RevisionDetailResponse revision) {
        String placeholder = token.key();
        String normalized = token.name().toLowerCase(Locale.ROOT);
        String transform = token.transform();
        String collapsed = normalized.replaceAll("[_\\-\\s]+", "");
        if (collapsed.startsWith("reviewersignature") && collapsed.length() > "reviewersignature".length() && Character.isDigit(collapsed.charAt("reviewersignature".length()))) {
            Integer index = extractTrailingIndex(collapsed, "reviewersignature");
            if (index != null) {
                return mapping(placeholder, "reviewerSignature" + index, "Reviewer Signature " + index, applyTransform(signatureBlockSample(revision == null ? null : revision.reviewers(), index, "Reviewed", "Reviewer"), transform), "Electronic signature block");
            }
        }
        if (collapsed.startsWith("approversignature") && collapsed.length() > "approversignature".length() && Character.isDigit(collapsed.charAt("approversignature".length()))) {
            Integer index = extractTrailingIndex(collapsed, "approversignature");
            if (index != null) {
                return mapping(placeholder, "approverSignature" + index, "Approver Signature " + index, applyTransform(signatureBlockSample(revision == null ? null : revision.approvers(), index, "Approved", "Approver"), transform), "Electronic signature block");
            }
        }
        return switch (normalized) {
            case "doctype", "documenttype", "document_type", "type" -> mapping(placeholder, "documentType", "Document Type", applyTransform(valueOrDash(revision == null ? null : revision.type()), transform), "Cover / metadata");
            case "documentnumber", "document_number" -> mapping(placeholder, "documentNumber", "Document Number", applyTransform(valueOrDash(revision == null ? null : revision.documentNumber()), transform), "Revision metadata");
            case "documentname", "document_name" -> mapping(placeholder, "documentName", "Document Name", applyTransform(valueOrDash(revision == null ? null : revision.documentName()), transform), "Revision metadata");
            case "revisionnumber", "revision_number" -> mapping(placeholder, "revisionNumber", "Revision Number", applyTransform(valueOrDash(revision == null ? null : revision.revisionNumber()), transform), "Revision metadata");
            case "revisionname", "revision_name" -> mapping(placeholder, "revisionName", "Revision Name", applyTransform(valueOrDash(revision == null ? null : revision.revisionName()), transform), "Revision metadata");
            case "effectivedate", "effective_date" -> mapping(placeholder, "effectiveDate", "Effective Date", applyTransform(dateValue(revision == null ? null : revision.effectiveDate()), transform), "Revision metadata");
            case "reviewdate", "review_date" -> mapping(placeholder, "reviewDate", "Review Date", applyTransform(valueOrDash(revision == null ? null : revision.reviewDate()), transform), "Revision metadata");
            case "validuntil", "valid_until" -> mapping(placeholder, "validUntil", "Valid Until", applyTransform(valueOrDash(revision == null ? null : revision.validUntil()), transform), "Revision metadata");
            case "author", "authorname", "preparedby", "prepared_by" -> mapping(placeholder, "author", "Author", applyTransform(valueOrDash(revision == null ? null : revision.author()), transform), "Revision participants");
            case "authorusername", "author_username", "preparedbyusername", "prepared_by_username" -> mapping(placeholder, "authorUsername", "Author Username", applyTransform(valueOrDash(revision == null ? null : revision.authorUsername()), transform), "Revision participants");
            case "authorposition", "author_position", "preparedbyposition", "prepared_by_position" -> mapping(placeholder, "authorPosition", "Author Position", applyTransform(valueOrDash(revision == null ? null : revision.authorPosition()), transform), "Revision participants");
            case "checkedby", "checkedbyname", "checked_by", "reviewedby", "reviewed_by" -> mapping(placeholder, "reviewers", "Checked By", applyTransform(firstParticipantName(revision == null ? null : revision.reviewers()), transform), "Revision participants");
            case "checkedbyusername", "checked_by_username", "reviewedbyusername", "reviewed_by_username" -> mapping(placeholder, "reviewers", "Checked By Username", applyTransform(firstParticipantUsername(revision == null ? null : revision.reviewers()), transform), "Revision participants");
            case "checkedbyposition", "checked_by_position", "reviewedbyposition", "reviewed_by_position" -> mapping(placeholder, "reviewers", "Checked By Position", applyTransform(firstParticipantPosition(revision == null ? null : revision.reviewers()), transform), "Revision participants");
            case "approvedby", "approvedbyname", "approved_by" -> mapping(placeholder, "approvers", "Approved By", applyTransform(firstParticipantName(revision == null ? null : revision.approvers()), transform), "Revision participants");
            case "approvedbyusername", "approved_by_username" -> mapping(placeholder, "approvers", "Approved By Username", applyTransform(firstParticipantUsername(revision == null ? null : revision.approvers()), transform), "Revision participants");
            case "approvedbyposition", "approved_by_position" -> mapping(placeholder, "approvers", "Approved By Position", applyTransform(firstParticipantPosition(revision == null ? null : revision.approvers()), transform), "Revision participants");
            case "openedby", "opened_by" -> mapping(placeholder, "openedBy", "Opened By", applyTransform(valueOrDash(revision == null ? null : revision.openedBy()), transform), "Revision metadata");
            case "openedbyusername", "opened_by_username" -> mapping(placeholder, "openedByUsername", "Opened By Username", applyTransform(valueOrDash(revision == null ? null : revision.openedByUsername()), transform), "Revision metadata");
            case "submittedbyusername", "submitted_by_username" -> mapping(placeholder, "submittedByUsername", "Submitted By Username", applyTransform(valueOrDash(revision == null ? null : revision.submittedByUsername()), transform), "Revision workflow");
            case "businessunit", "business_unit" -> mapping(placeholder, "businessUnit", "Business Unit", applyTransform(valueOrDash(revision == null ? null : revision.businessUnit()), transform), "Revision metadata");
            case "department" -> mapping(placeholder, "department", "Department", applyTransform(valueOrDash(revision == null ? null : revision.department()), transform), "Revision metadata");
            case "description" -> mapping(placeholder, "description", "Description", applyTransform(valueOrDash(revision == null ? null : revision.description()), transform), "Revision metadata");
            case "language" -> mapping(placeholder, "language", "Language", applyTransform(valueOrDash(revision == null ? null : revision.language()), transform), "Revision metadata");
            case "titlelocallanguage", "title_local_language" -> mapping(placeholder, "titleLocalLanguage", "Title Local Language", applyTransform(valueOrDash(revision == null ? null : revision.titleLocalLanguage()), transform), "Revision metadata");
            case "trainingcompletiondate", "training_completion_date" -> mapping(placeholder, "trainingCompletionDate", "Training Completion Date", applyTransform(valueOrDash(revision == null ? null : revision.trainingCompletionDate()), transform), "Revision metadata");
            case "trainingplanneddate", "training_planned_date" -> mapping(placeholder, "trainingPlannedDate", "Training Planned Date", applyTransform(valueOrDash(revision == null ? null : revision.trainingPlannedDate()), transform), "Revision metadata");
            case "trainingperiodenddate", "training_period_end_date" -> mapping(placeholder, "trainingPeriodEndDate", "Training Period End Date", applyTransform(valueOrDash(revision == null ? null : revision.trainingPeriodEndDate()), transform), "Revision metadata");
            case "requirestraining", "requires_training" -> mapping(placeholder, "requiresTraining", "Requires Training", applyTransform(revision == null ? "-" : String.valueOf(revision.requiresTraining()), transform), "Revision metadata");
            case "coauthors", "co_authors" -> mapping(placeholder, "coAuthors", "Co-Authors", applyTransform(participantNames(revision == null ? null : revision.coAuthors()), transform), "Revision participants");
            case "reviewers" -> mapping(placeholder, "reviewers", "Reviewers", applyTransform(participantNames(revision == null ? null : revision.reviewers()), transform), "Revision participants");
            case "approvers" -> mapping(placeholder, "approvers", "Approvers", applyTransform(participantNames(revision == null ? null : revision.approvers()), transform), "Revision participants");
            case "reviewersignatures", "reviewer_signatures" -> mapping(placeholder, "reviewerSignatures", "Reviewer Signatures", applyTransform(signatureBlocksSample(revision == null ? null : revision.reviewers(), "Reviewed", "Reviewer"), transform), "Electronic signature block");
            case "approversignatures", "approver_signatures" -> mapping(placeholder, "approverSignatures", "Approver Signatures", applyTransform(signatureBlocksSample(revision == null ? null : revision.approvers(), "Approved", "Approver"), transform), "Electronic signature block");
            case "status", "state" -> mapping(placeholder, "status", "Status", applyTransform(valueOrDash(revision == null ? null : revision.statusInfo() == null ? revision.status() : revision.statusInfo().label()), transform), "Revision metadata");
            case "page", "pagecount", "page_count" -> mapping(placeholder, "pageCount", "Page", applyTransform(previewPageValue(revision), transform), "Cover layout");
            case "code" -> mapping(placeholder, "code", "Code", applyTransform(buildRevisionCode(revision), transform), "Cover layout");
            case "copyno", "copy_no" -> mapping(placeholder, "copyNumber", "Copy No", applyTransform("-", transform), "Cover footer");
            case "issuedby", "issued_by" -> mapping(placeholder, "publishedBy", "Issued By", applyTransform(valueOrDash(revision == null ? null : revision.publishedBy()), transform), "Cover footer");
            case "date" -> mapping(placeholder, "publishedOn", "Date", applyTransform(valueOrDash(revision == null ? null : revision.publishedOn()), transform), "Cover footer");
            case "submittedon", "submitted_on", "submitforreviewtime", "submit_for_review_time" -> mapping(placeholder, "submittedOn", "Submitted On", applyTransform(valueOrDash(revision == null ? null : revision.submittedOn()), transform), "Revision workflow");
            case "reviewedon", "reviewed_on", "reviewcompletetime", "review_complete_time" -> mapping(placeholder, "reviewedOn", "Reviewed On", applyTransform(lastCompletedActionAt(revision == null ? null : revision.reviewers()), transform), "Revision workflow");
            case "approvedon", "approved_on", "approvalcompletetime", "approval_complete_time" -> mapping(placeholder, "approvedOn", "Approved On", applyTransform(lastCompletedActionAt(revision == null ? null : revision.approvers()), transform), "Revision workflow");
            case "distributionlist", "distribution_list" -> mapping(placeholder, "distributionList", "Distribution List", applyTransform("-", transform), "Cover section");
            case "reviewevaluate", "review_evaluate", "reviewhistory" -> mapping(placeholder, "reviewHistory", "Review - Evaluate", applyTransform(reviewHistorySummary(revision), transform), "Cover section");
            case "preparedsignature", "prepared_signature", "authorsignature", "author_signature", "authorblock", "author_block" ->
                    mapping(placeholder, "preparedSignature", "Prepared Signature", applyTransform(electronicSignatureBlockLabel("PREPARED"), transform), "Electronic signature block");
            case "dcosignature", "dco_signature", "submittedsignature", "submitted_signature", "submittedbysignature", "submitted_by_signature", "submittedforreviewsignature", "submitted_for_review_signature" ->
                    mapping(placeholder, "submittedSignature", "DCO Submit Signature", applyTransform(electronicSignatureBlockLabel("SUBMITTED_FOR_REVIEW"), transform), "Electronic signature block");
            case "reviewedsignature", "reviewed_signature" -> mapping(placeholder, "reviewedSignature", "Reviewed Signature", applyTransform(electronicSignatureBlockLabel("REVIEWED"), transform), "Electronic signature block");
            case "approvedsignature", "approved_signature" -> mapping(placeholder, "approvedSignature", "Approved Signature", applyTransform(electronicSignatureBlockLabel("APPROVED"), transform), "Electronic signature block");
            case "publishedsignature", "published_signature" -> mapping(placeholder, "publishedSignature", "Published Signature", applyTransform(electronicSignatureBlockLabel("PUBLISHED"), transform), "Electronic signature block");
            case "obsoletedsignature", "obsoleted_signature" -> mapping(placeholder, "obsoletedSignature", "Obsoleted Signature", applyTransform(electronicSignatureBlockLabel("OBSOLETED"), transform), "Electronic signature block");
            case "cancelledsignature", "cancelled_signature" -> mapping(placeholder, "cancelledSignature", "Cancelled Signature", applyTransform(electronicSignatureBlockLabel("CANCELLED"), transform), "Electronic signature block");
            default -> mapping(placeholder, placeholder, humanizePlaceholder(token.name()), applyTransform("-", transform), "OpenXML template");
        };
    }

    private PublishingTemplatePlaceholderMappingResponse mapping(String placeholder, String revisionField, String label, String sampleValue, String sourceSection) {
        return new PublishingTemplatePlaceholderMappingResponse(placeholder, revisionField, label, sampleValue, sourceSection);
    }

    private String participantNames(List<DocumentParticipantResponse> participants) {
        if (participants == null || participants.isEmpty()) {
            return "-";
        }
        return participants.stream()
                .map(item -> valueOrDash(item == null ? null : item.fullName()))
                .filter(value -> !"-".equals(value))
                .collect(Collectors.joining(", "));
    }

    private String firstParticipantName(List<DocumentParticipantResponse> participants) {
        if (participants == null || participants.isEmpty()) {
            return "-";
        }
        return participants.stream()
                .map(item -> valueOrDash(item == null ? null : item.fullName()))
                .filter(value -> !"-".equals(value))
                .findFirst()
                .orElse("-");
    }

    private String firstParticipantUsername(List<DocumentParticipantResponse> participants) {
        if (participants == null || participants.isEmpty()) {
            return "-";
        }
        return participants.stream()
                .map(item -> valueOrDash(item == null ? null : item.username()))
                .filter(value -> !"-".equals(value))
                .findFirst()
                .orElse("-");
    }

    private String firstParticipantPosition(List<DocumentParticipantResponse> participants) {
        if (participants == null || participants.isEmpty()) {
            return "-";
        }
        return participants.stream()
                .map(item -> valueOrDash(item == null ? null : item.position()))
                .filter(value -> !"-".equals(value))
                .findFirst()
                .orElse("-");
    }

    private String lastCompletedActionAt(List<DocumentParticipantResponse> participants) {
        if (participants == null || participants.isEmpty()) {
            return "-";
        }
        for (int i = participants.size() - 1; i >= 0; i--) {
            DocumentParticipantResponse participant = participants.get(i);
            if (participant != null && StringUtils.hasText(participant.actedAt())) {
                return participant.actedAt();
            }
        }
        return "-";
    }

    private String previewPageValue(RevisionDetailResponse revision) {
        return revision == null ? "-" : "1/1";
    }

    private String buildRevisionCode(RevisionDetailResponse revision) {
        if (revision == null) {
            return "-";
        }
        String documentNumber = valueOrDash(revision.documentNumber());
        String revisionNumber = shortenRevisionNumber(revision.revisionNumber());
        if (!StringUtils.hasText(documentNumber) || "-".equals(documentNumber)) {
            return revisionNumber;
        }
        if (!StringUtils.hasText(revisionNumber) || "-".equals(revisionNumber)) {
            return documentNumber;
        }
        return documentNumber + "." + revisionNumber;
    }

    private String shortenRevisionNumber(String revisionNumber) {
        if (!StringUtils.hasText(revisionNumber)) {
            return "-";
        }
        String normalized = revisionNumber.trim();
        String[] parts = normalized.split("\\.");
        if (parts.length == 0) {
            return normalized;
        }
        return parts[0];
    }

    private String reviewHistorySummary(RevisionDetailResponse revision) {
        if (revision == null) {
            return "-";
        }
        String reviewers = participantNames(revision.reviewers());
        String approvers = participantNames(revision.approvers());
        if ("-".equals(reviewers) && "-".equals(approvers)) {
            return "-";
        }
        return "Reviewers: " + reviewers + " | Approvers: " + approvers;
    }

    private String signatureBlocksSample(List<DocumentParticipantResponse> participants, String meaningDisplay, String participantLabel) {
        List<DocumentParticipantResponse> ordered = orderedParticipants(participants);
        if (ordered.isEmpty()) {
            return participantLabel + " signature blocks";
        }
        return ordered.stream()
                .map(participant -> signatureBlockSample(participant, meaningDisplay, participantLabel))
                .collect(Collectors.joining("\n\n"));
    }

    private String signatureBlockSample(List<DocumentParticipantResponse> participants, Integer index, String meaningDisplay, String participantLabel) {
        List<DocumentParticipantResponse> ordered = orderedParticipants(participants);
        if (index == null || index < 1 || index > ordered.size()) {
            return participantLabel + " signature block #" + (index == null ? "-" : index);
        }
        return signatureBlockSample(ordered.get(index - 1), meaningDisplay, participantLabel);
    }

    private Integer extractTrailingIndex(String collapsed, String prefix) {
        if (!StringUtils.hasText(collapsed) || !StringUtils.hasText(prefix) || !collapsed.startsWith(prefix)) {
            return null;
        }
        String suffix = collapsed.substring(prefix.length());
        if (!StringUtils.hasText(suffix)) {
            return null;
        }
        try {
            return Integer.parseInt(suffix);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String signatureBlockSample(DocumentParticipantResponse participant, String meaningDisplay, String participantLabel) {
        if (participant == null) {
            return participantLabel + " signature block";
        }
        String fullName = valueOrDash(participant.fullName());
        String position = valueOrDash(participant.position());
        String department = valueOrDash(participant.department());
        String username = valueOrDash(participant.username());
        String actedAt = valueOrDash(participant.actedAt());
        return participantLabel + " signature block\n"
                + fullName + "\n"
                + position + "\n"
                + department + "\n"
                + "Username: " + username + "\n"
                + "Status: Electronically Signed\n"
                + "Signed at: " + actedAt + "\n"
                + "Meaning: " + meaningDisplay;
    }

    private List<DocumentParticipantResponse> orderedParticipants(List<DocumentParticipantResponse> participants) {
        if (participants == null || participants.isEmpty()) {
            return List.of();
        }
        return participants.stream()
                .filter(participant -> participant != null)
                .sorted((left, right) -> {
                    Integer leftOrder = left.sequenceOrder();
                    Integer rightOrder = right.sequenceOrder();
                    if (leftOrder == null && rightOrder == null) return 0;
                    if (leftOrder == null) return 1;
                    if (rightOrder == null) return -1;
                    return Integer.compare(leftOrder, rightOrder);
                })
                .toList();
    }

    private String electronicSignatureBlockLabel(String meaning) {
        String label = switch (meaning == null ? "" : meaning.trim().toUpperCase(Locale.ROOT)) {
            case "PREPARED" -> "Prepared / Complete Editing signature block";
            case "SUBMITTED_FOR_REVIEW" -> "Submitted for review signature block";
            case "REVIEWED" -> "Reviewed signature block";
            case "APPROVED" -> "Approved signature block";
            case "PUBLISHED" -> "Published signature block";
            case "OBSOLETED" -> "Obsoleted signature block";
            case "CANCELLED" -> "Cancelled signature block";
            default -> "Electronic signature block";
        };
        return label;
    }

    private String dateValue(Object value) {
        if (value instanceof LocalDate localDate) {
            return DATE_FORMAT.format(localDate);
        }
        return valueOrDash(value == null ? null : value.toString());
    }

    private String valueOrDash(String value) {
        return StringUtils.hasText(value) ? value : "-";
    }

    private String applyTransform(String value, String transform) {
        return PublishingPlaceholderSyntax.applyTransform(value, transform);
    }

    private String humanizePlaceholder(String placeholder) {
        String cleaned = placeholder.replaceAll("[_\\-]+", " ").replaceAll("([a-z])([A-Z])", "$1 $2").trim();
        if (!StringUtils.hasText(cleaned)) {
            return placeholder;
        }
        return Character.toUpperCase(cleaned.charAt(0)) + cleaned.substring(1);
    }
}
