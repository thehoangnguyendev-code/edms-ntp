package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

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

    /** The list of the rules is worked on the server: searched, filtered, sorted and cut into pages. */
    @Test
    void theRulesListIsSearchedFilteredSortedAndPagedOnTheServer() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForList(anyString())).thenReturn(List.of(
                Map.of("entity", "ASSESSMENT", "pattern", "TAS-{SEQ:4}", "version", 1),
                Map.of("entity", "MATRIX", "pattern", "TM-{DEPT}", "version", 3, "updated_at", Timestamp.valueOf("2026-10-01 10:00:00"), "updated_by_name", "An Nguyen"),
                Map.of("entity", "REQUIREMENT", "pattern", "REQ/{YYYY}-{SEQ:3}", "version", 1)));
        TrainingCodeService service = new TrainingCodeService(jdbc, mock(TrainingAccess.class), mock(AuditTrailService.class));
        UserAccount actor = mock(UserAccount.class);

        Map<String, Object> all = service.rulesPage(actor, null, null, null, null, null, 1, 10);
        assertEquals(List.of("ASSESSMENT", "MATRIX", "REQUIREMENT"), entities(all));

        assertEquals(List.of("MATRIX"), entities(service.rulesPage(actor, "an nguyen", null, null, null, null, 1, 10)), "the search reads the person who changed it");
        assertEquals(List.of("REQUIREMENT"), entities(service.rulesPage(actor, "req/", null, null, null, null, 1, 10)), "the search reads the pattern");
        assertEquals(List.of("MATRIX"), entities(service.rulesPage(actor, null, null, "CHANGED", null, null, 1, 10)));
        assertEquals(List.of("ASSESSMENT", "REQUIREMENT"), entities(service.rulesPage(actor, null, null, "DEFAULT", null, null, 1, 10)));
        assertEquals(List.of("REQUIREMENT"), entities(service.rulesPage(actor, null, "REQUIREMENT", null, null, null, 1, 10)));
        assertEquals(List.of("MATRIX", "ASSESSMENT", "REQUIREMENT"), entities(service.rulesPage(actor, null, null, null, "pattern", "desc", 1, 10)));

        Map<String, Object> second = service.rulesPage(actor, null, null, null, null, null, 2, 2);
        assertEquals(List.of("REQUIREMENT"), entities(second));
        assertEquals(Map.of("page", 2, "limit", 2, "total", 3L, "totalPages", 2L), second.get("pagination"));
    }

    @SuppressWarnings("unchecked")
    private static List<String> entities(Map<String, Object> page) {
        return ((List<Map<String, Object>>) page.get("data")).stream().map(r -> String.valueOf(r.get("entity"))).toList();
    }
}
