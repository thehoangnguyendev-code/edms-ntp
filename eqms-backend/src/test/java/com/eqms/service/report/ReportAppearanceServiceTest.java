package com.eqms.service.report;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.AuditTrailService;
import com.eqms.service.EffectivePermissionService;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

/** REPORT-APPEARANCE-LIST-2026-11-15: many appearances, exactly one Active; activating another makes the present one Inactive, and every change is audited. */
class ReportAppearanceServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final EffectivePermissionService permissions = mock(EffectivePermissionService.class);
    private final AuditTrailService audit = mock(AuditTrailService.class);
    private final ReportAppearanceService service = new ReportAppearanceService(jdbc, permissions, audit);

    private UserAccount actor(String... codes) {
        UserAccount user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setStatus(UserStatus.Active);
        when(permissions.getEffectivePermissionCodes(user)).thenReturn(Set.of(codes));
        return user;
    }

    private static Map<String, Object> row(UUID id, String name, String status) {
        var row = new HashMap<String, Object>();
        row.put("id", id);
        row.put("name", name);
        row.put("status", status);
        return row;
    }

    @Test
    void theAppearancePermissionsAreTheOnlyWayInAndSeeingIsNotChanging() {
        for (String code : List.of("reports.properties.view", "reports.properties.manage", "reports.definition.manage", "settings.config_general.manage")) {
            assertThatThrownBy(() -> service.list(actor(code), new ReportAppearanceService.Filters(null, null), null, null, 1, 10)).isInstanceOf(SecurityException.class);
        }
        UserAccount viewer = actor("reports.appearance.view");
        UUID id = UUID.randomUUID();
        assertThatThrownBy(() -> service.create(viewer, new ReportAppearanceService.Create("A", null))).isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> service.update(viewer, id, new ReportAppearanceService.Update(1, "A", ReportLayout.defaults()))).isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> service.activate(viewer, id)).isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> service.delete(viewer, id)).isInstanceOf(SecurityException.class);
        verify(jdbc, never()).update(anyString(), any(Object[].class));
        verifyNoInteractions(audit);
    }

    @Test
    void aFilterThatIsNotInItsFixedListOrADateThatIsNotAnInstantIsRefusedBeforeAnythingIsAsked() {
        UserAccount viewer = actor("reports.appearance.view");
        for (var bad : List.of(new ReportAppearanceService.Filters(null, "DELETED"), new ReportAppearanceService.Filters(null, null, "SIDEWAYS", null, null, null, null, null, null, null),
                new ReportAppearanceService.Filters(null, null, null, "COMIC", null, null, null, null, null, null), new ReportAppearanceService.Filters(null, null, null, null, "MAYBE", null, null, null, null, null),
                new ReportAppearanceService.Filters(null, null, null, null, null, null, "yesterday", null, null, null))) {
            assertThatThrownBy(() -> service.list(viewer, bad, null, null, 1, 10)).isInstanceOf(IllegalArgumentException.class).hasMessage("REPORT_APPEARANCE_FILTER_INVALID");
        }
        verifyNoInteractions(jdbc);
    }

    @Test
    void aNewAppearanceKeepsTheLayoutThatWasSetOnTheScreenAndTheServerChecksIt() {
        UserAccount admin = actor("reports.appearance.manage");
        var look = ReportLayout.defaults();
        var bad = new ReportLayout(look.cover(), look.coverTitle(), look.subtitle(), look.showExecutor(), look.showGeneratedAt(), look.header(), look.footer(), look.pageNumbers(),
                false, look.watermark(), false, look.stamp(), null, null, null, List.of(), "PORTRAIT", null, "COMIC");
        assertThatThrownBy(() -> service.create(admin, new ReportAppearanceService.Create("Site B", null, bad))).isInstanceOf(IllegalArgumentException.class).hasMessage("REPORT_FONT_INVALID");
        verify(jdbc, never()).update(startsWith("insert into report_appearances"), any(Object[].class));
        verifyNoInteractions(audit);
    }

    @Test
    void aNameIsOneLineOfAtMost120CharactersAndNeverEmpty() {
        assertThat(ReportAppearanceService.cleanName("  Site   A  ")).isEqualTo("Site A");
        for (String bad : new String[] { null, "", "   ", "x".repeat(121), "line\nbreak", "tab\there" }) {
            assertThatThrownBy(() -> ReportAppearanceService.cleanName(bad)).isInstanceOf(IllegalArgumentException.class).hasMessage("REPORT_APPEARANCE_NAME_INVALID");
        }
        assertThat(ReportAppearanceService.cleanName("x".repeat(120))).hasSize(120);
    }

    @Test
    void activatingAnotherMakesThePresentOneInactiveFirstAndBothAreAudited() {
        UUID present = UUID.randomUUID(), other = UUID.randomUUID(), third = UUID.randomUUID();
        when(jdbc.queryForList(startsWith("select id, name, status from report_appearances"))).thenReturn(List.of(row(present, "Standard", "ACTIVE"), row(other, "Audit look", "INACTIVE"), row(third, "Draft", "INACTIVE")));
        UserAccount admin = actor("reports.appearance.manage");
        try {
            service.activate(admin, other);
        } catch (RuntimeException detailNotMocked) {
            // the answer is read back after the change; the change itself is what is checked here
        }
        InOrder order = inOrder(jdbc, audit);
        order.verify(jdbc).update(contains("status='INACTIVE'"), eq(admin.getId()), eq(present));
        order.verify(audit).logAs(eq(admin), eq("REPORT_APPEARANCE"), eq("Standard"), eq(present), eq("REPORT_APPEARANCE_DEACTIVATED"), eq("ACTIVE"), eq("INACTIVE"), anyString());
        order.verify(jdbc).update(contains("status='ACTIVE'"), eq(admin.getId()), eq(admin.getId()), eq(other));
        order.verify(audit).logAs(eq(admin), eq("REPORT_APPEARANCE"), eq("Audit look"), eq(other), eq("REPORT_APPEARANCE_ACTIVATED"), eq("INACTIVE"), eq("ACTIVE"), anyString());
        verify(jdbc, never()).update(contains("status='ACTIVE'"), eq(admin.getId()), eq(admin.getId()), eq(third));
    }

    @Test
    void anAppearanceThatIsAlreadyActiveIsNotActivatedAgainAndAnUnknownOneIsNotFound() {
        UUID active = UUID.randomUUID();
        when(jdbc.queryForList(startsWith("select id, name, status from report_appearances"))).thenReturn(List.of(row(active, "Standard", "ACTIVE")));
        UserAccount admin = actor("reports.appearance.manage");
        assertThatThrownBy(() -> service.activate(admin, active)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("REPORT_APPEARANCE_ALREADY_ACTIVE");
        assertThatThrownBy(() -> service.activate(admin, UUID.randomUUID())).isInstanceOf(ResponseStatusException.class).hasMessageContaining("REPORT_APPEARANCE_NOT_FOUND");
        verify(jdbc, never()).update(anyString(), any(Object[].class));
        verifyNoInteractions(audit);
    }

    @Test
    void theActiveAppearanceCannotBeDeletedAndAnotherOneCanBeAndIsAudited() {
        UUID active = UUID.randomUUID(), other = UUID.randomUUID();
        when(jdbc.queryForList(startsWith("select name, status from report_appearances where id=?"), eq(active))).thenReturn(List.of(row(active, "Standard", "ACTIVE")));
        when(jdbc.queryForList(startsWith("select name, status from report_appearances where id=?"), eq(other))).thenReturn(List.of(row(other, "Draft", "INACTIVE")));
        UserAccount admin = actor("reports.appearance.manage");
        assertThatThrownBy(() -> service.delete(admin, active)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("REPORT_APPEARANCE_ACTIVE_CANNOT_BE_DELETED");
        verify(jdbc, never()).update(startsWith("delete"), any(Object[].class));
        service.delete(admin, other);
        verify(jdbc).update(startsWith("delete from report_appearances"), eq(other));
        verify(audit).logAs(eq(admin), eq("REPORT_APPEARANCE"), eq("Draft"), eq(other), eq("REPORT_APPEARANCE_DELETED"), eq("INACTIVE"), isNull(), anyString());
    }

    @Test
    void aStaleOrUnchangedOrInvalidAppearanceIsRefusedBeforeAnythingIsWritten() {
        UUID id = UUID.randomUUID();
        var stored = new HashMap<String, Object>(row(id, "Standard", "ACTIVE"));
        stored.put("appearance", "{\"cover\":false,\"coverTitle\":\"{{report.title}}\",\"subtitle\":\"\",\"showExecutor\":true,\"showGeneratedAt\":true,\"header\":\"{{report.title}}\",\"footer\":\"f\",\"pageNumbers\":true,\"watermarkEnabled\":false,\"watermark\":\"w\",\"stampEnabled\":false,\"stamp\":\"s\"}");
        stored.put("version", 3);
        when(jdbc.queryForList(startsWith("select id, name, status, appearance::text as appearance, version from report_appearances where id=?"), eq(id))).thenReturn(List.of(stored));
        when(jdbc.queryForMap(startsWith("select name, status, appearance::text as appearance, version"), eq(id))).thenReturn(stored);
        UserAccount admin = actor("reports.appearance.manage");
        assertThatThrownBy(() -> service.update(admin, id, new ReportAppearanceService.Update(2, "Standard", ReportLayout.defaults()))).isInstanceOf(ResponseStatusException.class).hasMessageContaining("REPORT_PROPERTIES_VERSION_CHANGED");
        assertThatThrownBy(() -> service.update(admin, id, null)).isInstanceOf(IllegalArgumentException.class);
        var bad = new ReportLayout(false, "t", "", true, true, "h", "f", true, false, "w", false, "s", null, null, null, List.of(), "PORTRAIT", null, "COMIC");
        assertThatThrownBy(() -> service.update(admin, id, new ReportAppearanceService.Update(3, "Standard", bad))).isInstanceOf(IllegalArgumentException.class).hasMessage("REPORT_FONT_INVALID");
        verify(jdbc, never()).update(startsWith("update report_appearances set name"), any(Object[].class));
        verifyNoInteractions(audit);
    }

    @Test
    void theAuditTextNamesTheChangedPartsAndNeverTheirContents() {
        var before = ReportLayout.defaults();
        var after = new ReportLayout(before.cover(), before.coverTitle(), before.subtitle(), before.showExecutor(), before.showGeneratedAt(), before.header(), before.footer(), before.pageNumbers(),
                false, before.watermark(), true, "CONTROLLED", null, null, null, List.of(), "PORTRAIT", null, "TIMES_NEW_ROMAN");
        assertThat(ReportAppearanceService.describe(before, after)).containsExactly("font", "paper layout", "stamp");
    }
}
