package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.AuditTrailService;
import com.eqms.service.EffectivePermissionService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** REPORT-PLATFORM-2026-10-15, phase 2: the Audit Trail as a Report Type. */
class AuditTrailReportSourceTest {
    private final AuditTrailReportMetadataProvider audit = new AuditTrailReportMetadataProvider();
    private final EffectivePermissionService permissions = mock(EffectivePermissionService.class);
    private final ReportTypeService types = new ReportTypeService(mock(JdbcTemplate.class), permissions, mock(AuditTrailService.class), List.of(new DocumentReportMetadataProvider(), audit));

    private UserAccount actor(String... codes) {
        UserAccount user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setStatus(UserStatus.Active);
        when(permissions.getEffectivePermissionCodes(user)).thenReturn(Set.of(codes));
        return user;
    }

    @Test
    void aPersonNeedsBothAuditViewAndAuditExportToUseTheType() {
        assertThat(types.mayUse(actor("audit.view", "audit.export"), "AUDIT_TRAIL")).isTrue();
        assertThat(types.mayUse(actor("audit.view"), "AUDIT_TRAIL")).isFalse();
        assertThat(types.mayUse(actor("audit.export"), "AUDIT_TRAIL")).isFalse();
        assertThat(types.mayUse(actor("reports.run.create"), "AUDIT_TRAIL")).isFalse();
    }

    @Test
    void aRunMustNameADateRangeThatIsInOrderAndNotTooWide() {
        assertThatThrownBy(() -> audit.validateRun(Map.of())).hasMessage("REPORT_AUDIT_RANGE_REQUIRED");
        assertThatThrownBy(() -> audit.validateRun(Map.of("createdFrom", "2026-10-01"))).hasMessage("REPORT_AUDIT_RANGE_REQUIRED");
        assertThatThrownBy(() -> audit.validateRun(Map.of("createdFrom", "2026-10-10", "createdTo", "2026-10-01"))).hasMessage("REPORT_DATE_RANGE_INVALID");
        assertThatThrownBy(() -> audit.validateRun(Map.of("createdFrom", "2026-01-01", "createdTo", "2026-12-31"))).hasMessage("REPORT_AUDIT_RANGE_TOO_WIDE");
        assertThatThrownBy(() -> audit.validateRun(Map.of("createdFrom", "soon", "createdTo", "2026-12-31"))).hasMessage("REPORT_DATE_RANGE_INVALID");
        audit.validateRun(Map.of("createdFrom", "2026-10-01", "createdTo", "2026-10-31"));
        // 92 days counted from the first day to the last day, both included
        audit.validateRun(Map.of("createdFrom", "2026-07-01", "createdTo", "2026-09-30"));
        assertThatThrownBy(() -> audit.validateRun(Map.of("createdFrom", "2026-07-01", "createdTo", "2026-10-01"))).hasMessage("REPORT_AUDIT_RANGE_TOO_WIDE");
    }

    @Test
    void onlyTheWholeSystemScopeShowsTheAuditTrail() {
        var user = actor("audit.view", "audit.export");
        assertThatThrownBy(() -> audit.query(user, List.of("DEPARTMENT", "PERSONAL"), Map.of())).isInstanceOf(SecurityException.class);
        var query = audit.query(user, List.of("SYSTEM"), Map.of("createdFrom", "2026-10-01", "createdTo", "2026-10-31"));
        assertThat(query.fromWhere()).contains("from audit_logs al").contains("al.created_at>=?").contains("al.created_at<?");
        assertThat(query.arguments()).hasSize(2);
        assertThat(audit.allowedScopes()).containsExactly("SYSTEM");
    }

    @Test
    void unknownOrNonTextFiltersAndSensitiveColumnsAreRefused() {
        var user = actor("audit.view", "audit.export");
        assertThatThrownBy(() -> audit.query(user, List.of("SYSTEM"), Map.of("userAgent", "x"))).hasMessage("REPORT_FILTER_NOT_ALLOWED");
        assertThatThrownBy(() -> audit.query(user, List.of("SYSTEM"), Map.of("module", 5))).hasMessage("REPORT_FILTER_NOT_ALLOWED");
        assertThat(audit.columns().keySet()).doesNotContain("oldValue", "newValue", "userAgent", "device", "signatureId");
        assertThat(String.join(" ", audit.columns().values())).doesNotContain("old_value").doesNotContain("new_value").doesNotContain("user_agent");
    }

    @Test
    void searchAndLookupValuesAreBoundNeverJoinedIntoTheSql() {
        var user = actor("audit.view", "audit.export");
        var query = audit.query(user, List.of("SYSTEM"), Map.of("search", "x' or 1=1 --", "module", "DOCUMENT", "action", "CREATE"));
        assertThat(query.fromWhere()).doesNotContain("1=1").doesNotContain("DOCUMENT").doesNotContain("CREATE");
        assertThat(query.arguments()).contains("DOCUMENT", "CREATE");
        assertThat(query.arguments().stream().filter(String.class::isInstance).map(String.class::cast).anyMatch(v -> v.contains("1=1"))).isTrue();
    }

    @Test
    void theColumnsOfTheTypeMatchWhatTheScreenShows() {
        assertThat(audit.labels().values()).contains("Timestamp", "Module", "Action", "User", "IP Address", "Electronic Signature");
        assertThat(audit.requiredFields()).containsExactly("timestamp", "module", "action");
        assertThat(audit.columns().keySet()).containsAll(audit.requiredFields());
        assertThat(audit.filterColumns().get("createdFrom")).isEqualTo("timestamp");
    }
}
