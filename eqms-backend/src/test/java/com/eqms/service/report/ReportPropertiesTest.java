package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.AuditTrailService;
import com.eqms.service.EffectivePermissionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** REPORT-PROPERTIES-2026-10-15: the settings of the Reports module are checked, versioned, audited with what changed, and need their own permission. */
class ReportPropertiesTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final EffectivePermissionService permissions = mock(EffectivePermissionService.class);
    private final AuditTrailService audit = mock(AuditTrailService.class);
    private final ReportPropertiesService service = new ReportPropertiesService(jdbc, permissions, audit);

    private UserAccount actor(String... codes) {
        UserAccount user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setStatus(UserStatus.Active);
        when(permissions.getEffectivePermissionCodes(user)).thenReturn(Set.of(codes));
        return user;
    }

    private HashMap<String, Object> current(int version) {
        var row = new HashMap<String, Object>();
        row.put("template_number_prefix", "RPT");
        row.put("template_number_digits", 4);
        row.put("template_number_sequence", 2);
        row.put("max_rows", 10000);
        row.put("max_schedule_recipients", 200);
        row.put("schedule_retry_minutes", 5);
        row.put("version", version);
        row.put("updated_at", "now");
        return row;
    }

    @BeforeEach
    void setUp() {
        when(jdbc.queryForMap(anyString())).thenReturn(current(3));
    }

    private static ReportPropertiesService.PropertiesWrite write(int version, String prefix, Integer digits, Integer rows, Integer recipients, Integer retry) {
        return new ReportPropertiesService.PropertiesWrite(version, prefix, digits, rows, recipients, retry);
    }

    @Test
    void aChangeIsSavedAndTheAuditTrailNamesWhatChanged() {
        service.update(actor("reports.properties.manage", "reports.properties.view"), write(3, "QA", 5, 20000, null, null));
        verify(jdbc).update(anyString(), eq("QA"), eq(5), eq(20000), eq(200), eq(5), any(), any());
        verify(audit).logAs(any(), eq("REPORT_PROPERTIES"), anyString(), any(), eq("REPORT_PROPERTIES_UPDATED"), any(), any(),
                eq("Template number prefix: RPT -> QA; Digits of the serial number: 4 -> 5; Most rows in a report file: 10000 -> 20000"));
    }

    @Test
    void theCompanyAppearanceIsSavedWithTheSettingsAndTheAuditTrailNamesWhatChanged() {
        var look = ReportLayout.defaults();
        var changed = new ReportLayout(look.cover(), look.coverTitle(), look.subtitle(), look.showExecutor(), look.showGeneratedAt(), look.header(), look.footer(), look.pageNumbers(),
            false, look.watermark(), true, "CONTROLLED", null, null, null, List.of(), "PORTRAIT", null, "TIMES_NEW_ROMAN");
        var request = new ReportPropertiesService.PropertiesWrite(3, null, null, null, null, null, changed);
        service.update(actor("reports.properties.manage"), request);
        verify(audit).logAs(any(), eq("REPORT_PROPERTIES"), anyString(), any(), eq("REPORT_PROPERTIES_UPDATED"), any(), any(),
                eq("Report appearance: font, paper layout, stamp changed"));
    }

    @Test
    void anInvalidAppearanceIsRefusedBeforeAnythingIsWritten() {
        var look = ReportLayout.defaults();
        var bad = new ReportLayout(look.cover(), look.coverTitle(), look.subtitle(), look.showExecutor(), look.showGeneratedAt(), look.header(), look.footer(), look.pageNumbers(),
            false, look.watermark(), false, look.stamp(), null, null, null, List.of(), "PORTRAIT", null, "COMIC");
        assertThatThrownBy(() -> service.update(actor("reports.properties.manage"), new ReportPropertiesService.PropertiesWrite(3, null, null, null, null, null, bad)))
            .isInstanceOf(IllegalArgumentException.class).hasMessage("REPORT_FONT_INVALID");
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void aTemplateKeepsOnlyItsChartsAndTheAppearanceIsTheCompanyOne() {
        var chart = new ReportLayout.Chart("By status", "BAR", "status", "COUNT");
        var look = ReportLayout.defaults();
        var full = new ReportLayout(true, "X", "Y", false, false, "H", "F", false, true, "W", true, "S", null, null, null, List.of(chart), "PORTRAIT", null, "OSWALD");
        var kept = full.chartsOnly();
        assertThat(kept.effectiveCharts()).containsExactly(chart);
        assertThat(kept.cover()).isEqualTo(look.cover());
        assertThat(kept.stampEnabled()).isFalse();
        assertThat(kept.effectiveFont()).isEqualTo("NOTO_SANS");
        assertThat(look.withCharts(List.of(chart)).effectiveCharts()).containsExactly(chart);
    }

    @Test
    void aValueOutsideItsLimitIsRefusedBeforeAnythingIsWritten() {
        UserAccount admin = actor("reports.properties.manage");
        for (var bad : List.of(write(3, "rpt", null, null, null, null), write(3, "R", null, null, null, null), write(3, null, 2, null, null, null), write(3, null, 9, null, null, null),
                write(3, null, null, 999, null, null), write(3, null, null, 100001, null, null), write(3, null, null, null, 0, null), write(3, null, null, null, 501, null),
                write(3, null, null, null, null, 0), write(3, null, null, null, null, 61))) {
            assertThatThrownBy(() -> service.update(admin, bad)).isInstanceOf(IllegalArgumentException.class);
        }
        verify(jdbc, never()).update(anyString(), org.mockito.ArgumentMatchers.<Object[]>any());
    }

    @Test
    void aStaleVersionAndAnUnchangedSaveAreRefused() {
        UserAccount admin = actor("reports.properties.manage");
        assertThatThrownBy(() -> service.update(admin, write(2, "QA", null, null, null, null))).isInstanceOf(ResponseStatusException.class).hasMessageContaining("REPORT_PROPERTIES_VERSION_CHANGED");
        assertThatThrownBy(() -> service.update(admin, write(3, "RPT", 4, 10000, 200, 5))).isInstanceOf(ResponseStatusException.class).hasMessageContaining("REPORT_PROPERTIES_UNCHANGED");
    }

    @Test
    void viewingNeedsTheViewPermissionAndChangingNeedsTheManagePermission() {
        assertThatThrownBy(() -> service.get(actor("reports.definition.view"))).isInstanceOf(SecurityException.class);
        assertThat(service.get(actor("reports.properties.view")).get("nextTemplateNumber")).isEqualTo("RPT.0003");
        assertThatThrownBy(() -> service.update(actor("reports.properties.view"), write(3, "QA", null, null, null, null))).isInstanceOf(SecurityException.class);
    }

    @Test
    void theLimitsFallBackToTheirDefaultsWhenNothingIsStored() {
        when(jdbc.queryForList(anyString(), eq(Integer.class))).thenReturn(List.of());
        assertThat(service.maxRows()).isEqualTo(10000);
        assertThat(service.maxScheduleRecipients()).isEqualTo(200);
        assertThat(service.scheduleRetryMinutes()).isEqualTo(5);
    }
}
