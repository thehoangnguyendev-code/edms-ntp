package com.eqms.service;

import com.eqms.entity.NotificationTemplateVersion;
import com.eqms.entity.UserLocalizationPreference;
import com.eqms.repository.UserLocalizationPreferenceRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class NotificationTranslationTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final UserLocalizationPreferenceRepository preferences = mock(UserLocalizationPreferenceRepository.class);
    private final NotificationTranslationService service = new NotificationTranslationService(jdbc, null, null, null, preferences, null, null);
    private final UUID reader = UUID.randomUUID();

    private NotificationTemplateVersion english(String summary) {
        NotificationTemplateVersion version = new NotificationTemplateVersion();
        ReflectionTestUtils.setField(version, "id", UUID.randomUUID());
        version.setChannel(NotificationTemplateVersion.CHANNEL_IN_APP);
        version.setTitle("Controlled copy recalled");
        version.setSummary(summary);
        version.setActionUrlTemplate("/controlled-copies/{{controlledCopyId}}");
        return version;
    }

    private void readerSpeaks(String language) {
        UserLocalizationPreference preference = mock(UserLocalizationPreference.class);
        when(preference.getLanguage()).thenReturn(language);
        when(preferences.findById(reader)).thenReturn(Optional.of(preference));
    }

    private void translationSays(String summary) {
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(Map.of("title", "Đã thu hồi bản sao kiểm soát", "summary", summary)));
    }

    @Test
    void a_vietnamese_reader_gets_the_translation_but_the_address_stays_the_english_one() {
        NotificationTemplateVersion version = english("{{controlledCopyNumber}} has been recalled.");
        readerSpeaks("vi");
        translationSays("{{controlledCopyNumber}} đã bị thu hồi.");

        NotificationTemplateVersion wording = service.forRecipient(version, reader);

        assertThat(wording.getSummary()).isEqualTo("{{controlledCopyNumber}} đã bị thu hồi.");
        assertThat(wording.getActionUrlTemplate()).isEqualTo(version.getActionUrlTemplate());
    }

    @Test
    void english_is_kept_for_an_english_reader_a_reader_who_chose_nothing_and_when_there_is_no_translation() {
        NotificationTemplateVersion version = english("{{controlledCopyNumber}} has been recalled.");

        when(preferences.findById(reader)).thenReturn(Optional.empty());
        assertThat(service.forRecipient(version, reader)).isSameAs(version);
        readerSpeaks("en");
        assertThat(service.forRecipient(version, reader)).isSameAs(version);
        readerSpeaks("vi");
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());
        assertThat(service.forRecipient(version, reader)).isSameAs(version);
    }

    @Test
    void wording_that_shows_values_written_by_the_server_is_translated_too() {
        NotificationTemplateVersion version = english("{{actionName}}: {{entityName}}. {{actionComment}}");
        readerSpeaks("vi");
        translationSays("{{actionName}} tại {{entityName}}. {{actionComment}}");

        assertThat(service.forRecipient(version, reader).getSummary()).isEqualTo("{{actionName}} tại {{entityName}}. {{actionComment}}");
    }

    @Test
    void the_fixed_words_of_the_server_are_vietnamese_and_everything_a_person_wrote_is_left_alone() {
        Map<String, String> values = Map.of("actionName", "Report template disabled", "actorName", "The system", "actionComment", "Restore for the rehearsal",
                "entityName", "Effective", "revisionStatus", "Effective", "sessionDate", "27/11/2026");

        assertThat(NotificationValueWords.vietnamese(values))
                .containsEntry("actionName", "Đã tắt mẫu báo cáo").containsEntry("actorName", "Hệ thống").containsEntry("revisionStatus", "Đang hiệu lực")
                // a comment, a name that happens to be a status word, and a date stay as they are
                .containsEntry("actionComment", "Restore for the rehearsal").containsEntry("entityName", "Effective").containsEntry("sessionDate", "27/11/2026");
        assertThat(values).containsEntry("actionName", "Report template disabled");
    }

    @Test
    void every_action_that_raises_a_notification_has_its_vietnamese_words() {
        assertThat(AuditNotificationEvents.all().stream().flatMap(event -> event.actions().stream()))
                .allSatisfy(action -> assertThat(NotificationValueWords.ACTIONS).containsKey(action));
    }

    @Test
    void only_a_mail_marked_vietnamese_gets_the_vietnamese_frame() {
        com.eqms.entity.EmailDesign design = new com.eqms.entity.EmailDesign();
        design.setFooterText("© {year} Company. All rights reserved.");
        design.setFooterTextVi("© {year} Company. Bảo lưu mọi quyền.");
        String button = com.eqms.util.EmailFrameRenderer.button("Mở", "https://eqms.example.com/x", "#059669", true);

        String vietnamese = com.eqms.util.EmailFrameRenderer.render(design, com.eqms.util.EmailFrameRenderer.VIETNAMESE_MARK + "<p>Chào</p>" + button);
        String english = com.eqms.util.EmailFrameRenderer.render(design, "<p>Hello</p>" + com.eqms.util.EmailFrameRenderer.button("Open", "https://eqms.example.com/x", "#059669"));

        assertThat(vietnamese).contains("lang=\"vi\"", "Bảo lưu mọi quyền.", "Nếu nút không hoạt động").doesNotContain("All rights reserved", "If the button");
        assertThat(english).contains("lang=\"en\"", "All rights reserved.", "If the button does not work").doesNotContain("Bảo lưu", "Nếu nút");
    }

    @Test
    void the_button_has_the_size_of_the_design_and_the_medium_one_when_none_is_given() {
        java.util.function.Function<String, String> button = size -> com.eqms.util.EmailFrameRenderer.button("Open", "https://eqms.example.com/x", "#059669", false, size);

        assertThat(button.apply("SMALL")).contains("padding:8px 18px", "font-size:13px");
        assertThat(button.apply("LARGE")).contains("padding:16px 36px", "font-size:17px");
        assertThat(button.apply(null)).isEqualTo(button.apply("MEDIUM")).contains("padding:12px 26px", "font-size:15px");
    }

    @Test
    void the_address_under_the_button_can_be_left_out_and_the_button_still_works() {
        String with = com.eqms.util.EmailFrameRenderer.button("Open", "https://eqms.example.com/x", "#059669", false, "MEDIUM", true);
        String without = com.eqms.util.EmailFrameRenderer.button("Open", "https://eqms.example.com/x", "#059669", false, "MEDIUM", false);

        assertThat(with).contains("If the button does not work");
        assertThat(without).doesNotContain("If the button does not work").contains("href=\"https://eqms.example.com/x\"", ">Open</a>");
    }

    @Test
    void a_failure_to_read_the_translation_never_stops_the_notification() {
        NotificationTemplateVersion version = english("{{controlledCopyNumber}} has been recalled.");
        when(preferences.findById(reader)).thenThrow(new IllegalStateException("down"));

        assertThat(service.forRecipient(version, reader)).isSameAs(version);
    }

    @Test
    void a_translation_must_keep_every_placeholder_and_add_none() {
        var english = NotificationTranslationRules.placeholders("{{controlledCopyNumber}} recalled. Reason: {{recallReason}}.");

        assertThatThrownBy(() -> NotificationTranslationRules.requireSamePlaceholders(english, NotificationTranslationRules.placeholders("{{controlledCopyNumber}} đã thu hồi.")))
                .hasMessageContaining("{{recallReason}}");
        assertThatThrownBy(() -> NotificationTranslationRules.requireSamePlaceholders(english,
                NotificationTranslationRules.placeholders("{{controlledCopyNumber}} {{recallReason}} {{tempPassword}}")))
                .hasMessageContaining("{{tempPassword}}");
        NotificationTranslationRules.requireSamePlaceholders(english, NotificationTranslationRules.placeholders("Lý do {{ recallReason }}: {{controlledCopyNumber}}"));
    }
}
