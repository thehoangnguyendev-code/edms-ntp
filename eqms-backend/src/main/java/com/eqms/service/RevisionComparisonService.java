package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.document.RevisionComparisonBaselineResponse;
import com.eqms.dto.document.RevisionComparisonInfoResponse;
import com.eqms.dto.document.RevisionSideBySideResponse;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.util.DocxMarkupCleaner;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * "Compare with Effective" (DEC-DOC-2026-11-27-01): shows what the revision being drafted, reviewed or approved changed against the Effective revision of the
 * same document. The comparison is a reading aid, not a record: it is made by the Document Server into a temporary cache keyed by the checksums of both files,
 * may be deleted at any time and is made again when either file changes. Neither stored file is changed. Whoever may view the revision may open it, read only.
 */
@Service
public class RevisionComparisonService {
    private static final Logger log = LoggerFactory.getLogger(RevisionComparisonService.class);
    private static final Set<String> STAGES = Set.of("DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL");
    public static final String TOKEN_PURPOSE = "revision-compare";

    private final DocumentRevisionRepository revisionRepository;
    private final CurrentUserService currentUserService;
    private final DocumentAuthorizationService documentAuthorizationService;
    private final FileStorageService fileStorageService;
    private final OnlyOfficeDocumentEditService onlyOfficeDocumentEditService;
    private final AuditTrailService auditTrailService;
    private final Path cacheDirectory = Path.of(System.getProperty("java.io.tmpdir"), "eqms-revision-compare");

    public RevisionComparisonService(DocumentRevisionRepository revisionRepository, CurrentUserService currentUserService,
                                     DocumentAuthorizationService documentAuthorizationService, FileStorageService fileStorageService,
                                     OnlyOfficeDocumentEditService onlyOfficeDocumentEditService, AuditTrailService auditTrailService) {
        this.revisionRepository = revisionRepository;
        this.currentUserService = currentUserService;
        this.documentAuthorizationService = documentAuthorizationService;
        this.fileStorageService = fileStorageService;
        this.onlyOfficeDocumentEditService = onlyOfficeDocumentEditService;
        this.auditTrailService = auditTrailService;
    }

    @Transactional(readOnly = true)
    public RevisionComparisonInfoResponse info(UUID revisionId) {
        DocumentRevisionRecord revision = requireViewable(revisionId, currentUserService.requireCurrentUser());
        DocumentRevisionRecord baseline = findBaseline(revision);
        String reason = unavailableReason(revision, baseline);
        return new RevisionComparisonInfoResponse(reason == null, reason, baseline == null ? null : baseline.getRevisionNumber());
    }

    /** The revisions this one can be compared with: those that are or were Effective, have a Word file and that the person may view; the Effective one first. */
    @Transactional(readOnly = true)
    public List<RevisionComparisonBaselineResponse> baselines(UUID revisionId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireViewable(revisionId, currentUser);
        if (revision.getStatus() == null || !STAGES.contains(revision.getStatus().getCode()) || !isDocx(revision)) {
            return List.of();
        }
        return revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(revision.getDocument().getId()).stream()
                .filter(candidate -> isBaseline(revision, candidate))
                .filter(candidate -> isCurrentEffective(candidate) || documentAuthorizationService.canViewRevision(currentUser, candidate))
                .sorted(java.util.Comparator.comparing((DocumentRevisionRecord candidate) -> !isCurrentEffective(candidate)))
                .map(candidate -> new RevisionComparisonBaselineResponse(candidate.getId(), candidate.getRevisionNumber(),
                        candidate.getStatus().getCode(), candidate.getEffectiveDate()))
                .toList();
    }

    private static boolean isCurrentEffective(DocumentRevisionRecord revision) {
        return revision.getStatus() != null && "EFFECTIVE".equals(revision.getStatus().getCode());
    }

    /** Effective now, or obsoleted after it had been published; never a draft or a cancelled revision. */
    private static boolean isBaseline(DocumentRevisionRecord revision, DocumentRevisionRecord candidate) {
        if (candidate.getId().equals(revision.getId()) || candidate.getStatus() == null || !isDocx(candidate)
                || !candidate.getDocument().getId().equals(revision.getDocument().getId())) {
            return false;
        }
        return isCurrentEffective(candidate) || ("OBSOLETED".equals(candidate.getStatus().getCode()) && candidate.getPublishedAt() != null);
    }

    /** The chosen baseline, checked against this revision; without a choice, the Effective revision. */
    private DocumentRevisionRecord resolveBaseline(DocumentRevisionRecord revision, UUID baselineId) {
        if (baselineId == null) {
            return findBaseline(revision);
        }
        return revisionRepository.findById(baselineId)
                .filter(candidate -> isBaseline(revision, candidate))
                .orElseThrow(() -> new com.eqms.exception.RevisionLifecycleConflictException("REVISION_COMPARISON_UNAVAILABLE",
                        "The chosen revision cannot be compared with this one."));
    }

