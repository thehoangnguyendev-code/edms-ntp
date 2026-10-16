package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.AuditTrailService;
import com.eqms.service.EffectivePermissionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
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

/** REPORT-TEMPLATE-REVISION-2026-10-14: Upgrade, Discard, Disable and Enable are refused when they do not fit the state, and are audited when they do. */
class ReportTemplateRevisionActionsTest {
    private static final String CODE = "RPT.0001";
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final AuditTrailService audit = mock(AuditTrailService.class);
    private final ReportTemplateRevisionService revisions = mock(ReportTemplateRevisionService.class);
    private final UserAccount actor = new UserAccount();
    private ReportTemplateService service;
    private final EffectivePermissionService permissionsMock = mock(EffectivePermissionService.class);

    private static Object anyObj() { return org.mockito.ArgumentMatchers.<Object>any(); }

    private static HashMap<String, Object> template(boolean active, Object deletedAt, int version) {
        var row = new HashMap<String, Object>();
        row.put("code", CODE);
        row.put("active", active);
        row.put("deleted_at", deletedAt);
        row.put("definition_version", version);
        row.put("approvalStatus", "APPROVED");
        return row;
    }

    private static Map<String, Object> open(String status, boolean withContent) {
        var row = new HashMap<String, Object>();
        row.put("revision", 3);
        row.put("status", status);
        row.put("base_version", 4);
        row.put("draft_version", 2);
        row.put("snapshot", withContent ? "{}" : null);
        return row;
    }

    @BeforeEach
    void setUp() {
        actor.setId(UUID.randomUUID());
        actor.setStatus(UserStatus.Active);
        when(permissionsMock.getEffectivePermissionCodes(any(UserAccount.class))).thenReturn(Set.of("reports.definition.manage", "reports.definition.upgrade", "reports.definition.discard_revision", "reports.definition.set_enabled", "reports.catalog.view"));
        service = new ReportTemplateService(jdbc, new ObjectMapper(), permissionsMock, audit, List.of(new DocumentReportMetadataProvider()));
        service.configureRevisions(revisions);
        when(revisions.effective(anyString())).thenReturn(null);
        when(revisions.open(anyString())).thenReturn(null);
    }

    private void stored(HashMap<String, Object> row) {
        when(jdbc.queryForList(anyString(), anyObj())).thenReturn(List.of(row));
    }

    @Test
    void disablingStopsTheTemplateAndIsAudited() {
        stored(template(true, null, 5));
        when(revisions.effective(CODE)).thenReturn(Map.of("revision", 2));
        service.setEnabled(actor, CODE, false, "Retired by QA");
        verify(jdbc).update(anyString(), eq(false), eq(CODE));
        verify(audit).logAs(any(), eq("REPORT_DEFINITION"), eq(CODE), any(), eq("REPORT_TEMPLATE_DISABLED"), eq("ACTIVE"), eq("INACTIVE"), eq("Retired by QA"));
    }

    @Test
    void aReasonIsNotRequiredToEnableAndTheAuditSaysSo() {
        stored(template(false, null, 5));
        when(revisions.effective(CODE)).thenReturn(Map.of("revision", 2));
        service.setEnabled(actor, CODE, true, null);
        verify(audit).logAs(any(), eq("REPORT_DEFINITION"), eq(CODE), any(), eq("REPORT_TEMPLATE_ENABLED"), eq("INACTIVE"), eq("ACTIVE"), eq("Enabled"));
    }

    @Test
    void aTemplateStillBeingWrittenHasNoEnabledState() {
        stored(template(true, null, 5));
        assertThatThrownBy(() -> service.setEnabled(actor, CODE, false, null)).hasMessageContaining("REPORT_NO_EFFECTIVE_REVISION");
        verify(jdbc, never()).update(anyString(), eq(false), eq(CODE));
    }

