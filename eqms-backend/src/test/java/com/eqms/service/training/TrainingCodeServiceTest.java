package com.eqms.service.training;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** The pattern of the code of a Training Requirement, a Training Matrix or a Training Assessment: what it allows, what it needs, and the code it gives. */
class TrainingCodeServiceTest {

    @Test
    void theDefaultPatternsGiveTheCodesThatWereUsedBefore() {
        assertEquals("REQ/2027-005", TrainingCodeService.format("REQ/{YYYY}-{SEQ:3}", "QA", 2027, 5));
        assertEquals("TM-QA", TrainingCodeService.format("TM-{DEPT}", "qa", 2026, 0));
        assertEquals("TAS-0048", TrainingCodeService.format("TAS-{SEQ:4}", null, 2026, 48));
    }

    @Test
    void thePartsAreTheYearTheDepartmentAndTheNumber() {
        assertEquals("TRQ.26.QA.0007", TrainingCodeService.format("TRQ.{YY}.{DEPT}.{SEQ:4}", "QA", 2026, 7));
        assertEquals("X-12", TrainingCodeService.format("X-{SEQ:2}", null, 2026, 12));
        assertEquals("X-12345", TrainingCodeService.format("X-{SEQ:2}", null, 2026, 12345), "a number longer than its digits is not cut");
        assertEquals("X-0001", TrainingCodeService.format("X-{SEQ}", null, 2026, 1), "four digits when none are given");
    }

    @Test
    void aPatternHasOnlyLettersDigitsAndTheAllowedMarks() {
        TrainingCodeService.validate("REQUIREMENT", "REQ/{YYYY}-{SEQ:3}");
        for (String bad : new String[] {"", "REQ {SEQ}", "REQ_{SEQ:3}$", "REQ-{SEQ:9}", "REQ-{SEQ:0}", "REQ-{NUMBER}", "REQ-{SEQ}{SEQ}", "{YYYY}-{YY}-{SEQ}", "REQ-{DEPT}-{DEPT}-{SEQ}", "a".repeat(61)}) {
            assertThrows(IllegalArgumentException.class, () -> TrainingCodeService.validate("REQUIREMENT", bad), bad);
        }
    }

    @Test
    void eachRecordNeedsWhatMakesItsCodeUnique() {
        assertThrows(IllegalArgumentException.class, () -> TrainingCodeService.validate("REQUIREMENT", "REQ-{YYYY}"), "a requirement needs the number");
        assertThrows(IllegalArgumentException.class, () -> TrainingCodeService.validate("ASSESSMENT", "TAS"), "an assessment needs the number");
        assertThrows(IllegalArgumentException.class, () -> TrainingCodeService.validate("ASSESSMENT", "TAS-{DEPT}-{SEQ}"), "an assessment has no department");
        assertThrows(IllegalArgumentException.class, () -> TrainingCodeService.validate("MATRIX", "TM-{SEQ:3}"), "a matrix is one for each department");
        TrainingCodeService.validate("MATRIX", "TM-{DEPT}");
        TrainingCodeService.validate("MATRIX", "TM-{DEPT}-{SEQ:2}");
    }

    @Test
    void aCodeThatCouldNotFitTheColumnIsRefused() {
        assertThrows(IllegalArgumentException.class, () -> TrainingCodeService.validate("REQUIREMENT", "REQUIREMENT-OF-THE-YEAR/{YYYY}/{DEPT}/{SEQ:8}"));
    }
}
