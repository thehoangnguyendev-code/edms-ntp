package com.eqms.service.training;

import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ClamAvScanService;
import com.eqms.service.ElectronicSignatureService;
import com.eqms.service.FileStorageService;
import com.eqms.service.TrainingRevisionHooks.LegacyTraining;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Training evidence of documents imported from paper (decision D-27 and the owner decisions of LEGACY-IMPORT-TRAINING-2026-11-01). A revision that required training has the
 * Training Number written on its paper record (never issued by the system); that number is kept as a read-only historical activity (kind LEGACY) in Training Management, shared by
 * every revision that carries the same number. The evidence is the scan of the paper record (APD.0108 or APD.0117), or a declaration, with a reason, that the paper is lost. There is no
 * second person who verifies it (owner decision, 2026-11-01): the person who imports signs the import (the e-signature of the Legacy Import, with its justification), or, when the
 * evidence is attached later from the queue, signs that; the evidence is filed (status FILED) and read-only, and the training records of the persons named with it are written at once.
 * The queue shows every imported revision with what is still missing, so nothing is forgotten.
 */
@Service
public class TrainingLegacyEvidenceService {
    private static final String TYPE = "TRAINING_LEGACY_EVIDENCE";
    private static final int MAX_BYTES = 20 * 1024 * 1024;

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final ElectronicSignatureService signatures;
    private final AuditTrailService audit;
    private final FileStorageService files;
    private final ClamAvScanService virusScan;
    private final TrainingNumberService numbers;
    private final TrainingRecipients recipients;
    private final TrainingNotifier notifier;
    @PersistenceContext
    private EntityManager entityManager;

    public TrainingLegacyEvidenceService(JdbcTemplate jdbc, TrainingAccess access, ElectronicSignatureService signatures, AuditTrailService audit,
                                         FileStorageService files, ClamAvScanService virusScan, TrainingNumberService numbers, TrainingRecipients recipients, TrainingNotifier notifier) {
        this.jdbc = jdbc;
        this.access = access;
        this.signatures = signatures;
        this.audit = audit;
        this.files = files;
        this.virusScan = virusScan;
        this.numbers = numbers;
        this.recipients = recipients;
        this.notifier = notifier;
    }

    // ----------------------------------------------------------------------------------------------------------------------------- the queue

