package com.eqms.util;

import org.junit.jupiter.api.Test;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

/** The display format of every date and time of the system: dd/MM/yyyy and dd/MM/yyyy HH:mm:ss in the zone of the site. */
class DateTimeFormatUtilsTest {

    @Test
    void aDateIsDayMonthYear() {
        assertThat(DateTimeFormatUtils.formatDate(LocalDate.of(2026, 10, 3))).isEqualTo("03/10/2026");
        assertThat(DateTimeFormatUtils.formatDate((Object) java.sql.Date.valueOf("2026-01-31"))).isEqualTo("31/01/2026");
    }

    @Test
    void aMomentIsShownInTheZoneOfTheSite() {
        // 07:00 UTC is 14:00 in Ho Chi Minh City.
        Instant moment = Instant.parse("2026-10-23T07:00:05Z");
        assertThat(DateTimeFormatUtils.formatDateTime(moment)).isEqualTo("23/10/2026 14:00:05");
        assertThat(DateTimeFormatUtils.formatDateTime((Object) Timestamp.from(moment))).isEqualTo("23/10/2026 14:00:05");
        assertThat(DateTimeFormatUtils.formatDateTime((Object) OffsetDateTime.of(2026, 10, 23, 7, 0, 5, 0, ZoneOffset.UTC))).isEqualTo("23/10/2026 14:00:05");
        assertThat(DateTimeFormatUtils.formatDateTime((Object) LocalDateTime.of(2026, 10, 23, 14, 0, 5))).isEqualTo("23/10/2026 14:00:05");
    }

    @Test
    void aMomentAfterSevenInTheEveningStaysOnTheRightDay() {
        assertThat(DateTimeFormatUtils.formatDate((Object) Instant.parse("2026-10-23T18:30:00Z"))).isEqualTo("24/10/2026");
    }

    @Test
    void displayNeverFallsBackToIso() {
        assertThat(DateTimeFormatUtils.display(LocalDate.of(2026, 10, 23))).isEqualTo("23/10/2026");
        assertThat(DateTimeFormatUtils.display("2026-10-23")).isEqualTo("23/10/2026");
        assertThat(DateTimeFormatUtils.display("2026-10-23T07:00:00Z")).isEqualTo("23/10/2026 14:00:00");
        assertThat(DateTimeFormatUtils.display("2026-10-23 07:00:00.123456+00")).isNotEqualTo("2026-10-23 07:00:00.123456+00");
        assertThat(DateTimeFormatUtils.display(null)).isEmpty();
        assertThat(DateTimeFormatUtils.display("Quality Assurance")).isEqualTo("Quality Assurance");
        assertThat(DateTimeFormatUtils.display(42)).isEqualTo("42");
    }

    @Test
    void aTextThatCarriesIsoDatesIsWrittenInTheDisplayFormat() {
        assertThat(DateTimeFormatUtils.normalizeText("The list was due on 2026-10-22 and sent 2026-10-23T07:00:00Z."))
                .isEqualTo("The list was due on 22/10/2026 and sent 23/10/2026 14:00:00.");
        assertThat(DateTimeFormatUtils.normalizeText("Window 2026-10-01T00:00:00+07:00 to 2026-10-31T23:59:59+07:00"))
                .isEqualTo("Window 01/10/2026 00:00:00 to 31/10/2026 23:59:59");
    }

    @Test
    void aMonthIsMonthSlashYear() {
        assertThat(DateTimeFormatUtils.displayMonth(java.sql.Date.valueOf("2026-03-01"))).isEqualTo("03/2026");
        assertThat(DateTimeFormatUtils.displayMonth("2026-12-01")).isEqualTo("12/2026");
        assertThat(DateTimeFormatUtils.displayMonth(null)).isEmpty();
    }

    @Test
    void aTextWithoutAnIsoDateIsNotChanged() {
        assertThat(DateTimeFormatUtils.normalizeText("Review 12 of TRN/QA/26-001, revision 2.0")).isEqualTo("Review 12 of TRN/QA/26-001, revision 2.0");
        assertThat(DateTimeFormatUtils.normalizeText("Already 23/10/2026 14:00:00")).isEqualTo("Already 23/10/2026 14:00:00");
        assertThat(DateTimeFormatUtils.normalizeText("2026-13-45 is not a date")).isEqualTo("2026-13-45 is not a date");
        assertThat(DateTimeFormatUtils.normalizeText(null)).isNull();
    }
}
