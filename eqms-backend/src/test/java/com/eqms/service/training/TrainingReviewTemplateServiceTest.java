package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
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
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The checklist template of the reviews (DEC-TRAINING-2026-11-27-01 B8): the items of the SOP are locked, a change needs a reason, and only Training Administration changes it. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TrainingReviewTemplateServiceTest {
    @Mock JdbcTemplate jdbc;
    @Mock TrainingAccess access;
    @Mock AuditTrailService audit;

    private final UserAccount actor = mock(UserAccount.class);
    private final UUID id = UUID.randomUUID();
    private TrainingReviewTemplateService service;

    @BeforeEach
    void setUp() {
        when(actor.getId()).thenReturn(UUID.randomUUID());
        service = new TrainingReviewTemplateService(jdbc, access, audit);
    }

    private Map<String, Object> row(boolean locked, String check) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", id); m.put("kind", "NEW_HIRE"); m.put("title", "Specimen signature"); m.put("title_vi", null); m.put("hint", null); m.put("check_type", check);
        m.put("locked", locked); m.put("active", true); m.put("sort_order", 10); m.put("version", 3);
        return m;
    }

    private TrainingReviewTemplateService.Write change(String title, String check, Boolean active, String reason) {
        return new TrainingReviewTemplateService.Write(null, title, null, null, check, active, null, 3, reason);
    }

    @Test
    void anItemOfTheSopCannotBeSwitchedOffOrGivenAnotherCheck() {
        when(jdbc.queryForList(contains("for update"), eq(id))).thenReturn(List.of(row(true, "SPECIMEN")));

        assertThatThrownBy(() -> service.update(actor, id, change("Specimen signature", "SPECIMEN", false, "r"))).isInstanceOf(ResponseStatusException.class).hasMessageContaining("TRAINING_REVIEW_TEMPLATE_LOCKED");
        assertThatThrownBy(() -> service.update(actor, id, change("Specimen signature", "MANUAL", true, "r"))).isInstanceOf(ResponseStatusException.class).hasMessageContaining("TRAINING_REVIEW_TEMPLATE_LOCKED");
        verify(jdbc, never()).update(contains("update training_review_templates"), any(Object[].class));
    }

    @Test
    void aChangeNeedsAReasonAndTheVersionTheScreenRead() {
        when(jdbc.queryForList(contains("for update"), eq(id))).thenReturn(List.of(row(false, "MANUAL")));

        assertThatThrownBy(() -> service.update(actor, id, change("Better wording", "MANUAL", true, " "))).hasMessage("TRAINING_REASON_REQUIRED");
        assertThatThrownBy(() -> service.update(actor, id, new TrainingReviewTemplateService.Write(null, "x", null, null, "MANUAL", true, null, 2, "r")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("TRAINING_REVIEW_TEMPLATE_VERSION_CHANGED");
    }

    @Test
    void onlyTrainingAdministrationChangesTheTemplate() {
        doThrow(new SecurityException("denied")).when(access).require(actor, "training.admin.manage");

        assertThatThrownBy(() -> service.create(actor, new TrainingReviewTemplateService.Write("NEW_HIRE", "A new item", null, null, "MANUAL", null, null, null, null))).isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> service.update(actor, id, change("x", "MANUAL", true, "r"))).isInstanceOf(SecurityException.class);
        verify(jdbc, never()).update(contains("insert into training_review_templates"), any(Object[].class));
    }

    @Test
    void aNewItemNeedsAKnownTypeATitleAndNeverRepeatsARecordCheck() {
        assertThatThrownBy(() -> service.create(actor, new TrainingReviewTemplateService.Write("OTHER", "x", null, null, "MANUAL", null, null, null, null))).hasMessage("TRAINING_REVIEW_KIND_INVALID");
        assertThatThrownBy(() -> service.create(actor, new TrainingReviewTemplateService.Write("NEW_HIRE", " ", null, null, "MANUAL", null, null, null, null))).hasMessage("TRAINING_REVIEW_TEMPLATE_INVALID");
        assertThatThrownBy(() -> service.create(actor, new TrainingReviewTemplateService.Write("NEW_HIRE", "x", null, null, "TRAINING", null, null, null, null))).hasMessage("TRAINING_REVIEW_TEMPLATE_INVALID");
        when(jdbc.queryForObject(contains("check_type = ? and active"), eq(Integer.class), any(), any())).thenReturn(1);
        assertThatThrownBy(() -> service.create(actor, new TrainingReviewTemplateService.Write("NEW_HIRE", "Another specimen", null, null, "SPECIMEN", null, null, null, null)))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("TRAINING_REVIEW_TEMPLATE_DUPLICATE_CHECK");
        assertThat(true).isTrue();
    }
}
