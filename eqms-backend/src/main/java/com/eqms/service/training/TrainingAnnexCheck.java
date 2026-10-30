package com.eqms.service.training;

import java.io.IOException;
import java.util.List;

/**
 * What the check of a template of the Training Annex found: how it is written (TOKENS: written with tokens and checked against the contract of its code; LEGACY: an earlier template that the old
 * fillers find by its printed words, tokens not checked; NOT_APPLICABLE: APD.0009, whose test is built by the assessment form builder) and the problems. A legacy template is not a problem: it
 * keeps working, with the warning.
 */
public record TrainingAnnexCheck(String mode, List<String> problems) {
    public static final String LEGACY_WARNING = "Legacy template: tokens are not checked";

    public static TrainingAnnexCheck of(String code, byte[] docx) throws IOException {
        TrainingAnnexContract contract = TrainingAnnexContract.of(code);
        if (contract == null || !contract.checked()) return new TrainingAnnexCheck("NOT_APPLICABLE", List.of());
        TrainingAnnexEngine.Scan scan = TrainingAnnexEngine.scan(docx);
        if (!scan.hasTokens()) return new TrainingAnnexCheck("LEGACY", List.of());
        return new TrainingAnnexCheck("TOKENS", contract.check(scan));
    }

    /** One line for the Audit Trail. */
    public String summary() {
        return switch (mode) {
            case "LEGACY" -> LEGACY_WARNING;
            case "NOT_APPLICABLE" -> "Tokens not applicable";
            default -> problems.isEmpty() ? "Tokens agree with the contract" : "Tokens do not agree with the contract: " + String.join("; ", problems);
        };
    }
}
