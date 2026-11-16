package com.eqms.service;

import com.eqms.dto.document.WorkflowProgressResponse;
import com.eqms.dto.document.WorkflowProgressResponse.WorkflowStepResponse;
import com.eqms.dto.document.WorkflowStepsResponse;
import com.eqms.entity.AuditLog;
import com.eqms.repository.AuditLogRepository;
import com.eqms.repository.ControlledCopyStatusDefinitionRepository;
import com.eqms.repository.DocumentStatusDefinitionRepository;
import com.eqms.repository.RevisionStatusDefinitionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Works out what the lifecycle steppers show. The steps and their order are the status lookup tables
 * ({@code revision_statuses}, {@code document_statuses}, by {@code sort_order}); a status that ends the
 * lifecycle is the one flagged {@code is_terminal}. The client holds no status list and no rule of its own.
 *
 * <p>Read-only: it describes a record, it never moves one.
 */
@Service
public class WorkflowProgressService {

    /** A recorded move between statuses; the values are status codes or, in older rows, labels. */
    public record Transition(String actionType, String fromStatus, String toStatus) {
    }

    /** Status codes older rows used for the same state; mapped to the lookup code of the lifecycle asked about. */
    private static final Map<String, String> REVISION_ALIASES = Map.of(
            "PUBLISHED", "EFFECTIVE",
            "ACTIVE", "EFFECTIVE",
            "OBSOLETE", "OBSOLETED",
            "CANCELLED", "CLOSED_CANCELLED",
            "REJECTED", "CLOSED_CANCELLED");
    private static final Map<String, String> DOCUMENT_ALIASES = Map.of(
            "EFFECTIVE", "ACTIVE",
            "PUBLISHED", "ACTIVE",
            "OBSOLETE", "OBSOLETED",
            "CANCELLED", "CLOSED_CANCELLED");

    /** Controlled Copy phases an Uncontrolled Copy is drawn on. */
    private static final Set<String> UNCONTROLLED_COPY_PHASES =
            Set.of("READY_FOR_DISTRIBUTION", "DISTRIBUTED", "CLOSED_CANCELLED");
    private static final String TRAINING_STEP = "PENDING_TRAINING";
    /** Revision steps a Legacy Import never goes through. */
    private static final Set<String> LEGACY_IMPORT_SKIPPED =
            Set.of("PENDING_REVIEW", "PENDING_APPROVAL", TRAINING_STEP, "READY_FOR_PUBLISHING");

    private final RevisionStatusDefinitionRepository revisionStatusRepository;
    private final DocumentStatusDefinitionRepository documentStatusRepository;
    private final AuditLogRepository auditLogRepository;
    private final ControlledCopyStatusDefinitionRepository controlledCopyStatusRepository;

