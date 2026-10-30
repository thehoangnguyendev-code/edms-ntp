package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** A form made for an object keeps the template it was first made with (V697, owner decision 2026-10-28), even after another version is enabled. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TrainingFormTemplatesPinTest {
    @Mock JdbcTemplate jdbc;
    @Mock TrainingFileService files;

    private final UUID activityId = UUID.randomUUID();
    private final UserAccount actor = mock(UserAccount.class);
    private TrainingFormTemplates templates;

    @BeforeEach
    void setUp() {
        when(actor.getId()).thenReturn(UUID.randomUUID());
        templates = new TrainingFormTemplates(jdbc, files, null);
        when(files.readStored(anyString(), anyString(), anyString())).thenReturn(new byte[] {1});
    }

    private static Map<String, Object> template(String version) {
        Map<String, Object> t = new HashMap<>();
        t.put("id", UUID.randomUUID());
        t.put("version_label", version);
        t.put("provider", "LOCAL");
        t.put("stored_path", "p-" + version);
        t.put("sha256", "s-" + version);
        return t;
    }

    private void enabled(String version) {
        when(jdbc.queryForList(contains("status = 'ENABLED'"), eq("APD.0117"))).thenReturn(List.of(template(version)));
    }

    private void pinned(String version) {
        when(jdbc.queryForList(contains("from training_form_uses u join training_form_templates t"), eq("APD.0117"), eq("ACTIVITY"), eq(activityId))).thenReturn(List.of(template(version)));
    }

    @Test
    void theFirstFormForAnObjectUsesTheTemplateInForceAndRemembersIt() {
        enabled("1.0.0");

        TrainingFormTemplates.Template used = templates.enabledFor("APD.0117", "ACTIVITY", activityId, actor, "PDF", true);

        assertThat(used.versionLabel()).isEqualTo("1.0.0");
        verify(jdbc).update(contains("insert into training_form_uses"), any(UUID.class), eq("APD.0117"), any(UUID.class), eq("ACTIVITY"), eq(activityId), eq("pdf"), any(UUID.class));
    }

    @Test
    void aLaterFormForTheSameObjectComesOutInTheSameTemplateEvenAfterANewVersionWasEnabled() {
        pinned("1.0.0");
        enabled("2.0.0");

        TrainingFormTemplates.Template used = templates.enabledFor("APD.0117", "ACTIVITY", activityId, actor, "docx", true);

        assertThat(used.versionLabel()).isEqualTo("1.0.0");
        assertThat(used.sha256()).isEqualTo("s-1.0.0");
    }

    @Test
    void aPinnedTemplateIsUsedEvenWhenNothingIsEnabledAnyMore() {
        pinned("1.0.0");

        assertThat(templates.enabledFor("APD.0117", "ACTIVITY", activityId, actor, "docx", true).versionLabel()).isEqualTo("1.0.0");
    }

    @Test
    void aPreviewRemembersNothingAndRecordsNoUse() {
        enabled("1.0.0");

        templates.enabledFor("APD.0117", "ACTIVITY", activityId, actor, "pdf", false);

        verify(jdbc, never()).update(contains("insert into training_form_uses"), any(Object[].class));
    }

    @Test
    void withNothingPinnedAndNothingEnabledTheFormIsRefused() {
        assertThatThrownBy(() -> templates.enabledFor("APD.0117", "ACTIVITY", activityId, actor, "pdf", true))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("TRAINING_FORM_TEMPLATE_MISSING");
    }
}
