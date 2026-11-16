package com.eqms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ReportRunDetailDisplayTest {
    @Test
    void theTimelineOfARunReturnsTheFactsByNameAndNotTheIdentifiersTheServerKeeps() throws Exception {
        var detail = new ObjectMapper().readTree("{\"sha256\":\"ab12\",\"artifactId\":\"018ed806-0df1-4b10-95b1-1c5e008c4334\",\"format\":\"PDF\"}");
        var shown = ReportPlatformService.displayDetail(detail);
        assertEquals("ab12", shown.path("sha256").asText());
        assertEquals("PDF", shown.path("format").asText());
        assertFalse(shown.has("artifactId"));
        assertFalse(shown.toString().contains("018ed806"));
    }
}
