package com.eqms.service;

import com.eqms.entity.BusinessUnit;
import com.eqms.entity.Department;
import com.eqms.entity.KnowledgeShareDelegate;
import com.eqms.entity.ObjectAccessRule;
import com.eqms.entity.UserAccount;
import com.eqms.repository.BusinessUnitRepository;
import com.eqms.repository.DepartmentRepository;
import com.eqms.repository.KnowledgeShareDelegateRepository;
import com.eqms.service.KnowledgeShareAuthorityService.Level;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Who may share the Knowledge Base, at what level, and who may remove what whom made. */
class KnowledgeShareAuthorityServiceTest {
    private static final String ANY = KnowledgeShareAuthorityService.SHARE_ANY_DEPARTMENT_PERMISSION;
    private static final String ALL = KnowledgeShareAuthorityService.MANAGE_ALL_PERMISSION;

    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final DepartmentRepository departments = mock(DepartmentRepository.class);
    private final BusinessUnitRepository units = mock(BusinessUnitRepository.class);
    private final KnowledgeShareDelegateRepository delegates = mock(KnowledgeShareDelegateRepository.class);
    private KnowledgeShareAuthorityService authority;

    private UserAccount actor;
    private BusinessUnit unit;
    private Department qc;
    private Department qa;

    @BeforeEach
    void setUp() {
        authority = new KnowledgeShareAuthorityService(permissions, departments, units, delegates);
        actor = person("Actor");
        unit = new BusinessUnit();
        ReflectionTestUtils.setField(unit, "id", UUID.randomUUID());
        unit.setName("Quality Unit");
        qc = department("Quality Control", unit);
        qa = department("Quality Assurance", unit);
        when(departments.findAllByActiveTrueOrderByNameAsc()).thenReturn(List.of(qa, qc));
        when(units.findAllByActiveTrueOrderByNameAsc()).thenReturn(List.of(unit));
        when(departments.findAllByBusinessUnit_Id(unit.getId())).thenReturn(List.of(qa, qc));
        when(delegates.findByDepartment_IdAndUser_Id(any(), any())).thenReturn(Optional.empty());
        when(delegates.findByBusinessUnit_IdAndUser_Id(any(), any())).thenReturn(Optional.empty());
        when(delegates.findAllByUser_Id(any())).thenReturn(List.of());
    }

    private static UserAccount person(String name) {
        UserAccount user = new UserAccount();
        ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
        user.setFullName(name);
        return user;
    }

    private static Department department(String name, BusinessUnit unit) {
        Department department = new Department();
        ReflectionTestUtils.setField(department, "id", UUID.randomUUID());
        department.setName(name);
        department.setBusinessUnit(unit);
        department.setActive(true);
        return department;
    }

    private void has(String... codes) {
        for (String code : codes) {
            when(permissions.hasPermission(actor, code)).thenReturn(true);
        }
    }

    private KnowledgeShareDelegate delegateOf(Department department, BusinessUnit forUnit) {
        KnowledgeShareDelegate delegate = new KnowledgeShareDelegate();
        delegate.setUser(actor);
        delegate.setDepartment(department);
        delegate.setBusinessUnit(forUnit);
        return delegate;
    }

    // ---- levels ----

    @Test
    void thePermissionsOfTheAdministratorAndOfTheDcoGiveTheAdminLevelEverywhere() {
        has(ANY);
        assertThat(authority.levelOver(actor, qc)).isEqualTo(Level.ADMIN);
        assertThat(authority.levelOver(actor, unit)).isEqualTo(Level.ADMIN);
        when(permissions.hasPermission(actor, ANY)).thenReturn(false);
        has(ALL);
        assertThat(authority.levelOver(actor, qa)).isEqualTo(Level.ADMIN);
    }