    @Transactional
    public ObjectNode viewConfig(UUID revisionId, UUID baselineId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireViewable(revisionId, currentUser);
        DocumentRevisionRecord baseline = resolveBaseline(revision, baselineId);
        if (baseline != null && !isCurrentEffective(baseline)) {
            documentAuthorizationService.requireCanViewRevision(currentUser, baseline);
        }
        String reason = unavailableReason(revision, baseline);
        if (reason != null) {
            throw new com.eqms.exception.RevisionLifecycleConflictException("REVISION_COMPARISON_UNAVAILABLE",
                    "This revision cannot be compared with an Effective revision (" + reason + ").");
        }
        Path comparison = buildIfMissing(revision, baseline);
        String status = revision.getStatus().getCode();
        auditTrailService.logAs(currentUser, "REVISION", revision.getRevisionName(), revision.getId(), "VIEW_COMPARISON", status, status,
                "Viewed the comparison of revision " + revision.getRevisionNumber() + " with revision " + baseline.getRevisionNumber());
        return onlyOfficeDocumentEditService.buildComparisonViewConfig(
                TOKEN_PURPOSE,
                revision.getId(),
                comparison.getFileName().toString().replace(".docx", ""),
                baseline.getId(),
                "Compare " + baseline.getRevisionNumber() + " - " + revision.getRevisionNumber() + ".docx",
                currentUser);
    }

    /** The bytes the Document Server fetches for the viewer; the caller has already verified the token of this revision. */
    @Transactional(readOnly = true)
    public byte[] bytesForViewer(UUID revisionId, UUID baselineId, String announced) throws IOException {
        DocumentRevisionRecord revision = revisionRepository.findById(revisionId)
                .orElseThrow(() -> new IllegalArgumentException("Revision not found"));
        DocumentRevisionRecord baseline = resolveBaseline(revision, baselineId);
        if (unavailableReason(revision, baseline) != null) {
            throw new IllegalStateException("The comparison is no longer available for this revision");
        }
        Path comparison = buildIfMissing(revision, baseline);
        if (announced == null || !comparison.getFileName().toString().equals(announced + ".docx")) {
            throw new com.eqms.exception.RevisionLifecycleConflictException("REVISION_FILE_CHANGED",
                    "A file was saved again after this comparison was opened. Open the comparison again.");
        }
        return Files.readAllBytes(comparison);
    }

    public static final String PANE_BASELINE_PURPOSE = "revision-side-final";
    public static final String PANE_CURRENT_PURPOSE = "revision-side-current";

    /**
     * The two panes of the side-by-side view: left the chosen revision as it was published (final text), right the revision being worked on, with its markup. Each pane
     * names its own revision and content, so a pane can never show another file than the one its label says.
     */
    @Transactional
    public RevisionSideBySideResponse sideBySide(UUID revisionId, UUID baselineId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = requireViewable(revisionId, currentUser);
        DocumentRevisionRecord baseline = resolveBaseline(revision, baselineId);
        if (baseline != null && !isCurrentEffective(baseline)) {
            documentAuthorizationService.requireCanViewRevision(currentUser, baseline);
        }
        String reason = unavailableReason(revision, baseline);
        if (reason != null) {
            throw new com.eqms.exception.RevisionLifecycleConflictException("REVISION_COMPARISON_UNAVAILABLE",
                    "This revision cannot be compared with an Effective revision (" + reason + ").");
        }
        RevisionSideBySideResponse.Pane left = pane(baseline, PANE_BASELINE_PURPOSE, false, currentUser);
        RevisionSideBySideResponse.Pane right = pane(revision, PANE_CURRENT_PURPOSE, true, currentUser);
        String status = revision.getStatus().getCode();
        auditTrailService.logAs(currentUser, "REVISION", revision.getRevisionName(), revision.getId(), "VIEW_COMPARISON", status, status,
                "Viewed revision " + revision.getRevisionNumber() + " side by side with revision " + baseline.getRevisionNumber());
        return new RevisionSideBySideResponse(left, right);
    }

    private RevisionSideBySideResponse.Pane pane(DocumentRevisionRecord revision, String purpose, boolean showMarkup, UserAccount currentUser) {
        byte[] content = verifiedContent(revision);
        String sha = sha256(content);
        String fileName = revision.getRevisionNumber() + " - " + revision.getFileName();
        return new RevisionSideBySideResponse.Pane(revision.getId(), revision.getRevisionNumber(), revision.getStatus().getCode(), revision.getSourceFileChecksum(),
                onlyOfficeDocumentEditService.buildSidePaneConfig(purpose, revision.getId(), sha, "&content=" + sha, showMarkup, fileName, currentUser));
    }

