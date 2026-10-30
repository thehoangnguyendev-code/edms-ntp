package com.eqms;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.entity.AuditLog;
import com.eqms.entity.UserAccount;
import com.eqms.repository.AuditLogRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AccessProfileService;
import com.eqms.service.AuditTrailService;
import com.eqms.service.training.TrainingProposedParticipantService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class ServerListQueryIntegrationTest {
    @Autowired AccessProfileService profiles;
    @Autowired AuditTrailService audit;
    @Autowired TrainingProposedParticipantService proposal;
    @Autowired com.eqms.service.training.TrainingActivityService training;
    @Autowired com.eqms.service.UserAuthorizationSummaryService authorization;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired UserAccountRepository users;
    @Autowired DocumentRecordRepository documents;
    @Autowired AuditLogRepository logs;
    UserAccount actor;

    @BeforeEach
    void authenticate() {
        actor = users.findByUsername("admin").orElseThrow();
        var principal = new AuthenticatedUser(actor.getId(), UUID.randomUUID(), actor.getUsername(), "USER", Set.of());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
    }

    @Test
    void accessProfileCountsAndNamesAreSortedBeforePagination() {
        for (String key : List.of("name", "type", "permissionSetCount", "assignedUserCount", "createdAt", "updatedAt")) {
            var full = profiles.listProfiles(0, 100, null, null, null, null, null, null, null, key, "desc");
            var first = profiles.listProfiles(0, 1, null, null, null, null, null, null, null, key, "desc");
            var second = profiles.listProfiles(1, 1, null, null, null, null, null, null, null, key, "desc");
            assertThat(first.getTotalElements()).isEqualTo(full.getTotalElements());
            assertThat(first.getContent()).extracting(r -> r.id()).containsExactly(full.getContent().getFirst().id());
            assertThat(second.getContent()).extracting(r -> r.id()).containsExactly(full.getContent().get(1).id());
            if (key.equals("permissionSetCount")) assertThat(full.getContent()).extracting(r -> r.permissionSetCount()).isSortedAccordingTo(java.util.Comparator.reverseOrder());
            if (key.equals("assignedUserCount")) assertThat(full.getContent()).extracting(r -> r.assignedUserCount()).isSortedAccordingTo(java.util.Comparator.reverseOrder());
        }
    }

    @Test
    void scopedAuditFiltersAndCountsBeforePagingWithoutReturningAnotherObjectsRows() {
        var objects = documents.findAll();
        UUID first = objects.getFirst().getId();
        UUID other = objects.get(1).getId();
        String token = "QUERY-" + UUID.randomUUID();
        for (int i = 0; i < 3; i++) {
            AuditLog row = new AuditLog();
            row.setEntityType("DOCUMENT");
            row.setEntityId(i == 2 ? other : first);
            row.setEntityName(token);
            row.setActionType(i == 0 ? "QUERY_A" : "QUERY_B");
            logs.saveAndFlush(row);
        }
        var page = audit.getEntityPage("DOCUMENT", first, false, token, "All", null, null, null, null, "action", "asc", 1, 1);
        assertThat(page.pagination().total()).isEqualTo(2);
        assertThat(page.data()).hasSize(1);
        assertThat(page.data().getFirst().action()).isNotBlank();
        var next = audit.getEntityPage("DOCUMENT", first, false, token, "All", null, null, null, null, "action", "asc", 2, 1);
        assertThat(next.data().getFirst().id()).isNotEqualTo(page.data().getFirst().id());
        assertThat(audit.getEntityPage("DOCUMENT", first, false, token, "All", null, true, null, null, "timestamp", "desc", 1, 10).data()).isEmpty();
    }

    @Test
    void proposedPeopleLookupAppliesGroupAndLiteralSearchBeforePaging() {
        var first = proposal.queryPeople(actor, "", null, null, 1, 1);
        var next = proposal.queryPeople(actor, "", null, null, 2, 1);
        assertThat(first.data()).hasSize(1);
        assertThat(first.pagination().total()).isGreaterThan(1);
        assertThat(first.data().getFirst().get("id")).isNotEqualTo(next.data().getFirst().get("id"));
        String department = (String) first.data().getFirst().get("department");
        if (department != null && !department.isBlank()) {
            var filtered = proposal.queryPeople(actor, "", null, department, 1, 50);
            assertThat(filtered.data()).allSatisfy(p -> assertThat(p.get("department")).isEqualTo(department));
        }
        assertThat(proposal.queryPeople(actor, "QUERY-NOT-A-NAME-%_", null, null, 1, 20).data()).isEmpty();
    }

    @Test
    void participantSqlScopesCountsAndPagesBeforeReturningRows() {
        UUID activity = UUID.randomUUID(), other = UUID.randomUUID(), session = UUID.randomUUID(), secondSession = UUID.randomUUID(), otherSession = UUID.randomUUID();
        UUID dept = jdbc.queryForObject("select id from departments order by id limit 1", UUID.class);
        for (UUID id : List.of(activity, other)) jdbc.update("insert into training_activities(id,training_number,base_number,organizer_department_id,year,serial,kind,status) values(?,?,?,?,2026,999,'UNPLANNED','PLANNED')", id, "Q-" + id, "Q-" + id, dept);
        jdbc.update("insert into training_sessions(id,activity_id,session_no,method,assessment_method) values(?,?,1,'CLASSROOM','TEST'),(?,?,2,'CLASSROOM','TEST'),(?,?,1,'CLASSROOM','TEST')", session, activity, secondSession, activity, otherSession, other);
        var people = users.findAll().stream().limit(4).map(UserAccount::getId).toList();
        insertParticipant(activity, session, people.get(0), "A literal%_", "INVITED", "");
        insertParticipant(activity, session, people.get(1), "B literal%_", "ATTENDED", "");
        insertParticipant(activity, session, people.get(2), "C absent", "INVITED", "planned");
        insertParticipant(activity, secondSession, people.get(0), "Another Session", "INVITED", "");
        insertParticipant(other, otherSession, people.get(0), "Another Activity literal%_", "INVITED", "");
        insertParticipant(activity, session, null, "Outside", "INVITED", "");
        var first = training.participantPage(actor, activity, session, "EMPLOYEES", "literal%_", 1, 1);
        var next = training.participantPage(actor, activity, session, "EMPLOYEES", "literal%_", 2, 1);
        assertThat(first.pagination().total()).isEqualTo(2);
        assertThat(first.data()).extracting(p -> p.get("fullName")).containsExactly("A literal%_");
        assertThat(next.data()).extracting(p -> p.get("fullName")).containsExactly("B literal%_");
        assertThat(training.participantPage(actor, activity, session, "ABSENT", null, 1, 10).data()).extracting(p -> p.get("fullName")).containsExactly("C absent");
        assertThat(training.participantPage(actor, activity, session, "OUTSIDE", null, 1, 10).pagination().total()).isEqualTo(1);
        assertThat(training.participantPage(actor, activity, otherSession, "ALL", null, 1, 10).data()).isEmpty();
        var detail = training.get(actor, activity);
        var thin = training.overview(actor, activity, session, false);
        assertThat((List<?>) detail.get("participants")).hasSize(5);
        assertThat((List<?>) thin.get("participants")).isEmpty();
        assertThat(thin.get("version")).isEqualTo(detail.get("version"));
    }

    private void insertParticipant(UUID activity, UUID session, UUID user, String name, String state, String absence) {
        jdbc.update("insert into training_participants(id,activity_id,session_id,person_user_id,external_name,full_name,state,planned_absence) values(?,?,?,?,?,?,?,?)", UUID.randomUUID(), activity, session, user, user == null ? name : null, name, state, absence);
    }

    @Test void authorizationSearchKeepsAllSelectionIdsAndCountsBeforePaging() {
        var full = authorization.getSummary(actor.getId());
        var page = authorization.querySummary(actor.getId(), "", 1, 1);
        assertThat(page.assignedProfileIds()).containsExactlyElementsOf(full.accessProfiles().stream().map(p -> p.id()).toList());
        assertThat(page.pagination().total()).isEqualTo(full.accessProfiles().size());
        assertThat(page.accessProfiles()).hasSize(Math.min(1, full.accessProfiles().size()));
        var empty = authorization.querySummary(actor.getId(), "NO-MATCH-" + UUID.randomUUID(), 1, 10);
        assertThat(empty.accessProfiles()).isEmpty();
        assertThat(empty.assignedProfileIds()).isEqualTo(page.assignedProfileIds());
        assertThat(empty.effectivePermissionCount()).isEqualTo(full.effectivePermissionCount());
    }

    @Test void assignedUsersPageKeepsAllIdsAndLimitsTheRenderedRows() {
        var profile = profiles.listProfiles(0, 100, null, null, null, null, null, null, null, "assignedUserCount", "desc").getContent().getFirst();
        var full = profiles.getAssignedUsers(profile.id());
        var first = profiles.queryAssignedUsers(profile.id(), 1, 1);
        assertThat((List<?>) first.get("assignedIds")).hasSize(full.size());
        assertThat((List<?>) first.get("data")).hasSize(Math.min(1, full.size()));
        var pagination = (com.eqms.dto.user.PaginationResponse) first.get("pagination");
        assertThat(pagination.total()).isEqualTo(full.size());
        var editor = profiles.getProfileForEditor(profile.id());
        var slim = (com.eqms.dto.settings.AccessProfileDetailResponse) editor.get("profile");
        assertThat(slim.assignedUsers()).isEmpty();
        assertThat((List<?>) editor.get("assignedUserIds")).hasSize(full.size());
        assertThat(slim.permissionSets()).isEqualTo(profiles.getProfile(profile.id()).permissionSets());
        assertThat(slim.updatedAt()).isEqualTo(profiles.getProfile(profile.id()).updatedAt());
    }
}