    public WorkflowProgressService(
            RevisionStatusDefinitionRepository revisionStatusRepository,
            DocumentStatusDefinitionRepository documentStatusRepository,
            AuditLogRepository auditLogRepository,
            ControlledCopyStatusDefinitionRepository controlledCopyStatusRepository
    ) {
        this.controlledCopyStatusRepository = controlledCopyStatusRepository;
        this.revisionStatusRepository = revisionStatusRepository;
        this.documentStatusRepository = documentStatusRepository;
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional(readOnly = true)
    public WorkflowStepsResponse steps() {
        List<WorkflowStepResponse> revision = revisionSteps();
        List<String> legacySkipped = revision.stream()
                .filter(step -> LEGACY_IMPORT_SKIPPED.contains(step.code()))
                .map(WorkflowStepResponse::label)
                .toList();
        return new WorkflowStepsResponse(revision, documentSteps(), legacySkipped);
    }

    @Transactional(readOnly = true)
    public List<WorkflowStepResponse> revisionSteps() {
        return revisionStatusRepository.findAllByOrderBySortOrderAsc().stream()
                .map(s -> new WorkflowStepResponse(s.getCode(), s.getLabel(), s.isTerminal()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<WorkflowStepResponse> documentSteps() {
        return documentStatusRepository.findAllByOrderBySortOrderAsc().stream()
                .map(s -> new WorkflowStepResponse(s.getCode(), s.getLabel(), s.isTerminal()))
                .toList();
    }

    /** Stepper for a Revision. A step is "skipped" when the history shows the revision never went through it. */
    @Transactional(readOnly = true)
    public WorkflowProgressResponse forRevision(String statusCode, boolean requiresTraining, List<Transition> history) {
        return build(revisionSteps(), REVISION_ALIASES, statusCode, !requiresTraining, true, history);
    }

    /** Stepper for a Document; its history is the audit trail of the Document. */
    @Transactional(readOnly = true)
    public WorkflowProgressResponse forDocument(String statusCode, UUID documentId) {
        List<AuditLog> rows = documentId == null
                ? List.of()
                : new ArrayList<>(auditLogRepository.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("DOCUMENT", documentId));
        Collections.reverse(rows); // oldest first
        List<Transition> history = rows.stream()
                .map(row -> new Transition(row.getActionType(), row.getFromStatus(), row.getToStatus()))
                .toList();
        return build(documentSteps(), DOCUMENT_ALIASES, statusCode, false, false, history);
    }

    /** Stepper for a Controlled Copy or a Controlled Copy distribution batch; its history is its own audit trail. */
    @Transactional(readOnly = true)
    public WorkflowProgressResponse forControlledCopy(String statusCode, UUID copyId) {
        return forControlledCopy(statusCode, "CONTROLLED_COPY", copyId);
    }

    @Transactional(readOnly = true)
    public WorkflowProgressResponse forControlledCopy(String statusCode, String entityType, UUID copyId) {
        List<AuditLog> rows = copyId == null
                ? List.of()
                : new ArrayList<>(auditLogRepository.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc(entityType, copyId));
        Collections.reverse(rows); // oldest first
        List<Transition> history = rows.stream()
                .map(row -> new Transition(row.getActionType(), row.getFromStatus(), row.getToStatus()))
                .toList();
        return build(controlledCopySteps(), Map.of(), statusCode, false, false, history);
    }

    /**
     * Stepper for an Uncontrolled Copy. It has the three statuses of the system (Ready for Distribution, Distributed, Closed - Cancelled), drawn on the Controlled Copy
     * lifecycle; how far a copy that is Ready for Distribution has got is not a status and is not drawn (UCC-STATUS-2026-11-14).
     */
    @Transactional(readOnly = true)
    public WorkflowProgressResponse forUncontrolledCopy(String statusCode) {
        String phase = switch (statusCode == null ? "" : statusCode.toUpperCase(Locale.ROOT)) {
            case "DISTRIBUTED" -> "DISTRIBUTED";
            case "CLOSED_CANCELLED" -> "CLOSED_CANCELLED";
            default -> "READY_FOR_DISTRIBUTION";
        };
        List<WorkflowStepResponse> steps = controlledCopySteps().stream()
                .filter(step -> UNCONTROLLED_COPY_PHASES.contains(step.code()))
                .toList();
        int current = 0;
        for (int i = 0; i < steps.size(); i++) {
            if (steps.get(i).code().equals(phase)) current = i;
        }
        boolean ended = !steps.isEmpty() && steps.get(current).terminal();
        // A copy that ends was always still being prepared at that point, whatever its granular status was.
        String reached = ended && !steps.isEmpty() ? steps.get(0).label() : "";
        return new WorkflowProgressResponse(steps, current, List.of(), reached);
    }

    @Transactional(readOnly = true)
    public List<WorkflowStepResponse> controlledCopySteps() {
        return controlledCopyStatusRepository.findAllByOrderBySortOrderAsc().stream()
                .map(s -> new WorkflowStepResponse(s.getCode(), s.getLabel(), s.isTerminal()))
                .toList();
    }

    private WorkflowProgressResponse build(
            List<WorkflowStepResponse> steps,
            Map<String, String> aliases,
            String statusCode,
            boolean trainingNotRequired,
            boolean inferSkipped,
            List<Transition> history
    ) {
        Map<String, Integer> indexByCode = new HashMap<>();
        for (int i = 0; i < steps.size(); i++) {
            indexByCode.put(steps.get(i).code(), i);
        }
        int current = resolve(steps, indexByCode, aliases, statusCode);
        boolean ended = current >= 0 && steps.get(current).terminal();
        int currentIndex = Math.max(current, 0);

        int endedAt = ended ? terminalProgress(steps, indexByCode, aliases, history, current) : -1;
        String terminalProgressStep = endedAt >= 0 ? steps.get(endedAt).label() : "";

        Set<Integer> skipped = new LinkedHashSet<>();
        Integer trainingIndex = indexByCode.get(TRAINING_STEP);
        if (trainingNotRequired && trainingIndex != null) {
            skipped.add(trainingIndex);
        }
        // Without recorded history only the training rule is applied; nothing is guessed about other steps.
        if (inferSkipped && history != null && !history.isEmpty()) {
            Set<Integer> visited = new LinkedHashSet<>();
            visited.add(0); // every lifecycle starts at its first step
            for (Transition t : history) {
                int from = resolve(steps, indexByCode, aliases, t.fromStatus());
                int to = resolve(steps, indexByCode, aliases, t.toStatus());
                if (from >= 0) visited.add(from);
                if (to >= 0) visited.add(to);
            }
            if (current >= 0) visited.add(current);
            int progress = ended && endedAt >= 0 ? endedAt : current;
            // Only up to the point of progress: steps between that and an ending status are drawn as a gap by the stepper.
            for (int i = 0; i <= progress; i++) {
                if (!visited.contains(i)) skipped.add(i);
            }
            if (current >= 0) skipped.remove(current);
        }

        List<String> skippedLabels = skipped.stream().sorted().map(i -> steps.get(i).label()).toList();
        return new WorkflowProgressResponse(steps, currentIndex, skippedLabels, terminalProgressStep);
    }

    /**
     * The step a record had reached before it was cancelled or obsoleted: the status it moved <em>from</em> in the
     * last move into an ending status. A row without a "from" status is a side effect logged in the same operation
     * (e.g. evidence uploaded), not the move itself, and is ignored.
     */
    private int terminalProgress(
            List<WorkflowStepResponse> steps,
            Map<String, Integer> indexByCode,
            Map<String, String> aliases,
            List<Transition> history,
            int current
    ) {
        if (history == null) return -1;
        for (int i = history.size() - 1; i >= 0; i--) {
            Transition t = history.get(i);
            String action = t.actionType() == null ? "" : t.actionType().replaceAll("[_\\s-]+", "").toUpperCase(Locale.ROOT);
            int to = resolve(steps, indexByCode, aliases, t.toStatus());
            // Only the move into the status the record is in now says where it got to. A move into another ending status (Effective > Obsoleted, when the record
            // is now Closed - Cancelled) is not evidence of the present ending: nothing the product does leads from one to the other, so the path is not
            // drawn from it; the stepper then shows only the known origin and stripes the rest.
            if (current >= 0 && to >= 0 && to != current) continue;
            boolean intoEnd = action.contains("CANCEL") || action.contains("OBSOLETE") || (to >= 0 && steps.get(to).terminal());
            if (!intoEnd) continue;
            int from = resolve(steps, indexByCode, aliases, t.fromStatus());
            // A row that stays where it was (an opened screen, an update) is not a move, and nothing moves out of an ending status:
            // without this, the "opened document detail" row logged after a cancel made the record look as if it had reached its own ending.
            if (from >= 0 && from == to) continue;
            if (from >= 0 && steps.get(from).terminal()) continue;
            if (t.fromStatus() != null && !t.fromStatus().isBlank()) {
                return from;
            }
        }
        return -1;
    }

    /** Index of the step a stored status value (a code, or an older label) stands for; -1 when none does. */
    private int resolve(List<WorkflowStepResponse> steps, Map<String, Integer> indexByCode, Map<String, String> aliases, String value) {
        if (value == null || value.isBlank()) return -1;
        String code = value.trim().toUpperCase(Locale.ROOT).replaceAll("[-\\s]+", "_");
        Integer direct = indexByCode.get(code);
        if (direct != null) return direct;
        String aliased = aliases.get(code);
        if (aliased != null && indexByCode.containsKey(aliased)) return indexByCode.get(aliased);
        String flat = value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        for (int i = 0; i < steps.size(); i++) {
            if (steps.get(i).label().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "").equals(flat)) return i;
        }
        return -1;
    }
}
