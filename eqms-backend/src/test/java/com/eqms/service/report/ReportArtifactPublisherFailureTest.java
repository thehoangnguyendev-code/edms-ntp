package com.eqms.service.report;

import com.eqms.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** A run that exceeds the row limit fails with its own reason, not as an invalid request (no silent truncation, clear reason). */
class ReportArtifactPublisherFailureTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final UUID runId = UUID.randomUUID();

    private ReportArtifactPublisher publisher() {
        when(jdbc.queryForMap(anyString(), any(Object.class))).thenReturn(Map.of("status", "PROCESSING", "attempt_count", 1, "leased", true));
        return new ReportArtifactPublisher(jdbc, mock(ReportTemplateService.class), mock(UserAccountRepository.class));
    }

    @Test
    void aRowLimitFailureHasItsOwnReasonAndText() {
        publisher().fail(runId, 1, new IllegalArgumentException("REPORT_ROW_LIMIT_EXCEEDED"));

        verify(jdbc).update(anyString(), eq("FAILED"), eq("REPORT_ROW_LIMIT_EXCEEDED"),
                eq("The result has more than 10,000 rows. Add a filter to narrow it and start a new request."), any(), eq(runId));
    }

    @Test
    void otherInvalidCriteriaKeepTheirReason() {
        publisher().fail(runId, 1, new IllegalArgumentException("REPORT_FORMAT_NOT_ALLOWED"));

        verify(jdbc).update(anyString(), eq("FAILED"), eq("REPORT_INVALID_CRITERIA"), any(), any(), eq(runId));
    }
}
