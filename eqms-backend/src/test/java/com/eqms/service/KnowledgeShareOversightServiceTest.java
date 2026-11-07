package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.knowledge.KnowledgeShareOversightDtos.Explanation;
import com.eqms.dto.knowledge.KnowledgeShareOversightDtos.ShareRow;
import com.eqms.entity.Department;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.DocumentStatusDefinition;
import com.eqms.entity.ObjectAccessRule;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.ObjectAccessRuleRepository;
import com.eqms.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class KnowledgeShareOversightServiceTest {
    private final ObjectAccessRuleRepository rules = mock(ObjectAccessRuleRepository.class);
    private final UserAccountRepository users = mock(UserAccountRepository.class);
    private final DocumentRecordRepository documents = mock(DocumentRecordRepository.class);
    private final DocumentRevisionRepository revisions = mock(DocumentRevisionRepository.class);
    private final KnowledgeVisibilityService visibility = mock(KnowledgeVisibilityService.class);
    private final KnowledgeSharingService sharing = mock(KnowledgeSharingService.class);
    private final DocumentAuthorizationService documentAuthorization = mock(DocumentAuthorizationService.class);
    private final SystemConfigurationService configuration = mock(SystemConfigurationService.class);
    private final DocumentService documentService = mock(DocumentService.class);
    private final CurrentUserService currentUser = mock(CurrentUserService.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final com.eqms.repository.KnowledgeShareLinkRepository links = mock(com.eqms.repository.KnowledgeShareLinkRepository.class);
    private final com.eqms.repository.KnowledgeShareLinkRedemptionRepository redemptions = mock(com.eqms.repository.KnowledgeShareLinkRedemptionRepository.class);
    private final KnowledgeShareLinkService linkService = mock(KnowledgeShareLinkService.class);
    private KnowledgeShareOversightService service;

    private final UUID qcId = UUID.randomUUID();
    private final UUID qaId = UUID.randomUUID();
    private UserAccount admin;
    private UserAccount subject;
    private Department qc;
    private Department qa;
    private DocumentRecord document;

    @BeforeEach
    void setUp() {
        service = new KnowledgeShareOversightService(rules, users, documents, revisions, visibility, sharing, documentAuthorization,
                configuration, documentService, currentUser, permissions, links, redemptions, linkService);
        admin = user("Admin");
        subject = user("Nguyen Van A");
        subject.setStatus(UserStatus.Active);
        qc = department(qcId, "Quality Control");
        qa = department(qaId, "Quality Assurance");
        document = new DocumentRecord();
        ReflectionTestUtils.setField(document, "id", UUID.randomUUID());
        document.setDocumentNumber("SOP.0001");
        document.setDocumentName("Balance calibration");
        document.setDepartment(qc);
        DocumentStatusDefinition active = new DocumentStatusDefinition();
        ReflectionTestUtils.setField(active, "code", "ACTIVE");
        document.setStatus(active);
        when(currentUser.requireCurrentUser()).thenReturn(admin);
        when(permissions.hasAnyPermission(any(), any(String.class), any(String.class))).thenReturn(true);
        when(users.findById(subject.getId())).thenReturn(Optional.of(subject));
        when(documents.findById(document.getId())).thenReturn(Optional.of(document));
        when(revisions.findAllByDocument_IdInAndStatus_CodeInOrderByDocument_IdAscCreatedAtDesc(anyList(), anyList()))
                .thenReturn(List.of(new DocumentRevisionRecord()));
        when(configuration.getKnowledgeVisibilityMode()).thenReturn(SystemConfigurationService.KNOWLEDGE_VISIBILITY_SHARING);
    }

    private static UserAccount user(String name) {
        UserAccount user = new UserAccount();
        ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
        user.setFullName(name);
        return user;
    }

    private static Department department(UUID id, String name) {
        Department department = new Department();
        ReflectionTestUtils.setField(department, "id", id);
        department.setName(name);
        return department;
    }

    private ObjectAccessRule share(Department owner, String effect, String type) {
        ObjectAccessRule rule = new ObjectAccessRule();
        ReflectionTestUtils.setField(rule, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(rule, "createdAt", java.time.Instant.parse("2026-11-03T03:00:00Z"));
        rule.setName("share " + owner.getName() + " " + effect);
        rule.setOwnerDepartment(owner);
        rule.setActions(List.of("VIEW"));
        rule.setEffect(effect);
        rule.setResourceType(type);
        rule.setResourceId(owner.getId());
        rule.setResourceName(owner.getName());
        rule.setGranteeUsers(new LinkedHashSet<>(Set.of(subject)));
        return rule;
    }

    // ---- the list and taking a share away ----

    @Test
    void theListIsForThoseWhoMayViewAccessReviews() {
        when(permissions.hasAnyPermission(any(), any(String.class), any(String.class))).thenReturn(false);
        assertThatThrownBy(() -> service.list(1, 20, null, null, null, null, null)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void theListFiltersByDepartmentEffectAndTextAndSkipsRulesThatAreNotShares() {
        ObjectAccessRule qcShare = share(qc, "ALLOW", "DEPARTMENT");
        ObjectAccessRule qcExclude = share(qc, "DENY", "DEPARTMENT");
        ObjectAccessRule qaShare = share(qa, "ALLOW", "DEPARTMENT");
        ObjectAccessRule notAShare = share(qc, "ALLOW", "DOCUMENT_STATUS");
        when(rules.findAllByOwnerDepartmentIsNotNullOrOwnerBusinessUnitIsNotNullOrderByCreatedAtDesc()).thenReturn(List.of(qcShare, qcExclude, qaShare, notAShare));

        assertThat(service.list(1, 20, null, null, null, "createdAt", "desc").data()).hasSize(3);
        assertThat(service.list(1, 20, null, qcId, null, null, null).data()).extracting(ShareRow::ruleId)
                .containsExactlyInAnyOrder(qcShare.getId(), qcExclude.getId());
        assertThat(service.list(1, 20, null, qcId, "DENY", null, null).data()).extracting(ShareRow::ruleId).containsExactly(qcExclude.getId());
        assertThat(service.list(1, 20, "assurance", null, null, null, null).data()).extracting(ShareRow::ruleId).containsExactly(qaShare.getId());
        assertThat(service.list(1, 20, "nguyen van a", null, null, null, null).data()).hasSize(3);
    }

    @Test
    void anAdministratorWhoMayNotManageRulesCannotTakeAShareAway() {
        when(permissions.hasPermission(admin, "security.object_rules.manage")).thenReturn(false);
        assertThatThrownBy(() -> service.revoke(UUID.randomUUID())).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void anAdministratorWhoMayManageRulesTakesAShareAwayThroughTheSharingService() {
        when(permissions.hasPermission(admin, "security.object_rules.manage")).thenReturn(true);
        UUID ruleId = UUID.randomUUID();
        service.revoke(ruleId);
        verify(sharing).revoke(ruleId);
    }

    // ---- the "why" ----

    private Explanation explain() {
        return service.explain(subject.getId(), document.getId());
    }

    private static com.eqms.dto.security.EffectiveAccessDiagnosisLayer layer(Explanation e, String code) {
        return e.layers().stream().filter(l -> l.layerCode().equals(code)).findFirst().orElseThrow();
    }

    @Test
    void aDocumentTheKnowledgeBaseDoesNotListIsNotVisibleToAnyone() {
        when(revisions.findAllByDocument_IdInAndStatus_CodeInOrderByDocument_IdAscCreatedAtDesc(anyList(), anyList())).thenReturn(List.of());
        when(permissions.hasPermission(subject, KnowledgeVisibilityService.KNOWLEDGE_VIEW_ALL_PERMISSION)).thenReturn(true);
        Explanation e = explain();
        assertThat(e.canSee()).isFalse();
        assertThat(layer(e, "DOCUMENT_IN_KNOWLEDGE_BASE").passed()).isFalse();
    }

    @Test
    void theViewAllOfDocumentControlDoesNotShowTheKnowledgeBase() {
        when(documentAuthorization.canViewAllDocuments(subject)).thenReturn(true);
        when(configuration.getKnowledgeVisibilityMode()).thenReturn(SystemConfigurationService.KNOWLEDGE_VISIBILITY_OWN_DEPARTMENT);
        when(documentService.resolveUserDepartmentId(subject)).thenReturn(qaId);
        Explanation e = explain();
        assertThat(e.canSee()).isFalse();
        assertThat(layer(e, "VIEW_ALL").passed()).isFalse();
    }

    @Test
    void aHolderOfViewAllInTheKnowledgeBaseSeesEveryListedDocumentInEveryMode() {
        when(permissions.hasPermission(subject, KnowledgeVisibilityService.KNOWLEDGE_VIEW_ALL_PERMISSION)).thenReturn(true);
        Explanation e = explain();
        assertThat(e.canSee()).isTrue();
        assertThat(e.summary()).contains("View All Documents in the Knowledge Base");
        // under Sharing too, and an exclusion of a Head does not hide it
        when(configuration.getKnowledgeVisibilityMode()).thenReturn(SystemConfigurationService.KNOWLEDGE_VISIBILITY_SHARING);
        assertThat(explain().canSee()).isTrue();
    }

    @Test
    void underSharingAShareThatReachesTheUserShowsItAndNamesTheShare() {
        ObjectAccessRule rule = share(qc, "ALLOW", "DEPARTMENT");
        when(visibility.decide(any(), any())).thenReturn(new KnowledgeVisibilityService.Decision(true, "SHARED", rule));
        Explanation e = explain();
        assertThat(e.canSee()).isTrue();
        assertThat(e.decidingShare().ruleId()).isEqualTo(rule.getId());
        assertThat(layer(e, "SHARE").passed()).isTrue();
        assertThat(e.summary()).contains("shared");
    }

    @Test
    void underSharingAnExclusionKeepsTheUserOutAndSaysWhich() {
        ObjectAccessRule rule = share(qc, "DENY", "DEPARTMENT");
        when(visibility.decide(any(), any())).thenReturn(new KnowledgeVisibilityService.Decision(false, "EXCLUDED", rule));
        Explanation e = explain();
        assertThat(e.canSee()).isFalse();
        assertThat(e.summary()).contains("excluded");
        assertThat(layer(e, "SHARE").reasonCode()).isEqualTo("EXCLUDED");
    }

    @Test
    void underSharingNoShareMeansClosedByDefault() {
        when(visibility.decide(any(), any())).thenReturn(new KnowledgeVisibilityService.Decision(false, "NO_SHARE", null));
        Explanation e = explain();
        assertThat(e.canSee()).isFalse();
        assertThat(e.decidingShare()).isNull();
        assertThat(layer(e, "SHARE").reasonCode()).isEqualTo("NO_SHARE");
    }

    @Test
    void underSharingTheMissingKnowledgePermissionIsNamed() {
        when(visibility.decide(any(), any())).thenReturn(new KnowledgeVisibilityService.Decision(false, "NO_PERMISSION", null));
        Explanation e = explain();
        assertThat(e.canSee()).isFalse();
        assertThat(layer(e, "KNOWLEDGE_PERMISSION").passed()).isFalse();
    }

    @Test
    void underOwnDepartmentTheDepartmentsAreCompared() {
        when(configuration.getKnowledgeVisibilityMode()).thenReturn(SystemConfigurationService.KNOWLEDGE_VISIBILITY_OWN_DEPARTMENT);
        when(documentService.resolveUserDepartmentId(subject)).thenReturn(qcId);
        assertThat(explain().canSee()).as("same Department").isTrue();
        when(documentService.resolveUserDepartmentId(subject)).thenReturn(qaId);
        Explanation other = explain();
        assertThat(other.canSee()).as("another Department").isFalse();
        assertThat(layer(other, "OWN_DEPARTMENT").passed()).isFalse();
    }

    @Test
    void underOwnBusinessUnitTheUnitsAreComparedAndUnderAllEveryoneSees() {
        com.eqms.entity.BusinessUnit unit = new com.eqms.entity.BusinessUnit();
        UUID unitId = UUID.randomUUID();
        ReflectionTestUtils.setField(unit, "id", unitId);
        qc.setBusinessUnit(unit);
        when(configuration.getKnowledgeVisibilityMode()).thenReturn(SystemConfigurationService.KNOWLEDGE_VISIBILITY_OWN_BUSINESS_UNIT);
        when(documentService.resolveUserBusinessUnitId(subject)).thenReturn(unitId);
        assertThat(explain().canSee()).as("same Business Unit").isTrue();
        when(documentService.resolveUserBusinessUnitId(subject)).thenReturn(UUID.randomUUID());
        Explanation other = explain();
        assertThat(other.canSee()).as("another Business Unit").isFalse();
        assertThat(layer(other, "OWN_BUSINESS_UNIT").passed()).isFalse();

        when(configuration.getKnowledgeVisibilityMode()).thenReturn(SystemConfigurationService.KNOWLEDGE_VISIBILITY_ALL);
        assertThat(explain().canSee()).as("everything is visible").isTrue();
    }

    // ---- links ----

    private com.eqms.entity.KnowledgeShareLink link(String label, java.time.Instant expires, java.time.Instant revoked, String by) {
        com.eqms.entity.KnowledgeShareLink link = new com.eqms.entity.KnowledgeShareLink();
        ReflectionTestUtils.setField(link, "id", UUID.randomUUID());
        link.setScopeKind("DOCUMENT");
        link.setLabel(label);
        link.setOwnerDepartment(qc);
        link.setCreatedBy(user(by));
        link.setCreatedAuthority("DELEGATE");
        link.setExpiresAt(expires);
        link.setRevokedAt(revoked);
        return link;
    }

    @Test
    void theAdministratorListsEveryLinkWithItsStatusAndFiltersThem() {
        java.time.Instant now = java.time.Instant.now();
        var active = link("SOP.0001", now.plusSeconds(3600), null, "Head");
        var expired = link("SOP.0002", now.minusSeconds(3600), null, "Delegate");
        var revoked = link("SOP.0003", null, now.minusSeconds(60), "Head");
        when(links.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(active, expired, revoked));
        when(redemptions.countById_LinkId(any())).thenReturn(2L);

        var all = service.listLinks(1, 10, null, "ALL", null, null).data();
        assertThat(all).extracting(com.eqms.dto.knowledge.KnowledgeShareOversightDtos.LinkAdminRow::status).containsExactlyInAnyOrder("ACTIVE", "EXPIRED", "REVOKED");
        assertThat(all.get(0).opens()).isEqualTo(2L);
        assertThat(all.get(0).ownerName()).isEqualTo("Quality Control");
        assertThat(service.listLinks(1, 10, null, "ACTIVE", null, null).data()).extracting(com.eqms.dto.knowledge.KnowledgeShareOversightDtos.LinkAdminRow::label).containsExactly("SOP.0001");
        assertThat(service.listLinks(1, 10, "delegate", "ALL", null, null).data()).extracting(com.eqms.dto.knowledge.KnowledgeShareOversightDtos.LinkAdminRow::label).containsExactly("SOP.0002");
    }

    @Test
    void theLinkListIsForThoseWhoMayViewAccessReviews() {
        when(permissions.hasAnyPermission(any(), any(String.class), any(String.class))).thenReturn(false);
        assertThatThrownBy(() -> service.listLinks(1, 10, null, null, null, null)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void onlyAHolderOfTheManagePermissionRevokesALinkAndItGoesThroughTheLinkService() {
        UUID id = UUID.randomUUID();
        when(permissions.hasPermission(admin, "security.object_rules.manage")).thenReturn(false);
        assertThatThrownBy(() -> service.revokeLink(id)).isInstanceOf(AccessDeniedException.class);
        when(permissions.hasPermission(admin, "security.object_rules.manage")).thenReturn(true);
        service.revokeLink(id);
        verify(linkService).revoke(id);
    }
}
