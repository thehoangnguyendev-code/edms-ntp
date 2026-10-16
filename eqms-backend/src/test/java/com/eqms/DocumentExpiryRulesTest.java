package com.eqms;

import com.eqms.entity.DocumentRecord;
import com.eqms.service.DocumentExpiryRules;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Owner decision DOCUMENT-EXPIRY-2026-10-16: a document expires at the START of its Valid Until day,
 * so on the Valid Until day itself it is already expired. Without a Valid Until date it never expires.
 */
class DocumentExpiryRulesTest {

    private static DocumentRecord withValidUntil(LocalDate validUntil) {
        DocumentRecord document = new DocumentRecord();
        document.setValidUntil(validUntil);
        return document;
    }

    @Test
    void expiresAtTheStartOfTheValidUntilDay() {
        LocalDate validUntil = LocalDate.of(2026, 10, 10);
        DocumentRecord document = withValidUntil(validUntil);
        ZoneId zone = ZoneId.systemDefault();

        assertThat(DocumentExpiryRules.isExpired(document,
                ZonedDateTime.of(2026, 10, 9, 23, 59, 59, 0, zone).toInstant())).isFalse();
        assertThat(DocumentExpiryRules.isExpired(document,
                ZonedDateTime.of(2026, 10, 10, 0, 0, 0, 0, zone).toInstant())).isTrue();
        assertThat(DocumentExpiryRules.isExpired(document,
                ZonedDateTime.of(2026, 10, 16, 9, 0, 0, 0, zone).toInstant())).isTrue();
    }

    @Test
    void documentWithoutValidUntilNeverExpires() {
        DocumentRecord document = withValidUntil(null);

        assertThat(DocumentExpiryRules.isExpired(document, java.time.Instant.now())).isFalse();
    }

    @Test
    void nullInputsAreNotExpired() {
        assertThat(DocumentExpiryRules.isExpired(null, java.time.Instant.now())).isFalse();
        assertThat(DocumentExpiryRules.isExpired(withValidUntil(LocalDate.of(2020, 1, 1)), null)).isFalse();
    }
}