    /** The stored file, refused when it is not the one recorded for this revision. */
    private byte[] verifiedContent(DocumentRevisionRecord revision) {
        try {
            byte[] content = fileStorageService.readFile(revision.getFilePath());
            if (!com.eqms.util.SourceChecksum.matches(revision.getSourceFileChecksum(), content)) {
                log.error("The stored file of revision {} does not match its recorded checksum", revision.getId());
                throw new com.eqms.exception.RevisionLifecycleConflictException("REVISION_FILE_INTEGRITY_MISMATCH",
                        "The stored file of revision " + revision.getRevisionNumber() + " does not match its recorded checksum. Contact an administrator.");
            }
            return content;
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to read the file of revision " + revision.getRevisionNumber(), ex);
        }
    }

    /**
     * The bytes of a pane; the caller has verified the token, which names this revision. {@code content} is the checksum the pane was opened for: if the file has been
     * saved again since, nothing is returned, so a pane never shows other content than its configuration announced.
     */
    @Transactional(readOnly = true)
    public byte[] paneBytes(UUID revisionId, String purpose, String content) throws IOException {
        DocumentRevisionRecord revision = revisionRepository.findById(revisionId)
                .orElseThrow(() -> new IllegalArgumentException("Revision not found"));
        if (!isDocx(revision)) {
            throw new IllegalStateException("The revision has no Word file");
        }
        byte[] stored = verifiedContent(revision);
        if (content == null || !content.equalsIgnoreCase(sha256(stored))) {
            throw new com.eqms.exception.RevisionLifecycleConflictException("REVISION_FILE_CHANGED",
                    "The file was saved again after this view was opened. Open the comparison again.");
        }
        return PANE_BASELINE_PURPOSE.equals(purpose) ? DocxMarkupCleaner.clean(stored) : stored;
    }

    private DocumentRevisionRecord requireViewable(UUID revisionId, UserAccount currentUser) {
        DocumentRevisionRecord revision = revisionRepository.findById(revisionId)
                .orElseThrow(() -> new IllegalArgumentException("Revision not found"));
        documentAuthorizationService.requireCanViewRevision(currentUser, revision);
        return revision;
    }

    private DocumentRevisionRecord findBaseline(DocumentRevisionRecord revision) {
        return revisionRepository
                .findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(revision.getDocument().getId(), "EFFECTIVE")
                .filter(effective -> !effective.getId().equals(revision.getId()))
                .orElse(null);
    }

    private String unavailableReason(DocumentRevisionRecord revision, DocumentRevisionRecord baseline) {
        if (revision.getStatus() == null || !STAGES.contains(revision.getStatus().getCode())) {
            return "WRONG_STAGE";
        }
        if (!isDocx(revision)) {
            return "NO_SOURCE_FILE";
        }
        if (baseline == null) {
            return "NO_EFFECTIVE_REVISION";
        }
        return isDocx(baseline) ? null : "EFFECTIVE_HAS_NO_DOCX";
    }

    private static boolean isDocx(DocumentRevisionRecord revision) {
        return StringUtils.hasText(revision.getFilePath())
                && StringUtils.hasText(revision.getFileName())
                && revision.getFileName().toLowerCase(Locale.ROOT).endsWith(".docx");
    }

    private Path buildIfMissing(DocumentRevisionRecord revision, DocumentRevisionRecord baseline) {
        try {
            // Refused when either stored file is not the one recorded for its revision.
            byte[] current = verifiedContent(revision);
            byte[] effective = verifiedContent(baseline);
            // Keyed by the content actually read, so a file saved a moment ago can never show an older comparison.
            // Both revisions are in the key: two baselines with the same content still make two comparisons, each with its own title.
            String key = sha256(("final-text|" + revision.getId() + "|" + baseline.getId() + "|" + sha256(effective) + "|" + sha256(current)).getBytes(StandardCharsets.UTF_8)).substring(0, 32);
            Files.createDirectories(cacheDirectory);
            Path target = cacheDirectory.resolve(key + ".docx");
            if (Files.exists(target)) {
                return target;
            }
            List<Path> temporary = new java.util.ArrayList<>();
            try {
                Path oldFile = Files.createTempFile(cacheDirectory, "base-", ".docx");
                temporary.add(oldFile);
                Path newFile = Files.createTempFile(cacheDirectory, "current-", ".docx");
                temporary.add(newFile);
                Files.write(oldFile, DocxMarkupCleaner.clean(effective));
                Files.write(newFile, DocxMarkupCleaner.clean(current));
                byte[] result;
                try {
                    result = onlyOfficeDocumentEditService.compareDocuments(oldFile, newFile);
                } catch (IllegalStateException ex) {
                    // The response carries a short message only: the cause (HTTP status, builder error code) is needed by whoever operates the Document Server.
                    log.error("Comparison of revision {} with {} failed", revision.getId(), baseline.getId(), ex);
                    throw ex;
                }
                Path partial = Files.createTempFile(cacheDirectory, "result-", ".part");
                temporary.add(partial);
                Files.write(partial, result);
                Files.move(partial, target, StandardCopyOption.REPLACE_EXISTING);
                return target;
            } finally {
                for (Path path : temporary) {
                    Files.deleteIfExists(path);
                }
            }
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to prepare the document comparison", ex);
        }
    }

    private static String sha256(byte[] content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
