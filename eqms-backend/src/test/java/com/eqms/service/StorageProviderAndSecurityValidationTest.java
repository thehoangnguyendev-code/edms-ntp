package com.eqms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;
import org.mockito.Mockito;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Configuration cleanup 2026-11-12: only the storage providers that really store files, and the Security checks that no longer stop early. */
class StorageProviderAndSecurityValidationTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private static JsonNode json(String text) throws Exception {
        return JSON.readTree(text);
    }

    @Test
    void theCloudProvidersThatWereNeverConnectedAreRefusedWhenTheConfigurationIsSaved() throws Exception {
        for (String provider : new String[]{"aws-s3", "azure-blob", "google-cloud", "google-drive", "dropbox", "AWS-S3"}) {
            JsonNode integrations = json("{\"storage\":{\"provider\":\"" + provider + "\"}}");
            assertThatThrownBy(() -> SystemConfigurationService.validateStorageProvider(integrations))
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not supported").hasMessageContaining(provider);
        }
    }

    @Test
    void minioANasTheLocalFolderAndAnAbsentProviderAreAccepted() throws Exception {
        for (String provider : new String[]{"minio", "nas", "local", "MinIO"}) {
            JsonNode integrations = json("{\"storage\":{\"provider\":\"" + provider + "\"}}");
            assertThatCode(() -> SystemConfigurationService.validateStorageProvider(integrations)).doesNotThrowAnyException();
        }
        assertThatCode(() -> SystemConfigurationService.validateStorageProvider(null)).doesNotThrowAnyException();
        assertThatCode(() -> SystemConfigurationService.validateStorageProvider(json("{}"))).doesNotThrowAnyException();
        assertThatCode(() -> SystemConfigurationService.validateStorageProvider(json("{\"storage\":{\"provider\":\"\"}}"))).doesNotThrowAnyException();
    }

    @Test
    void testingAProviderThatWasNeverConnectedSaysSoInsteadOfReportingSuccess() throws Exception {
        FileStorageService storage = new FileStorageService(null, null, null);
        for (String provider : new String[]{"aws-s3", "azure-blob", "google-cloud", "google-drive", "dropbox"}) {
            JsonNode config = json("{\"provider\":\"" + provider + "\",\"bucketName\":\"b\",\"region\":\"r\",\"accessKeyId\":\"k\",\"secretAccessKey\":\"s\","
                    + "\"googleDriveClientId\":\"i\",\"googleDriveClientSecret\":\"s\",\"googleDriveFolderId\":\"f\",\"dropboxAppKey\":\"a\",\"dropboxAppSecret\":\"b\","
                    + "\"dropboxAccessToken\":\"t\",\"dropboxFolderPath\":\"p\"}");
            assertThatThrownBy(() -> storage.testConnection(config)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not supported");
        }
    }

    private static void validateSecurity(JsonNode security) throws Throwable {
        SystemConfigurationService service = Mockito.mock(SystemConfigurationService.class, Answers.CALLS_REAL_METHODS);
        Method method = SystemConfigurationService.class.getDeclaredMethod("validateSecurityConfig", JsonNode.class);
        method.setAccessible(true);
        try {
            method.invoke(service, security);
        } catch (InvocationTargetException e) {
            throw e.getCause();
        }
    }

    @Test
    void theOtherSecurityChecksStillRunWhenTheSessionTimeoutIsNotSent() throws Exception {
        assertThatThrownBy(() -> validateSecurity(json("{\"passwordMinLength\":4}"))).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Minimum Password Length");
        assertThatThrownBy(() -> validateSecurity(json("{\"maxLoginAttempts\":99}"))).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Maximum Login Attempts");
        assertThatThrownBy(() -> validateSecurity(json("{\"sessionTimeoutMinutes\":0}"))).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Session Timeout");
        assertThatCode(() -> validateSecurity(json("{\"passwordMinLength\":12,\"maxLoginAttempts\":5}"))).doesNotThrowAnyException();
        assertThatCode(() -> validateSecurity(json("{\"passwordMinLength\":12,\"sessionTimeoutMinutes\":30}"))).doesNotThrowAnyException();
        assertThat(true).isTrue();
    }
}
