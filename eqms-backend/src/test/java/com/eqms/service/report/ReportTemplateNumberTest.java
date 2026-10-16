package com.eqms.service.report;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** REPORT-TEMPLATE-NUMBER-2026-10-14: the system issues a template number from the numbering settings; nobody types it, and a number is never issued twice. */
class ReportTemplateNumberTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final ReportTemplateNumberService service = new ReportTemplateNumberService(jdbc);

    private void settings(String prefix, int digits, int sequence) {
        when(jdbc.queryForMap(anyString())).thenReturn(Map.of("prefix", prefix, "digits", digits, "sequence", sequence));
    }

    @Test
    void aNumberIsThePrefixADotAndAPaddedSerial() {
        assertThat(ReportTemplateNumberService.format("RPT", 4, 1)).isEqualTo("RPT.0001");
        assertThat(ReportTemplateNumberService.format("QA", 6, 123)).isEqualTo("QA.000123");
    }

    @Test
    void theNextNumberFollowsTheLastIssuedAndTheSerialIsStored() {
        settings("RPT", 4, 7);
        when(jdbc.queryForList(anyString(), ArgumentMatchers.<Object>any())).thenReturn(List.of());
        assertThat(service.allocate()).isEqualTo("RPT.0008");
        verify(jdbc).update(anyString(), eq(8L));
    }

    @Test
    void aNumberAlreadyHeldByATemplateIsSkipped() {
        settings("RPT", 4, 0);
        when(jdbc.queryForList(anyString(), ArgumentMatchers.<Object>any())).thenReturn(List.of(Map.of("x", 1)), List.of(Map.of("x", 1)), List.of());
        assertThat(service.allocate()).isEqualTo("RPT.0003");
        verify(jdbc).update(anyString(), eq(3L));
    }
}
