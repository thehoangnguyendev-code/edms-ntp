package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.AuditTrailService;
import com.eqms.service.EffectivePermissionService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
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

/** REPORT-PLATFORM-2026-10-15, phase 1: Report Types are listed on the server, enabled or disabled with a reason and an audit entry, and checked before use. */
class ReportTypeServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final EffectivePermissionService permissions = mock(EffectivePermissionService.class);
    private final AuditTrailService audit = mock(AuditTrailService.class);
    private final ReportMetadataProvider documents = new DocumentReportMetadataProvider();
    private final ReportMetadataProvider audits = new FakeProvider("AUDIT_TRAIL", "Audit Trail", "Audit", List.of("audit.view"));
    private final ReportTypeService service = new ReportTypeService(jdbc, permissions, audit, List.of(documents, audits));

    /** A second type, as the Audit Trail source will be: its own code, its own category and a permission of its own. */
    private static class FakeProvider extends DocumentReportMetadataProvider {
        private final String code, name, category;
        private final List<String> use;
        FakeProvider(String code, String name, String category, List<String> use) { this.code = code; this.name = name; this.category = category; this.use = use; }
        @Override public String code() { return code; }
        @Override public String name() { return name; }
        @Override public String category() { return category; }
        @Override public String description() { return "Test source"; }
        @Override public List<String> usePermissions() { return use; }
    }

    private UserAccount actor(String... codes) {
        UserAccount user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setStatus(UserStatus.Active);
        when(permissions.getEffectivePermissionCodes(user)).thenReturn(Set.of(codes));
        return user;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> rows(Map<String, Object> page) { return (List<Map<String, Object>>) page.get("data"); }

    @Test
    void theListIsFilteredSortedAndPagedByTheServer() {
        when(jdbc.queryForObject(anyString(), eq(Long.class), anyString())).thenReturn(3L);
        UserAccount user = actor("reports.types.view");
        assertThat(rows(service.list(user, "ALL", "", "", "name", "asc", 1, 10))).extracting(r -> r.get("code")).containsExactly("AUDIT_TRAIL", "DOCUMENT_STATUS");
        assertThat(rows(service.list(user, "ALL", "Audit", "", "name", "asc", 1, 10))).extracting(r -> r.get("code")).containsExactly("AUDIT_TRAIL");
        assertThat(rows(service.list(user, "ALL", "", "register", "name", "asc", 1, 10))).extracting(r -> r.get("code")).containsExactly("DOCUMENT_STATUS");
        assertThat(rows(service.list(user, "ALL", "", "", "code", "desc", 1, 1))).extracting(r -> r.get("code")).containsExactly("DOCUMENT_STATUS");
        assertThat(rows(service.list(user, "DISABLED", "", "", "name", "asc", 1, 10))).isEmpty();
    }

    @Test
    void aBadFilterSortOrPageIsRefusedAndAPersonWithoutThePermissionSeesNothing() {
        UserAccount user = actor("reports.types.view");
        assertThatThrownBy(() -> service.list(user, "MAYBE", "", "", "name", "asc", 1, 10)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.list(user, "ALL", "", "", "password", "asc", 1, 10)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.list(user, "ALL", "", "", "name", "asc", 1, 1000)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.list(actor("reports.run.create"), "ALL", "", "", "name", "asc", 1, 10)).isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> service.detail(actor(), "DOCUMENT_STATUS")).isInstanceOf(SecurityException.class);
    }

    @Test
    void theDetailListsColumnsAndFiltersWithoutAnySql() {
        var detail = service.detail(actor("reports.types.view"), "DOCUMENT_STATUS");
        assertThat(detail.get("columns").toString()).contains("documentNumber").doesNotContain("d.document_number");
        assertThat(detail.get("filters").toString()).contains("createdFrom");
        UserAccount viewer = actor("reports.types.view");
        assertThatThrownBy(() -> service.detail(viewer, "NOPE")).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void aTypeIsUsableOnlyWhenKnownEnabledAndPermitted() {
        when(jdbc.queryForList(anyString(), eq(Boolean.class), eq("AUDIT_TRAIL"))).thenReturn(List.of(false));
        assertThatThrownBy(() -> service.requireUsable("AUDIT_TRAIL")).hasMessage("REPORT_TYPE_DISABLED");
        assertThatThrownBy(() -> service.requireUsable("UNKNOWN")).hasMessage("REPORT_SOURCE_UNKNOWN");
        service.requireUsable("DOCUMENT_STATUS");
        assertThat(service.mayUse(actor("audit.view"), "AUDIT_TRAIL")).isTrue();
        assertThat(service.mayUse(actor("reports.run.create"), "AUDIT_TRAIL")).isFalse();
        assertThat(service.mayUse(actor(), "DOCUMENT_STATUS")).isTrue(); // the Document register applies the scopes of the template
    }

    @Test
    void enablingNeedsThePermissionAReasonAndTheVersionThatWasRead() {
        var current = new HashMap<String, Object>();
        current.put("enabled", true);
        current.put("version", 4);
        when(jdbc.queryForMap(anyString(), eq("DOCUMENT_STATUS"))).thenReturn(current);
        when(jdbc.queryForObject(anyString(), eq(Long.class), anyString())).thenReturn(0L);
        UserAccount manager = actor("reports.types.manage");
        UserAccount viewer = actor("reports.types.view");
        assertThatThrownBy(() -> service.setEnabled(viewer, "DOCUMENT_STATUS", 4, false, "x")).isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> service.setEnabled(manager, "DOCUMENT_STATUS", 4, false, " ")).hasMessage("REPORT_CHANGE_REASON_REQUIRED");
        assertThatThrownBy(() -> service.setEnabled(manager, "DOCUMENT_STATUS", 3, false, "stale")).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.setEnabled(manager, "DOCUMENT_STATUS", 4, true, "already")).isInstanceOf(ResponseStatusException.class);
        verify(audit, never()).logAs(any(), anyString(), anyString(), any(), anyString(), any(), any(), any());
        service.setEnabled(manager, "DOCUMENT_STATUS", 4, false, "retired source");
        verify(audit).logAs(any(), eq("REPORT_TYPE"), eq("DOCUMENT_STATUS"), any(), eq("REPORT_TYPE_DISABLED"), eq("ENABLED"), eq("DISABLED"), eq("retired source"));
    }
}