    @Test
    void beingNamedDepartmentHeadIsTheWholeGrantAndHeadsOnlyTheirDepartment() {
        // no permission of any kind is held: naming the person in Dictionaries is enough
        ReflectionTestUtils.setField(qc, "departmentHead", actor);
        assertThat(authority.levelOver(actor, qc)).isEqualTo(Level.DEPARTMENT_HEAD);
        when(departments.findAllByDepartmentHead_Id(actor.getId())).thenReturn(List.of(qc));
        assertThat(authority.managed(actor).departmentIds()).containsExactly(qc.getId());
        assertThat(authority.levelOver(actor, qa)).isEqualTo(Level.NONE);
        assertThat(authority.levelOver(actor, unit)).as("not the folder of the Unit").isEqualTo(Level.NONE);
    }

    @Test
    void theHeadOfUnitHeadsTheUnitAndEveryDepartmentInIt() {
        unit.setHeadOfUnit(actor);
        assertThat(authority.levelOver(actor, unit)).isEqualTo(Level.UNIT_HEAD);
        assertThat(authority.levelOver(actor, qc)).isEqualTo(Level.UNIT_HEAD);
        assertThat(authority.levelOver(actor, qa)).isEqualTo(Level.UNIT_HEAD);
        Department other = department("Elsewhere", new BusinessUnit());
        assertThat(authority.levelOver(actor, other)).isEqualTo(Level.NONE);
    }

    @Test
    void theHeadOfUnitOutranksTheDepartmentHeadWhenTheyAreTheSamePerson() {
        unit.setHeadOfUnit(actor);
        ReflectionTestUtils.setField(qc, "departmentHead", actor);
        assertThat(authority.levelOver(actor, qc)).isEqualTo(Level.UNIT_HEAD);
    }

    @Test
    void aDelegateOfADepartmentSharesThatDepartmentOnly() {
        when(delegates.findByDepartment_IdAndUser_Id(qc.getId(), actor.getId())).thenReturn(Optional.of(delegateOf(qc, null)));
        assertThat(authority.levelOver(actor, qc)).isEqualTo(Level.DELEGATE);
        assertThat(authority.levelOver(actor, qa)).isEqualTo(Level.NONE);
        assertThat(authority.levelOver(actor, unit)).as("a Department delegate has no say over the Unit").isEqualTo(Level.NONE);
    }

    @Test
    void aDelegateOfAUnitSharesTheUnitAndItsDepartments() {
        when(delegates.findByBusinessUnit_IdAndUser_Id(unit.getId(), actor.getId())).thenReturn(Optional.of(delegateOf(null, unit)));
        assertThat(authority.levelOver(actor, unit)).isEqualTo(Level.DELEGATE);
        assertThat(authority.levelOver(actor, qc)).isEqualTo(Level.DELEGATE);
    }

    @Test
    void aPersonWithNothingHasNoLevel() {
        assertThat(authority.levelOver(actor, qc)).isEqualTo(Level.NONE);
        assertThat(authority.levelOver(actor, unit)).isEqualTo(Level.NONE);
        assertThat(authority.levelOver(null, qc)).isEqualTo(Level.NONE);
    }

    // ---- what is managed ----

    @Test
    void managedIsEverythingForTheAdminTheUnitAndItsDepartmentsForTheHeadOfUnitAndTheNamedScopeForADelegate() {
        has(ANY);
        assertThat(authority.managed(actor).departmentIds()).containsExactlyInAnyOrder(qa.getId(), qc.getId());
        assertThat(authority.managed(actor).businessUnitIds()).containsExactly(unit.getId());

        when(permissions.hasPermission(actor, ANY)).thenReturn(false);
        when(units.findAllByHeadOfUnit_Id(actor.getId())).thenReturn(List.of(unit));
        assertThat(authority.managed(actor).departmentIds()).containsExactlyInAnyOrder(qa.getId(), qc.getId());
        assertThat(authority.managed(actor).businessUnitIds()).containsExactly(unit.getId());

        when(units.findAllByHeadOfUnit_Id(actor.getId())).thenReturn(List.of());
        when(delegates.findAllByUser_Id(actor.getId())).thenReturn(List.of(delegateOf(qc, null)));
        assertThat(authority.managed(actor).departmentIds()).containsExactly(qc.getId());
        assertThat(authority.managed(actor).businessUnitIds()).isEmpty();
    }

