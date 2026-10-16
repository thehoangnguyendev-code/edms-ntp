package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.EffectivePermissionService;
import com.fasterxml.jackson.databind.ObjectMapper;
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

/** REPORT-TEMPLATE-REVISION-2026-10-14: the revisions of a template are compared and listed on the server; only people who may view templates can read them. */
class ReportTemplateRevisionTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final EffectivePermissionService permissions = mock(EffectivePermissionService.class);
    private final ReportTemplateRevisionService service = new ReportTemplateRevisionService(jdbc, new ObjectMapper(), permissions);

    private UserAccount actor(String... codes) {
        UserAccount user = mock(UserAccount.class);
        when(user.getId()).thenReturn(UUID.randomUUID());
        when(user.getStatus()).thenReturn(UserStatus.Active);
        when(permissions.getEffectivePermissionCodes(user)).thenReturn(Set.of(codes));
        return user;
    }

    private static Map<String, Object> field(String code, boolean allowed, boolean required) {
        return Map.of("code", code, "name", code.toUpperCase(), "allowed", allowed, "defaultSelected", allowed, "required", required);
    }

    @Test
    void noDifferenceMeansNoChanges() {
        Map<String, Object> content = Map.of("displayName", "Register", "fields", List.of(field("a", true, false)), "allowedFormats", List.of("PDF"));
        assertThat(ReportTemplateRevisionService.diff(content, content)).isEmpty();
    }

    @Test
    void aChangedNameFormatsFieldsAndAccessAreEachReported() {
        Map<String, Object> from = Map.of("displayName", "Register", "allowedFormats", List.of("PDF"),
                "fields", List.of(field("a", true, false), field("b", true, false)),
                "roleScopes", List.of(Map.of("roleId", "r1", "roleName", "QA", "scope", "DEPARTMENT")));
        Map<String, Object> to = Map.of("displayName", "Register v2", "allowedFormats", List.of("PDF", "CSV"),
                "fields", List.of(field("a", false, false), field("c", true, false)),
                "roleScopes", List.of(Map.of("roleId", "r1", "roleName", "QA", "scope", "SYSTEM")));
        var changes = ReportTemplateRevisionService.diff(from, to);
        assertThat(changes).extracting(c -> c.get("section") + "|" + c.get("kind") + "|" + c.get("item"))
                .contains("General|CHANGED|Template name", "Output|CHANGED|Output formats", "Fields|ADDED|C", "Fields|REMOVED|B",
                        "Fields|CHANGED|A — allowed", "Access|CHANGED|QA — scope");
    }

    @Test
    void theVersionToSendIsTheLiveVersionPlusTheNumberOfSaves() {
        assertThat(ReportTemplateRevisionService.versionOf(Map.of("base_version", 3, "draft_version", 2))).isEqualTo(5);
    }

    @Test
    void aStatusOrSortOutsideTheAllowedSetIsRefused() {
        when(jdbc.queryForList("select 1 from report_definitions where code=?", "RPT.0001")).thenReturn(List.of(Map.of("x", 1)));
        UserAccount viewer = actor("reports.definition.view");
        assertThatThrownBy(() -> service.list(viewer, "RPT.0001", "BOGUS", "", "revision", "desc", 1, 10)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.list(viewer, "RPT.0001", "ALL", "", "password", "desc", 1, 10)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void peopleWithoutViewPermissionCannotReadRevisions() {
        UserAccount other = actor("reports.run.create");
        assertThatThrownBy(() -> service.list(other, "RPT.0001", "ALL", "", "revision", "desc", 1, 10)).isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> service.detail(other, "RPT.0001", 1, Map.of())).isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> service.compare(other, "RPT.0001", 2, "previous", Map.of())).isInstanceOf(SecurityException.class);
    }
}