    /** Every imported revision that required training, with the state of its evidence. */
    @Transactional(readOnly = true)
    public Map<String, Object> queue(UserAccount actor, String status, String search, String sortBy, String sortDirection, int page, int limit) {
        return queue(actor, status, search, sortBy, sortDirection, page, limit, Map.of());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> queue(UserAccount actor, String status, String search, String sortBy, String sortDirection, int page, int limit, Map<String, String> more) {
        access.require(actor, "training.activity.view", "training.compliance.view", "training.activity.organize");
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where r.training_origin = 'LEGACY_IMPORT' and r.requires_training");
        if (!access.allDepartments(actor)) {
            UUID own = access.departmentOf(actor);
            where.append(" and d.department_id = ?");
            args.add(own == null ? new UUID(0, 0) : own);
        }
        if (status != null && !status.isBlank()) {
            switch (status) {
                case "MISSING" -> where.append(" and le.id is null");
                case "FILED", "VERIFIED" -> { where.append(" and le.status = ?"); args.add(status); }
                default -> throw new IllegalArgumentException("TRAINING_STATUS_INVALID");
            }
        }
        if (search != null && !search.isBlank()) {
            String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" and (lower(d.document_number) like ? escape '\\' or lower(d.document_name) like ? escape '\\' or lower(coalesce(r.revision_number,'')) like ? escape '\\' or lower(coalesce(r.training_number,'')) like ? escape '\\' or lower(coalesce(le.original_name,'')) like ? escape '\\' or lower(coalesce(su.full_name,'')) like ? escape '\\' or lower(coalesce(vu.full_name,'')) like ? escape '\\')");
            args.add(like); args.add(like); args.add(like); args.add(like); args.add(like); args.add(like); args.add(like);
        }
        TrainingListFilter extra = new TrainingListFilter().contains(more.get("submittedBy"), "su.full_name").contains(more.get("verifiedBy"), "vu.full_name")
                .dateRange("r.training_completion_date", more.get("completionFrom"), more.get("completionTo"))
                .timeRange("le.submitted_at", more.get("submittedFrom"), more.get("submittedTo")).timeRange("le.verified_at", more.get("verifiedFrom"), more.get("verifiedTo"));
        if (more.get("departmentId") != null && !more.get("departmentId").isBlank()) {
            try {
                extra.raw("d.department_id = ?", UUID.fromString(more.get("departmentId").trim()));
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("TRAINING_FILTER_INVALID");
            }
        }
        where.append(extra.and());
        args.addAll(extra.args());
        // The evidence of a revision is its own, or the one of the activity it shares with other revisions (one paper number for several SOPs).
        String from = """
             from document_revisions r join documents d on d.id = r.document_id
             left join training_legacy_evidence le on le.status in ('FILED','VERIFIED') and (le.revision_id = r.id or (r.training_activity_id is not null and le.activity_id = r.training_activity_id))
             left join app_users su on su.id = le.submitted_by left join app_users vu on vu.id = le.verified_by
            """;
        Long total = jdbc.queryForObject("select count(*)" + from + where, Long.class, args.toArray());
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        args.add(safeLimit); args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = TrainingRows.camel(jdbc.queryForList("""
            select r.id as revision_id, d.id as document_id, d.document_number, d.document_name, r.revision_number, r.training_completion_date as completion_date, r.training_number as paper_training_number,
                   r.training_activity_id as activity_id, le.id as evidence_id, le.status as evidence_status, le.not_evidenced, le.not_evidenced_reason, le.original_name, le.content_type,
                   le.submitted_at, le.verified_at, su.full_name as submitted_by_name, vu.full_name as verified_by_name,
                   (select count(*) from training_legacy_people p where p.evidence_id = le.id and p.role = 'TRAINEE') as trainee_count
            """ + from + where + TrainingRows.orderBy(sortBy, sortDirection, Map.ofEntries(Map.entry("document", "d.document_number"), Map.entry("documentName", "d.document_name"),
                Map.entry("revision", "r.revision_number"), Map.entry("completion", "r.training_completion_date"), Map.entry("paperNo", "r.training_number"), Map.entry("evidence", "le.status"),
                Map.entry("detail", "le.original_name"), Map.entry("submittedBy", "su.full_name"), Map.entry("verifiedBy", "vu.full_name"), Map.entry("submittedOn", "le.submitted_at"),
                Map.entry("verifiedOn", "le.verified_at")), "d.document_number, r.revision_number") + " limit ? offset ?", args.toArray()));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", rows);
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        result.put("canSubmit", access.has(actor, "training.activity.organize"));
        return result;
    }

    /** What the import form needs to know about a paper Training Number typed by the person: is it new, does it join an activity of another document, is there evidence already. */
    @Transactional(readOnly = true)
    public Map<String, Object> numberInfo(UserAccount actor, String number) {
        access.require(actor, "documents.legacy_import.manage", "training.activity.view", "training.activity.organize");
        Map<String, Object> out = new LinkedHashMap<>();
        String typed = number == null ? "" : number.trim();
        out.put("number", typed);
        out.put("exists", false);
        if (typed.isEmpty()) return out;
        List<Map<String, Object>> rows = jdbc.queryForList("select id, kind, status, revision_id from training_activities where upper(training_number) = upper(?)", typed);
        if (rows.isEmpty()) {
            boolean onRevision = numbers.isUsed(typed);
            out.put("usedElsewhere", onRevision);
            return out;
        }
        Map<String, Object> a = rows.getFirst();
        UUID activityId = (UUID) a.get("id");
        out.put("exists", true);
        out.put("legacy", "LEGACY".equals(a.get("kind")));
        out.put("activityId", activityId);
        Map<String, Object> evidence = openEvidence(activityId, (UUID) a.get("revision_id"));
        out.put("evidenceStatus", evidence == null ? null : evidence.get("status"));
        out.put("traineeCount", evidence == null ? 0 : jdbc.queryForObject("select count(*) from training_legacy_people where evidence_id = ? and role = 'TRAINEE'", Integer.class, evidence.get("id")));
        out.put("documents", TrainingRows.camel(jdbc.queryForList("""
            select d.document_number, d.document_name, r.revision_number from document_revisions r join documents d on d.id = r.document_id
             where r.training_activity_id = ? order by d.document_number, r.revision_number
            """, activityId)));
        return out;
    }

