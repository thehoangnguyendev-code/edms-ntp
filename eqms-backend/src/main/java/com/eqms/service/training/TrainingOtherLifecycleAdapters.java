package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.repository.WorkflowActionPolicyRelationRepository;
import com.eqms.service.WorkflowActionPolicyService;
import com.eqms.service.authorization.PolicyBackedAdapter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The adapters of the other lifecycles of Training (V812): the participant of an activity, the assessment library, the job assignment, the personnel review, the export of a personal record and of a
 * department's batch, the trainer exception, the work suspension, the approval of an external vendor and the voiding of a training record. Each mirrors the checks of its service
 * (AUTHORIZATION_ACTION_CATALOG_TRAINING_AS_IS_2026_11_18): the permission is the policy, and what is left is the facts of the record, the department the action is limited to, and the relations of the
 * actor (the person it is about, the person who prepared or created it, the person designated).
 */
@Configuration
public class TrainingOtherLifecycleAdapters {

    /** The common part: the department rule of Training and the helper that builds the relation set. */
    abstract static class Base extends PolicyBackedAdapter {
        final TrainingAccess access;

        Base(JdbcTemplate jdbc, TrainingAccess access, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations, String workflow, String type) {
            super(jdbc, policies, relations, "TRAINING", workflow, type);
            this.access = access;
        }

        /** The actions that are not limited to a department (the relation, or nothing, carries the rule). */
        Set<String> unscoped() {
            return Set.of();
        }

        @Override
        public boolean isWithinObjectScope(UserAccount actor, UUID resourceId, String action) {
            Facts facts = facts(actor, resourceId);
            if (facts == null) return false;
            return unscoped().contains(action) || access.inScope(actor, facts.departmentId());
        }

        /** The department of a person, matched by name as the user table keeps it; null when it cannot be matched. */
        UUID departmentOfPerson(UUID personId) {
            if (personId == null) return null;
            Map<String, Object> row = one(jdbc.queryForList("select d.id from departments d join app_users u on lower(trim(d.name)) = lower(trim(u.department)) where u.id = ?", personId));
            return row == null ? null : (UUID) row.get("id");
        }

        /** The scope of a record that is about a person: every department for a person who holds the scope of all, else the department of that person. */
        boolean inScopeOfPerson(UserAccount actor, UUID personId) {
            if (access.allDepartments(actor)) return true;
            UUID department = departmentOfPerson(personId);
            return department != null && access.inScope(actor, department);
        }
    }

    @Bean
    PolicyBackedAdapter trainingParticipantAdapter(JdbcTemplate jdbc, TrainingAccess access, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations) {
        return new Base(jdbc, access, policies, relations, "TRAINING_PARTICIPANT", "TRAINING_PARTICIPANT") {
            @Override protected String table() { return "training_participants"; }

            /** The state of a participant action is the state of its activity. */
            @Override protected String stateSql() { return "select a.status from training_participants p join training_activities a on a.id = p.activity_id where p.id = ?"; }

            @Override Set<String> unscoped() { return Set.of("CONFIRM_READ"); }

            @Override protected Facts facts(UserAccount actor, UUID id) {
                Map<String, Object> p = one(jdbc.queryForList("select p.person_user_id, a.organizer_department_id from training_participants p join training_activities a on a.id = p.activity_id where p.id = ?", id));
                if (p == null || actor == null || actor.getId() == null) return null;
                Set<String> relations = new HashSet<>();
                if (actor.getId().equals(p.get("person_user_id"))) relations.add("SELF");
                if (access.has(actor, "training.activity.conduct", "training.activity.organize")) relations.add("CONDUCTOR");
                return new Facts((UUID) p.get("organizer_department_id"), relations);
            }
        };
    }

    @Bean
    PolicyBackedAdapter trainingAssessmentAdapter(JdbcTemplate jdbc, TrainingAccess access, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations) {
        return new Base(jdbc, access, policies, relations, "TRAINING_ASSESSMENT", "TRAINING_ASSESSMENT") {
            @Override protected String table() { return "training_assessment_defs"; }

            /** The library has no department: whoever holds the permission acts. */
            @Override public boolean isWithinObjectScope(UserAccount actor, UUID resourceId, String action) { return facts(actor, resourceId) != null; }

            @Override protected Facts facts(UserAccount actor, UUID id) {
                Map<String, Object> d = one(jdbc.queryForList("select created_by, updated_by, submitted_by from training_assessment_defs where id = ?", id));
                if (d == null || actor == null || actor.getId() == null) return null;
                UUID me = actor.getId();
                Set<String> relations = new HashSet<>();
                if (me.equals(d.get("created_by"))) relations.add("CREATOR");
                if (me.equals(d.get("updated_by"))) relations.add("UPDATER");
                if (me.equals(d.get("submitted_by"))) relations.add("SUBMITTER");
                // May manage this assessment: every one for manage_all, or the one this person created for manage (the rule of the permissions, see TrainingAssessmentLibraryService)
                boolean canManage = access.has(actor, "training.assessment.manage_all") || (access.has(actor, "training.assessment.manage") && me.equals(d.get("created_by")));
                if (canManage) relations.add("CAN_MANAGE");
                if (canManage || access.has(actor, "training.assessment.approve")) relations.add("DESIGNER_OR_APPROVER");
                return new Facts(null, relations);
            }
        };
    }

