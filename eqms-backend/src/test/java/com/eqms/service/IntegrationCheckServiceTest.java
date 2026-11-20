package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class IntegrationCheckServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final IntegrationCheckService service = new IntegrationCheckService(jdbc, new ObjectMapper());

    @Test
    void theSubjectNamesWhatWasTestedAndNeverCarriesASecret() throws Exception {
        var mapper = new ObjectMapper();
        var minio = mapper.readTree("{\"provider\":\"minio\",\"minioEndpoint\":\"http://minio:9000\",\"minioBucket\":\"eqms-gmp-records\",\"minioAccessKeyId\":\"key-id\",\"minioSecretAccessKey\":\"TOP-SECRET\"}");
        assertEquals("MinIO · http://minio:9000 · eqms-gmp-records", IntegrationCheckService.storageSubject(minio));
        assertFalse(IntegrationCheckService.storageSubject(minio).contains("TOP-SECRET"));
        assertFalse(IntegrationCheckService.storageSubject(minio).contains("key-id"));

        var nas = mapper.readTree("{\"provider\":\"nas\",\"nasHost\":\"nas01\",\"nasShareName\":\"eqms\",\"nasPath\":\"\",\"nasPassword\":\"TOP-SECRET\"}");
        assertEquals("NAS · nas01/eqms", IntegrationCheckService.storageSubject(nas));
        assertEquals("Local server", IntegrationCheckService.storageSubject(mapper.readTree("{\"provider\":\"local\"}")));
        assertEquals("Storage", IntegrationCheckService.storageSubject(mapper.createObjectNode()));
    }

    @Test
    void textFromAnExceptionIsOneBoundedLineWithoutControlCharacters() {
        assertEquals("a b c", IntegrationCheckService.clean("a\nb\r\tc"));
        assertEquals("", IntegrationCheckService.clean(null));
        assertEquals(500, IntegrationCheckService.clean("x".repeat(900)).length());
        assertTrue(IntegrationCheckService.clean("x".repeat(900)).endsWith("…"));
    }

    @Test
    void theResultIsWrittenAsOneRowPerIntegrationThatTheNextTestOverwrites() {
        var actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        service.record(actor, IntegrationCheckService.STORAGE, false, "failed\nbadly", "MinIO · x", List.of(new IntegrationCheckService.Step("reachable", "Reachable", "FAILED", "no")));

        verify(jdbc).update(contains("ON CONFLICT (integration_key) DO UPDATE"), eq("STORAGE"), eq(false), eq("failed badly"), eq("MinIO · x"), argThat((Object json) -> json instanceof String text && text.contains("\"status\":\"FAILED\"")), eq(actor.getId()));
    }

    @Test
    void aFailureToKeepTheResultNeverReachesTheTest() {
        when(jdbc.update(anyString(), any(Object[].class))).thenThrow(new org.springframework.dao.DataAccessResourceFailureException("db down"));

        assertDoesNotThrow(() -> service.record(null, IntegrationCheckService.ONLYOFFICE, true, "ok", "OnlyOffice · x", List.of()));
    }
}
