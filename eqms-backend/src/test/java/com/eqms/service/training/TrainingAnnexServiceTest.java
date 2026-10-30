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

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The Training Annex: the list, the signature style of a slot and the permissions behind them. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TrainingAnnexServiceTest {
    @Mock JdbcTemplate jdbc;
    @Mock TrainingAccess access;
    @Mock TrainingFormTemplates templates;
    @Mock TrainingFileService files;
    @Mock TrainingPreviewMarking marking;
    @Mock AuditTrailService audit;

    private final UserAccount actor = mock(UserAccount.class);
    private TrainingAnnexService service;

    @BeforeEach
    void setUp() {
        when(actor.getId()).thenReturn(UUID.randomUUID());
        service = new TrainingAnnexService(jdbc, access, templates, files, marking, audit);
        when(jdbc.queryForList(contains("from training_form_templates where status = 'ENABLED'"))).thenReturn(List.of(
                Map.of("code", "APD.0117", "version_label", "1.1", "token_mode", "TOKENS", "check_problems", "", "activated_at", "2026-10-28")));
        when(jdbc.queryForList(contains("group by code"))).thenReturn(List.of(Map.of("code", "APD.0117", "n", 2L)));
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> rows(Map<String, Object> page) {
        return (List<Map<String, Object>>) page.get("data");
    }

    @Test
    void theListNamesEveryFormAndWhichOneHasATemplateInForce() {
        Map<String, Object> page = service.page(actor, null, null, null, "asc", 1, 20);
        assertThat(rows(page)).extracting(r -> r.get("code")).containsExactly("APD.0009", "APD.0011", "APD.0014", "APD.0024", "APD.0108", "APD.0117", "APD.0118");
        Map<String, Object> row = rows(page).stream().filter(r -> r.get("code").equals("APD.0117")).findFirst().orElseThrow();
        assertThat(row.get("enabledVersion")).isEqualTo("1.1");
        assertThat(row.get("status")).isEqualTo("ACTIVE");
        assertThat(rows(page).stream().filter(r -> r.get("code").equals("APD.0118")).findFirst().orElseThrow().get("status")).isEqualTo("INACTIVE");
        assertThat(row.get("templateCount")).isEqualTo(2L);
        verify(access).require(actor, "training.annex.view");
    }

    @Test
    void theListIsSearchedFilteredAndPagedHere() {
        assertThat(rows(service.page(actor, "matrix", null, null, "asc", 1, 20))).extracting(r -> r.get("code")).containsExactly("APD.0011");
        assertThat(rows(service.page(actor, null, "ACTIVE", null, "asc", 1, 20))).extracting(r -> r.get("code")).containsExactly("APD.0117");
        assertThat(rows(service.page(actor, null, "INACTIVE", null, "asc", 1, 20))).hasSize(6);
        Map<String, Object> second = service.page(actor, null, null, "code", "desc", 2, 3);
        assertThat(rows(second)).extracting(r -> r.get("code")).containsExactly("APD.0024", "APD.0014", "APD.0011");
        assertThat(((Map<?, ?>) second.get("pagination")).get("total")).isEqualTo(7);
    }

    @Test
    void aPersonWithoutThePermissionSeesNothing() {
        doThrow(new SecurityException("denied")).when(access).require(actor, "training.annex.view");
        assertThatThrownBy(() -> service.page(actor, null, null, null, "asc", 1, 20)).isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> service.detail(actor, "APD.0117")).isInstanceOf(SecurityException.class);
    }

    @Test
    void theStyleOfASlotIsSavedWithAReasonAndRecordedInTheAuditTrail() {
        service.setStyle(actor, "APD.0117", "LIST_PREPARED", new TrainingAnnexService.StyleRequest("compact", "Narrow cell"));

        verify(access).require(actor, "training.annex.manage");
        verify(jdbc).update(contains("insert into training_annex_slot_styles"), eq("APD.0117"), eq("LIST_PREPARED"), eq("COMPACT"), any());
        verify(audit).logAs(eq(actor), eq("TRAINING_ANNEX"), eq("APD.0117"), any(UUID.class), eq("TRAINING_ANNEX_SIGNATURE_STYLE_CHANGED"), any(), eq("COMPACT"), contains("Narrow cell"));
    }

    @Test
    void aStyleNeedsAReasonAKnownSlotAndAKnownStyle() {
        assertThatThrownBy(() -> service.setStyle(actor, "APD.0117", "LIST_PREPARED", new TrainingAnnexService.StyleRequest("COMPACT", " ")))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("TRAINING_REASON_REQUIRED");
        assertThatThrownBy(() -> service.setStyle(actor, "APD.0117", "NO_SUCH_SLOT", new TrainingAnnexService.StyleRequest("COMPACT", "x")))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("TRAINING_TEMPLATE_INVALID");
        assertThatThrownBy(() -> service.setStyle(actor, "APD.0117", "LIST_PREPARED", new TrainingAnnexService.StyleRequest("FANCY", "x")))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("TRAINING_TEMPLATE_INVALID");
        assertThatThrownBy(() -> service.setStyle(actor, "APD.0009", "ANY", new TrainingAnnexService.StyleRequest("COMPACT", "x")))
                .isInstanceOf(IllegalArgumentException.class);
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void anEarlierTemplateCannotBePreviewed() {
        UUID id = UUID.randomUUID();
        when(jdbc.queryForList(contains("select * from training_form_templates where id = ?"), eq(id))).thenReturn(List.of(Map.of("code", "APD.0117", "token_mode", "LEGACY")));
        assertThatThrownBy(() -> service.preview(actor, id)).hasMessageContaining("TRAINING_ANNEX_PREVIEW_NEEDS_TOKENS");
    }

    @Test
    @SuppressWarnings("unchecked")
    void theMenuOfARowFollowsThePermissionsAndTheStateOfTheForm() {
        when(access.has(actor, "training.annex.manage")).thenReturn(true);
        when(access.has(actor, "training.annex.enable")).thenReturn(true);
        Map<String, Object> inForce = rows(service.page(actor, "0117", null, null, "asc", 1, 20)).getFirst();
        assertThat((Map<String, Object>) inForce.get("actions")).containsEntry("view", true).containsEntry("edit", true).containsEntry("enable", true).containsEntry("disable", true);
        Map<String, Object> none = rows(service.page(actor, "0118", null, null, "asc", 1, 20)).getFirst();
        assertThat((Map<String, Object>) none.get("actions")).containsEntry("edit", true).containsEntry("enable", false).containsEntry("disable", false);

        when(access.has(actor, "training.annex.manage")).thenReturn(false);
        when(access.has(actor, "training.annex.enable")).thenReturn(false);
        assertThat((Map<String, Object>) rows(service.page(actor, "0117", null, null, "asc", 1, 20)).getFirst().get("actions"))
                .containsEntry("view", true).containsEntry("edit", false).containsEntry("enable", false).containsEntry("disable", false);
    }
}
