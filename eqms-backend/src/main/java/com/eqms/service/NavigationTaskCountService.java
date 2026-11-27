package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.service.report.ReportTemplateRevisionService;
import com.eqms.service.training.MyTrainingQueryService;
import com.eqms.service.training.TrainingActivityService;
import com.eqms.service.training.TrainingImpactService;
import com.eqms.service.training.TrainingPersonnelEventService;
import com.eqms.service.training.TrainingJobAssignmentService;
import com.eqms.service.training.TrainingLegacyEvidenceService;
import com.eqms.service.training.TrainingMatrixService;
import com.eqms.service.training.TrainingPersonnelReviewService;
import com.eqms.service.training.TrainingRecordExportBatchService;
import com.eqms.service.training.TrainingRecordExportService;
import com.eqms.service.training.TrainingRequirementService;
import com.eqms.service.training.TrainingSpecimenService;
import com.eqms.service.training.TrainingWaiting;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.function.LongSupplier;

/**
 * How many things wait for the signed-in person, for each entry of the menu. Nothing is stored: each number is worked out from the records as they are now, so it goes down by itself when the
 * work is done, cancelled or handed to somebody else. A number is the total of the list of that entry with the filter "waiting for me", asked from the same service that serves the list,
 * so the permissions and the scope are the same. An entry the person may not read, or whose count fails, is left out (never shown as 0).
 * <p>Not transactional on purpose: each list reads in its own transaction, so one that fails does not spoil the others.
 */
@Service
public class NavigationTaskCountService {
    private static final Logger log = LoggerFactory.getLogger(NavigationTaskCountService.class);
    private static final Map<String, String> WAITING = Map.of(TrainingWaiting.PARAM, "true");

    /** {@code counts}: work that names the person. {@code shared}: queues that anyone who may can work, so several people see the same number. */
    public record TaskCounts(Map<String, Long> counts, Map<String, Long> shared) {}

    private final MyTrainingQueryService myTraining;
    private final TrainingActivityService activities;
    private final TrainingRequirementService requirements;
    private final TrainingMatrixService matrices;
    private final TrainingJobAssignmentService jobs;
    private final TrainingPersonnelReviewService reviews;
    private final TrainingSpecimenService specimens;
    private final TrainingRecordExportService exports;
    private final TrainingRecordExportBatchService batches;
    private final TrainingLegacyEvidenceService evidence;
    private final RevisionService revisions;
    private final ReportTemplateRevisionService reportRevisions;

    private final TrainingImpactService impacts;
    private final TrainingPersonnelEventService personnelEvents;
    private final AccessReviewService accessReviews;
    private final AuditTrailReviewService auditReviews;
    private final ControlledCopyService controlledCopies;
    private final UncontrolledCopyService uncontrolledCopies;
    private final PermissionEvaluationService permissions;
    private final NavigationTaskCountCache cache;

    public NavigationTaskCountService(MyTrainingQueryService myTraining, TrainingActivityService activities, TrainingRequirementService requirements, TrainingMatrixService matrices,
                                      TrainingJobAssignmentService jobs, TrainingPersonnelReviewService reviews, TrainingSpecimenService specimens, TrainingRecordExportService exports,
                                      TrainingRecordExportBatchService batches, TrainingLegacyEvidenceService evidence, RevisionService revisions, ReportTemplateRevisionService reportRevisions,
                                      TrainingImpactService impacts, TrainingPersonnelEventService personnelEvents, AccessReviewService accessReviews, AuditTrailReviewService auditReviews, ControlledCopyService controlledCopies,
                                      UncontrolledCopyService uncontrolledCopies, PermissionEvaluationService permissions, NavigationTaskCountCache cache) {
        this.cache = cache;
        this.personnelEvents = personnelEvents;
        this.impacts = impacts;
        this.accessReviews = accessReviews;
        this.auditReviews = auditReviews;
        this.controlledCopies = controlledCopies;
        this.uncontrolledCopies = uncontrolledCopies;
        this.permissions = permissions;
        this.myTraining = myTraining;
        this.activities = activities;
        this.requirements = requirements;
        this.matrices = matrices;
        this.jobs = jobs;
        this.reviews = reviews;
        this.specimens = specimens;
        this.exports = exports;
        this.batches = batches;
        this.evidence = evidence;
        this.revisions = revisions;
        this.reportRevisions = reportRevisions;
    }

    public TaskCounts counts(UserAccount actor) {
        return cache.get(actor.getId(), () -> count(actor));
    }