    @Bean
    PolicyBackedAdapter trainingJobAssignmentAdapter(JdbcTemplate jdbc, TrainingAccess access, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations) {
        return new Base(jdbc, access, policies, relations, "TRAINING_JOB_ASSIGNMENT", "TRAINING_JOB_ASSIGNMENT") {
            @Override protected String table() { return "training_job_assignments"; }

            /** The person assigned accepts with no department rule: the relation is the rule. */
            @Override Set<String> unscoped() { return Set.of("ACCEPT"); }

            @Override protected Facts facts(UserAccount actor, UUID id) {
                Map<String, Object> j = one(jdbc.queryForList("select department_id, person_user_id, created_by from training_job_assignments where id = ?", id));
                if (j == null || actor == null || actor.getId() == null) return null;
                UUID me = actor.getId();
                Set<String> relations = new HashSet<>();
                if (me.equals(j.get("person_user_id"))) relations.add("RECEIVER");
                if (me.equals(j.get("created_by"))) relations.add("CREATOR");
                if (pendingAssignees("TRAINING_JOB_ASSIGNMENT", id, "JOB_ASSIGN_EXCEPTION").contains(me)) relations.add("EXCEPTION_ASSIGNEE");
                return new Facts((UUID) j.get("department_id"), relations);
            }
        };
    }

    @Bean
    PolicyBackedAdapter trainingPersonnelReviewAdapter(JdbcTemplate jdbc, TrainingAccess access, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations) {
        return new Base(jdbc, access, policies, relations, "TRAINING_PERSONNEL_REVIEW", "TRAINING_PERSONNEL_REVIEW") {
            @Override protected String table() { return "training_personnel_reviews"; }

            /** The scope is the department of the person reviewed (every department for a person who holds the scope of all). */
            @Override public boolean isWithinObjectScope(UserAccount actor, UUID resourceId, String action) {
                Map<String, Object> r = one(jdbc.queryForList("select person_user_id from training_personnel_reviews where id = ?", resourceId));
                return r != null && inScopeOfPerson(actor, (UUID) r.get("person_user_id"));
            }

            @Override protected Facts facts(UserAccount actor, UUID id) {
                Map<String, Object> r = one(jdbc.queryForList("select person_user_id from training_personnel_reviews where id = ?", id));
                if (r == null || actor == null || actor.getId() == null) return null;
                UUID me = actor.getId();
                Set<String> relations = new HashSet<>();
                if (me.equals(r.get("person_user_id"))) relations.add("SUBJECT");
                Set<UUID> closers = pendingAssignees("TRAINING_PERSONNEL_REVIEW", id, "REVIEW_CLOSE");
                if (closers.isEmpty() || closers.contains(me)) relations.add("CLOSER_OK");
                if (access.has(actor, "training.approval.reassign")) relations.add("REASSIGN_RIGHT");
                return new Facts(null, relations);
            }
        };
    }

    @Bean
    PolicyBackedAdapter trainingRecordExportAdapter(JdbcTemplate jdbc, TrainingAccess access, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations) {
        return new Base(jdbc, access, policies, relations, "TRAINING_RECORD_EXPORT", "TRAINING_RECORD_EXPORT") {
            @Override protected String table() { return "training_record_exports"; }

            @Override public boolean isWithinObjectScope(UserAccount actor, UUID resourceId, String action) {
                Map<String, Object> e = one(jdbc.queryForList("select person_user_id from training_record_exports where id = ?", resourceId));
                return e != null && inScopeOfPerson(actor, (UUID) e.get("person_user_id"));
            }

            @Override protected Facts facts(UserAccount actor, UUID id) {
                Map<String, Object> e = one(jdbc.queryForList("select prepared_by from training_record_exports where id = ?", id));
                if (e == null || actor == null || actor.getId() == null) return null;
                UUID me = actor.getId();
                Set<String> relations = new HashSet<>();
                if (me.equals(e.get("prepared_by"))) relations.add("PREPARER");
                if (pendingAssignees("TRAINING_RECORD_EXPORT", id, "RECORD_EXPORT_APPROVE").contains(me)) relations.add("APPROVAL_ASSIGNEE");
                return new Facts(null, relations);
            }
        };
    }

