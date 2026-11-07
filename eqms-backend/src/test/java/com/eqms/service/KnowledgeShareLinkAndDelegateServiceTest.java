package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.DelegateRequest;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.LinkCreated;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.LinkRequest;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.LinkTarget;
import com.eqms.entity.BusinessUnit;
import com.eqms.entity.Department;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentType;
import com.eqms.entity.KnowledgeCategoryHierarchy;
import com.eqms.entity.KnowledgeShareDelegate;
import com.eqms.entity.KnowledgeShareLink;
import com.eqms.entity.KnowledgeShareLinkRedemption;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.BusinessUnitRepository;
import com.eqms.repository.DepartmentRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.DocumentTypeRepository;
import com.eqms.repository.KnowledgeCategoryHierarchyRepository;
import com.eqms.repository.KnowledgeShareDelegateRepository;
import com.eqms.repository.KnowledgeShareLinkRedemptionRepository;
import com.eqms.repository.KnowledgeShareLinkRepository;
import com.eqms.repository.ObjectAccessRuleRepository;
import com.eqms.repository.PositionRepository;
import com.eqms.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Delegates (people a Head names to share) and links (the token, the expiry, opening, revoking). */
class KnowledgeShareLinkAndDelegateServiceTest {
    private static final String ANY = KnowledgeShareAuthorityService.SHARE_ANY_DEPARTMENT_PERMISSION;

