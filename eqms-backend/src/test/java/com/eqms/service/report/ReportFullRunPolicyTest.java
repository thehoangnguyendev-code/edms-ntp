package com.eqms.service.report;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.eqms.service.AuditTrailService;
import com.eqms.service.EffectivePermissionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

/** REPORT-FULL-RUN-2026-11-12: a report is run with a filter; Full is the explicit choice to run without one. */
class ReportFullRunPolicyTest {
    private final ReportTemplateService service = new ReportTemplateService(mock(JdbcTemplate.class), new ObjectMapper(),
            mock(EffectivePermissionService.class), mock(AuditTrailService.class), List.of(new DocumentReportMetadataProvider(ReportTestVisibility.everything()), new AuditTrailReportMetadataProvider()));

    @Test
    void aRunWithoutAnyFilterIsRefusedUnlessItIsFull() {
        assertThatThrownBy(() -> service.requireNarrowing("DOCUMENT_STATUS", Map.of(), false))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("REPORT_FILTER_REQUIRED");
        assertThatThrownBy(() -> service.requireNarrowing("DOCUMENT_STATUS", null, false))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("REPORT_FILTER_REQUIRED");
        assertThatCode(() -> service.requireNarrowing("DOCUMENT_STATUS", Map.of(), true)).doesNotThrowAnyException();
    }

    @Test
    void aBlankFilterValueDoesNotNarrow() {
        var blank = new HashMap<String, Object>();
        blank.put("status", "  ");
        blank.put("department", null);
        assertThatThrownBy(() -> service.requireNarrowing("DOCUMENT_STATUS", blank, false)).hasMessage("REPORT_FILTER_REQUIRED");
    }

    @Test
    void oneFilterWithAValueIsEnough() {
        assertThatCode(() -> service.requireNarrowing("DOCUMENT_STATUS", Map.of("status", "EFFECTIVE"), false)).doesNotThrowAnyException();
        assertThatCode(() -> service.requireNarrowing("DOCUMENT_STATUS", Map.of("createdFrom", "2026-01-01"), false)).doesNotThrowAnyException();
    }

    @Test
    void aKeyThatIsNotAFilterOfTheTypeDoesNotNarrow() {
        assertThatThrownBy(() -> service.requireNarrowing("DOCUMENT_STATUS", Map.of("reportTitle", "My report", "unknown", "x"), false))
                .hasMessage("REPORT_FILTER_REQUIRED");
    }

    @Test
    void everyFilterOfATypeNarrowsByDefault() {
        var document = new DocumentReportMetadataProvider(ReportTestVisibility.everything());
        assertThat(document.narrowingFilters()).contains("status", "department", "businessUnit", "documentType", "createdFrom", "effectiveFrom");
        assertThat(new AuditTrailReportMetadataProvider().narrowingFilters()).contains("module", "action", "createdFrom", "createdTo");
    }

    @Test
    void theFullLimitIsNeverBelowTheOrdinaryLimitNorAboveWhatTheWorkerCanHold() {
        assertThat(service.maxRows()).isEqualTo(ReportPropertiesService.DEFAULT_MAX_ROWS);
        assertThat(service.maxRowsFull()).isEqualTo(ReportPropertiesService.DEFAULT_MAX_ROWS_FULL);
        assertThat(ReportPropertiesService.MAX_MAX_ROWS_FULL).isLessThanOrEqualTo(100_000);
        assertThat(service.maxRowsFull()).isGreaterThan(service.maxRows());
    }

    @Test
    void aTypeThatIsNotKnownIsRefused() {
        assertThatThrownBy(() -> service.requireNarrowing("NO_SUCH_TYPE", Map.of("status", "x"), false))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("REPORT_SOURCE_NOT_SUPPORTED");
    }
}
