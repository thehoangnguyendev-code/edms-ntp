package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.AuditTrailService;
import com.eqms.service.EffectivePermissionService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** REPORT-NAME-FORMAT-2026-10-14: a template name is built from its rule; an invalid value is refused before anything is written. */
class ReportNameFormatTest {

    private static Map<String, Object> fixed(int order, String text) {
        return Map.of("display_order", order, "part_type", "FIXED", "fixed_text", text);
    }

    private static Map<String, Object> input(int order, String rule, int max) {
        return Map.of("display_order", order, "part_type", "INPUT", "input_rule", rule, "max_length", max);
    }

    private static final List<Map<String, Object>> TITLE_RULE = List.of(fixed(1, "EQMS"), input(2, "TEXT", 100));

    @Test
    void theNameJoinsFixedAndTypedPartsWithTheSeparator() {
        assertThat(ReportNameFormatService.compose(TITLE_RULE, " - ", Map.of("2", "Document status"))).isEqualTo("EQMS - Document status");
    }

    @Test
    void aMissingInputIsRefused() {
        assertThatThrownBy(() -> ReportNameFormatService.compose(TITLE_RULE, " - ", Map.of("2", "   ")))
                .hasMessage("REPORT_NAME_INVALID");
        assertThatThrownBy(() -> ReportNameFormatService.compose(TITLE_RULE, " - ", Map.of()))
                .hasMessage("REPORT_NAME_INVALID");
    }

    @Test
    void anInputBreakingItsRuleIsRefused() {
        List<Map<String, Object>> code = List.of(fixed(1, "RPT"), input(2, "UPPER_CODE", 20));
        assertThat(ReportNameFormatService.compose(code, "_", Map.of("2", "ABC_123"))).isEqualTo("RPT_ABC_123");
        assertThatThrownBy(() -> ReportNameFormatService.compose(code, "_", Map.of("2", "abc"))).hasMessage("REPORT_NAME_INVALID");
        List<Map<String, Object>> digits = List.of(input(1, "DIGITS", 4));
        assertThatThrownBy(() -> ReportNameFormatService.compose(digits, " - ", Map.of("1", "12a"))).hasMessage("REPORT_NAME_INVALID");
    }

    @Test
    void markupAndControlCharactersInTextAreRefused() {
        assertThatThrownBy(() -> ReportNameFormatService.compose(TITLE_RULE, " - ", Map.of("2", "<b>bold</b>"))).hasMessage("REPORT_NAME_INVALID");
        assertThatThrownBy(() -> ReportNameFormatService.compose(TITLE_RULE, " - ", Map.of("2", "a\u0007b"))).hasMessage("REPORT_NAME_INVALID");
    }

    @Test
    void aValueLongerThanItsLimitIsRefused() {
        List<Map<String, Object>> short_ = List.of(input(1, "TEXT", 5));
        assertThatThrownBy(() -> ReportNameFormatService.compose(short_, " - ", Map.of("1", "too long"))).hasMessage("REPORT_NAME_INVALID");
    }

    @Test
    void aFormatWithoutInputPartsIsRefusedBeforeAnyWrite() {
        var jdbc = mock(JdbcTemplate.class);
        var permissions = mock(EffectivePermissionService.class);
        when(permissions.getEffectivePermissionCodes(any(UserAccount.class))).thenReturn(Set.of("reports.name_format.manage"));
        var service = new ReportNameFormatService(jdbc, permissions, mock(AuditTrailService.class));
        var actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        actor.setStatus(UserStatus.Active);
        var fixedOnly = new ReportNameFormatService.FormatWrite("FIXED_ONLY", "Fixed only", " - ", null,
                List.of(new ReportNameFormatService.PartWrite("FIXED", "EQMS", null, null, null)), "Test", true, null);

        assertThatThrownBy(() -> service.create(actor, fixedOnly)).hasMessage("REPORT_NAME_FORMAT_NEEDS_INPUT");
        verifyNoInteractions(jdbc);
    }

    @Test
    void theExampleShowsLabelsForInputParts() {
        var parts = List.of(new ReportNameFormatService.PartWrite("FIXED", "EQMS", null, null, null),
                new ReportNameFormatService.PartWrite("INPUT", null, "Report topic", "TEXT", 100));
        assertThat(ReportNameFormatService.example(parts, " - ")).isEqualTo("EQMS - <Report topic>");
    }
}