    @Bean
    PolicyBackedAdapter trainingRecordExportBatchAdapter(JdbcTemplate jdbc, TrainingAccess access, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations) {
        return new Base(jdbc, access, policies, relations, "TRAINING_RECORD_EXPORT_BATCH", "TRAINING_RECORD_EXPORT_BATCH") {
            @Override protected String table() { return "training_record_export_batches"; }

            @Override protected Facts facts(UserAccount actor, UUID id) {
                Map<String, Object> b = one(jdbc.queryForList("select department_id, prepared_by from training_record_export_batches where id = ?", id));
                if (b == null || actor == null || actor.getId() == null) return null;
                UUID me = actor.getId();
                Set<String> relations = new HashSet<>();
                if (me.equals(b.get("prepared_by"))) relations.add("PREPARER");
                if (pendingAssignees("TRAINING_RECORD_EXPORT_BATCH", id, "RECORD_EXPORT_APPROVE").contains(me)) relations.add("APPROVAL_ASSIGNEE");
                return new Facts((UUID) b.get("department_id"), relations);
            }
        };
    }

    @Bean
    PolicyBackedAdapter trainingTrainerExceptionAdapter(JdbcTemplate jdbc, TrainingAccess access, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations) {
        return new Base(jdbc, access, policies, relations, "TRAINING_TRAINER_EXCEPTION", "TRAINING_TRAINER_EXCEPTION") {
            @Override protected String table() { return "training_trainer_exceptions"; }

            @Override protected Facts facts(UserAccount actor, UUID id) {
                Map<String, Object> e = one(jdbc.queryForList(
                        "select a.organizer_department_id, x.requested_by, x.trainer_user_id from training_trainer_exceptions x join training_activities a on a.id = x.activity_id where x.id = ?", id));
                if (e == null || actor == null || actor.getId() == null) return null;
                UUID me = actor.getId();
                Set<String> relations = new HashSet<>();
                if (me.equals(e.get("requested_by"))) relations.add("REQUESTER");
                if (me.equals(e.get("trainer_user_id"))) relations.add("TRAINER");
                if (pendingAssignees("TRAINING_TRAINER_EXCEPTION", id, "TRAINER_EXCEPTION").contains(me)) relations.add("APPROVAL_ASSIGNEE");
                return new Facts((UUID) e.get("organizer_department_id"), relations);
            }
        };
    }

    @Bean
    PolicyBackedAdapter trainingSuspensionAdapter(JdbcTemplate jdbc, TrainingAccess access, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations) {
        return new Base(jdbc, access, policies, relations, "TRAINING_SUSPENSION", "TRAINING_SUSPENSION") {
            @Override protected String table() { return "training_work_suspensions"; }

            @Override public boolean isWithinObjectScope(UserAccount actor, UUID resourceId, String action) {
                Map<String, Object> s = one(jdbc.queryForList("select person_user_id from training_work_suspensions where id = ?", resourceId));
                return s != null && inScopeOfPerson(actor, (UUID) s.get("person_user_id"));
            }

            @Override protected Facts facts(UserAccount actor, UUID id) {
                Map<String, Object> s = one(jdbc.queryForList("select person_user_id from training_work_suspensions where id = ?", id));
                if (s == null || actor == null || actor.getId() == null) return null;
                Set<String> relations = new HashSet<>();
                if (actor.getId().equals(s.get("person_user_id"))) relations.add("SUBJECT");
                return new Facts(null, relations);
            }
        };
    }

    @Bean
    PolicyBackedAdapter trainingVendorAdapter(JdbcTemplate jdbc, TrainingAccess access, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations) {
        return new Base(jdbc, access, policies, relations, "TRAINING_VENDOR", "TRAINING_VENDOR") {
            @Override protected String table() { return "training_approved_providers"; }

            /** The register of vendors has no department. */
            @Override public boolean isWithinObjectScope(UserAccount actor, UUID resourceId, String action) { return facts(actor, resourceId) != null; }

            @Override protected Facts facts(UserAccount actor, UUID id) {
                Map<String, Object> v = one(jdbc.queryForList("select created_by from training_approved_providers where id = ?", id));
                if (v == null || actor == null || actor.getId() == null) return null;
                Set<String> relations = new HashSet<>();
                if (actor.getId().equals(v.get("created_by"))) relations.add("CREATOR");
                return new Facts(null, relations);
            }
        };
    }

    @Bean
    PolicyBackedAdapter trainingRecordAdapter(JdbcTemplate jdbc, TrainingAccess access, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations) {
        return new Base(jdbc, access, policies, relations, "TRAINING_RECORD", "TRAINING_RECORD") {
            @Override protected String table() { return "training_records"; }

            /** A record has no status column: it is Active until a row of training_record_voids names it. */
            @Override protected String stateSql() {
                return "select case when exists (select 1 from training_record_voids v where v.record_id = r.id) then 'VOIDED' else 'ACTIVE' end from training_records r where r.id = ?";
            }

            @Override protected Facts facts(UserAccount actor, UUID id) {
                Map<String, Object> r = one(jdbc.queryForList("select a.organizer_department_id, a.confirmed_by from training_records r join training_activities a on a.id = r.activity_id where r.id = ?", id));
                if (r == null || actor == null || actor.getId() == null) return null;
                Set<String> relations = new HashSet<>();
                if (actor.getId().equals(r.get("confirmed_by"))) relations.add("CONFIRMER");
                return new Facts((UUID) r.get("organizer_department_id"), relations);
            }
        };
    }
}