    /**
     * The persons named with the evidence of a historical activity: the persons who were trained on paper and the author, reviewers and approver of the revisions that are users of
     * the system, and whether their training record is written (it is, once the evidence is filed) or was voided afterwards.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> people(UserAccount actor, UUID activityId, int page, int limit) {
        access.require(actor, "training.activity.view", "training.compliance.view", "training.activity.organize");
        Map<String, Object> activity = jdbc.queryForList("select id, kind, organizer_department_id, revision_id from training_activities where id = ?", activityId).stream().findFirst()
                .orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        access.requireScope(actor, (UUID) activity.get("organizer_department_id"));
        if (!"LEGACY".equals(activity.get("kind"))) throw new IllegalArgumentException("TRAINING_LEGACY_NOT_APPLICABLE");
        Map<String, Object> evidence = openEvidence(activityId, (UUID) activity.get("revision_id"));
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        List<Map<String, Object>> rows = List.of();
        long total = 0;
        if (evidence != null) {
            Long count = jdbc.queryForObject("select count(*) from training_legacy_people where evidence_id = ?", Long.class, evidence.get("id"));
            total = count == null ? 0 : count;
            rows = TrainingRows.camel(jdbc.queryForList("""
                select p.role, u.id as person_id, u.full_name, u.employee_code, u.department, u.position, d.document_number, rv.revision_number,
                       exists(select 1 from training_records x where x.person_user_id = u.id and x.activity_id = p.activity_id
                                 and (p.revision_id is null or (x.document_number = d.document_number and x.document_revision = rv.revision_number))
                                 and not exists (select 1 from training_record_voids v where v.record_id = x.id)) as record_written,
                       exists(select 1 from training_records x join training_record_voids v on v.record_id = x.id where x.person_user_id = u.id and x.activity_id = p.activity_id
                                 and (p.revision_id is null or (x.document_number = d.document_number and x.document_revision = rv.revision_number))) as record_voided
                  from training_legacy_people p join app_users u on u.id = p.person_user_id
                  left join document_revisions rv on rv.id = p.revision_id left join documents d on d.id = rv.document_id
                 where p.evidence_id = ? order by p.role desc, u.full_name, d.document_number limit ? offset ?
                """, evidence.get("id"), safeLimit, (safePage - 1) * safeLimit));
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", rows);
        result.put("evidenceStatus", evidence == null ? null : evidence.get("status"));
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", total, "totalPages", Math.max(1, (total + safeLimit - 1) / safeLimit)));
        return result;
    }

    // ----------------------------------------------------------------------------------------------------------------------------- import (Document Control calls these)

    /** A problem with the paper training entered for a revision of an import, in words for the person, or null. Nothing is written. */
    @Transactional(readOnly = true)
    public String problem(UserAccount actor, DocumentRecord document, String revisionNumber, LegacyTraining entry) {
        String where = "Revision " + revisionNumber + ": ";
        if (entry == null) return where + "the paper training record (scan, or a declaration that it is lost) is required for a document that requires training.";
        String number = entry.paperTrainingNumber() == null ? "" : entry.paperTrainingNumber().trim();
        boolean hasTrainees = entry.traineeIds() != null && !entry.traineeIds().isEmpty();
        Map<String, Object> existing = number.isEmpty() ? null : jdbc.queryForList("select id, kind, revision_id from training_activities where upper(training_number) = upper(?)", number).stream().findFirst().orElse(null);
        if (!number.isEmpty()) {
            if (existing != null && !"LEGACY".equals(existing.get("kind"))) return where + "Training Number " + number + " was issued by Training Management; the number of a paper record cannot be the same.";
            if (existing == null && numbers.isUsed(number)) return where + "Training Number " + number + " is already used by another record.";
        }
        boolean joinsEvidence = existing != null && openEvidence((UUID) existing.get("id"), (UUID) existing.get("revision_id")) != null;
        boolean hasPaperDetails = notBlank(entry.topic()) || notBlank(entry.trainer()) || notBlank(entry.method());
        if (joinsEvidence) {
            if (entry.scan() != null || entry.notEvidenced() || hasTrainees || hasPaperDetails) return where + "Training Number " + number + " already has its evidence, its trainees and its topic (shared with another document); do not enter them again.";
            return null;
        }
        if (hasTrainees && number.isEmpty()) return where + "the persons who were trained can only be entered together with the Training Number of the paper record.";
        if (hasPaperDetails && number.isEmpty()) return where + "the Training Topic, the Trainer and the Mode of the paper record can only be entered together with its Training Number.";
        if (entry.method() != null && !entry.method().isBlank() && !List.of("SELF_READING", "CLASSROOM", "HYBRID", "PRACTICAL").contains(entry.method())) return where + "the Mode is not one of Self-reading, Classroom, Hybrid or Practical training.";
        if (notBlank(entry.topic()) && entry.topic().trim().length() > 1000) return where + "the Training Topic is longer than 1000 characters.";
        if (notBlank(entry.trainer()) && entry.trainer().trim().length() > 255) return where + "the Trainer is longer than 255 characters.";
        if (!access.has(actor, "training.activity.organize")) {
            return where + "you need the Training permission to organize to attach the training evidence.";
        }
        if (entry.notEvidenced()) {
            if (entry.reason() == null || entry.reason().isBlank()) return where + "say why there is no evidence of the paper training.";
            if (entry.scan() != null || hasTrainees) return where + "a declaration that the paper is lost cannot come with a scan or with trainees.";
        } else {
            if (entry.scan() == null || entry.scan().isEmpty()) return where + "attach the scan of the paper training record (APD.0108 or APD.0117), or declare that it is lost.";
            if (entry.scan().getSize() > MAX_BYTES) return where + "the scan is larger than 20 MB.";
            byte[] bytes;
            try {
                bytes = entry.scan().getBytes();
            } catch (IOException e) {
                return where + "the scan could not be read.";
            }
            if (!"application/pdf".equals(detect(bytes))) return where + "the scan must be a PDF file.";
            if (!virusScan.scan(bytes).clean()) return where + "the scan was rejected by the virus check.";
        }
        if (!number.isEmpty() && !entry.notEvidenced()) {
            if (!notBlank(entry.topic())) return where + "enter the Training Topic of the paper record.";
            if (!notBlank(entry.trainer())) return where + "enter the Trainer of the paper record.";
            if (!notBlank(entry.method())) return where + "choose the Mode of the paper training.";
        }
        if (hasTrainees) {
            for (UUID id : entry.traineeIds()) {
                Integer found = jdbc.queryForObject("select count(*) from app_users where id = ?", Integer.class, id);
                if (found == null || found == 0) return where + "a person chosen as trained is not a user of the system.";
            }
        }
        return null;
    }

