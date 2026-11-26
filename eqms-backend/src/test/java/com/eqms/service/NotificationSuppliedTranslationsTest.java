package com.eqms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class NotificationSuppliedTranslationsTest {
    private final List<NotificationSuppliedTranslations.Supplied> supplied =
            new NotificationSuppliedTranslations(mock(JdbcTemplate.class), new ObjectMapper(), null).supplied();

    @Test
    void every_supplied_wording_is_complete_fits_its_columns_and_appears_once() {
        assertThat(supplied).hasSizeGreaterThan(250);
        assertThat(supplied).extracting(s -> s.eventCode() + "/" + s.channel()).doesNotHaveDuplicates();
        assertThat(supplied).allSatisfy(s -> {
            if ("EMAIL".equals(s.channel())) {
                assertThat(s.subject()).isNotBlank().hasSizeLessThanOrEqualTo(255);
                assertThat(s.body()).isNotBlank();
                assertThat(s.actionLabel() == null ? "" : s.actionLabel()).hasSizeLessThanOrEqualTo(80);
            } else {
                assertThat(s.title()).isNotBlank().hasSizeLessThanOrEqualTo(255);
                assertThat(s.summary()).isNotBlank().hasSizeLessThanOrEqualTo(500);
            }
        });
    }

    @Test
    void cleaning_a_wording_keeps_every_placeholder_including_a_link_placeholder_and_still_drops_what_runs() {
        assertThat(supplied).allSatisfy(s -> {
            if (s.body() != null) {
                assertThat(NotificationTranslationRules.placeholders(EmailTemplateService.sanitizeWording(s.body())))
                        .containsExactlyInAnyOrderElementsOf(NotificationTranslationRules.placeholders(s.body()));
            }
        });
        assertThat(EmailTemplateService.sanitizeWording("<p><a href=\"{{loginLink}}\">x</a></p>")).contains("href=\"{{loginLink}}\"");
        assertThat(EmailTemplateService.sanitizeWording("<a href=\"javascript:alert(1)\">x</a><a href=\"{{reason}}\">y</a><script>z</script>"))
                .doesNotContain("javascript").doesNotContain("href=\"{{reason}}").doesNotContain("script");
    }

    @Test
    void the_vietnamese_of_review_is_one_word() {
        assertThat(supplied.toString()).doesNotContainIgnoringCase("xem xét");
    }
}