    private TaskCounts count(UserAccount actor) {
        Map<String, Long> counts = new LinkedHashMap<>();
        Map<String, Long> shared = new LinkedHashMap<>();

        // A signature of Training Management shows in My Tasks and in its own entry; the module as a whole counts it once, so it takes the number of My Tasks.
        put(counts, "my-tasks", () -> number(myTraining.counts(actor).get("total")));
        Long mine = counts.get("my-tasks");
        if (mine != null) {
            counts.put("my-training", mine);
            counts.put("training-management", mine);
        }
        put(counts, "training-activities", () -> total(activities.list(actor, null, null, null, (UUID) null, null, null, false, TrainingActivityService.ListFilters.WAITING, "createdAt", "desc", 1, 1)));
        put(counts, "training-requirements", () -> total(requirements.list(actor, null, null, null, TrainingRequirementService.ListFilters.WAITING, null, null, 1, 1)));
        put(counts, "training-matrices", () -> total(matrices.matrices(actor, null, null, true, null, null, 1, 1)));
        put(counts, "training-job-assignments", () -> total(jobs.list(actor, null, null, null, null, 1, 1, WAITING)));
        // the reviews that wait for the person to close, and the alerts that ask for a review to be opened
        put(counts, "training-personnel-reviews", () -> total(reviews.list(actor, null, null, null, null, null, 1, 1, WAITING)) + personnelEvents.openCount(actor));
        put(counts, "training-specimen-signatures", () -> total(specimens.list(actor, null, null, null, null, 1, 1, WAITING)));
        put(counts, "training-record-exports", () -> total(exports.list(actor, null, null, null, null, 1, 1, WAITING)) + total(batches.list(actor, null, null, null, 1, 1, WAITING)));
        put(counts, "training-legacy-evidence", () -> total(evidence.queue(actor, null, null, null, null, 1, 1, WAITING)));

        try {
            Map<String, Long> pending = revisions.getPendingCounts();
            counts.put("pending-review", pending.get("pendingReview"));
            counts.put("pending-approval", pending.get("pendingApproval"));
        } catch (RuntimeException e) {
            skipped("pending revisions", e);
        }

        put(counts, "rev-owned-me", () -> revisions.listRevisions(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
                true, false, "revisionName", "asc", 1, 1, true).pagination().total());
        put(counts, "sec-access-review", () -> accessReviews.listPaged(1, 1, null, null, null, null, null, null, true, "createdAt", "desc").pagination().total());
        put(counts, "audit-trail-review", () -> auditReviews.listCampaignsPaged(1, 1, null, null, true, "createdAt", "desc").pagination().total());

        // Queues: shown only to a person who may work them, as the total of the list that the entry opens.
        if (permissions.hasPermission(actor, "documents.controlled_copy.distribute")) {
            put(shared, "cc-ready", () -> controlledCopies.listDistributionBatches(1, 1, null, "READY_FOR_DISTRIBUTION", null, null, null, null, null, null, null, null, null, null, "created", "desc").pagination().total());
        }
        if (permissions.hasPermission(actor, UncontrolledCopyService.P_DISTRIBUTE)) {
            put(shared, "uc-ready", () -> uncontrolledCopies.list(1, 1, null, "READY_FOR_DISTRIBUTION", null, null, null, null, null, null, null, "created", "desc").pagination().total());
        }
        put(shared, "training-document-impact-assessment", () -> total(impacts.list(actor, null, null, null, null, true, null, null, 1, 1)));
        put(shared, "report-template-revisions-pending", () -> total(reportRevisions.listAll(actor, "pending-approval", null, null, null, null, null, null, 1, 1)));
        return new TaskCounts(counts, shared);
    }

    private static void put(Map<String, Long> into, String menuId, LongSupplier count) {
        try {
            into.put(menuId, count.getAsLong());
        } catch (RuntimeException e) {
            skipped(menuId, e);
        }
    }

    /** Not being allowed to read a list is the normal case for most people; anything else is a fault worth seeing in the log. */
    private static void skipped(String what, RuntimeException e) {
        boolean denied = e instanceof SecurityException || e instanceof AccessDeniedException
                || (e instanceof ResponseStatusException status && status.getStatusCode().value() == 403);
        if (!denied) log.warn("Task count of {} could not be read", what, e);
    }

    private static long number(Object value) {
        return ((Number) value).longValue();
    }

    private static long total(Map<String, Object> listResult) {
        return number(((Map<?, ?>) listResult.get("pagination")).get("total"));
    }
}
