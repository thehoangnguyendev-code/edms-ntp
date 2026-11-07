package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.GrantRequest;
import com.eqms.entity.BusinessUnit;
import com.eqms.entity.Department;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.KnowledgeShareDelegate;
import com.eqms.entity.ObjectAccessRule;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.BusinessUnitRepository;
import com.eqms.repository.DepartmentRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentTypeRepository;
import com.eqms.repository.KnowledgeCategoryHierarchyRepository;
import com.eqms.repository.KnowledgeShareDelegateRepository;
import com.eqms.repository.ObjectAccessRuleRepository;
import com.eqms.repository.PositionRepository;
import com.eqms.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

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
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Who may share the Knowledge Base, what a share looks like once made, who is told, and who may take it away. */
class KnowledgeSharingServiceTest {
    private static final String ANY = KnowledgeShareAuthorityService.SHARE_ANY_DEPARTMENT_PERMISSION;

    private final ObjectAccessRuleRepository rules = mock(ObjectAccessRuleRepository.class);
    private final DepartmentRepository departments = mock(DepartmentRepository.class);
    private final BusinessUnitRepository units = mock(BusinessUnitRepository.class);
    private final DocumentTypeRepository types = mock(DocumentTypeRepository.class);
    private final DocumentRecordRepository documents = mock(DocumentRecordRepository.class);
    private final UserAccountRepository users = mock(UserAccountRepository.class);
    private final PositionRepository positions = mock(PositionRepository.class);
    private final KnowledgeCategoryHierarchyRepository hierarchies = mock(KnowledgeCategoryHierarchyRepository.class);
    private final KnowledgeShareDelegateRepository delegates = mock(KnowledgeShareDelegateRepository.class);
    private final CurrentUserService currentUser = mock(CurrentUserService.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final KnowledgeShareNotifier notifier = mock(KnowledgeShareNotifier.class);
    private final AuditTrailService audit = mock(AuditTrailService.class);
    private KnowledgeSharingService service;

    private UserAccount actor;
    private BusinessUnit unit;
    private Department qc;
    private Department qa;
    private DocumentRecord document;

    @BeforeEach
    void setUp() {
        KnowledgeShareAuthorityService authority = new KnowledgeShareAuthorityService(permissions, departments, units, delegates);
        service = new KnowledgeSharingService(rules, departments, units, types, documents, users, positions, hierarchies, delegates, currentUser,
                authority, notifier, audit);
        actor = person("Actor");
        unit = new BusinessUnit();
        ReflectionTestUtils.setField(unit, "id", UUID.randomUUID());
        unit.setName("Quality Unit");
        qc = department("Quality Control");
        qa = department("Quality Assurance");
        document = new DocumentRecord();
        ReflectionTestUtils.setField(document, "id", UUID.randomUUID());
        document.setDocumentNumber("SOP.0001");
        document.setDocumentName("Balance calibration");
        document.setDepartment(qc);
        when(currentUser.requireCurrentUser()).thenReturn(actor);
        when(departments.findAllByActiveTrueOrderByNameAsc()).thenReturn(List.of(qa, qc));
        when(units.findAllByActiveTrueOrderByNameAsc()).thenReturn(List.of(unit));
        when(departments.findAllByBusinessUnit_Id(unit.getId())).thenReturn(List.of(qa, qc));
        when(departments.findById(qc.getId())).thenReturn(Optional.of(qc));
        when(departments.findById(qa.getId())).thenReturn(Optional.of(qa));
        when(units.findById(unit.getId())).thenReturn(Optional.of(unit));
        when(documents.findById(document.getId())).thenReturn(Optional.of(document));
        when(rules.findAllByOwnerDepartment_IdOrderByPriorityDescNameAsc(any())).thenReturn(List.of());
        when(rules.findAllByOwnerBusinessUnit_IdOrderByPriorityDescNameAsc(any())).thenReturn(List.of());
        when(delegates.findByDepartment_IdAndUser_Id(any(), any())).thenReturn(Optional.empty());
        when(delegates.findByBusinessUnit_IdAndUser_Id(any(), any())).thenReturn(Optional.empty());
        when(delegates.findAllByUser_Id(any())).thenReturn(List.of());
        when(delegates.findAllByDepartment_IdOrderByGrantedAtAsc(any())).thenReturn(List.of());
        when(delegates.findAllByBusinessUnit_IdOrderByGrantedAtAsc(any())).thenReturn(List.of());
        when(users.findAllById(anyList())).thenReturn(List.of());
        when(positions.findAllById(anyList())).thenReturn(List.of());
        when(departments.findAllById(anyList())).thenReturn(List.of());
    }

    private static UserAccount person(String name) {
        UserAccount user = new UserAccount();
        ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
        user.setFullName(name);
        user.setStatus(UserStatus.Active);
        return user;
    }

    private Department department(String name) {
        Department department = new Department();
        ReflectionTestUtils.setField(department, "id", UUID.randomUUID());
        department.setName(name);
        department.setActive(true);
        department.setBusinessUnit(unit);
        return department;
    }

    private void has(String... codes) {
        for (String code : codes) {
            when(permissions.hasPermission(actor, code)).thenReturn(true);
        }
    }

    private void headOf(Department department) {
        ReflectionTestUtils.setField(department, "departmentHead", actor);
    }

    private void delegateOf(Department department) {
        KnowledgeShareDelegate delegate = new KnowledgeShareDelegate();
        delegate.setUser(actor);
        delegate.setDepartment(department);
        when(delegates.findByDepartment_IdAndUser_Id(department.getId(), actor.getId())).thenReturn(Optional.of(delegate));
    }

    private GrantRequest documentShare(String effect) {
        return new GrantRequest("DOCUMENT", null, null, null, document.getId(), effect, List.of(), List.of(), List.of(), false, true);
    }

    private ObjectAccessRule saved(int times) {
        ArgumentCaptor<ObjectAccessRule> captor = ArgumentCaptor.forClass(ObjectAccessRule.class);
        verify(rules, times(times)).save(captor.capture());
        return captor.getValue();
    }

    // ---- who may share ----

    @Test
    void aUserWithNoSharingPowerManagesNothing() {
        assertThat(service.managed().departmentIds()).isEmpty();
        assertThat(service.managed().businessUnitIds()).isEmpty();
    }

    @Test
    void thePersonDesignatedAsDcoSharesADocumentOfAnyDepartmentAndItIsOwnedByThatDepartment() {
        has(ANY);
        service.grant(documentShare("ALLOW"));
        ObjectAccessRule rule = saved(1);
        assertThat(rule.getOwnerDepartment()).isSameAs(qc);
        assertThat(rule.getOwnerBusinessUnit()).isNull();
        assertThat(rule.getResourceType()).isEqualTo("DOCUMENT");
        assertThat(rule.getDocuments()).containsExactly(document);
        assertThat(rule.isGranteeEveryone()).isTrue();
        assertThat(rule.getActions()).containsExactly("VIEW");
        assertThat(rule.getCreatedBy()).isSameAs(actor);
        assertThat(rule.getCreatedAuthority()).isEqualTo("ADMIN");
        verify(audit).logAs(eq(actor), eq("OBJECT_ACCESS_RULE"), anyString(), any(), eq("CREATED"), any(), eq("Active"), anyString(), anyList());
        verify(notifier, never()).tell(any(), any(), anyString(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void aUserWhoMayNotShareTheDepartmentOfTheDocumentIsRefusedAndNothingIsSaved() {
        ReflectionTestUtils.setField(qa, "departmentHead", actor);
        assertThatThrownBy(() -> service.grant(documentShare("ALLOW"))).isInstanceOf(AccessDeniedException.class);
        verify(rules, never()).save(any());
    }

    @Test
    void theHeadOfUnitSharesTheWholeUnitAndTheShareIsOwnedByTheUnit() {
        unit.setHeadOfUnit(actor);
        service.grant(new GrantRequest("BUSINESS_UNIT", unit.getId(), null, null, null, "ALLOW", List.of(), List.of(), List.of(), true, false));
        ObjectAccessRule rule = saved(1);
        assertThat(rule.getOwnerBusinessUnit()).isSameAs(unit);
        assertThat(rule.getOwnerDepartment()).isNull();
        assertThat(rule.getResourceType()).isEqualTo("BUSINESS_UNIT");
        assertThat(rule.isGranteeWholeDepartment()).isTrue();
        assertThat(rule.getCreatedAuthority()).isEqualTo("UNIT_HEAD");
        assertThat(rule.getPriority()).isEqualTo(5);
    }

    @Test
    void aDepartmentHeadCannotShareTheFolderOfTheWholeUnit() {
        headOf(qc);
        assertThatThrownBy(() -> service.grant(new GrantRequest("BUSINESS_UNIT", unit.getId(), null, null, null, "ALLOW", List.of(), List.of(), List.of(), false, true)))
                .isInstanceOf(AccessDeniedException.class);
        verify(rules, never()).save(any());
    }

    @Test
    void theHeadOfUnitSharesAnyDepartmentOfTheUnit() {
        unit.setHeadOfUnit(actor);
        service.grant(new GrantRequest("DEPARTMENT", null, qa.getId(), null, null, "ALLOW", List.of(), List.of(), List.of(), false, true));
        assertThat(saved(1).getOwnerDepartment()).isSameAs(qa);
    }

    // ---- priorities ----

    @Test
    void aNarrowerItemRanksAboveAWiderOneAndAnExclusionAboveEveryShare() {
        has(ANY);
        service.grant(documentShare("ALLOW"));
        service.grant(documentShare("DENY"));
        service.grant(new GrantRequest("DEPARTMENT", null, qc.getId(), null, null, "ALLOW", List.of(), List.of(), List.of(), false, true));
        ArgumentCaptor<ObjectAccessRule> saved = ArgumentCaptor.forClass(ObjectAccessRule.class);
        verify(rules, times(3)).save(saved.capture());
        List<ObjectAccessRule> made = saved.getAllValues();
        assertThat(made.get(0).getPriority()).as("share of a document").isEqualTo(30);
        assertThat(made.get(1).getPriority()).as("exclusion of a document").isEqualTo(130);
        assertThat(made.get(2).getPriority()).as("share of the Department").isEqualTo(10);
    }

    @Test
    void aShareForNobodyIsRefused() {
        has(ANY);
        GrantRequest nobody = new GrantRequest("DOCUMENT", null, null, null, document.getId(), "ALLOW", List.of(), List.of(), List.of(), false, false);
        assertThatThrownBy(() -> service.grant(nobody)).isInstanceOf(IllegalArgumentException.class);
        verify(rules, never()).save(any());
    }

    // ---- delegates ----

    @Test
    void aDelegateSharesLikeTheHeadButTheShareCarriesTheDelegateLevelAndTheHeadIsToldAndTheAuditTrailKnows() {
        UserAccount head = person("Head");
        ReflectionTestUtils.setField(qc, "departmentHead", head);
        delegateOf(qc);
        service.grant(documentShare("ALLOW"));
        assertThat(saved(1).getCreatedAuthority()).isEqualTo("DELEGATE");
        ArgumentCaptor<String> comment = ArgumentCaptor.forClass(String.class);
        verify(audit).logAs(eq(actor), eq("OBJECT_ACCESS_RULE"), anyString(), any(), eq("CREATED"), any(), eq("Active"), comment.capture(), anyList());
        assertThat(comment.getValue()).contains("on behalf of the Head");
        verify(notifier).tell(eq(List.of(head)), eq(actor), anyString(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void aDelegateCannotExclude() {
        delegateOf(qc);
        assertThatThrownBy(() -> service.grant(documentShare("DENY"))).isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("cannot exclude");
        verify(rules, never()).save(any());
    }

    @Test
    void aDelegateOfADepartmentCannotShareAnotherDepartment() {
        delegateOf(qa);
        assertThatThrownBy(() -> service.grant(documentShare("ALLOW"))).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void aHeadSharingIsNotReportedToAnyone() {
        headOf(qc);
        service.grant(documentShare("ALLOW"));
        verify(notifier, never()).tell(any(), any(), anyString(), anyString(), anyString(), anyString(), anyString());
    }

    // ---- taking a share away ----

    private ObjectAccessRule existingShare(Department owner, String madeBy, UserAccount maker) {
        ObjectAccessRule rule = new ObjectAccessRule();
        ReflectionTestUtils.setField(rule, "id", UUID.randomUUID());
        rule.setName("Share: x");
        rule.setOwnerDepartment(owner);
        rule.setResourceType("DEPARTMENT");
        rule.setResourceName(owner.getName());
        rule.setEffect("ALLOW");
        rule.setGranteeEveryone(true);
        rule.setCreatedAuthority(madeBy);
        rule.setCreatedBy(maker);
        when(rules.findById(rule.getId())).thenReturn(Optional.of(rule));
        return rule;
    }

    @Test
    void thePersonWhoIsNotTheHeadMayTakeAShareAwayAndTheAuditTrailNamesThem() {
        has(ANY);
        ObjectAccessRule rule = existingShare(qc, "DEPARTMENT_HEAD", person("Head"));
        service.revoke(rule.getId());
        verify(rules).delete(rule);
        ArgumentCaptor<String> comment = ArgumentCaptor.forClass(String.class);
        verify(audit).logAs(eq(actor), eq("OBJECT_ACCESS_RULE"), anyString(), any(), eq("DELETED"), eq("Active"), any(), comment.capture(), anyList());
        assertThat(comment.getValue()).contains("Actor").contains("who is not the Department Head");
    }

    @Test
    void theHeadTakesTheirOwnShareAwayWithoutTheNote() {
        headOf(qc);
        ObjectAccessRule rule = existingShare(qc, "DEPARTMENT_HEAD", actor);
        service.revoke(rule.getId());
        ArgumentCaptor<String> comment = ArgumentCaptor.forClass(String.class);
        verify(audit).logAs(eq(actor), eq("OBJECT_ACCESS_RULE"), anyString(), any(), eq("DELETED"), eq("Active"), any(), comment.capture(), anyList());
        assertThat(comment.getValue()).doesNotContain("not the Department Head");
    }

    @Test
    void aDelegateCannotTakeAwayWhatTheHeadSharedButCanTakeAwayWhatHeSharedHimselfAndTheHeadIsTold() {
        UserAccount head = person("Head");
        ReflectionTestUtils.setField(qc, "departmentHead", head);
        delegateOf(qc);
        ObjectAccessRule heads = existingShare(qc, "DEPARTMENT_HEAD", head);
        assertThatThrownBy(() -> service.revoke(heads.getId())).isInstanceOf(AccessDeniedException.class);
        verify(rules, never()).delete(any());

        ObjectAccessRule mine = existingShare(qc, "DELEGATE", actor);
        service.revoke(mine.getId());
        verify(rules).delete(mine);
        verify(notifier).tell(eq(List.of(head)), eq(actor), anyString(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void aDelegateCannotTakeAwayWhatAnotherDelegateShared() {
        delegateOf(qc);
        ObjectAccessRule theirs = existingShare(qc, "DELEGATE", person("Another"));
        assertThatThrownBy(() -> service.revoke(theirs.getId())).isInstanceOf(AccessDeniedException.class);
        verify(rules, never()).delete(any());
    }

    @Test
    void aDepartmentHeadCannotTakeAwayWhatTheHeadOfUnitShared() {
        headOf(qc);
        ObjectAccessRule rule = existingShare(qc, "UNIT_HEAD", person("Head of Unit"));
        assertThatThrownBy(() -> service.revoke(rule.getId())).isInstanceOf(AccessDeniedException.class);
        verify(rules, never()).delete(any());
    }

    // ---- the explorer's Node ----

    @Test
    void theNodeTellsTheUiWhatTheUserMayDo() {
        headOf(qc);
        var head = service.access("DEPARTMENT", null, qc.getId(), null, null).node();
        assertThat(head.level()).isEqualTo("DEPARTMENT_HEAD");
        assertThat(head.canExclude()).isTrue();
        assertThat(head.canManageDelegates()).isTrue();
    }

    @Test
    void aDelegateSeesTheNodeWithoutExcludingOrNamingDelegates() {
        delegateOf(qc);
        var node = service.access("DEPARTMENT", null, qc.getId(), null, null).node();
        assertThat(node.level()).isEqualTo("DELEGATE");
        assertThat(node.canExclude()).isFalse();
        assertThat(node.canManageDelegates()).isFalse();
    }

    // ---- who has access, one row each; taking one person out ----

    private ObjectAccessRule shareWithPeople(Department owner, String madeBy, UserAccount maker, UserAccount... people) {
        ObjectAccessRule rule = existingShare(owner, madeBy, maker);
        rule.setGranteeEveryone(false);
        for (UserAccount p : people) {
            rule.getGranteeUsers().add(p);
        }
        when(rules.findAllByOwnerDepartment_IdOrderByPriorityDescNameAsc(owner.getId())).thenReturn(List.of(rule));
        return rule;
    }

    @Test
    void theAccessListHasARowForEachPersonAndIsReadAPageAtATimeAndSearched() {
        headOf(qc);
        ObjectAccessRule rule = shareWithPeople(qc, "DEPARTMENT_HEAD", actor, person("Anna"), person("Binh"), person("Chi"));
        var all = service.people("DEPARTMENT", null, qc.getId(), null, null, null, false, 0, 20);
        assertThat(all.total()).isEqualTo(3);
        assertThat(all.items()).extracting(r -> r.label()).containsExactly("Anna", "Binh", "Chi");
        assertThat(all.items()).allMatch(r -> r.removable() && r.ruleId().equals(rule.getId()) && r.granteeType().equals("USER"));

        var second = service.people("DEPARTMENT", null, qc.getId(), null, null, null, false, 2, 2);
        assertThat(second.total()).isEqualTo(3);
        assertThat(second.items()).extracting(r -> r.label()).containsExactly("Chi");

        var found = service.people("DEPARTMENT", null, qc.getId(), null, null, "bin", false, 0, 20);
        assertThat(found.items()).extracting(r -> r.label()).containsExactly("Binh");
        assertThat(found.total()).isEqualTo(1);
    }

    @Test
    void aDelegateIsMarkedInTheAccessListAndCannotRemoveARowOfTheHeadsShare() {
        UserAccount head = person("Head");
        ReflectionTestUtils.setField(qc, "departmentHead", head);
        delegateOf(qc);
        UserAccount anna = person("Anna");
        shareWithPeople(qc, "DEPARTMENT_HEAD", head, anna);
        var rows = service.people("DEPARTMENT", null, qc.getId(), null, null, null, false, 0, 20);
        assertThat(rows.items()).hasSize(1);
        assertThat(rows.items().get(0).removable()).isFalse();
    }

    @Test
    void takingOnePersonOutLeavesTheOthersInTheShareAndIsRecorded() {
        headOf(qc);
        UserAccount anna = person("Anna");
        UserAccount binh = person("Binh");
        ObjectAccessRule rule = shareWithPeople(qc, "DEPARTMENT_HEAD", actor, anna, binh);
        service.revokeGrantee(rule.getId(), "USER", anna.getId());
        assertThat(rule.getGranteeUsers()).containsExactly(binh);
        verify(rules).save(rule);
        verify(rules, never()).delete(any());
        ArgumentCaptor<String> comment = ArgumentCaptor.forClass(String.class);
        verify(audit).logAs(eq(actor), eq("OBJECT_ACCESS_RULE"), anyString(), any(), eq("UPDATED"), eq("Active"), any(), comment.capture(), anyList());
        assertThat(comment.getValue()).contains("Anna");
    }

    @Test
    void takingTheLastPersonOutRemovesTheWholeShare() {
        headOf(qc);
        UserAccount anna = person("Anna");
        ObjectAccessRule rule = shareWithPeople(qc, "DEPARTMENT_HEAD", actor, anna);
        service.revokeGrantee(rule.getId(), "USER", anna.getId());
        verify(rules).delete(rule);
    }

    @Test
    void aDelegateCannotTakeAPersonOutOfTheHeadsShareAndAnUnknownPersonIsRefused() {
        UserAccount head = person("Head");
        ReflectionTestUtils.setField(qc, "departmentHead", head);
        delegateOf(qc);
        UserAccount anna = person("Anna");
        ObjectAccessRule heads = shareWithPeople(qc, "DEPARTMENT_HEAD", head, anna, person("Binh"));
        assertThatThrownBy(() -> service.revokeGrantee(heads.getId(), "USER", anna.getId())).isInstanceOf(AccessDeniedException.class);
        assertThat(heads.getGranteeUsers()).hasSize(2);

        headOf(qc);
        ObjectAccessRule mine = shareWithPeople(qc, "DEPARTMENT_HEAD", actor, anna, person("Binh"));
        assertThatThrownBy(() -> service.revokeGrantee(mine.getId(), "USER", UUID.randomUUID())).isInstanceOf(IllegalArgumentException.class);
    }

    // ---- naming a person who may share: only the people of the scope ----

    @Test
    void aPersonWhoIsNotAHeadCannotSearchPeopleOfAScope() {
        delegateOf(qc);
        assertThatThrownBy(() -> service.searchUsers("a", 20, 0, "DEPARTMENT", null, qc.getId())).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void aDepartmentHeadCannotSearchTheWholeUnit() {
        headOf(qc);
        assertThatThrownBy(() -> service.searchUsers("a", 20, 0, "BUSINESS_UNIT", unit.getId(), null)).isInstanceOf(AccessDeniedException.class);
    }
}
