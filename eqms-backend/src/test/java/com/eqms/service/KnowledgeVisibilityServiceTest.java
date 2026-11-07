package com.eqms.service;

import com.eqms.entity.Department;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.ObjectAccessRule;
import com.eqms.entity.Position;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DepartmentRepository;
import com.eqms.repository.ObjectAccessRuleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** The single-document decision of Knowledge Base sharing (the list form is exercised against the real database). */
class KnowledgeVisibilityServiceTest {
    private static final String KNOWLEDGE_VIEW = KnowledgeVisibilityService.KNOWLEDGE_VIEW_PERMISSION;

    private final ObjectAccessRuleRepository ruleRepository = mock(ObjectAccessRuleRepository.class);
    private final DepartmentRepository departmentRepository = mock(DepartmentRepository.class);
    private final com.eqms.repository.BusinessUnitRepository unitRepository = mock(com.eqms.repository.BusinessUnitRepository.class);
    private final com.eqms.repository.KnowledgeShareLinkRepository linkRepository = mock(com.eqms.repository.KnowledgeShareLinkRepository.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private KnowledgeVisibilityService service;

    private final UUID unitId = UUID.randomUUID();
    private final UUID qaId = UUID.randomUUID();
    private final UUID qcId = UUID.randomUUID();
    private final UUID docId = UUID.randomUUID();
    private final UUID sopTypeId = UUID.randomUUID();
    private UserAccount user;
    private Department qa;
    private Department qc;

    @BeforeEach
    void setUp() {
        service = new KnowledgeVisibilityService(ruleRepository, departmentRepository, unitRepository, linkRepository, permissions);
        user = new UserAccount();
        ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
        qa = department(qaId);
        qc = department(qcId);
        when(permissions.hasPermission(user, KNOWLEDGE_VIEW)).thenReturn(true);
        when(departmentRepository.findAllByDepartmentHead_Id(any())).thenReturn(List.of());
        when(unitRepository.findAllByHeadOfUnit_Id(any())).thenReturn(List.of());
        when(linkRepository.findUsableOpenedBy(any(), any())).thenReturn(List.of());
        shares();
    }

    private void shares(ObjectAccessRule... rules) {
        when(ruleRepository.findSharesThatMayApply(any(), any(), any(), anyString())).thenReturn(List.of(rules));
    }

    private static Department department(UUID id) {
        Department department = new Department();
        ReflectionTestUtils.setField(department, "id", id);
        return department;
    }

    private static Position position(String name) {
        Position position = new Position();
        ReflectionTestUtils.setField(position, "id", UUID.randomUUID());
        position.setName(name);
        return position;
    }

    private static DocumentRecord documentWithId(UUID id) {
        DocumentRecord document = new DocumentRecord();
        ReflectionTestUtils.setField(document, "id", id);
        return document;
    }

    private KnowledgeVisibilityService.Facts qaSop() {
        return new KnowledgeVisibilityService.Facts(docId, qaId, unitId, sopTypeId);
    }

    private boolean sees(KnowledgeVisibilityService.Facts facts) {
        return service.isVisible(user, facts);
    }

    /** A share owned by {@code owner}; names the user unless changed afterwards. */
    private ObjectAccessRule share(Department owner, String effect, int priority, String type, UUID resourceId) {
        ObjectAccessRule rule = new ObjectAccessRule();
        ReflectionTestUtils.setField(rule, "id", UUID.randomUUID());
        rule.setName("rule-" + priority + effect + type);
        rule.setOwnerDepartment(owner);
        rule.setActions(List.of("VIEW"));
        rule.setEffect(effect);
        rule.setPriority(priority);
        rule.setResourceType(type);
        rule.setResourceId(resourceId);
        rule.setGranteeUsers(new LinkedHashSet<>(Set.of(user)));
        return rule;
    }

    private ObjectAccessRule shareForNobodyInParticular(Department owner, String effect, int priority, String type, UUID resourceId) {
        ObjectAccessRule rule = share(owner, effect, priority, type, resourceId);
        rule.setGranteeUsers(new LinkedHashSet<>());
        return rule;
    }

    @Test
    void closedByDefaultNoShareMeansNoVisibility() {
        assertThat(sees(qaSop())).isFalse();
    }

    @Test
    void withoutTheKnowledgePermissionNothingIsVisibleNotEvenToTheHead() {
        when(permissions.hasPermission(user, KNOWLEDGE_VIEW)).thenReturn(false);
        when(departmentRepository.findAllByDepartmentHead_Id(user.getId())).thenReturn(List.of(qa));
        shares(share(qa, "ALLOW", 10, "DEPARTMENT", qaId));
        assertThat(sees(qaSop())).isFalse();
    }

    @Test
    void theDepartmentHeadSeesEveryDocumentOfThatDepartmentOnly() {
        when(departmentRepository.findAllByDepartmentHead_Id(user.getId())).thenReturn(List.of(qa));
        assertThat(sees(qaSop())).isTrue();
        assertThat(sees(new KnowledgeVisibilityService.Facts(docId, qcId, unitId, sopTypeId))).isFalse();
    }

    @Test
    void aSharedDocumentTypeShowsThatTypeOfThatDepartmentAndNothingElse() {
        shares(share(qa, "ALLOW", 20, "DOCUMENT_TYPE", sopTypeId));
        assertThat(sees(qaSop())).isTrue();
        assertThat(sees(new KnowledgeVisibilityService.Facts(docId, qaId, unitId, UUID.randomUUID()))).as("another type").isFalse();
        // the share belongs to QA: the same type in QC is not covered
        assertThat(sees(new KnowledgeVisibilityService.Facts(docId, qcId, unitId, sopTypeId))).as("another Department").isFalse();
    }

    @Test
    void aSharedWholeDepartmentShowsEveryDocumentOfIt() {
        shares(share(qa, "ALLOW", 10, "DEPARTMENT", qaId));
        assertThat(sees(qaSop())).isTrue();
        assertThat(sees(new KnowledgeVisibilityService.Facts(UUID.randomUUID(), qaId, unitId, UUID.randomUUID()))).isTrue();
        assertThat(sees(new KnowledgeVisibilityService.Facts(docId, qcId, unitId, sopTypeId))).isFalse();
    }

    @Test
    void aShareOfSpecificDocumentsShowsOnlyThose() {
        UUID other = UUID.randomUUID();
        ObjectAccessRule rule = share(qa, "ALLOW", 30, "DOCUMENT", null);
        rule.setDocuments(new LinkedHashSet<>(Set.of(documentWithId(docId))));
        shares(rule);
        assertThat(sees(qaSop())).isTrue();
        assertThat(sees(new KnowledgeVisibilityService.Facts(other, qaId, unitId, sopTypeId))).isFalse();
    }

    @Test
    void anExclusionBeatsAShareOfAnyLevelAndOnlyForItsItem() {
        UUID secret = UUID.randomUUID();
        ObjectAccessRule allowAll = share(qa, "ALLOW", 10, "DEPARTMENT", qaId);
        ObjectAccessRule excludeOne = share(qa, "DENY", 130, "DOCUMENT", null);
        excludeOne.setDocuments(new LinkedHashSet<>(Set.of(documentWithId(secret))));
        shares(allowAll, excludeOne);
        assertThat(sees(new KnowledgeVisibilityService.Facts(secret, qaId, unitId, sopTypeId))).isFalse();
        assertThat(sees(qaSop())).isTrue();
    }

    @Test
    void theHeadIsNotLockedOutByAnExclusionOfTheirOwnDepartment() {
        // the Head sees the whole Department by being its Head, whatever is shared or excluded
        when(departmentRepository.findAllByDepartmentHead_Id(user.getId())).thenReturn(List.of(qa));
        shares(share(qa, "DENY", 110, "DEPARTMENT", qaId));
        assertThat(sees(qaSop())).isTrue();
    }

    @Test
    void aDocumentWithNoDepartmentIsNeverVisibleThroughASharing() {
        shares(share(qa, "ALLOW", 10, "DEPARTMENT", qaId));
        assertThat(sees(new KnowledgeVisibilityService.Facts(docId, null, unitId, sopTypeId))).isFalse();
    }

    @Test
    void aRuleOfAnotherKindOrWithoutAnOwnerIsNotAShare() {
        ObjectAccessRule ordinary = share(qa, "ALLOW", 10, "DEPARTMENT", qaId);
        ordinary.setOwnerDepartment(null);
        ObjectAccessRule statusRule = share(qa, "ALLOW", 10, "DOCUMENT_STATUS", null);
        assertThat(KnowledgeVisibilityService.isKnowledgeShare(ordinary)).isFalse();
        assertThat(KnowledgeVisibilityService.isKnowledgeShare(statusRule)).isFalse();
        shares(ordinary, statusRule);
        assertThat(sees(qaSop())).isFalse();
    }

    // ---- the kinds of grantee ----

    @Test
    void aShareForEveryoneCoversEveryUserWithTheKnowledgePermissionWhateverTheirDepartment() {
        ObjectAccessRule rule = shareForNobodyInParticular(qa, "ALLOW", 10, "DEPARTMENT", qaId);
        rule.setGranteeEveryone(true);
        user.setDepartmentId(qcId);
        assertThat(KnowledgeVisibilityService.appliesToUser(rule, user, null)).isTrue();
        shares(rule);
        assertThat(sees(qaSop())).as("a user of another Department sees it").isTrue();
    }

    @Test
    void aWholeDepartmentShareCoversTheUsersOfTheOwnerDepartmentOnly() {
        ObjectAccessRule rule = shareForNobodyInParticular(qa, "ALLOW", 10, "DEPARTMENT", qaId);
        rule.setGranteeWholeDepartment(true);
        user.setDepartmentId(qcId);
        assertThat(KnowledgeVisibilityService.appliesToUser(rule, user, null)).as("another Department").isFalse();
        user.setDepartmentId(null);
        assertThat(KnowledgeVisibilityService.appliesToUser(rule, user, null)).as("no Department").isFalse();
        user.setDepartmentId(qaId);
        assertThat(KnowledgeVisibilityService.appliesToUser(rule, user, null)).isTrue();
    }

    @Test
    void aShareForOtherDepartmentsCoversTheirUsers() {
        ObjectAccessRule rule = shareForNobodyInParticular(qa, "ALLOW", 10, "DEPARTMENT", qaId);
        rule.setGranteeDepartments(new LinkedHashSet<>(Set.of(qc)));
        user.setDepartmentId(qcId);
        assertThat(KnowledgeVisibilityService.appliesToUser(rule, user, null)).isTrue();
        user.setDepartmentId(UUID.randomUUID());
        assertThat(KnowledgeVisibilityService.appliesToUser(rule, user, null)).isFalse();
        user.setDepartmentId(null);
        assertThat(KnowledgeVisibilityService.appliesToUser(rule, user, null)).isFalse();
    }

    @Test
    void aPositionShareCoversTheHoldersOfThatPositionOnlyIgnoringCaseAndBlanks() {
        ObjectAccessRule rule = shareForNobodyInParticular(qa, "ALLOW", 10, "DEPARTMENT", qaId);
        rule.setGranteePositions(new LinkedHashSet<>(Set.of(position("QC Staff"))));
        user.setPosition("  qc staff ");
        assertThat(KnowledgeVisibilityService.appliesToUser(rule, user, null)).isTrue();
        user.setPosition("QC Supervisor");
        assertThat(KnowledgeVisibilityService.appliesToUser(rule, user, null)).isFalse();
        user.setPosition(null);
        assertThat(KnowledgeVisibilityService.appliesToUser(rule, user, null)).isFalse();
    }

    @Test
    void aShareThatNamesNobodyAppliesToNobody() {
        assertThat(KnowledgeVisibilityService.appliesToUser(shareForNobodyInParticular(qa, "ALLOW", 10, "DEPARTMENT", qaId), user, null)).isFalse();
    }

    @Test
    void theKindsOfGranteeAreAUnion() {
        ObjectAccessRule rule = shareForNobodyInParticular(qa, "ALLOW", 10, "DEPARTMENT", qaId);
        rule.setGranteePositions(new LinkedHashSet<>(Set.of(position("QC Staff"))));
        rule.setGranteeDepartments(new LinkedHashSet<>(Set.of(qc)));
        user.setPosition("Pharmacist");
        user.setDepartmentId(qcId);
        assertThat(KnowledgeVisibilityService.appliesToUser(rule, user, null)).as("by Department only").isTrue();
        user.setDepartmentId(UUID.randomUUID());
        user.setPosition("QC Staff");
        assertThat(KnowledgeVisibilityService.appliesToUser(rule, user, null)).as("by Position only").isTrue();
    }

    @Test
    void aShareThatTheDatabaseReturnedButDoesNotConcernTheUserIsStillIgnored() {
        // the query narrows the shares; the Java test is the authority
        ObjectAccessRule rule = shareForNobodyInParticular(qa, "ALLOW", 10, "DEPARTMENT", qaId);
        rule.setGranteeWholeDepartment(true);
        user.setDepartmentId(qcId);
        shares(rule);
        assertThat(sees(qaSop())).isFalse();
    }

    // ---- Head of Unit, shares owned by a Business Unit, links ----

    private com.eqms.entity.BusinessUnit unit(UUID id) {
        com.eqms.entity.BusinessUnit unit = new com.eqms.entity.BusinessUnit();
        ReflectionTestUtils.setField(unit, "id", id);
        unit.setName("Unit " + id.toString().substring(0, 4));
        return unit;
    }

    private ObjectAccessRule unitShare(com.eqms.entity.BusinessUnit owner, String effect) {
        ObjectAccessRule rule = new ObjectAccessRule();
        ReflectionTestUtils.setField(rule, "id", UUID.randomUUID());
        rule.setName("unit-" + effect);
        rule.setOwnerBusinessUnit(owner);
        rule.setActions(List.of("VIEW"));
        rule.setEffect(effect);
        rule.setPriority("DENY".equals(effect) ? 105 : 5);
        rule.setResourceType("BUSINESS_UNIT");
        rule.setResourceId(owner.getId());
        rule.setGranteeUsers(new LinkedHashSet<>(Set.of(user)));
        return rule;
    }

    private com.eqms.entity.KnowledgeShareLink link(String kind) {
        com.eqms.entity.KnowledgeShareLink link = new com.eqms.entity.KnowledgeShareLink();
        link.setScopeKind(kind);
        link.setLabel("a link");
        switch (kind) {
            case "BUSINESS_UNIT" -> link.setOwnerBusinessUnit(unit(unitId));
            case "DEPARTMENT" -> link.setOwnerDepartment(qa);
            case "DOCUMENT_TYPE" -> {
                link.setOwnerDepartment(qa);
                com.eqms.entity.DocumentType type = new com.eqms.entity.DocumentType();
                ReflectionTestUtils.setField(type, "id", sopTypeId);
                link.setDocumentType(type);
            }
            default -> link.setDocument(documentWithId(docId));
        }
        return link;
    }

    @Test
    void theHeadOfUnitSeesEveryDocumentOfTheUnitAndOnlyOfThatUnit() {
        when(unitRepository.findAllByHeadOfUnit_Id(user.getId())).thenReturn(List.of(unit(unitId)));
        assertThat(sees(qaSop())).isTrue();
        assertThat(service.decide(user, qaSop()).reason()).isEqualTo("UNIT_HEAD");
        assertThat(sees(new KnowledgeVisibilityService.Facts(docId, qaId, UUID.randomUUID(), sopTypeId))).as("another Unit").isFalse();
    }

    @Test
    void aShareOwnedByABusinessUnitCoversEveryDocumentOfThatUnit() {
        shares(unitShare(unit(unitId), "ALLOW"));
        assertThat(sees(qaSop())).isTrue();
        assertThat(sees(new KnowledgeVisibilityService.Facts(UUID.randomUUID(), qcId, unitId, UUID.randomUUID()))).as("another Department of the Unit").isTrue();
        assertThat(sees(new KnowledgeVisibilityService.Facts(docId, qaId, UUID.randomUUID(), sopTypeId))).as("another Unit").isFalse();
    }

    @Test
    void aShareOfAUnitIsOnlyAShareWhenTheOwnerAndTheTargetAgree() {
        ObjectAccessRule unitWithADepartmentTarget = unitShare(unit(unitId), "ALLOW");
        unitWithADepartmentTarget.setResourceType("DEPARTMENT");
        ObjectAccessRule bothOwners = unitShare(unit(unitId), "ALLOW");
        bothOwners.setOwnerDepartment(qa);
        assertThat(KnowledgeVisibilityService.isKnowledgeShare(unitWithADepartmentTarget)).isFalse();
        assertThat(KnowledgeVisibilityService.isKnowledgeShare(bothOwners)).as("one owner at most").isFalse();
        assertThat(KnowledgeVisibilityService.isKnowledgeShare(unitShare(unit(unitId), "ALLOW"))).isTrue();
    }

    @Test
    void everyoneInTheUnitCoversTheUsersOfEveryDepartmentOfTheUnit() {
        ObjectAccessRule rule = unitShare(unit(unitId), "ALLOW");
        rule.setGranteeUsers(new LinkedHashSet<>());
        rule.setGranteeWholeDepartment(true);
        assertThat(KnowledgeVisibilityService.appliesToUser(rule, user, unitId)).isTrue();
        assertThat(KnowledgeVisibilityService.appliesToUser(rule, user, UUID.randomUUID())).isFalse();
        assertThat(KnowledgeVisibilityService.appliesToUser(rule, user, null)).isFalse();
    }

    @Test
    void anExclusionOfTheUnitBeatsAShareOfTheDepartment() {
        shares(unitShare(unit(unitId), "DENY"), share(qa, "ALLOW", 10, "DEPARTMENT", qaId));
        assertThat(sees(qaSop())).isFalse();
        assertThat(service.decide(user, qaSop()).reason()).isEqualTo("EXCLUDED");
    }

    @Test
    void aLinkOpenedByTheUserGivesWhatItCoversWhenNoRuleMatches() {
        when(linkRepository.findUsableOpenedBy(any(), any())).thenReturn(List.of(link("DOCUMENT")));
        assertThat(sees(qaSop())).isTrue();
        assertThat(service.decide(user, qaSop()).reason()).isEqualTo("LINK");
        assertThat(sees(new KnowledgeVisibilityService.Facts(UUID.randomUUID(), qaId, unitId, sopTypeId))).as("another document").isFalse();
    }

    @Test
    void aLinkToAFolderCoversTheDocumentsOfThatFolderOnly() {
        when(linkRepository.findUsableOpenedBy(any(), any())).thenReturn(List.of(link("DOCUMENT_TYPE")));
        assertThat(sees(qaSop())).isTrue();
        assertThat(sees(new KnowledgeVisibilityService.Facts(docId, qaId, unitId, UUID.randomUUID()))).as("another type").isFalse();
        assertThat(sees(new KnowledgeVisibilityService.Facts(docId, qcId, unitId, sopTypeId))).as("another Department").isFalse();

        when(linkRepository.findUsableOpenedBy(any(), any())).thenReturn(List.of(link("BUSINESS_UNIT")));
        service = new KnowledgeVisibilityService(ruleRepository, departmentRepository, unitRepository, linkRepository, permissions);
        assertThat(sees(new KnowledgeVisibilityService.Facts(UUID.randomUUID(), qcId, unitId, UUID.randomUUID()))).as("anything in the Unit").isTrue();
    }

    @Test
    void aLinkNeverBringsBackWhatAnExclusionTookAway() {
        when(linkRepository.findUsableOpenedBy(any(), any())).thenReturn(List.of(link("DOCUMENT")));
        shares(share(qa, "DENY", 130, "DOCUMENT", null));
        ObjectAccessRule exclusion = share(qa, "DENY", 130, "DOCUMENT", null);
        exclusion.setDocuments(new LinkedHashSet<>(Set.of(documentWithId(docId))));
        shares(exclusion);
        assertThat(sees(qaSop())).isFalse();
        assertThat(service.decide(user, qaSop()).reason()).isEqualTo("EXCLUDED");
    }

    @Test
    void aLinkNeedsTheKnowledgePermissionToo() {
        when(permissions.hasPermission(user, KNOWLEDGE_VIEW)).thenReturn(false);
        when(linkRepository.findUsableOpenedBy(any(), any())).thenReturn(List.of(link("DOCUMENT")));
        assertThat(sees(qaSop())).isFalse();
    }
}