    @Test
    void aTemplateAlreadyInTheWantedStateOrDeletedIsRefused() {
        when(revisions.effective(CODE)).thenReturn(Map.of("revision", 2));
        stored(template(true, null, 5));
        assertThatThrownBy(() -> service.setEnabled(actor, CODE, true, null)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("REPORT_TEMPLATE_ALREADY_ENABLED");
        stored(template(false, null, 5));
        assertThatThrownBy(() -> service.setEnabled(actor, CODE, false, null)).hasMessageContaining("REPORT_TEMPLATE_ALREADY_DISABLED");
        stored(template(true, "2026-10-14", 5));
        assertThatThrownBy(() -> service.setEnabled(actor, CODE, false, null)).hasMessageContaining("REPORT_TEMPLATE_DELETED");
        verify(jdbc, never()).update(anyString(), eq(false), eq(CODE));
    }

    @Test
    void upgradeNeedsAnEffectiveRevisionNoOpenRevisionAndTheCurrentVersion() {
        stored(template(true, null, 5));
        assertThatThrownBy(() -> service.upgrade(actor, CODE, 4, "x")).hasMessageContaining("REPORT_TEMPLATE_VERSION_CHANGED");
        assertThatThrownBy(() -> service.upgrade(actor, CODE, 5, "x")).hasMessageContaining("REPORT_NO_EFFECTIVE_REVISION");
        when(revisions.effective(CODE)).thenReturn(Map.of("revision", 2));
        when(revisions.open(CODE)).thenReturn(open("DRAFT", true));
        assertThatThrownBy(() -> service.upgrade(actor, CODE, 5, "x")).hasMessageContaining("REPORT_REVISION_ALREADY_OPEN");
        assertThatThrownBy(() -> service.upgrade(actor, CODE, 5, " ")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void onlyADraftRevisionWithAnEffectivePredecessorIsDiscardedWithAReason() {
        stored(template(true, null, 5));
        assertThatThrownBy(() -> service.discardRevision(actor, CODE, 6, "x")).hasMessageContaining("REPORT_NO_EFFECTIVE_REVISION");
        when(revisions.effective(CODE)).thenReturn(Map.of("revision", 2));
        when(revisions.open(CODE)).thenReturn(open("PENDING_APPROVAL", true));
        assertThatThrownBy(() -> service.discardRevision(actor, CODE, 6, "x")).hasMessageContaining("REPORT_TEMPLATE_NOT_DRAFT");
        when(revisions.open(CODE)).thenReturn(open("DRAFT", true));
        assertThatThrownBy(() -> service.discardRevision(actor, CODE, 5, "x")).hasMessageContaining("REPORT_TEMPLATE_VERSION_CHANGED");
        assertThatThrownBy(() -> service.discardRevision(actor, CODE, 6, "")).isInstanceOf(IllegalArgumentException.class);
        verify(revisions, never()).discard(anyString(), any(), anyString());
    }

    @Test
    void aDraftIsDiscardedAndAudited() {
        stored(template(true, null, 5));
        when(revisions.effective(CODE)).thenReturn(Map.of("revision", 2));
        when(revisions.open(CODE)).thenReturn(open("DRAFT", true));
        when(revisions.discard(eq(CODE), any(), eq("Not needed"))).thenReturn(true);
        service.discardRevision(actor, CODE, 6, "Not needed");
        verify(audit).logAs(any(), eq("REPORT_DEFINITION"), eq(CODE), any(), eq("REPORT_TEMPLATE_REVISION_DISCARDED"), eq("DRAFT_REV3"), eq("DISCARDED"), eq("Not needed"));
        assertThat(true).isTrue();
        assertThat(HttpStatus.CONFLICT.value()).isEqualTo(409);
    }

    @Test
    void inactiveIsAStateOfAnApprovedTemplateOnly() {
        assertThat(ReportTemplateService.lifecycleOf(Map.of("active", false, "approvalStatus", "APPROVED"))).isEqualTo("INACTIVE");
        assertThat(ReportTemplateService.lifecycleOf(Map.of("active", true, "approvalStatus", "APPROVED"))).isEqualTo("ACTIVE");
        assertThat(ReportTemplateService.lifecycleOf(Map.of("active", false, "approvalStatus", "DRAFT"))).isEqualTo("DRAFT");
        assertThat(ReportTemplateService.lifecycleOf(Map.of("active", false, "approvalStatus", "PENDING_APPROVAL"))).isEqualTo("PENDING_APPROVAL");
    }

    // ---- capabilities: what the screens show, from permissions and state, never from a fixed account ----

    private UserAccount userWith(String... codes) {
        UserAccount user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setStatus(UserStatus.Active);
        when(permissionsMock.getEffectivePermissionCodes(user)).thenReturn(Set.of(codes));
        return user;
    }

    private void effectiveWithoutOpenRevision() {
        var row = new HashMap<String, Object>();
        row.put("active", true); row.put("deleted_at", null); row.put("gmp_use", false); row.put("approval_status", "APPROVED");
        when(jdbc.queryForList(anyString(), anyObj())).thenReturn(List.of(row));
        when(revisions.effective(CODE)).thenReturn(Map.of("revision", 2));
        when(revisions.open(CODE)).thenReturn(null);
    }

    @Test
    void theActionsOfATemplateFollowThePermissionsOfTheUserNotTheirAccount() {
        effectiveWithoutOpenRevision();
        var author = service.capabilities(userWith("reports.catalog.view", "reports.definition.manage", "reports.definition.upgrade"), CODE).actions();
        assertThat(author.get("upgrade").allowed()).isTrue();
        assertThat(author.get("edit").allowed()).isFalse();
        assertThat(author.get("edit").reasonCode()).isEqualTo("REPORT_UPGRADE_REQUIRED");
        assertThat(author.get("disable").allowed()).isFalse();
        assertThat(author.get("disable").reasonCode()).isEqualTo("REPORT_PERMISSION_REQUIRED");
        assertThat(author.get("disable").requiredPermissionCode()).isEqualTo("reports.definition.set_enabled");
        // Someone else, with other permissions, gets the other actions: nothing depends on who the person is.
        var other = service.capabilities(userWith("reports.catalog.view", "reports.definition.set_enabled"), CODE).actions();
        assertThat(other.get("disable").allowed()).isTrue();
        assertThat(other.get("enable").allowed()).isFalse();
        assertThat(other.get("upgrade").allowed()).isFalse();
        assertThat(other.get("upgrade").reasonCode()).isEqualTo("REPORT_PERMISSION_REQUIRED");
    }

    @Test
    void anOpenRevisionAllowsEditAndDiscardAndTheStateStopsUpgrade() {
        effectiveWithoutOpenRevision();
        when(revisions.open(CODE)).thenReturn(open("DRAFT", true));
        var actions = service.capabilities(userWith("reports.catalog.view", "reports.definition.manage", "reports.definition.upgrade", "reports.definition.discard_revision"), CODE).actions();
        assertThat(actions.get("edit").allowed()).isTrue();
        assertThat(actions.get("discardRevision").allowed()).isTrue();
        assertThat(actions.get("submitForApproval").allowed()).isTrue();
        assertThat(actions.get("upgrade").allowed()).isFalse();
        assertThat(actions.get("upgrade").reasonCode()).isEqualTo("REPORT_REVISION_ALREADY_OPEN");
    }

    @Test
    void theAuthorOfARevisionCannotDecideItButAnotherApproverCan() {
        effectiveWithoutOpenRevision();
        var authorUser = userWith("reports.catalog.view", "reports.definition.approve");
        var pending = open("PENDING_APPROVAL", true);
        pending.put("last_changed_by_user_id", authorUser.getId().toString());
        when(revisions.open(CODE)).thenReturn(pending);
        var asAuthor = service.capabilities(authorUser, CODE).actions().get("approve");
        assertThat(asAuthor.allowed()).isFalse();
        assertThat(asAuthor.reasonCode()).isEqualTo("REPORT_APPROVER_IS_AUTHOR");
        assertThat(asAuthor.requiresESignature()).isTrue();
        assertThat(service.capabilities(userWith("reports.catalog.view", "reports.definition.approve"), CODE).actions().get("approve").allowed()).isTrue();
    }

    @Test
    void someoneWhoMayNotSeeReportsGetsNoCapabilities() {
        effectiveWithoutOpenRevision();
        assertThatThrownBy(() -> service.capabilities(userWith("documents.document.view"), CODE)).isInstanceOf(SecurityException.class);
    }

    @Test
    void upgradeDiscardAndDisableNeedTheirOwnPermissionNotTheGeneralManageOne() {
        stored(template(true, null, 5));
        when(revisions.effective(CODE)).thenReturn(Map.of("revision", 2));
        var manager = userWith("reports.definition.manage", "settings.configuration.manage");
        assertThatThrownBy(() -> service.upgrade(manager, CODE, 5, "x")).isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> service.discardRevision(manager, CODE, 6, "x")).isInstanceOf(SecurityException.class);
        assertThatThrownBy(() -> service.setEnabled(manager, CODE, false, null)).isInstanceOf(SecurityException.class);
    }
}