    /** The revisions were created: keeps each paper number as a historical activity, files the evidence, names the persons, and tells the department. */
    @Transactional
    public void imported(UserAccount actor, DocumentRecord document, List<DocumentRevisionRecord> revisions, List<LegacyTraining> entries) {
        entityManager.flush();
        UUID departmentId = document.getDepartment() == null ? null : document.getDepartment().getId();
        List<String> done = new ArrayList<>();
        for (int i = 0; i < revisions.size() && i < entries.size(); i++) {
            LegacyTraining entry = entries.get(i);
            DocumentRevisionRecord revision = revisions.get(i);
            if (entry == null) continue;
            Map<String, Object> r = revision(revision.getId());
            String number = entry.paperTrainingNumber() == null ? "" : entry.paperTrainingNumber().trim();
            UUID activityId = number.isEmpty() ? null : ensureActivity(actor, r, entry);
            if (activityId != null) {
                revision.setTrainingActivityId(activityId);
                revision.setTrainingMode("INTEGRATED");
            }
            Map<String, Object> shared = activityId == null ? null : openEvidence(activityId, leadRevision(activityId));
            List<UUID> signatories = entry.signatoryIds() == null ? List.of() : entry.signatoryIds();
            if (shared != null) {
                addPeople(actor, (UUID) shared.get("id"), activityId, revision.getId(), "SIGNATORY", signatories);
                writeRecords((UUID) shared.get("id"), revision.getId());
                done.add(document.getDocumentNumber() + " Rev " + revision.getRevisionNumber() + " (evidence of " + number + " already filed)");
                continue;
            }
            UUID evidenceId = createEvidence(actor, r, activityId, entry.scan(), entry.notEvidenced(), entry.reason(), entry.traineeIds() == null ? List.of() : entry.traineeIds(), null);
            if (activityId != null) {
                addPeople(actor, evidenceId, activityId, revision.getId(), "SIGNATORY", signatories);
                // The persons are taken to have been trained from the day the import is signed: their records are written now.
                writeRecords(evidenceId, null);
            }
            done.add(document.getDocumentNumber() + " Rev " + revision.getRevisionNumber());
        }
        if (!done.isEmpty()) tellDepartment(actor, document, departmentId, done);
    }