    private final KnowledgeShareDelegateRepository delegates = mock(KnowledgeShareDelegateRepository.class);
    private final DepartmentRepository departments = mock(DepartmentRepository.class);
    private final BusinessUnitRepository units = mock(BusinessUnitRepository.class);
    private final UserAccountRepository users = mock(UserAccountRepository.class);
    private final KnowledgeShareLinkRepository links = mock(KnowledgeShareLinkRepository.class);
    private final KnowledgeShareLinkRedemptionRepository redemptions = mock(KnowledgeShareLinkRedemptionRepository.class);
    private final KnowledgeCategoryHierarchyRepository hierarchies = mock(KnowledgeCategoryHierarchyRepository.class);
    private final DocumentRevisionRepository revisions = mock(DocumentRevisionRepository.class);
    private final DocumentRecordRepository documents = mock(DocumentRecordRepository.class);
    private final CurrentUserService currentUser = mock(CurrentUserService.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final SystemConfigurationService configuration = mock(SystemConfigurationService.class);
    private final KnowledgeShareNotifier notifier = mock(KnowledgeShareNotifier.class);
    private final AuditTrailService audit = mock(AuditTrailService.class);
    private KnowledgeShareDelegateService delegateService;
    private KnowledgeShareLinkService linkService;

    private UserAccount actor;
    private BusinessUnit unit;
    private Department qc;
    private DocumentRecord document;

    @BeforeEach
    void setUp() {
        KnowledgeShareAuthorityService authority = new KnowledgeShareAuthorityService(permissions, departments, units, delegates);
        KnowledgeSharingService sharing = new KnowledgeSharingService(mock(ObjectAccessRuleRepository.class), departments, units,
                mock(DocumentTypeRepository.class), documents, users, mock(PositionRepository.class), hierarchies, delegates, currentUser,
                authority, notifier, audit);
        delegateService = new KnowledgeShareDelegateService(delegates, departments, units, users, currentUser, authority, audit);
        linkService = new KnowledgeShareLinkService(links, redemptions, hierarchies, revisions, sharing, authority, notifier, currentUser,
                permissions, configuration, audit);
        actor = person("Actor");
        unit = new BusinessUnit();
        ReflectionTestUtils.setField(unit, "id", UUID.randomUUID());
        unit.setName("Quality Unit");
        qc = new Department();
        ReflectionTestUtils.setField(qc, "id", UUID.randomUUID());
        qc.setName("Quality Control");
        qc.setActive(true);
        qc.setBusinessUnit(unit);
        document = new DocumentRecord();
        ReflectionTestUtils.setField(document, "id", UUID.randomUUID());
        document.setDocumentNumber("SOP.0001");
        document.setDocumentName("Balance calibration");
        document.setDepartment(qc);
        when(currentUser.requireCurrentUser()).thenReturn(actor);
        when(departments.findById(qc.getId())).thenReturn(Optional.of(qc));
        when(units.findById(unit.getId())).thenReturn(Optional.of(unit));
        when(documents.findById(document.getId())).thenReturn(Optional.of(document));
        when(delegates.findByDepartment_IdAndUser_Id(any(), any())).thenReturn(Optional.empty());
        when(delegates.findByBusinessUnit_IdAndUser_Id(any(), any())).thenReturn(Optional.empty());
        when(delegates.save(any(KnowledgeShareDelegate.class))).thenAnswer(i -> i.getArgument(0));
        when(links.save(any(KnowledgeShareLink.class))).thenAnswer(i -> i.getArgument(0));
        when(configuration.getKnowledgeVisibilityMode()).thenReturn(SystemConfigurationService.KNOWLEDGE_VISIBILITY_SHARING);
        when(permissions.hasPermission(actor, KnowledgeVisibilityService.KNOWLEDGE_VIEW_PERMISSION)).thenReturn(true);
    }

    private static UserAccount person(String name) {
        UserAccount user = new UserAccount();
        ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
        user.setFullName(name);
        user.setStatus(UserStatus.Active);
        return user;
    }

    private void headOfDepartment() {
        ReflectionTestUtils.setField(qc, "departmentHead", actor);
    }

    private void delegateOfDepartment() {
        KnowledgeShareDelegate d = new KnowledgeShareDelegate();
        d.setUser(actor);
        d.setDepartment(qc);
        when(delegates.findByDepartment_IdAndUser_Id(qc.getId(), actor.getId())).thenReturn(Optional.of(d));
    }

    // ---- delegates ----

    @Test
    void aDepartmentHeadNamesADelegateAndItIsAuditedWithoutAnyoneElseBeingToldFirst() {
        headOfDepartment();
        UserAccount person = person("Trainer");
        when(users.findById(person.getId())).thenReturn(Optional.of(person));
        var row = delegateService.add(new DelegateRequest("DEPARTMENT", null, qc.getId(), person.getId()));
        assertThat(row.fullName()).isEqualTo("Trainer");
        assertThat(row.scopeLabel()).isEqualTo("Department Quality Control");
        verify(audit).logAs(eq(actor), eq("KNOWLEDGE_SHARE_DELEGATE"), anyString(), any(), eq("CREATED"), any(), eq("Active"), anyString(), anyList());
    }

    @Test
    void aDelegateCannotNameOtherDelegates() {
        delegateOfDepartment();
        UserAccount person = person("Trainer");
        when(users.findById(person.getId())).thenReturn(Optional.of(person));
        assertThatThrownBy(() -> delegateService.add(new DelegateRequest("DEPARTMENT", null, qc.getId(), person.getId())))
                .isInstanceOf(AccessDeniedException.class);
        verify(delegates, never()).save(any(KnowledgeShareDelegate.class));
    }

    @Test
    void aDepartmentHeadCannotNameADelegateForTheWholeUnitButTheHeadOfUnitCan() {
        headOfDepartment();
        UserAccount person = person("Trainer");
        when(users.findById(person.getId())).thenReturn(Optional.of(person));
        assertThatThrownBy(() -> delegateService.add(new DelegateRequest("BUSINESS_UNIT", unit.getId(), null, person.getId())))
                .isInstanceOf(AccessDeniedException.class);
        unit.setHeadOfUnit(actor);
        assertThat(delegateService.add(new DelegateRequest("BUSINESS_UNIT", unit.getId(), null, person.getId())).scopeLabel()).isEqualTo("Business Unit Quality Unit");
    }

    @Test
    void aPersonAlreadyNamedOrNotActiveCannotBeNamedAgain() {
        headOfDepartment();
        UserAccount person = person("Trainer");
        when(users.findById(person.getId())).thenReturn(Optional.of(person));
        when(delegates.findByDepartment_IdAndUser_Id(qc.getId(), person.getId())).thenReturn(Optional.of(new KnowledgeShareDelegate()));
        assertThatThrownBy(() -> delegateService.add(new DelegateRequest("DEPARTMENT", null, qc.getId(), person.getId())))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("already");
        UserAccount inactive = person("Gone");
        inactive.setStatus(UserStatus.Suspended);
        when(users.findById(inactive.getId())).thenReturn(Optional.of(inactive));
        assertThatThrownBy(() -> delegateService.add(new DelegateRequest("DEPARTMENT", null, qc.getId(), inactive.getId())))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void theHeadRemovesADelegateAndTheAuditTrailSaysWhatStays() {
        headOfDepartment();
        KnowledgeShareDelegate d = new KnowledgeShareDelegate();
        ReflectionTestUtils.setField(d, "id", UUID.randomUUID());
        d.setUser(person("Trainer"));
        d.setDepartment(qc);
        when(delegates.findById(d.getId())).thenReturn(Optional.of(d));
        delegateService.remove(d.getId());
        verify(delegates).delete(d);
        ArgumentCaptor<String> comment = ArgumentCaptor.forClass(String.class);
        verify(audit).logAs(eq(actor), eq("KNOWLEDGE_SHARE_DELEGATE"), anyString(), any(), eq("DELETED"), eq("Active"), any(), comment.capture(), anyList());
        assertThat(comment.getValue()).contains("stays until a Head removes it");
    }

    // ---- links: making ----

    private LinkRequest documentLink(Integer days) {
        return new LinkRequest("DOCUMENT", null, null, null, document.getId(), days);
    }

    @Test
    void aLinkIsShownOnceAndOnlyItsHashIsStored() {
        headOfDepartment();
        LinkCreated created = linkService.create(documentLink(30));
        ArgumentCaptor<KnowledgeShareLink> saved = ArgumentCaptor.forClass(KnowledgeShareLink.class);
        verify(links).save(saved.capture());
        KnowledgeShareLink link = saved.getValue();
        assertThat(created.token()).hasSizeGreaterThanOrEqualTo(40);
        assertThat(link.getTokenHash()).isEqualTo(KnowledgeShareLinkService.hash(created.token())).hasSize(64).doesNotContain(created.token());
        assertThat(link.getScopeKind()).isEqualTo("DOCUMENT");
        assertThat(link.getOwnerDepartment()).isSameAs(qc);
        assertThat(link.getCreatedAuthority()).isEqualTo("DEPARTMENT_HEAD");
        assertThat(link.getExpiresAt()).isBetween(Instant.now().plus(29, ChronoUnit.DAYS), Instant.now().plus(31, ChronoUnit.DAYS));
        assertThat(created.link().status()).isEqualTo("ACTIVE");
        verify(audit).logAs(eq(actor), eq("KNOWLEDGE_SHARE_LINK"), anyString(), any(), eq("CREATED"), any(), eq("Active"), anyString(), anyList());
        verify(notifier, never()).tell(any(), any(), anyString(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void twoLinksNeverShareAToken() {
        assertThat(KnowledgeShareLinkService.newToken()).isNotEqualTo(KnowledgeShareLinkService.newToken());
    }

    @Test
    void aLinkExpiresAfterTheChosenNumberOfDaysOrNotAtAllForAHead() {
        headOfDepartment();
        for (int days : new int[] {1, 7, 30, 90}) {
            linkService.create(documentLink(days));
        }
        assertThat(linkService.create(documentLink(null)).link().expiresAt()).isNull();
        assertThatThrownBy(() -> linkService.create(documentLink(5))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> linkService.create(documentLink(0))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aDelegateMustGiveALinkAnExpiryAndTheHeadIsToldWhenHeMakesOne() {
        UserAccount head = person("Head");
        ReflectionTestUtils.setField(qc, "departmentHead", head);
        delegateOfDepartment();
        assertThatThrownBy(() -> linkService.create(documentLink(null))).isInstanceOf(AccessDeniedException.class);
        linkService.create(documentLink(7));
        verify(notifier).tell(eq(List.of(head)), eq(actor), anyString(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void aUserWhoMayNotShareTheItemCannotMakeALink() {
        assertThatThrownBy(() -> linkService.create(documentLink(7))).isInstanceOf(AccessDeniedException.class);
        verify(links, never()).save(any(KnowledgeShareLink.class));
    }

    @Test
    void theHeadOfUnitMakesALinkToTheFolderOfTheWholeUnit() {
        unit.setHeadOfUnit(actor);
        linkService.create(new LinkRequest("BUSINESS_UNIT", unit.getId(), null, null, null, 30));
        ArgumentCaptor<KnowledgeShareLink> saved = ArgumentCaptor.forClass(KnowledgeShareLink.class);
        verify(links).save(saved.capture());
        assertThat(saved.getValue().getOwnerBusinessUnit()).isSameAs(unit);
        assertThat(saved.getValue().getOwnerDepartment()).isNull();
        assertThat(saved.getValue().getCreatedAuthority()).isEqualTo("UNIT_HEAD");
    }

    // ---- links: opening ----

    private KnowledgeShareLink stored(String kind, Instant expires, Instant revoked) {
        KnowledgeShareLink link = new KnowledgeShareLink();
        ReflectionTestUtils.setField(link, "id", UUID.randomUUID());
        link.setScopeKind(kind);
        link.setLabel("SOP.0001 - Balance calibration");
        link.setOwnerDepartment(qc);
        link.setDocument(document);
        link.setCreatedBy(person("Head"));
        link.setCreatedAuthority("DEPARTMENT_HEAD");
        link.setExpiresAt(expires);
        link.setRevokedAt(revoked);
        when(links.findByTokenHash(KnowledgeShareLinkService.hash("good-token"))).thenReturn(Optional.of(link));
        return link;
    }

    @Test
    void aUsableLinkOpensTheDocumentAndRecordsWhoOpenedIt() {
        KnowledgeShareLink link = stored("DOCUMENT", Instant.now().plus(1, ChronoUnit.DAYS), null);
        LinkTarget target = linkService.redeem("good-token");
        assertThat(target.kind()).isEqualTo("DOCUMENT");
        assertThat(target.documentId()).isEqualTo(document.getId());
        assertThat(target.documentNumber()).isEqualTo("SOP.0001");
        ArgumentCaptor<KnowledgeShareLinkRedemption> saved = ArgumentCaptor.forClass(KnowledgeShareLinkRedemption.class);
        verify(redemptions).save(saved.capture());
        assertThat(saved.getValue().getId().getUserId()).isEqualTo(actor.getId());
        assertThat(saved.getValue().getId().getLinkId()).isEqualTo(link.getId());
        verify(audit).logAs(eq(actor), eq("KNOWLEDGE_SHARE_LINK"), anyString(), any(), eq("LINK_OPENED"), any(), any(), anyString(), anyList());
    }

    @Test
    void openingTheSameLinkAgainCountsItAndDoesNotCreateASecondRow() {
        KnowledgeShareLink link = stored("DOCUMENT", null, null);
        KnowledgeShareLinkRedemption existing = new KnowledgeShareLinkRedemption(link.getId(), actor.getId());
        when(redemptions.findById(existing.getId())).thenReturn(Optional.of(existing));
        linkService.redeem("good-token");
        assertThat(existing.getOpenCount()).isEqualTo(2);
    }

    @Test
    void aRevokedAnExpiredAndAnUnknownLinkAnswerTheSameWayAndOpenNothing() {
        stored("DOCUMENT", null, Instant.now().minusSeconds(5));
        assertThatThrownBy(() -> linkService.redeem("good-token")).hasMessage("This link is not valid, has expired or was revoked");
        stored("DOCUMENT", Instant.now().minusSeconds(5), null);
        assertThatThrownBy(() -> linkService.redeem("good-token")).hasMessage("This link is not valid, has expired or was revoked");
        assertThatThrownBy(() -> linkService.redeem("never-existed")).hasMessage("This link is not valid, has expired or was revoked");
        assertThatThrownBy(() -> linkService.redeem(" ")).hasMessage("This link is not valid, has expired or was revoked");
        verify(redemptions, never()).save(any());
    }

    @Test
    void aLinkOpensNothingWithoutTheKnowledgePermissionOrWhileSharingIsOff() {
        stored("DOCUMENT", null, null);
        when(permissions.hasPermission(actor, KnowledgeVisibilityService.KNOWLEDGE_VIEW_PERMISSION)).thenReturn(false);
        assertThatThrownBy(() -> linkService.redeem("good-token")).isInstanceOf(AccessDeniedException.class);
        when(permissions.hasPermission(actor, KnowledgeVisibilityService.KNOWLEDGE_VIEW_PERMISSION)).thenReturn(true);
        when(configuration.getKnowledgeVisibilityMode()).thenReturn(SystemConfigurationService.KNOWLEDGE_VISIBILITY_OWN_DEPARTMENT);
        assertThatThrownBy(() -> linkService.redeem("good-token")).hasMessageContaining("Sharing is not switched on");
        verify(redemptions, never()).save(any());
    }

    @Test
    void aLinkToAFolderLeadsTheExplorerThereWhenTheHierarchyCanSayIt() {
        KnowledgeShareLink link = stored("DEPARTMENT", null, null);
        link.setDocument(null);
        KnowledgeCategoryHierarchy hierarchy = mock(KnowledgeCategoryHierarchy.class);
        ReflectionTestUtils.setField(hierarchy, "id", UUID.randomUUID());
        when(hierarchy.getId()).thenReturn(UUID.randomUUID());
        when(hierarchy.isDefaultHierarchy()).thenReturn(true);
        when(hierarchy.getDeterminatorField()).thenReturn("BUSINESS_UNIT");
        var level = mock(com.eqms.entity.KnowledgeCategoryLevel.class);
        when(level.getFieldCode()).thenReturn("DEPARTMENT");
        when(hierarchy.getLevels()).thenReturn(List.of(level));
        when(hierarchies.findAllByActiveTrueOrderByNameAsc()).thenReturn(List.of(hierarchy));
        LinkTarget target = linkService.redeem("good-token");
        assertThat(target.kind()).isEqualTo("DEPARTMENT");
        assertThat(target.knowledgeBaseKey()).isEqualTo(unit.getId().toString());
        assertThat(target.knowledgeBaseLabel()).isEqualTo("Quality Unit");
        assertThat(target.path()).containsExactly(qc.getId().toString());
    }

    @Test
    void aLinkToAFolderTheHierarchyCannotExpressStillOpensWithoutAPath() {
        KnowledgeShareLink link = stored("DOCUMENT_TYPE", null, null);
        link.setDocument(null);
        DocumentType type = new DocumentType();
        ReflectionTestUtils.setField(type, "id", UUID.randomUUID());
        link.setDocumentType(type);
        KnowledgeCategoryHierarchy hierarchy = mock(KnowledgeCategoryHierarchy.class);
        when(hierarchy.getId()).thenReturn(UUID.randomUUID());
        when(hierarchy.isDefaultHierarchy()).thenReturn(true);
        when(hierarchy.getDeterminatorField()).thenReturn("LANGUAGE");
        when(hierarchy.getLevels()).thenReturn(List.of());
        when(hierarchies.findAllByActiveTrueOrderByNameAsc()).thenReturn(List.of(hierarchy));
        LinkTarget target = linkService.redeem("good-token");
        assertThat(target.knowledgeBaseKey()).isNull();
        assertThat(target.path()).isEmpty();
    }

    // ---- links: revoking ----

    @Test
    void theHeadRevokesAnyLinkOfTheirDepartmentAndTheLinkStopsOpening() {
        headOfDepartment();
        KnowledgeShareLink link = stored("DOCUMENT", null, null);
        when(links.findById(link.getId())).thenReturn(Optional.of(link));
        linkService.revoke(link.getId());
        assertThat(link.getRevokedAt()).isNotNull();
        assertThat(link.getRevokedBy()).isSameAs(actor);
        assertThat(link.isUsable(Instant.now())).isFalse();
        verify(audit).logAs(eq(actor), eq("KNOWLEDGE_SHARE_LINK"), anyString(), any(), eq("REVOKED"), eq("Active"), eq("Revoked"), anyString(), anyList());
        assertThatThrownBy(() -> linkService.redeem("good-token")).hasMessageContaining("not valid");
    }

    @Test
    void aDelegateRevokesOnlyTheLinksHeMadeAndTheHeadIsTold() {
        UserAccount head = person("Head");
        ReflectionTestUtils.setField(qc, "departmentHead", head);
        delegateOfDepartment();
        KnowledgeShareLink heads = stored("DOCUMENT", null, null);
        when(links.findById(heads.getId())).thenReturn(Optional.of(heads));
        assertThatThrownBy(() -> linkService.revoke(heads.getId())).isInstanceOf(AccessDeniedException.class);

        KnowledgeShareLink mine = new KnowledgeShareLink();
        ReflectionTestUtils.setField(mine, "id", UUID.randomUUID());
        mine.setScopeKind("DOCUMENT");
        mine.setLabel("mine");
        mine.setOwnerDepartment(qc);
        mine.setDocument(document);
        mine.setCreatedBy(actor);
        mine.setCreatedAuthority("DELEGATE");
        when(links.findById(mine.getId())).thenReturn(Optional.of(mine));
        linkService.revoke(mine.getId());
        assertThat(mine.getRevokedAt()).isNotNull();
        verify(notifier).tell(eq(List.of(head)), eq(actor), anyString(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void theAdminRevokesAnyLink() {
        when(permissions.hasPermission(actor, ANY)).thenReturn(true);
        KnowledgeShareLink link = stored("DOCUMENT", null, null);
        when(links.findById(link.getId())).thenReturn(Optional.of(link));
        linkService.revoke(link.getId());
        assertThat(link.getRevokedAt()).isNotNull();
    }
}