    @Test
    void aUserWithNothingManagesNothing() {
        assertThat(authority.managed(actor).isEmpty()).isTrue();
    }

    // ---- removing what somebody made ----

    private ObjectAccessRule madeBy(Level level, UserAccount maker, Department owner) {
        ObjectAccessRule rule = new ObjectAccessRule();
        ReflectionTestUtils.setField(rule, "id", UUID.randomUUID());
        rule.setOwnerDepartment(owner);
        rule.setCreatedAuthority(level == null ? null : level.name());
        rule.setCreatedBy(maker);
        return rule;
    }

    @Test
    void aDepartmentHeadRemovesWhatADelegateMadeButADelegateNeverRemovesWhatAHeadMade() {
        UserAccount delegate = person("Delegate");
        ReflectionTestUtils.setField(qc, "departmentHead", actor);
        assertThat(authority.mayRemove(actor, madeBy(Level.DELEGATE, delegate, qc))).isTrue();
        assertThat(authority.mayRemove(actor, madeBy(Level.DEPARTMENT_HEAD, actor, qc))).isTrue();

        // the same rule seen by the delegate
        UserAccount asDelegate = delegate;
        when(delegates.findByDepartment_IdAndUser_Id(qc.getId(), asDelegate.getId())).thenReturn(Optional.of(delegateOf(qc, null)));
        assertThat(authority.mayRemove(asDelegate, madeBy(Level.DEPARTMENT_HEAD, actor, qc))).as("made by the Head").isFalse();
        assertThat(authority.mayRemove(asDelegate, madeBy(Level.DELEGATE, asDelegate, qc))).as("made by himself").isTrue();
        assertThat(authority.mayRemove(asDelegate, madeBy(Level.DELEGATE, person("Another delegate"), qc))).as("made by another delegate").isFalse();
    }

    @Test
    void aDepartmentHeadNeverRemovesWhatTheHeadOfUnitMadeButTheHeadOfUnitRemovesWhatADepartmentHeadMade() {
        UserAccount unitHead = person("Head of Unit");
        unit.setHeadOfUnit(unitHead);
        ReflectionTestUtils.setField(qc, "departmentHead", actor);
        assertThat(authority.mayRemove(actor, madeBy(Level.UNIT_HEAD, unitHead, qc))).isFalse();
        assertThat(authority.mayRemove(unitHead, madeBy(Level.DEPARTMENT_HEAD, actor, qc))).isTrue();
    }

    @Test
    void theAdminRemovesEverythingAndAShareOfBeforeTheColumnCountsAsMadeByADepartmentHead() {
        has(ANY);
        assertThat(authority.mayRemove(actor, madeBy(Level.UNIT_HEAD, person("x"), qc))).isTrue();
        assertThat(authority.mayRemove(actor, madeBy(null, person("x"), qc))).isTrue();
        when(permissions.hasPermission(actor, ANY)).thenReturn(false);
        ReflectionTestUtils.setField(qc, "departmentHead", actor);
        assertThat(authority.mayRemove(actor, madeBy(null, person("old"), qc))).as("made before the column: a Department Head's").isTrue();
    }

    @Test
    void somebodyWithNoLevelRemovesNothing() {
        assertThat(authority.mayRemove(actor, madeBy(Level.DELEGATE, actor, qc))).isFalse();
    }

    // ---- who is told ----

    @Test
    void theDepartmentHeadIsToldAndTheHeadOfUnitWhenThereIsNone() {
        UserAccount head = person("Head");
        UserAccount unitHead = person("Head of Unit");
        unit.setHeadOfUnit(unitHead);
        assertThat(authority.headsToTell(qc)).containsExactly(unitHead);
        ReflectionTestUtils.setField(qc, "departmentHead", head);
        assertThat(authority.headsToTell(qc)).containsExactly(head);
        assertThat(authority.headsToTell(unit)).containsExactly(unitHead);
        unit.setHeadOfUnit(null);
        ReflectionTestUtils.setField(qa, "departmentHead", null);
        assertThat(authority.headsToTell(qa)).isEmpty();
        assertThat(authority.headsToTell(unit)).isEmpty();
    }
}