    private void tellDepartment(UserAccount actor, DocumentRecord document, UUID departmentId, List<String> done) {
        for (UserAccount head : recipients.holders("training.document_impact.manage", departmentId)) {
            if (head.getId().equals(actor.getId())) continue;
            notifier.send("TRAINING_LEGACY_IMPORTED", head, actor, "Training: a document was imported from paper",
                    document.getDocumentNumber() + " was imported from paper (" + String.join(", ", done) + "). Check which positions must be trained on it and the training matrix.",
                    TYPE, document.getId(), "legacy-import:" + document.getId() + ":" + head.getId());
        }
    }

    // ----------------------------------------------------------------------------------------------------------------------------- the queue actions

    /**
     * Attaches, from the queue, the scan of the paper training record of a revision imported earlier without it, or declares that there is none (with a reason), and names the persons
     * trained. The person who attaches it signs (there is no second person to verify): the evidence is filed and the training records of the persons are written at once.
     */
    @Transactional
    public Map<String, Object> submit(UserAccount actor, UUID revisionId, MultipartFile file, boolean notEvidenced, String reason, List<UUID> traineeIds, String signatureToken) {
        Map<String, Object> r = revision(revisionId);
        access.require(actor, "training.activity.organize");
        access.requireScope(actor, (UUID) r.get("department_id"));
        if (signatureToken == null || signatureToken.isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        UUID activityId = (UUID) r.get("training_activity_id");
        if (activityId == null && r.get("training_number") != null && !String.valueOf(r.get("training_number")).isBlank()) activityId = ensureActivity(actor, r, null);
        if (openEvidence(activityId, revisionId) != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_LEGACY_EVIDENCE_EXISTS");
        List<UUID> trainees = traineeIds == null ? List.of() : traineeIds;
        if (!trainees.isEmpty() && (activityId == null || notEvidenced)) throw new IllegalArgumentException("TRAINING_LEGACY_TRAINEES_NEED_NUMBER");
        UUID evidenceId = createEvidence(actor, r, activityId, file, notEvidenced, reason, trainees, signatureToken);
        if (activityId != null) writeRecords(evidenceId, null);
        return queueRow(actor, revisionId);
    }

    @Transactional
    public Map<String, Object> download(UserAccount actor, UUID evidenceId) {
        return read(actor, evidenceId, "TRAINING_LEGACY_EVIDENCE_DOWNLOADED", "Downloaded");
    }

    /** Opens the scan in the viewer of the page: the same checks and integrity test as a download, written to the audit trail as a view. */
    @Transactional
    public Map<String, Object> view(UserAccount actor, UUID evidenceId) {
        return read(actor, evidenceId, "TRAINING_LEGACY_EVIDENCE_VIEWED", "Viewed");
    }

    private Map<String, Object> read(UserAccount actor, UUID evidenceId, String auditAction, String auditComment) {
        Map<String, Object> e = jdbc.queryForList("select * from training_legacy_evidence where id=?", evidenceId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        Map<String, Object> r = revision((UUID) e.get("revision_id"));
        access.require(actor, "training.activity.view", "training.compliance.view", "training.activity.organize");
        access.requireScope(actor, (UUID) r.get("department_id"));
        if (e.get("stored_path") == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_LEGACY_NO_FILE");
        try {
            byte[] bytes = files.readReportArtifact(String.valueOf(e.get("provider")), String.valueOf(e.get("stored_path")));
            if (!sha256(bytes).equals(e.get("sha256"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_FILE_INTEGRITY_FAILED");
            audit.logAs(actor, TYPE, label(r), evidenceId, auditAction, null, null, auditComment);
            return Map.of("bytes", bytes, "contentType", String.valueOf(e.get("content_type")), "name", String.valueOf(e.get("original_name")));
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "TRAINING_FILE_UNAVAILABLE");
        }
    }

    // ----------------------------------------------------------------------------------------------------------------------------- the activity, the evidence, the persons

    /** The historical activity of a paper Training Number: found when another revision already carries the number, made otherwise; the revision is linked to it. */
    private UUID ensureActivity(UserAccount actor, Map<String, Object> r, LegacyTraining paper) {
        String number = String.valueOf(r.get("training_number")).trim();
        List<Map<String, Object>> existing = jdbc.queryForList("select id, kind from training_activities where upper(training_number) = upper(?)", number);
        UUID id;
        if (existing.isEmpty()) {
            id = UUID.randomUUID();
            java.sql.Date completion = (java.sql.Date) r.get("training_completion_date");
            // The year and the serial of the activity are the ones of its number (the log of the Training Numbers is by the year of the number: TRN/DC/YY-XXX); a number of another form
            // has no year in it, so the day of the paper training gives it.
            Integer numberYear = yearOf(number);
            int year = numberYear != null ? numberYear : completion == null ? LocalDate.now(TrainingNumberService.ZONE).getYear() : completion.toLocalDate().getYear();
            int serial = serialOf(number);
            jdbc.update("""
                insert into training_activities(id, training_number, base_number, organizer_department_id, year, serial, kind, status, document_id, revision_id, revision_number, document_number,
                                                document_name, completed_on, remarks, created_by, paper_topic, paper_trainer, paper_method)
                values (?,?,?,?,?,?,'LEGACY','COMPLETED',?,?,?,?,?,?,?,?,?,?,?)
                """, id, number, number, r.get("department_id"), year, serial, r.get("document_id"), r.get("id"), r.get("revision_number"), r.get("document_number"), r.get("document_name"),
                    completion, "Paper training imported with the document (Legacy Import)", actor.getId(),
                    paper == null ? null : blankToNull(paper.topic()), paper == null ? null : blankToNull(paper.trainer()), paper == null ? null : blankToNull(paper.method()));
            numbers.reserveFromPaper(number);
            audit.logAs(actor, "TRAINING_ACTIVITY", number, id, "TRAINING_LEGACY_ACTIVITY_CREATED", null, "COMPLETED", "Paper Training Number " + number + " of " + r.get("document_number") + " Rev " + r.get("revision_number"));
        } else {
            if (!"LEGACY".equals(existing.getFirst().get("kind"))) throw new IllegalArgumentException("TRAINING_LEGACY_NUMBER_IN_USE");
            id = (UUID) existing.getFirst().get("id");
        }
        jdbc.update("update document_revisions set training_activity_id = ?, training_mode = 'INTEGRATED' where id = ?", id, r.get("id"));
        return id;
    }

    private static boolean notBlank(String text) {
        return text != null && !text.isBlank();
    }

    private static String blankToNull(String text) {
        return notBlank(text) ? text.trim() : null;
    }

    private static final java.util.regex.Pattern YEAR_OF_NUMBER = java.util.regex.Pattern.compile("(?i)^TRN/[A-Z0-9]{1,40}/([0-9]{2})-[0-9]{1,6}$");

    /** The year written in a Training Number of the form of the system (TRN/DC/YY-XXX), or null. */
    static Integer yearOf(String number) {
        java.util.regex.Matcher m = YEAR_OF_NUMBER.matcher(number == null ? "" : number.trim());
        return m.matches() ? 2000 + Integer.parseInt(m.group(1)) : null;
    }

    private static int serialOf(String number) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("-([0-9]{1,6})$").matcher(number);
        return m.find() ? Integer.parseInt(m.group(1)) : 0;
    }

    private UUID leadRevision(UUID activityId) {
        return jdbc.queryForList("select revision_id from training_activities where id = ?", UUID.class, activityId).stream().findFirst().orElse(null);
    }

    /** The evidence of an activity that is on file (submitted or verified), whether it was filed for the activity or for its lead revision before the activity existed. */
    private Map<String, Object> openEvidence(UUID activityId, UUID revisionId) {
        return jdbc.queryForList("""
            select id, status from training_legacy_evidence
             where status in ('FILED','VERIFIED') and ((?::uuid is not null and activity_id = ?::uuid) or (?::uuid is not null and revision_id = ?::uuid))
             order by submitted_at desc limit 1
            """, activityId, activityId, revisionId, revisionId).stream().findFirst().orElse(null);
    }

    private UUID createEvidence(UserAccount actor, Map<String, Object> r, UUID activityId, MultipartFile file, boolean notEvidenced, String reason, List<UUID> trainees, String signatureToken) {
        UUID revisionId = (UUID) r.get("id");
        UUID id = UUID.randomUUID();
        // Attached later from the queue: the person signs it. Attached by the import: the e-signature of the import (with its justification) is the signature.
        UUID signatureId = signatureToken == null ? null : signatures.createEntitySignature(TYPE, id, label(r), actor, signatureToken, "TRAINING_LEGACY_FILED",
                "Training Management: legacy training evidence filed", null, null, null).getId();
        if (notEvidenced) {
            if (reason == null || reason.isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
            jdbc.update("insert into training_legacy_evidence(id, revision_id, activity_id, document_number, revision_number, document_name, completion_date, paper_training_number, not_evidenced, not_evidenced_reason, submitted_by, status, signature_id) values (?,?,?,?,?,?,?,?,true,?,?,'FILED',?)",
                    id, revisionId, activityId, r.get("document_number"), r.get("revision_number"), r.get("document_name"), r.get("training_completion_date"), r.get("training_number"), reason.trim(), actor.getId(), signatureId);
        } else {
            if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
            byte[] bytes;
            try { bytes = file.getBytes(); } catch (IOException e) { throw new IllegalArgumentException("TRAINING_FILE_REJECTED"); }
            String type = detect(bytes);
            if (!"application/pdf".equals(type) || !virusScan.scan(bytes).clean()) throw new IllegalArgumentException("TRAINING_FILE_REJECTED");
            String original = file.getOriginalFilename() == null ? "scan" : file.getOriginalFilename().replace('\\', '/');
            original = original.substring(original.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "");
            FileStorageService.StorageWriteResult stored;
            try {
                stored = files.storeReportArtifact("training/legacy-evidence/" + revisionId + "/" + id + ".pdf", new ByteArrayInputStream(bytes), type);
            } catch (IOException e) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "TRAINING_FILE_UNAVAILABLE");
            }
            cleanUpIfNotCommitted(stored.storedPath());
            jdbc.update("""
                insert into training_legacy_evidence(id, revision_id, activity_id, document_number, revision_number, document_name, completion_date, paper_training_number, original_name, provider, stored_path, content_type, size_bytes, sha256, submitted_by, status, signature_id)
                values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'FILED',?)
                """, id, revisionId, activityId, r.get("document_number"), r.get("revision_number"), r.get("document_name"), r.get("training_completion_date"), r.get("training_number"),
                    original.length() > 255 ? original.substring(0, 255) : original, stored.provider(), stored.storedPath(), type, bytes.length, sha256(bytes), actor.getId(), signatureId);
        }
        if (activityId != null) addPeople(actor, id, activityId, null, "TRAINEE", trainees);
        audit.logAs(actor, TYPE, label(r), id, "TRAINING_LEGACY_EVIDENCE_FILED", null, "FILED",
                (notEvidenced ? "Declared without evidence: " + reason.trim() : "Scan of the paper record attached") + (trainees.isEmpty() ? "" : "; " + trainees.size() + " trainee(s) named"));
        return id;
    }

    /**
     * The scan is written to the store at once, but the evidence row belongs to a transaction that can still roll back (the import is all or nothing). When it does, the scan has no row that
     * points to it. The store is locked (Object Lock), so it cannot be removed: asking to remove it makes the storage service write the blocked deletion down for the reconciliation, which is
     * the only way such an object is ever found again.
     */
    void cleanUpIfNotCommitted(String storedPath) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == TransactionSynchronization.STATUS_COMMITTED) return;
                try {
                    files.deleteReportArtifact(storedPath);
                } catch (Exception blocked) {
                    // locked by retention: the storage service has recorded it (DELETE_BLOCKED_BY_RETENTION)
                }
            }
        });
    }

    private void addPeople(UserAccount actor, UUID evidenceId, UUID activityId, UUID revisionId, String role, List<UUID> persons) {
        for (UUID person : persons) {
            jdbc.update("insert into training_legacy_people(id, evidence_id, activity_id, revision_id, person_user_id, role, created_by) select ?,?,?,?,u.id,?,? from app_users u where u.id = ? on conflict do nothing",
                    UUID.randomUUID(), evidenceId, activityId, revisionId, role, actor.getId(), person);
        }
    }

    /**
     * Writes the training records of the persons named with a verified evidence: a record for each trainee and each revision that shares the activity, and the initial record (D-45) of
     * the author, reviewers and approver of a revision that are users of the system (method SIGNATORY, source LEGACY_IMPORT: the unique index of the native initial record allows one
     * for each person and activity, and a number shared by several documents needs one for each document). {@code onlyRevision} limits it to one revision (a revision that joined
     * the activity later). A person who already has the record of the document and revision is skipped, so verifying again changes nothing.
     */
    private int writeRecords(UUID evidenceId, UUID onlyRevision) {
        int trainees = jdbc.update("""
            insert into training_records(id, person_user_id, activity_id, training_number, topic_text, document_number, document_revision, completed_on, method, result, source,
                                         employee_code, full_name, department, position, content_sha256)
            select gen_random_uuid(), u.id, a.id, a.training_number, coalesce(nullif(btrim(a.paper_topic), ''), d.document_name), d.document_number, r.revision_number, r.training_completion_date, 'PAPER', 'ATTENDED', 'LEGACY_IMPORT',
                   u.employee_code, u.full_name, u.department, u.position,
                   encode(sha256(convert_to(a.training_number || '|' || u.id || '|' || d.document_number || '|' || r.revision_number || '|' || r.training_completion_date || '|LEGACY_IMPORT', 'UTF8')), 'hex')
              from training_legacy_people p join training_activities a on a.id = p.activity_id join document_revisions r on r.training_activity_id = a.id
              join documents d on d.id = r.document_id join app_users u on u.id = p.person_user_id
             where p.evidence_id = ? and p.role = 'TRAINEE' and r.training_completion_date is not null and (?::uuid is null or r.id = ?::uuid)
               and not exists (select 1 from training_records x where x.person_user_id = u.id and x.activity_id = a.id and x.document_number = d.document_number
                               and x.document_revision = r.revision_number and x.source = 'LEGACY_IMPORT')
            """, evidenceId, onlyRevision, onlyRevision);
        int signatories = jdbc.update("""
            insert into training_records(id, person_user_id, activity_id, training_number, topic_text, document_number, document_revision, completed_on, method, result, source,
                                         employee_code, full_name, department, position, content_sha256)
            select gen_random_uuid(), u.id, a.id, a.training_number, coalesce(nullif(btrim(a.paper_topic), ''), d.document_name), d.document_number, r.revision_number, r.training_completion_date, 'SIGNATORY', 'READ', 'LEGACY_IMPORT',
                   u.employee_code, u.full_name, u.department, u.position,
                   encode(sha256(convert_to(a.training_number || '|' || u.id || '|' || d.document_number || '|' || r.revision_number || '|' || r.training_completion_date || '|LEGACY_SIGNATORY', 'UTF8')), 'hex')
              from training_legacy_people p join training_activities a on a.id = p.activity_id join document_revisions r on r.id = p.revision_id
              join documents d on d.id = r.document_id join app_users u on u.id = p.person_user_id
             where p.evidence_id = ? and p.role = 'SIGNATORY' and r.training_completion_date is not null and (?::uuid is null or r.id = ?::uuid)
               and not exists (select 1 from training_records x where x.person_user_id = u.id and x.activity_id = a.id and x.document_number = d.document_number
                               and x.document_revision = r.revision_number and x.source = 'LEGACY_IMPORT')
            """, evidenceId, onlyRevision, onlyRevision);
        return trainees + signatories;
    }

    // ----------------------------------------------------------------------------------------------------------------------------- helpers

    private Map<String, Object> queueRow(UserAccount actor, UUID revisionId) {
        Map<String, Object> page = queue(actor, null, null, null, null, 1, 100);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) page.get("data");
        return rows.stream().filter(x -> revisionId.equals(x.get("revisionId"))).findFirst().orElse(Map.of());
    }

    private Map<String, Object> revision(UUID revisionId) {
        Map<String, Object> r = jdbc.queryForList("""
            select r.id, r.revision_number, r.training_completion_date, r.training_number, r.training_origin, r.requires_training, r.training_activity_id,
                   d.id as document_id, d.document_number, d.document_name, d.department_id
              from document_revisions r join documents d on d.id = r.document_id where r.id=?
            """, revisionId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (!"LEGACY_IMPORT".equals(r.get("training_origin")) || !Boolean.TRUE.equals(r.get("requires_training"))) throw new IllegalArgumentException("TRAINING_LEGACY_NOT_APPLICABLE");
        return r;
    }

    private static String label(Map<String, Object> r) {
        return "Legacy training evidence " + r.get("document_number") + " Rev " + r.get("revision_number");
    }

    static String detect(byte[] b) {
        if (b.length > 5 && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F') return "application/pdf";
        if (b.length > 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return "image/png";
        if (b.length > 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "image/jpeg";
        return null;
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
