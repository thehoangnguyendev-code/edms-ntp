package com.eqms.service;

import com.eqms.entity.Department;
import com.eqms.entity.DocumentComponent;
import com.eqms.entity.DocumentNameFormat;
import com.eqms.entity.DocumentNameFormatComponent;
import com.eqms.entity.DocumentType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * Resolves a {@link DocumentComponent}'s value, both for PREVIEW (Phase 1) and for real
 * document-number generation (Phase 2 — see {@link #composeDocumentNumber}). This is a closed
 * switch over known token {@code value} keys, not a generic field lookup: it is the enforcement
 * point for the GMP/security boundary described on {@link DocumentComponent} (a name format may
 * only ever expose data a developer explicitly wired here, never an admin-chosen arbitrary field).
 * Centralizing this substitution here is deliberate — a duplicated copy of the same formatting
 * logic (DocumentService vs. DictionaryManagementService) already drifted once in this codebase.
 */
@Component
public class DocumentComponentResolver {

    private final SystemConfigurationService systemConfigurationService;

    public DocumentComponentResolver(SystemConfigurationService systemConfigurationService) {
        this.systemConfigurationService = systemConfigurationService;
    }

    // ── Real generation (Phase 2) ───────────────────────────────────────────

    /**
     * Whether a component can be resolved to a REAL value at document-number-generation time.
     * Document numbering happens before the DocumentRecord itself exists (see
     * DocumentService#generateDocumentNumber), so only fields already known at that moment --
     * the DocumentType being used, the Department passed in, the serial number being allocated --
     * plus admin-authored FREE_TEXT, are eligible. Anything else (document name, revision number,
     * owner, dates, user fields...) belongs to a record that doesn't exist yet and must never be
     * offered here, regardless of what the catalog otherwise allows for preview purposes.
     */
    public boolean isSafeForDocumentNumber(DocumentComponent component) {
        if (component == null) {
            return false;
        }
        if (DocumentComponent.SOURCE_FREE_TEXT.equals(component.getSourceTable())) {
            return true;
        }
        String value = component.getValue() == null ? "" : component.getValue();
        return "documentType".equals(value) || "department".equals(value) || "serial_number".equals(value);
    }

    /**
     * Whether a whole Format is eligible to be assigned as a Document Type's real Document Number
     * Format. Deliberately narrower than {@link #isSafeForDocumentNumber} alone: the sequence
     * drift-reconciliation safety net (DocumentRecordRepository#findMaxDocumentSequenceByPrefix)
     * is hard-coded to the legacy shape "&lt;prefix&gt;.&lt;1-9 digits&gt;" (regex
     * {@code ^[^.]+\.[0-9]{1,9}$}), so for now only that EXACT 2-component shape -- Document Type
     * then Serial Number, joined by "." -- is allowed to generate real document numbers. A richer
     * shape (a Department prefix, a different separator, additional components) stays available
     * for preview/cataloging (Phase 1) but is rejected here until that reconciliation query is
     * made shape-agnostic in a later phase.
     */
    public boolean isEligibleAsDocumentNumberFormat(DocumentNameFormat format) {
        if (format == null) {
            return false;
        }
        List<DocumentNameFormatComponent> ordered = format.getComponents().stream()
                .sorted(Comparator.comparingInt(DocumentNameFormatComponent::getDisplayOrder))
                .toList();
        if (ordered.size() != 2) {
            return false;
        }
        if (!".".equals(format.getSeparator())) {
            return false;
        }
        String first = ordered.get(0).getComponent().getValue();
        String second = ordered.get(1).getComponent().getValue();
        return "documentType".equals(first) && "serial_number".equals(second);
    }

    /**
     * Composes the real document number for a Document Type + Department + allocated sequence,
     * using the Document Type's assigned Format. Only ever called with a Format that already
     * passed {@link #isEligibleAsDocumentNumberFormat}, so this always renders the legacy
     * "TYPE.NNNN" shape today -- the composition still goes through the Format/Component engine
     * (not a second hardcoded literal) so the two stay driven by one definition going forward.
     */
    public String composeDocumentNumber(DocumentNameFormat format, DocumentType documentType, Department department, int sequence) {
        List<DocumentNameFormatComponent> ordered = format.getComponents().stream()
                .sorted(Comparator.comparingInt(DocumentNameFormatComponent::getDisplayOrder))
                .toList();
        return ordered.stream()
                .map(link -> resolveForDocumentNumber(link.getComponent(), documentType, department, sequence))
                .collect(Collectors.joining(format.getSeparator() == null ? "" : format.getSeparator()));
    }

    private String resolveForDocumentNumber(DocumentComponent component, DocumentType documentType, Department department, int sequence) {
        if (DocumentComponent.SOURCE_FREE_TEXT.equals(component.getSourceTable())) {
            return component.getFreeText() == null ? "" : component.getFreeText();
        }
        String value = component.getValue() == null ? "" : component.getValue();
        return switch (value) {
            case "documentType" -> documentType == null || !StringUtils.hasText(documentType.getShortCode())
                    ? "DOC" : documentType.getShortCode().trim().toUpperCase(Locale.ROOT);
            case "department" -> department == null || !StringUtils.hasText(department.getCode())
                    ? "" : department.getCode().trim().toUpperCase(Locale.ROOT);
            case "serial_number" -> String.format(
                    "%0" + systemConfigurationService.getSerialNumberDigits() + "d", Math.max(sequence, 1));
            default -> throw new IllegalStateException(
                    "Document component \"" + component.getName() + "\" cannot be used in a real document number "
                            + "(only Document Type, Department, Serial Number and Free Text are safe at generation time)");
        };
    }

    // ── Preview (Phase 1) ───────────────────────────────────────────────────

    /** Sample value shown in the Document Name Formats builder/preview UI. */
    public String sampleFor(DocumentComponent component) {
        if (component == null) {
            return "";
        }
        if (DocumentComponent.SOURCE_FREE_TEXT.equals(component.getSourceTable())) {
            return component.getFreeText() == null ? "" : component.getFreeText();
        }
        String sampleSerial = String.format("%0" + systemConfigurationService.getSerialNumberDigits() + "d", 7);
        return switch (component.getValue() == null ? "" : component.getValue()) {
            case "documentNumber" -> "SOP." + sampleSerial;
            case "documentName", "documentTitle" -> "Cleaning Procedure";
            case "department" -> "QA";
            case "documentType" -> "SOP";
            case "serial_number" -> sampleSerial;
            case "documentVersion", "revisionNumber" -> "1.0.0";
            case "nextDocumentVersion" -> "1.0.1";
            case "owner" -> "Jane Doe";
            case "createdAt" -> "01/01/2026";
            case "reviewDate" -> "01/07/2026";
            case "approvalDate" -> "15/01/2026";
            case "documentEffectiveDate" -> "20/01/2026";
            case "user_name" -> "John Smith";
            case "user_email" -> "john.smith@example.com";
            case "user_main_job_title" -> "QA Manager";
            case "user_main_business_unit" -> "Quality Unit";
            default -> "";
        };
    }
}
