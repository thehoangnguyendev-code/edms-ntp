package com.eqms.enums;

import com.eqms.entity.DocumentRecord;

import java.util.Arrays;
import java.util.Optional;
import java.util.function.Function;

/**
 * The only document fields a Knowledge Categories Hierarchy may use as Determinator or Level. It is a
 * closed catalog on purpose: an administrator picks from it, never types a column name.
 */
public enum KnowledgeField {
    // Determinator-eligible: exactly one low-cardinality value per document.
    BUSINESS_UNIT("Business Unit", true, d -> d.getBusinessUnit() == null ? null
            : new Value(String.valueOf(d.getBusinessUnit().getId()), d.getBusinessUnit().getName())),
    DEPARTMENT("Department", true, d -> d.getDepartment() == null ? null
            : new Value(String.valueOf(d.getDepartment().getId()), d.getDepartment().getName())),
    DOCUMENT_TYPE("Document Type", true, d -> d.getDocumentType() == null ? null
            : new Value(String.valueOf(d.getDocumentType().getId()), d.getDocumentType().getName())),
    SUB_TYPE("Sub-Type", true, d -> text(d.getSubType())),
    LANGUAGE("Language", true, d -> text(d.getLanguage())),
    OWNER("Owner", true, d -> user(d.getOwner())),
    // Level-only: still exactly one value per document, but too fine-grained to define a Knowledge Base.
    AUTHOR("Author", false, d -> user(d.getAuthor())),
    OPENED_BY("Opened By", false, d -> user(d.getOpenedBy())),
    LAST_MODIFIED_BY("Last Modified By", false, d -> user(d.getLastModifiedBy())),
    REVIEW_REQUIREMENT("Review Requirement", false, d -> d.getReviewRequirement() == null ? null
            : new Value(d.getReviewRequirement().name(),
                    d.getReviewRequirement() == com.eqms.entity.ReviewRequirement.NONE ? "Review not required" : "Review required")),
    REQUIRES_TRAINING("Requires Training", false, d -> yesNo(d.isRequiresTraining())),
    HAS_RELATED_DOCUMENTS("Has Related Documents", false, d -> yesNo(d.isHasRelatedDocuments())),
    HAS_CORRELATED_DOCUMENTS("Has Correlated Documents", false, d -> yesNo(d.isHasCorrelatedDocuments()));

    public record Value(String key, String label) {
    }

    private final String label;
    private final boolean determinatorEligible;
    private final Function<DocumentRecord, Value> extractor;

    KnowledgeField(String label, boolean determinatorEligible, Function<DocumentRecord, Value> extractor) {
        this.label = label;
        this.determinatorEligible = determinatorEligible;
        this.extractor = extractor;
    }

    public boolean determinatorEligible() {
        return determinatorEligible;
    }

    public String label() {
        return label;
    }

    /** The document's value for this field, or null when the document has none. */
    public Value valueOf(DocumentRecord document) {
        return document == null ? null : extractor.apply(document);
    }

    public static Optional<KnowledgeField> parse(String code) {
        if (code == null) {
            return Optional.empty();
        }
        return Arrays.stream(values()).filter(f -> f.name().equalsIgnoreCase(code.trim())).findFirst();
    }

    private static Value user(com.eqms.entity.UserAccount user) {
        if (user == null || user.getId() == null) {
            return null;
        }
        String label = user.getFullName() != null && !user.getFullName().isBlank() ? user.getFullName() : user.getUsername();
        return new Value(String.valueOf(user.getId()), label == null ? String.valueOf(user.getId()) : label);
    }

    private static Value yesNo(boolean value) {
        return new Value(String.valueOf(value), value ? "Yes" : "No");
    }

    private static Value text(String value) {
        return value == null || value.isBlank() ? null : new Value(value.trim(), value.trim());
    }
}
