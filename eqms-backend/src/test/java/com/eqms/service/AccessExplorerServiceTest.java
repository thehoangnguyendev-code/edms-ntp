package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.user.AccessExplorerDtos;
import com.eqms.dto.user.AccessExplorerDtos.HoldersResponse;
import com.eqms.entity.AccessProfilePermissionSet;
import com.eqms.entity.Permission;
import com.eqms.entity.PermissionSet;
import com.eqms.entity.RoleDefinition;
import com.eqms.entity.TimeLimitedUserGrant;
import com.eqms.entity.UserAccessProfile;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.AccessProfilePermissionSetRepository;
import com.eqms.repository.PermissionRepository;
import com.eqms.repository.PermissionSetRepository;
import com.eqms.repository.TimeLimitedUserGrantRepository;
import com.eqms.repository.UserAccessProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * SECURITY-AUTHORIZATION-REVIEW D6: Access Explorer answers "who holds this permission, and through what" from the same chain the sign-in uses (person, ACTIVE access profile,
 * ACTIVE permission set, permission). Read only, and open only to someone who may view users or access profiles.
 */
class AccessExplorerServiceTest {
    private final CurrentUserService current = mock(CurrentUserService.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final PermissionRepository permissionRepo = mock(PermissionRepository.class);
    private final PermissionSetRepository setRepo = mock(PermissionSetRepository.class);
    private final AccessProfilePermissionSetRepository linkRepo = mock(AccessProfilePermissionSetRepository.class);
    private final UserAccessProfileRepository assignmentRepo = mock(UserAccessProfileRepository.class);
    private final TimeLimitedUserGrantRepository limitedRepo = mock(TimeLimitedUserGrantRepository.class);
    private final AccessExplorerService service = new AccessExplorerService(current, permissions, permissionRepo, setRepo, linkRepo, assignmentRepo, limitedRepo);

    private final UserAccount admin = user("admin", "Admin", UserStatus.Active);
    private final Permission target = permission("training.paper.verify", "Verify Paper Training", "training");
    { target.setCategory("Paper records"); }

    @BeforeEach
    void setUp() {
        when(current.requireCurrentUser()).thenReturn(admin);
        when(permissions.hasAnyPermission(admin, "settings.user.view", "security.access_profiles.view")).thenReturn(true);
        when(permissionRepo.findByCode("training.paper.verify")).thenReturn(Optional.of(target));
        when(limitedRepo.findByStatus(TimeLimitedUserGrant.STATUS_ACTIVE)).thenReturn(List.of());
    }

    private static UserAccount user(String username, String fullName, UserStatus status) {
        UserAccount u = new UserAccount();
        u.setId(UUID.randomUUID());
        u.setUsername(username);
        u.setFullName(fullName);
        u.setStatus(status);
        return u;
    }

    private static Permission permission(String code, String name, String module) {
        Permission p = new Permission();
        p.setCode(code);
        p.setName(name);
        p.setModuleKey(module);
        p.setCategory("General");
        return p;
    }

    private static PermissionSet set(String code, String name) {
        PermissionSet s = new PermissionSet();
        ReflectionTestUtils.setField(s, "id", UUID.randomUUID());
        s.setCode(code);
        s.setName(name);
        return s;
    }

    private static RoleDefinition profile(String code, String name, boolean active) {
        RoleDefinition r = new RoleDefinition();
        ReflectionTestUtils.setField(r, "id", UUID.randomUUID());
        r.setCode(code);
        r.setName(name);
        r.setActive(active);
        return r;
    }

    private void link(PermissionSet set, RoleDefinition profile) {
        AccessProfilePermissionSet link = new AccessProfilePermissionSet();
        ReflectionTestUtils.setField(link, "accessProfile", profile);
        ReflectionTestUtils.setField(link, "permissionSet", set);
        when(linkRepo.findByPermissionSetId(set.getId())).thenReturn(List.of(link));
    }

    private void assign(RoleDefinition profile, UserAccount... holders) {
        List<UserAccessProfile> rows = new java.util.ArrayList<>();
        for (UserAccount holder : holders) {
            UserAccessProfile row = new UserAccessProfile();
            ReflectionTestUtils.setField(row, "user", holder);
            rows.add(row);
        }
        when(assignmentRepo.findByAccessProfileId(profile.getId())).thenReturn(rows);
    }

    @Test
    void thePeopleWhoHoldAPermissionAreFoundThroughItsActiveSetsAndActiveProfilesAndEachSaysThroughWhat() {
        PermissionSet verifySet = set("TRAINING_PAPER", "Training Paper");
        RoleDefinition trainer = profile("TRAINER", "Trainer", true);
        UserAccount ann = user("ann", "Ann", UserStatus.Active);
        UserAccount bob = user("bob", "Bob", UserStatus.Suspended);
        when(setRepo.findActiveSetsGrantingCode("training.paper.verify")).thenReturn(List.of(verifySet));
        link(verifySet, trainer);
        assign(trainer, ann, bob);

        HoldersResponse onlyActive = service.whoHolds("training.paper.verify", true, null, 0, 100);
        HoldersResponse everyone = service.whoHolds("training.paper.verify", false, null, 0, 100);

        assertThat(onlyActive.holders()).extracting(h -> h.username()).containsExactly("ann");
        assertThat(onlyActive.holders().get(0).viaProfiles()).containsExactly("Trainer");
        assertThat(onlyActive.holders().get(0).viaPermissionSets()).containsExactly("Training Paper");
        assertThat(onlyActive.permissionSets()).hasSize(1);
        assertThat(onlyActive.permissionSets().get(0).profiles().get(0).holderCount()).isEqualTo(2);
        assertThat(everyone.holders()).extracting(h -> h.username()).containsExactly("ann", "bob");
        assertThat(everyone.holderCount()).isEqualTo(2);
        assertThat(everyone.activeHolderCount()).isEqualTo(1);
        assertThat(everyone.permission().code()).isEqualTo("training.paper.verify");
    }

    @Test
    void aProfileThatIsNotActiveGivesNothingAndAPersonWithTwoRoutesIsListedOnceWithBoth() {
        PermissionSet one = set("A_SET", "Set A");
        PermissionSet two = set("B_SET", "Set B");
        RoleDefinition inactive = profile("OLD", "Old Profile", false);
        RoleDefinition live = profile("LIVE", "Live Profile", true);
        UserAccount cy = user("cy", "Cy", UserStatus.Active);
        when(setRepo.findActiveSetsGrantingCode("training.paper.verify")).thenReturn(List.of(one, two));
        link(one, inactive);
        assign(inactive, user("ghost", "Ghost", UserStatus.Active));
        AccessProfilePermissionSet viaTwo = new AccessProfilePermissionSet();
        ReflectionTestUtils.setField(viaTwo, "accessProfile", live);
        ReflectionTestUtils.setField(viaTwo, "permissionSet", two);
        when(linkRepo.findByPermissionSetId(two.getId())).thenReturn(List.of(viaTwo));
        AccessProfilePermissionSet viaOne = new AccessProfilePermissionSet();
        ReflectionTestUtils.setField(viaOne, "accessProfile", live);
        ReflectionTestUtils.setField(viaOne, "permissionSet", one);
        when(linkRepo.findByPermissionSetId(one.getId())).thenReturn(List.of(viaOne));
        assign(live, cy);

        HoldersResponse response = service.whoHolds("training.paper.verify", true, null, 0, 100);

        assertThat(response.holders()).extracting(h -> h.username()).containsExactly("cy");
        assertThat(response.holders().get(0).viaPermissionSets()).containsExactly("Set A", "Set B");
    }

    @Test
    void theEndOfATimeLimitedAccountIsShownAndAnUnknownPermissionIsRefused() {
        PermissionSet s = set("S", "S");
        RoleDefinition p = profile("P", "P", true);
        UserAccount dee = user("dee", "Dee", UserStatus.Active);
        Instant end = Instant.now().plusSeconds(86400);
        TimeLimitedUserGrant grant = new TimeLimitedUserGrant();
        grant.setUser(dee);
        grant.setEndAt(end);
        when(limitedRepo.findByStatus(TimeLimitedUserGrant.STATUS_ACTIVE)).thenReturn(List.of(grant));
        when(setRepo.findActiveSetsGrantingCode("training.paper.verify")).thenReturn(List.of(s));
        link(s, p);
        assign(p, dee);

        assertThat(service.whoHolds("training.paper.verify", true, null, 0, 100).holders().get(0).timeLimitedUntil()).isEqualTo(end);
        assertThatThrownBy(() -> service.whoHolds("no.such.code", true, null, 0, 100)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Unknown permission");
        assertThatThrownBy(() -> service.whoHolds("  ", true, null, 0, 100)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void theListSearchesWithEveryWordInAnyOrderAndFiltersByModule() {
        List<Permission> all = new java.util.ArrayList<>();
        for (int i = 0; i < 80; i++) all.add(permission("audit.item" + String.format("%02d", i), "Item " + i, "audit"));
        all.add(target);
        all.add(permission("reports.run.create", "Create Report Run", "reports"));
        all.add(permission("system.none", "No module", null));
        when(permissionRepo.findAll()).thenReturn(all);

        assertThat(codes(service.listPermissions("paper", null, null, "code", "asc", 0, 10))).containsExactly("training.paper.verify");
        assertThat(codes(service.listPermissions("REPORT RUN", null, null, "code", "asc", 0, 10))).containsExactly("reports.run.create");
        // the words may come in any order and in different fields
        assertThat(codes(service.listPermissions("verify paper", null, null, "code", "asc", 0, 10))).containsExactly("training.paper.verify");
        assertThat(codes(service.listPermissions("paper verify  training", null, null, "code", "asc", 0, 10))).containsExactly("training.paper.verify");
        assertThat(service.listPermissions("paper reports", null, null, "code", "asc", 0, 10).content()).isEmpty();
        // a module is an exact key, not a word, and is reachable past the first page
        assertThat(codes(service.listPermissions("", " TRAINING ", null, "code", "asc", 0, 10))).containsExactly("training.paper.verify");
        assertThat(service.modules()).containsExactly("audit", "reports", "training");
    }

    @Test
    void theListIsPagedSortedAndCountsHowWidelyEachPermissionIsHeld() {
        List<Permission> all = new java.util.ArrayList<>();
        for (int i = 0; i < 25; i++) all.add(permission("audit.item" + String.format("%02d", i), "Item " + String.format("%02d", i), "audit"));
        all.add(target);
        when(permissionRepo.findAll()).thenReturn(all);
        when(permissionRepo.holderCountsByCode()).thenReturn(List.of(new Object[] {"training.paper.verify", 2L, 4L, 3L, 2L}, new Object[] {"audit.item03", 1L, 1L, 1L, 1L}));

        AccessExplorerDtos.PermissionPage first = service.listPermissions("", null, null, "holderCount", "desc", 0, 10);

        assertThat(first.totalElements()).isEqualTo(26);
        assertThat(first.totalPages()).isEqualTo(3);
        assertThat(first.content()).hasSize(10);
        AccessExplorerDtos.PermissionRow top = first.content().get(0);
        assertThat(top.code()).isEqualTo("training.paper.verify");
        assertThat(top.permissionSetCount()).isEqualTo(2);
        assertThat(top.accessProfileCount()).isEqualTo(4);
        assertThat(top.holderCount()).isEqualTo(3);
        assertThat(top.activeHolderCount()).isEqualTo(2);
        assertThat(first.content().get(1).code()).isEqualTo("audit.item03");
        // the last page has the rest, and a page far past the end is empty, not an error
        assertThat(service.listPermissions("", null, null, "code", "asc", 2, 10).content()).hasSize(6);
        assertThat(service.listPermissions("", null, null, "code", "asc", 9, 10).content()).isEmpty();
        // held / none
        assertThat(codes(service.listPermissions("", null, "held", "code", "asc", 0, 10))).containsExactly("audit.item03", "training.paper.verify");
        assertThat(service.listPermissions("", null, "none", "code", "asc", 0, 100).totalElements()).isEqualTo(24);
        // the page size is capped so one request cannot read everything
        assertThat(service.listPermissions("", null, null, "code", "asc", 0, 100000).size()).isEqualTo(AccessExplorerService.MAX_PAGE_SIZE);
    }

    @Test
    void thePeopleOfAPermissionAreSearchedAndPagedOnTheServer() {
        PermissionSet verifySet = set("TRAINING_PAPER", "Training Paper");
        RoleDefinition trainer = profile("TRAINER", "Trainer", true);
        when(setRepo.findActiveSetsGrantingCode("training.paper.verify")).thenReturn(List.of(verifySet));
        link(verifySet, trainer);
        UserAccount[] people = new UserAccount[12];
        for (int i = 0; i < people.length; i++) {
            people[i] = user("user" + String.format("%02d", i), i == 7 ? "Bao Tran" : "Person " + String.format("%02d", i), UserStatus.Active);
            people[i].setDepartment(i == 7 ? "Packaging" : "QA");
        }
        assign(trainer, people);

        HoldersResponse firstPage = service.whoHolds("training.paper.verify", true, null, 0, 10);
        assertThat(firstPage.holders()).hasSize(10);
        assertThat(firstPage.holderTotal()).isEqualTo(12);
        assertThat(firstPage.totalPages()).isEqualTo(2);
        assertThat(firstPage.holderCount()).isEqualTo(12);
        assertThat(service.whoHolds("training.paper.verify", true, null, 1, 10).holders()).hasSize(2);

        HoldersResponse searched = service.whoHolds("training.paper.verify", true, "packaging bao", 0, 10);
        assertThat(searched.holders()).extracting(h -> h.fullName()).containsExactly("Bao Tran");
        assertThat(searched.holderTotal()).isEqualTo(1);
        // the totals of the permission do not shrink with the search
        assertThat(searched.holderCount()).isEqualTo(12);
        // a person is also found by the profile or the set they hold it through
        assertThat(service.whoHolds("training.paper.verify", true, "trainer", 0, 10).holderTotal()).isEqualTo(12);
        assertThat(service.whoHolds("training.paper.verify", true, "nothing like this", 0, 10).holders()).isEmpty();
    }

    private static List<String> codes(AccessExplorerDtos.PermissionPage page) {
        return page.content().stream().map(AccessExplorerDtos.PermissionRow::code).toList();
    }

    @Test
    void theModuleListAndTheListAreRefusedWithoutTheViewPermissionToo() {
        when(permissions.hasAnyPermission(admin, "settings.user.view", "security.access_profiles.view")).thenReturn(false);

        assertThatThrownBy(() -> service.modules()).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.listPermissions("x", "training", null, null, null, 0, 10)).isInstanceOf(AccessDeniedException.class);
        verify(permissionRepo, never()).findAll();
        verify(permissionRepo, never()).holderCountsByCode();
    }

    @Test
    void someoneWhoMayNeitherViewUsersNorAccessProfilesIsRefusedAndNothingIsRead() {
        when(permissions.hasAnyPermission(admin, "settings.user.view", "security.access_profiles.view")).thenReturn(false);

        assertThatThrownBy(() -> service.whoHolds("training.paper.verify", true, null, 0, 100)).isInstanceOf(AccessDeniedException.class);
                verify(setRepo, never()).findActiveSetsGrantingCode(anyString());
        verify(permissionRepo, never()).findAll();
        verify(assignmentRepo, never()).findByAccessProfileId(any());
    }
}
