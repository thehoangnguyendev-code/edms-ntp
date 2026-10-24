package com.eqms.service;

import com.eqms.util.DateTimeFormatUtils;
import com.eqms.auth.CurrentUserService;
import com.eqms.dto.controlledcopyrecall.RecallBatchCommitRequest;
import com.eqms.dto.controlledcopyrecall.RecallBatchResponse;
import com.eqms.dto.controlledcopyrecall.RecallBatchSummaryResponse;
import com.eqms.dto.controlledcopyrecall.RecallItemCopyResponse;
import com.eqms.dto.controlledcopyrecall.RecallItemResponse;
import com.eqms.dto.controlledcopyrecall.RecallItemUpdateRequest;
import com.eqms.entity.ControlledCopyRecallBatch;
import com.eqms.entity.ControlledCopyRecallItem;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserAccount;
import com.eqms.exception.RecallBatchNotReadyException;
import com.eqms.repository.ControlledCopyRecallBatchRepository;
import com.eqms.repository.ControlledCopyRecallItemRepository;
import com.eqms.repository.ControlledCopyRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Recalls many paper Controlled Copies at once from their scans (Decision COPY-RECALL-SCAN-2026-10-06).
 *
 * <p>Two steps, because a QR code identifies which copy a scan belongs to but cannot prove the paper is the original,
 * complete and correct: that physical check stays with the DCO, who attests it by signing.</p>
 * <ol>
 *   <li><b>Draft</b> -- the DCO uploads up to {@value #MAX_FILES} scans. Each is type-checked from its bytes, malware
 *       scanned (a scanner that is enabled but unreachable fails the upload, never skips the scan), its QR code read, and
 *       matched to a copy. Nothing about any copy changes yet. The DCO reviews, excludes scans, or identifies a copy by number.</li>
 *   <li><b>Commit</b> -- every copy still ready is re-validated against its CURRENT state, then ONE electronic signature
 *       covers the reviewed list. Each copy is recalled with its own audit entry (linked to that signature) and its scan is
 *       registered as a record. Commit is all-or-nothing: if anything is no longer recallable nothing changes and the DCO
 *       is told which scans to fix or exclude.</li>
 * </ol>
 * Only copies that carry a scan code (printed since QR codes were introduced) can be recalled this way.
 */
@Service
public class ControlledCopyRecallBatchService {

    public static final int MAX_FILES = 50;
    public static final long MAX_FILE_BYTES = 25L * 1024 * 1024;
    private static final String PERMISSION_RECALL = "documents.controlled_copy.recall";
    private static final String ENTITY_TYPE = "Controlled Copy Recall Batch";
    private static final String SIGNATURE_ENTITY_TYPE = "ControlledCopyRecallBatch";
    /** Same meaning as a single Recall: the signer attests the copies were recalled. */
    private static final String SIGNATURE_MEANING = "CONTROLLED_COPY_RECALLED";
    private static final String STATUS_DISTRIBUTED = "DISTRIBUTED";
    private static final String STATUS_OBSOLETED = "OBSOLETED";
    private static final ZoneId SYSTEM_ZONE = DateTimeFormatUtils.ZONE;
    private static final long CLOCK_SKEW_SECONDS = 120;

    private final ControlledCopyRecallBatchRepository batchRepository;
    private final ControlledCopyRecallItemRepository itemRepository;
    private final ControlledCopyRepository controlledCopyRepository;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final DocumentAuthorizationService documentAuthorizationService;
    private final ControlledCopyAuthorizationService controlledCopyAuthorizationService;
    private final ControlledCopyService controlledCopyService;
    private final ExecutedRecordService executedRecordService;
    private final ClamAvScanService clamAvScanService;
    private final FileStorageService fileStorageService;
    private final AuditTrailService auditTrailService;
    private final ElectronicSignatureService electronicSignatureService;
    private final SignatureTokenConsumptionService signatureTokenConsumptionService;

    public ControlledCopyRecallBatchService(
            ControlledCopyRecallBatchRepository batchRepository,
            ControlledCopyRecallItemRepository itemRepository,
            ControlledCopyRepository controlledCopyRepository,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService,
            DocumentAuthorizationService documentAuthorizationService,
            ControlledCopyAuthorizationService controlledCopyAuthorizationService,
            ControlledCopyService controlledCopyService,
            ExecutedRecordService executedRecordService,
            ClamAvScanService clamAvScanService,
            FileStorageService fileStorageService,
            AuditTrailService auditTrailService,
            ElectronicSignatureService electronicSignatureService,
            SignatureTokenConsumptionService signatureTokenConsumptionService
    ) {
        this.batchRepository = batchRepository;
        this.itemRepository = itemRepository;
        this.controlledCopyRepository = controlledCopyRepository;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.documentAuthorizationService = documentAuthorizationService;
        this.controlledCopyAuthorizationService = controlledCopyAuthorizationService;
        this.controlledCopyService = controlledCopyService;
        this.executedRecordService = executedRecordService;
        this.clamAvScanService = clamAvScanService;
        this.fileStorageService = fileStorageService;
        this.auditTrailService = auditTrailService;
        this.electronicSignatureService = electronicSignatureService;
        this.signatureTokenConsumptionService = signatureTokenConsumptionService;
    }

    // ------------------------------------------------------------------------------------------------------------
    // Draft: upload, review
    // ------------------------------------------------------------------------------------------------------------

    @Transactional
    public RecallBatchResponse createDraft(List<MultipartFile> files) {
        UserAccount actor = currentUserService.requireCurrentUser();
        requireOperator(actor);
        List<MultipartFile> uploads = nonEmpty(files);
        requireFileCount(uploads.size());

        ControlledCopyRecallBatch batch = new ControlledCopyRecallBatch();
        batch.setId(UUID.randomUUID());
        batch.setBatchNumber("RCB-" + LocalDate.now(SYSTEM_ZONE).getYear() + "-"
                + String.format("%05d", batchRepository.nextBatchSequence()));
        batch.setStatus(ControlledCopyRecallBatch.STATUS_DRAFT);
        batch.setCreatedBy(actor);
        batchRepository.saveAndFlush(batch);

        addItems(batch, uploads, 0);
        revalidate(batch, actor);
        auditTrailService.logAs(actor, ENTITY_TYPE, batch.getBatchNumber(), batch.getId(), "CREATE", null, batch.getStatus(),
                "Uploaded " + uploads.size() + " scan(s) for recall");
        return toResponse(batch);
    }

    @Transactional
    public RecallBatchResponse addFiles(UUID batchId, List<MultipartFile> files) {
        UserAccount actor = currentUserService.requireCurrentUser();
        requireOperator(actor);
        ControlledCopyRecallBatch batch = requireOwnDraft(batchId, actor);
        List<MultipartFile> uploads = nonEmpty(files);
        long existing = itemRepository.countByBatch_Id(batchId);
        requireFileCount(existing + uploads.size());

        // Item numbers are never reused: placing a loose page removes an item, which leaves a gap.
        int lastNo = itemRepository.findAllByBatch_IdOrderByItemNoAsc(batchId).stream().mapToInt(ControlledCopyRecallItem::getItemNo).max().orElse(0);
        addItems(batch, uploads, lastNo);
        revalidate(batch, actor);
        auditTrailService.logAs(actor, ENTITY_TYPE, batch.getBatchNumber(), batch.getId(), "ADD_FILES", batch.getStatus(), batch.getStatus(),
                "Added " + uploads.size() + " scan(s)");
        return toResponse(batch);
    }

    /**
     * The scans of a batch, searched and sorted here on the server (the screen sends only the query). Search looks at the file
     * name, the copy number, the document number and title, the recipient and the message shown for the scan. A batch holds at
     * most {@value #MAX_FILES} scans, so no paging is needed. Counts of the batch are not affected by the search.
     */
    @Transactional(readOnly = true)
    public List<RecallItemResponse> listItems(UUID batchId, String search, String sortBy, String sortDirection) {
        UserAccount actor = currentUserService.requireCurrentUser();
        requireOperator(actor);
        requireBatch(batchId);
        String needle = StringUtils.hasText(search) ? search.trim().toLowerCase(java.util.Locale.ROOT) : null;
        java.util.Comparator<ControlledCopyRecallItem> order = switch (sortBy == null ? "" : sortBy.trim().toLowerCase(java.util.Locale.ROOT)) {
            case "file" -> java.util.Comparator.comparing(i -> lower(i.getFileName()));
            case "code" -> java.util.Comparator.comparing(i -> lower(i.getQrStatus()));
            case "copy" -> java.util.Comparator.comparing(i -> i.getControlledCopy() == null ? "" : lower(i.getControlledCopy().getControlledCopyNumber()));
            case "size" -> java.util.Comparator.comparingLong(ControlledCopyRecallItem::getFileSize);
            case "document" -> java.util.Comparator.comparing(i -> i.getControlledCopy() == null ? "" : lower(i.getControlledCopy().getDocumentNumber()));
            case "recipient" -> java.util.Comparator.comparing(i -> i.getControlledCopy() == null ? "" : lower(recipientName(i.getControlledCopy())));
            case "result" -> java.util.Comparator.comparing(i -> lower(i.isExcluded() ? "excluded" : i.getMatchStatus()));
            default -> java.util.Comparator.comparingInt(ControlledCopyRecallItem::getItemNo);
        };
        if ("desc".equalsIgnoreCase(sortDirection)) {
            order = order.reversed();
        }
        return itemRepository.findAllByBatch_IdOrderByItemNoAsc(batchId).stream()
                .filter(item -> needle == null || matches(item, needle))
                .sorted(order)
                .map(this::toItemResponse)
                .toList();
    }

    private static String recipientName(ControlledCopyRecord copy) {
        return copy.getRecipientUser() != null ? copy.getRecipientUser().getFullName() : copy.getRecipientName();
    }

    private static String lower(String value) {
        return value == null ? "" : value.toLowerCase(java.util.Locale.ROOT);
    }

    private static boolean matches(ControlledCopyRecallItem item, String needle) {
        ControlledCopyRecord copy = item.getControlledCopy();
        for (String field : new String[] {
                item.getFileName(), item.getMatchMessage(), item.getOutcomeMessage(),
                copy == null ? null : copy.getControlledCopyNumber(), copy == null ? null : copy.getDocumentNumber(),
                copy == null ? null : copy.getDocumentTitle(),
                copy == null ? null : recipientName(copy)}) {
            if (lower(field).contains(needle)) {
                return true;
            }
        }
        return false;
    }

    @Transactional(readOnly = true)
    public RecallBatchResponse get(UUID batchId) {
        UserAccount actor = currentUserService.requireCurrentUser();
        requireOperator(actor);
        return toResponse(requireBatch(batchId));
    }

    @Transactional(readOnly = true)
    public List<RecallBatchSummaryResponse> myDrafts() {
        UserAccount actor = currentUserService.requireCurrentUser();
        requireOperator(actor);
        return batchRepository.findAllByCreatedBy_IdAndStatusOrderByCreatedAtDesc(actor.getId(), ControlledCopyRecallBatch.STATUS_DRAFT)
                .stream()
                .map(batch -> new RecallBatchSummaryResponse(batch.getId().toString(), batch.getBatchNumber(), batch.getStatus(),
                        batch.getCreatedAt(), (int) itemRepository.countByBatch_Id(batch.getId())))
                .toList();
    }

    @Transactional
    public RecallBatchResponse updateItem(UUID batchId, UUID itemId, RecallItemUpdateRequest request) {
        UserAccount actor = currentUserService.requireCurrentUser();
        requireOperator(actor);
        ControlledCopyRecallBatch batch = requireOwnDraft(batchId, actor);
        ControlledCopyRecallItem item = itemRepository.findByIdAndBatch_Id(itemId, batchId)
                .orElseThrow(() -> new IllegalArgumentException("Scan not found in this recall batch"));
        if (request == null) {
            throw new IllegalArgumentException("Nothing to change");
        }
        if (Boolean.TRUE.equals(request.clearMatch())) {
            item.setControlledCopy(null);
            item.setMatchSource(null);
        }
        if (StringUtils.hasText(request.copyNumber())) {
            String number = request.copyNumber().trim();
            ControlledCopyRecord copy = controlledCopyRepository.findByControlledCopyNumberIgnoreCase(number)
                    .orElseThrow(() -> new IllegalArgumentException("No controlled copy has the number \"" + number + "\"."));
            if (isLoosePage(item)) {
                placeLoosePage(batch, item, copy, request.pageNumber(), actor);
                revalidate(batch, actor);
                return toResponse(batch);
            }
            if (item.getPageNumbers() != null) {
                item.setExpectedPages(copyPageCount(copy));
            }
            item.setControlledCopy(copy);
            item.setMatchSource(ControlledCopyRecallItem.SOURCE_MANUAL);
            auditTrailService.logAs(actor, ENTITY_TYPE, batch.getBatchNumber(), batch.getId(), "MATCH_ITEM", batch.getStatus(), batch.getStatus(),
                    "Scan " + item.getItemNo() + " (" + item.getFileName() + ") matched by hand to controlled copy " + copy.getControlledCopyNumber()
                            + (StringUtils.hasText(item.getQrValue()) ? "; the code on the scan read: " + item.getQrValue() : "; no readable code"));
        }
        if (request.excluded() != null && request.excluded() != item.isExcluded()) {
            item.setExcluded(request.excluded());
            auditTrailService.logAs(actor, ENTITY_TYPE, batch.getBatchNumber(), batch.getId(), request.excluded() ? "EXCLUDE_ITEM" : "INCLUDE_ITEM",
                    batch.getStatus(), batch.getStatus(), "Scan " + item.getItemNo() + " (" + item.getFileName() + ")");
        }
        itemRepository.save(item);
        revalidate(batch, actor);
        return toResponse(batch);
    }

    @Transactional
    public RecallBatchResponse discard(UUID batchId) {
        UserAccount actor = currentUserService.requireCurrentUser();
        requireOperator(actor);
        ControlledCopyRecallBatch batch = requireOwnDraft(batchId, actor);
        batch.setStatus(ControlledCopyRecallBatch.STATUS_DISCARDED);
        batchRepository.save(batch);
        // The uploaded scans are kept (not deleted): a discarded draft is still evidence of what was handled.
        auditTrailService.logAs(actor, ENTITY_TYPE, batch.getBatchNumber(), batch.getId(), "DISCARD",
                ControlledCopyRecallBatch.STATUS_DRAFT, batch.getStatus(), "Draft recall batch discarded; no copy was recalled");
        return toResponse(batch);
    }

    /** The uploaded scan, for review before commit and for the preview modal. */
    @Transactional(readOnly = true)
    public ExecutedRecordService.RecordFile previewItemFile(UUID batchId, UUID itemId) throws IOException {
        UserAccount actor = currentUserService.requireCurrentUser();
        requireOperator(actor);
        requireBatch(batchId);
        ControlledCopyRecallItem item = itemRepository.findByIdAndBatch_Id(itemId, batchId)
                .orElseThrow(() -> new IllegalArgumentException("Scan not found in this recall batch"));
        if (!StringUtils.hasText(item.getStoredPath())) {
            throw new IllegalStateException("This scan was rejected and is not stored.");
        }
        byte[] bytes = fileStorageService.readFile(item.getStoredPath(), item.getSha256());
        String sniffed = ControlledCopyScanCodeService.sniffContentType(bytes);
        return new ExecutedRecordService.RecordFile(bytes, sniffed != null ? sniffed : "application/octet-stream", item.getFileName());
    }

    // ------------------------------------------------------------------------------------------------------------
    // Commit
    // ------------------------------------------------------------------------------------------------------------

    @Transactional(noRollbackFor = RecallBatchNotReadyException.class)
    public RecallBatchResponse commit(UUID batchId, RecallBatchCommitRequest request) {
        UserAccount actor = currentUserService.requireCurrentUser();
        requireOperator(actor);
        ControlledCopyRecallBatch batch = requireOwnDraft(batchId, actor);
        if (request == null) {
            throw new IllegalArgumentException("A reason and an electronic signature are required");
        }
        String reason = request.reason() == null ? null : request.reason().trim();
        if (!StringUtils.hasText(reason)) {
            throw new IllegalArgumentException("Reason for recall is required.");
        }
        if (!StringUtils.hasText(request.signatureToken())) {
            throw new IllegalArgumentException("Electronic signature is required for recalling controlled copies");
        }

        // Everything that can be checked is checked BEFORE the signature token is consumed, so a rejected commit costs the
        // DCO nothing and changes nothing.
        revalidate(batch, actor);
        List<ControlledCopyRecallItem> items = itemRepository.findAllByBatch_IdOrderByItemNoAsc(batchId);
        List<ControlledCopyRecallItem> included = items.stream().filter(item -> !item.isExcluded()).toList();
        if (included.isEmpty()) {
            throw new IllegalStateException("There is nothing to recall: every scan is excluded.");
        }
        List<String> problems = new ArrayList<>();
        for (ControlledCopyRecallItem item : included) {
            if (!ControlledCopyRecallItem.MATCH_READY.equals(item.getMatchStatus())) {
                problems.add("Scan " + item.getItemNo() + " (" + item.getFileName() + "): "
                        + (StringUtils.hasText(item.getMatchMessage()) ? item.getMatchMessage() : item.getMatchStatus()));
            }
        }
        if (!problems.isEmpty()) {
            throw new RecallBatchNotReadyException("Nothing was recalled. Fix or exclude these scans first: " + String.join(" | ", problems));
        }
        Instant now = Instant.now();
        Instant receivedAt = parseReceivedAt(request.receivedAt(), now);
        for (ControlledCopyRecallItem item : included) {
            Instant distributedAt = item.getControlledCopy().getDistributedAt();
            if (distributedAt != null && receivedAt.isBefore(distributedAt)) {
                throw new IllegalArgumentException("The paper cannot have been received before controlled copy "
                        + item.getControlledCopy().getControlledCopyNumber() + " was distributed.");
            }
        }

        signatureTokenConsumptionService.requireAndConsume(request.signatureToken(), actor);
        List<String> copyNumbers = included.stream().map(item -> item.getControlledCopy().getControlledCopyNumber()).toList();
        ElectronicSignature signature = electronicSignatureService.createEntitySignature(
                SIGNATURE_ENTITY_TYPE, batch.getId(), batch.getBatchNumber(), actor, request.signatureToken(), SIGNATURE_MEANING,
                reason, included.size() + " controlled copies recalled by scan: " + String.join(", ", copyNumbers),
                ControlledCopyRecallBatch.STATUS_DRAFT, ControlledCopyRecallBatch.STATUS_COMMITTED);

        batch.setStatus(ControlledCopyRecallBatch.STATUS_COMMITTED);
        batch.setCommittedBy(actor);
        batch.setCommittedAt(now);
        batch.setReceivedAt(receivedAt);
        batch.setRecallReason(reason);
        batch.setSignatureId(signature.getId());
        batchRepository.saveAndFlush(batch);

        for (ControlledCopyRecallItem item : items) {
            if (item.isExcluded()) {
                item.setOutcome(ControlledCopyRecallItem.OUTCOME_SKIPPED);
                item.setOutcomeMessage("Excluded from the recall by the DCO");
                itemRepository.save(item);
                continue;
            }
            ControlledCopyRecord copy = item.getControlledCopy();
            controlledCopyService.recallFromScanBatch(copy.getId(), actor, reason, receivedAt, batch.getBatchNumber(), signature.getId());
            var record = executedRecordService.recordRecalledCopyScan(
                    copy, item, actor, receivedAt, batch.getId(), batch.getBatchNumber(), signature.getId());
            item.setExecutedRecordId(record.getId());
            item.setOutcome(ControlledCopyRecallItem.OUTCOME_RECALLED);
            item.setOutcomeMessage("Recalled; scan filed as " + record.getRecordNumber());
            itemRepository.save(item);
        }
        auditTrailService.logAs(actor, ENTITY_TYPE, batch.getBatchNumber(), batch.getId(), "COMMIT",
                ControlledCopyRecallBatch.STATUS_DRAFT, batch.getStatus(),
                included.size() + " controlled copy(ies) recalled, " + (items.size() - included.size()) + " scan(s) excluded; received "
                        + receivedAt + "; reason: " + reason + "; copies: " + String.join(", ", copyNumbers),
                List.of(), signature.getId());
        return toResponse(batch);
    }

    // ------------------------------------------------------------------------------------------------------------
    // Matching
    // ------------------------------------------------------------------------------------------------------------

    private void addItems(ControlledCopyRecallBatch batch, List<MultipartFile> uploads, int alreadyThere) {
        int number = alreadyThere;
        for (MultipartFile upload : uploads) {
            List<ControlledCopyRecallItem> built = buildItems(batch, number + 1, upload);
            for (ControlledCopyRecallItem item : built) {
                itemRepository.save(item);
            }
            number += built.size();
        }
        itemRepository.flush();
    }

    private ControlledCopyRecallItem buildItem(ControlledCopyRecallBatch batch, int itemNo, MultipartFile upload) {
        ControlledCopyRecallItem item = new ControlledCopyRecallItem();
        item.setId(UUID.randomUUID());
        item.setBatch(batch);
        item.setItemNo(itemNo);
        item.setFileName(safeFileName(upload.getOriginalFilename()));
        item.setVirusStatus(ControlledCopyRecallItem.VIRUS_NOT_SCANNED);

        byte[] bytes;
        try {
            bytes = upload.getBytes();
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to read the uploaded file " + item.getFileName(), ex);
        }
        item.setFileSize(bytes.length);
        item.setSha256(sha256(bytes));
        item.setContentType(ControlledCopyScanCodeService.sniffContentType(bytes));

        if (bytes.length == 0) {
            return reject(item, "The file is empty.");
        }
        if (bytes.length > MAX_FILE_BYTES) {
            return reject(item, "The file is larger than " + (MAX_FILE_BYTES / (1024 * 1024)) + " MB.");
        }
        if (!"application/pdf".equals(item.getContentType())) {
            // The file's own bytes decide, never its name or the type the browser claimed. The company scanner produces PDF.
            return reject(item, "Unsupported file: only PDF scans are accepted.");
        }
        if (clamAvScanService.isEnabled()) {
            // Fails the whole upload if the scanner cannot be reached (VirusScanUnavailableException): an unreachable
            // control is never treated as "clean".
            ClamAvScanService.ScanResult scan = clamAvScanService.scan(bytes);
            if (!scan.clean()) {
                item.setVirusStatus(ControlledCopyRecallItem.VIRUS_INFECTED);
                item.setVirusSignature(scan.signatureName());
                return reject(item, "The file was rejected by the virus scanner"
                        + (StringUtils.hasText(scan.signatureName()) ? " (" + scan.signatureName() + ")" : "") + " and was not stored.");
            }
            item.setVirusStatus(ControlledCopyRecallItem.VIRUS_CLEAN);
        }

        // Opened only after the scanner found it clean. It must be a PDF the stamp and watermark can be drawn on.
        String pdfProblem = ControlledCopyScanCodeService.pdfProblem(bytes);
        if (pdfProblem != null) {
            return reject(item, pdfProblem);
        }
        try {
            if (ControlledCopyScanPageAssembler.pageCount(bytes) > ControlledCopyScanCodeService.MAX_SCAN_PAGES) {
                return reject(item, "The scan has more than " + ControlledCopyScanCodeService.MAX_SCAN_PAGES + " pages. Split it into smaller files.");
            }
        } catch (IOException ex) {
            return reject(item, "The PDF could not be opened.");
        }

        try {
            FileStorageService.StorageWriteResult stored = fileStorageService.storeControlledCopyRecallScan(
                    batch.getId(), item.getId(), item.getFileName(), new ByteArrayInputStream(bytes));
            item.setStoredPath(stored.storedPath());
            item.setStorageProvider(stored.provider());
            item.setStorageBucket(stored.bucket());
            item.setStorageObjectKey(stored.objectKey());
            item.setStorageVersionId(stored.versionId());
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to store the scan " + item.getFileName(), ex);
        }

        ControlledCopyScanCodeService.DecodeResult decoded = ControlledCopyScanCodeService.decode(bytes);
        item.setQrStatus(decoded.status());
        item.setQrValue(truncate(decoded.rawValue(), 2000));
        if (decoded.token() != null) {
            Optional<ControlledCopyRecord> copy = controlledCopyRepository.findByScanToken(decoded.token());
            if (copy.isPresent()) {
                item.setControlledCopy(copy.get());
                item.setMatchSource(ControlledCopyRecallItem.SOURCE_QR);
            }
        }
        return item;
    }

    // ------------------------------------------------------------------------------------------------------------
    // Scans that hold loose pages of several copies
    // ------------------------------------------------------------------------------------------------------------

    /**
     * One upload becomes one or more items. A scan whose pages carry per-page codes is split: the pages of each copy are put in
     * page order into one file per copy, and every page that cannot be recognised becomes an item of its own for the DCO to
     * assign by typing the copy number and the page number. A scan with no per-page code at all (an old copy, or a code that
     * cannot be read) stays one item for the whole file, exactly as before.
     */
    private List<ControlledCopyRecallItem> buildItems(ControlledCopyRecallBatch batch, int firstItemNo, MultipartFile upload) {
        ControlledCopyRecallItem whole = buildItem(batch, firstItemNo, upload);
        if (!StringUtils.hasText(whole.getStoredPath())) {
            return List.of(whole); // rejected at upload
        }
        byte[] bytes;
        try {
            bytes = upload.getBytes();
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to read the uploaded file " + whole.getFileName(), ex);
        }
        List<ControlledCopyScanCodeService.PageScan> scans;
        try {
            scans = ControlledCopyScanCodeService.decodePages(bytes);
        } catch (IOException | RuntimeException ex) {
            return List.of(whole);
        }
        Map<String, java.util.TreeMap<Integer, Integer>> pagesByToken = new LinkedHashMap<>();
        Map<String, Set<Integer>> totalsByToken = new HashMap<>();
        Map<String, ControlledCopyRecord> copyByToken = new HashMap<>();
        List<LoosePage> loose = new ArrayList<>();
        boolean paged = false;
        for (ControlledCopyScanCodeService.PageScan scan : scans) {
            ControlledCopyScanCodeService.PageCode code = scan.code();
            if (code != null && code.page() != null) {
                paged = true;
                ControlledCopyRecord copy = copyByToken.get(code.token());
                if (copy == null) {
                    copy = controlledCopyRepository.findByScanToken(code.token()).orElse(null);
                    if (copy != null) {
                        copyByToken.put(code.token(), copy);
                    }
                }
                if (copy == null) {
                    loose.add(new LoosePage(scan, "The code on this page does not belong to any controlled copy."));
                    continue;
                }
                java.util.TreeMap<Integer, Integer> pages = pagesByToken.computeIfAbsent(code.token(), key -> new java.util.TreeMap<>());
                if (pages.containsKey(code.page())) {
                    loose.add(new LoosePage(scan, "Page " + code.page() + " of controlled copy " + copy.getControlledCopyNumber()
                            + " was already found on page " + (pages.get(code.page()) + 1) + " of this scan: this one is a duplicate. Exclude it."));
                    continue;
                }
                pages.put(code.page(), scan.index());
                totalsByToken.computeIfAbsent(code.token(), key -> new java.util.TreeSet<>()).add(code.pages());
            } else {
                loose.add(new LoosePage(scan, looseNote(scan)));
            }
        }
        if (!paged) {
            return List.of(whole);
        }

        List<ControlledCopyRecallItem> built = new ArrayList<>();
        int itemNo = firstItemNo;
        String base = baseName(whole.getFileName());
        for (Map.Entry<String, java.util.TreeMap<Integer, Integer>> entry : pagesByToken.entrySet()) {
            ControlledCopyRecord copy = copyByToken.get(entry.getKey());
            List<Integer> numbers = new ArrayList<>(entry.getValue().keySet());
            List<Integer> sourceIndexes = new ArrayList<>(entry.getValue().values());
            Set<Integer> totals = totalsByToken.get(entry.getKey());
            ControlledCopyRecallItem item = derivedItem(batch, itemNo++, whole, base + " - " + copy.getControlledCopyNumber() + ".pdf",
                    pdfOf(bytes, sourceIndexes));
            item.setQrStatus(ControlledCopyRecallItem.QR_DECODED);
            item.setQrValue(truncate(ControlledCopyScanCodeService.pagePayload(entry.getKey(), numbers.get(0), totals.iterator().next())
                    + (numbers.size() > 1 ? " (+" + (numbers.size() - 1) + " more pages)" : ""), 2000));
            item.setControlledCopy(copy);
            item.setMatchSource(ControlledCopyRecallItem.SOURCE_QR);
            item.setPageNumbers(joinNumbers(numbers));
            item.setSourcePages(describePages(whole.getFileName(), sourceIndexes));
            if (totals.size() == 1) {
                item.setExpectedPages(totals.iterator().next());
            } else {
                item.setPageNote("The pages of this copy disagree about how many pages it has (" + joinNumbers(new ArrayList<>(totals)) + ").");
            }
            built.add(item);
        }
        for (LoosePage page : loose) {
            int index = page.scan().index();
            ControlledCopyRecallItem item = derivedItem(batch, itemNo++, whole, base + " - page " + (index + 1) + ".pdf", pdfOf(bytes, List.of(index)));
            item.setQrStatus(page.scan().status());
            item.setQrValue(truncate(page.scan().rawValue(), 2000));
            item.setSourcePages(describePages(whole.getFileName(), List.of(index)));
            item.setPageNote(page.note());
            built.add(item);
        }
        auditTrailService.logAs(currentUserService.requireCurrentUser(), ENTITY_TYPE, batch.getBatchNumber(), batch.getId(), "SPLIT_SCAN",
                batch.getStatus(), batch.getStatus(),
                "Scan " + whole.getFileName() + " (" + scans.size() + " pages, SHA-256 " + whole.getSha256() + ") was read page by page: "
                        + pagesByToken.size() + " controlled copy(ies) put in page order, " + loose.size() + " page(s) not recognised");
        return built;
    }

    private record LoosePage(ControlledCopyScanCodeService.PageScan scan, String note) {
    }

    private static String looseNote(ControlledCopyScanCodeService.PageScan scan) {
        return switch (scan.status()) {
            case ControlledCopyScanCodeService.STATUS_DECODED ->
                    "This page carries a code printed before page numbers existed, so its place in the copy is unknown.";
            case ControlledCopyScanCodeService.STATUS_FOREIGN -> "The code on this page is not an EQMS controlled copy code.";
            case ControlledCopyScanCodeService.STATUS_MULTIPLE -> "More than one code was found on this page.";
            default -> "No code could be read on this page.";
        };
    }

    /** A new item for a file cut from {@code source}; its own file is stored, the source stays as evidence. */
    private ControlledCopyRecallItem derivedItem(ControlledCopyRecallBatch batch, int itemNo, ControlledCopyRecallItem source, String fileName, byte[] pdf) {
        ControlledCopyRecallItem item = new ControlledCopyRecallItem();
        item.setId(UUID.randomUUID());
        item.setBatch(batch);
        item.setItemNo(itemNo);
        item.setFileName(safeFileName(fileName));
        item.setVirusStatus(source.getVirusStatus());
        item.setVirusSignature(source.getVirusSignature());
        item.setSourceFileName(source.getFileName());
        item.setSourceSha256(source.getSha256());
        item.setSourceStoredPath(source.getStoredPath());
        storePdf(batch, item, pdf);
        return item;
    }

    private void storePdf(ControlledCopyRecallBatch batch, ControlledCopyRecallItem item, byte[] pdf) {
        try {
            FileStorageService.StorageWriteResult stored = fileStorageService.storeControlledCopyRecallScan(
                    batch.getId(), item.getId(), item.getFileName(), new ByteArrayInputStream(pdf));
            item.setStoredPath(stored.storedPath());
            item.setStorageProvider(stored.provider());
            item.setStorageBucket(stored.bucket());
            item.setStorageObjectKey(stored.objectKey());
            item.setStorageVersionId(stored.versionId());
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to store the scan " + item.getFileName(), ex);
        }
        item.setFileSize(pdf.length);
        item.setSha256(sha256(pdf));
        item.setContentType("application/pdf");
    }

    private static byte[] pdfOf(byte[] source, List<Integer> pageIndexes) {
        try {
            return ControlledCopyScanPageAssembler.assemble(pageIndexes.stream()
                    .map(index -> new ControlledCopyScanPageAssembler.PageRef(source, index)).toList());
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to cut the pages out of the scan", ex);
        }
    }

    private static String baseName(String fileName) {
        String name = fileName == null ? "scan" : fileName;
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }

    private static String joinNumbers(List<Integer> numbers) {
        return numbers.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(","));
    }

    private static List<Integer> parseNumbers(String csv) {
        List<Integer> numbers = new ArrayList<>();
        if (StringUtils.hasText(csv)) {
            for (String part : csv.split(",")) {
                numbers.add(Integer.parseInt(part.trim()));
            }
        }
        return numbers;
    }

    private static String describePages(String fileName, List<Integer> zeroBasedIndexes) {
        return (zeroBasedIndexes.size() == 1 ? "page " : "pages ")
                + zeroBasedIndexes.stream().map(index -> String.valueOf(index + 1)).collect(java.util.stream.Collectors.joining(", "))
                + " of " + fileName;
    }

    /** The number of pages the copy itself has, or null when it has no stored file. */
    private Integer copyPageCount(ControlledCopyRecord copy) {
        if (!StringUtils.hasText(copy.getControlledCopyFilePath())) {
            return null;
        }
        try {
            return ControlledCopyScanPageAssembler.pageCount(fileStorageService.readFile(copy.getControlledCopyFilePath()));
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to read controlled copy " + copy.getControlledCopyNumber(), ex);
        }
    }

    /** True for a single page cut from a scan that nobody has placed in a copy yet. */
    private static boolean isLoosePage(ControlledCopyRecallItem item) {
        return StringUtils.hasText(item.getSourceStoredPath()) && item.getPageNumbers() == null;
    }

    /**
     * The DCO says which copy a loose page belongs to and which page of it that is. The page goes into the file of that copy at its
     * place, so the order stays exact; a page that is already there, or lies outside the copy, is refused and nothing changes.
     */
    private void placeLoosePage(ControlledCopyRecallBatch batch, ControlledCopyRecallItem loose, ControlledCopyRecord copy, Integer pageNumber, UserAccount actor) {
        List<ControlledCopyRecallItem> same = itemRepository.findAllByBatch_IdOrderByItemNoAsc(batch.getId()).stream()
                .filter(other -> !other.getId().equals(loose.getId()) && other.getPageNumbers() != null && other.getControlledCopy() != null
                        && other.getControlledCopy().getId().equals(copy.getId()))
                .toList();
        ControlledCopyRecallItem target = same.isEmpty() ? null : same.get(0);
        Integer expected = target != null && target.getExpectedPages() != null ? target.getExpectedPages() : copyPageCount(copy);
        if (expected == null) {
            throw new IllegalStateException("Controlled copy " + copy.getControlledCopyNumber() + " has no stored file, so its pages cannot be checked.");
        }
        if (pageNumber == null || pageNumber < 1 || pageNumber > expected) {
            throw new IllegalArgumentException("Enter the page number of this page within controlled copy " + copy.getControlledCopyNumber()
                    + ": a number from 1 to " + expected + ".");
        }
        String message;
        if (target == null) {
            loose.setControlledCopy(copy);
            loose.setMatchSource(ControlledCopyRecallItem.SOURCE_MANUAL);
            loose.setPageNumbers(String.valueOf(pageNumber));
            loose.setExpectedPages(expected);
            loose.setPageNote(null);
            itemRepository.save(loose);
            message = "now holds page " + pageNumber + " of " + expected;
        } else {
            List<Integer> numbers = parseNumbers(target.getPageNumbers());
            if (numbers.contains(pageNumber)) {
                throw new IllegalArgumentException("Page " + pageNumber + " of controlled copy " + copy.getControlledCopyNumber()
                        + " is already on scan " + target.getItemNo() + ". If this page is a duplicate, exclude it.");
            }
            byte[] targetBytes;
            byte[] looseBytes;
            try {
                targetBytes = fileStorageService.readFile(target.getStoredPath(), target.getSha256());
                looseBytes = fileStorageService.readFile(loose.getStoredPath(), loose.getSha256());
            } catch (IOException ex) {
                throw new IllegalStateException("Failed to read the scans to put the page in order", ex);
            }
            record Placed(int number, byte[] pdf, int index) {
            }
            List<Placed> all = new ArrayList<>();
            for (int i = 0; i < numbers.size(); i++) {
                all.add(new Placed(numbers.get(i), targetBytes, i));
            }
            all.add(new Placed(pageNumber, looseBytes, 0));
            all.sort(java.util.Comparator.comparingInt(Placed::number));
            byte[] merged;
            try {
                merged = ControlledCopyScanPageAssembler.assemble(all.stream()
                        .map(placed -> new ControlledCopyScanPageAssembler.PageRef(placed.pdf(), placed.index())).toList());
            } catch (IOException ex) {
                throw new IllegalStateException("Failed to put the page in order", ex);
            }
            storePdf(batch, target, merged);
            target.setPageNumbers(joinNumbers(all.stream().map(Placed::number).toList()));
            target.setExpectedPages(expected);
            target.setSourcePages(truncate(target.getSourcePages() + "; " + loose.getSourcePages(), 1000));
            itemRepository.save(target);
            itemRepository.delete(loose);
            message = "put into the file of scan " + target.getItemNo() + " as page " + pageNumber + " of " + expected;
        }
        itemRepository.flush();
        auditTrailService.logAs(actor, ENTITY_TYPE, batch.getBatchNumber(), batch.getId(), "MATCH_ITEM", batch.getStatus(), batch.getStatus(),
                "Scan " + loose.getItemNo() + " (" + loose.getFileName() + ", " + loose.getSourcePages() + ") assigned by hand to controlled copy "
                        + copy.getControlledCopyNumber() + " as page " + pageNumber + "; " + message
                        + (StringUtils.hasText(loose.getQrValue()) ? "; the code on the page read: " + loose.getQrValue() : "; no readable code"));
    }

    /** Why a scan made of numbered pages cannot be recalled yet (pages missing), or null. */
    private static String pageProblem(ControlledCopyRecallItem item, ControlledCopyRecord copy) {
        if (item.getPageNumbers() == null) {
            return null;
        }
        if (item.getExpectedPages() == null) {
            return StringUtils.hasText(item.getPageNote()) ? item.getPageNote()
                    : "The number of pages of controlled copy " + copy.getControlledCopyNumber() + " is not known.";
        }
        List<Integer> present = parseNumbers(item.getPageNumbers());
        List<String> missing = new ArrayList<>();
        for (int page = 1; page <= item.getExpectedPages(); page++) {
            if (!present.contains(page)) {
                missing.add(String.valueOf(page));
            }
        }
        if (!missing.isEmpty()) {
            return "Controlled copy " + copy.getControlledCopyNumber() + " is incomplete: page " + String.join(", ", missing) + " of "
                    + item.getExpectedPages() + " missing. Assign the unrecognised pages to it, or scan it again.";
        }
        if (present.stream().anyMatch(page -> page > item.getExpectedPages())) {
            return "Controlled copy " + copy.getControlledCopyNumber() + " has only " + item.getExpectedPages() + " pages, but the scan holds more.";
        }
        return null;
    }

    private ControlledCopyRecallItem reject(ControlledCopyRecallItem item, String message) {
        item.setQrStatus(ControlledCopyRecallItem.QR_NOT_ATTEMPTED);
        item.setMatchStatus(ControlledCopyRecallItem.MATCH_BLOCKED);
        item.setMatchMessage(message);
        return item;
    }

    /**
     * Recomputes, from the CURRENT state of every matched copy, whether each scan is ready, blocked or unmatched. Called after
     * every change and again at commit, so what the DCO signs is what is true at that moment.
     */
    private void revalidate(ControlledCopyRecallBatch batch, UserAccount actor) {
        List<ControlledCopyRecallItem> items = itemRepository.findAllByBatch_IdOrderByItemNoAsc(batch.getId());
        Set<UUID> copyIds = new java.util.LinkedHashSet<>();
        for (ControlledCopyRecallItem item : items) {
            if (item.getControlledCopy() != null) {
                copyIds.add(item.getControlledCopy().getId());
            }
        }
        Map<UUID, String> claimedElsewhere = new HashMap<>();
        if (!copyIds.isEmpty()) {
            itemRepository.findAllByControlledCopy_IdInAndBatch_StatusAndBatch_IdNot(
                            copyIds, ControlledCopyRecallBatch.STATUS_DRAFT, batch.getId())
                    .stream()
                    .filter(other -> !other.isExcluded())
                    .forEach(other -> claimedElsewhere.putIfAbsent(other.getControlledCopy().getId(), other.getBatch().getBatchNumber()));
        }
        Map<UUID, Integer> firstItemForCopy = new LinkedHashMap<>();
        for (ControlledCopyRecallItem item : items) {
            if (item.getStoredPath() == null) {
                continue; // rejected at upload (unsupported, empty, too large, infected): stays blocked with its message
            }
            evaluate(item, actor, firstItemForCopy, claimedElsewhere);
            itemRepository.save(item);
        }
        itemRepository.flush();
    }

    private void evaluate(ControlledCopyRecallItem item, UserAccount actor, Map<UUID, Integer> firstItemForCopy, Map<UUID, String> claimedElsewhere) {
        ControlledCopyRecord copy = item.getControlledCopy();
        if (copy == null) {
            item.setMatchStatus(ControlledCopyRecallItem.MATCH_UNMATCHED);
            item.setMatchMessage(unmatchedMessage(item));
            return;
        }
        // A copy issued for reading only is not recalled by scan (nothing is written on it, so there is nothing to keep): it stays
        // BLOCKED, shown apart on the screen, until the DCO removes it from the batch. The rest of the batch is unaffected.
        String problem = isReadAndComply(copy)
                ? "Controlled copy " + copy.getControlledCopyNumber()
                        + " is for reading only (Read and comply) and is not recalled by scan. Remove this scan; if the copy has to be recalled, do it from Controlled Copies."
                : recallProblem(copy, actor);
        if (problem == null) {
            problem = pageProblem(item, copy);
        }
        if (problem == null && !item.isExcluded()) {
            Integer first = firstItemForCopy.putIfAbsent(copy.getId(), item.getItemNo());
            if (first != null) {
                problem = "Controlled copy " + copy.getControlledCopyNumber() + " is already on scan " + first + " of this batch.";
            } else if (claimedElsewhere.containsKey(copy.getId())) {
                problem = "Controlled copy " + copy.getControlledCopyNumber() + " is already in the open recall batch "
                        + claimedElsewhere.get(copy.getId()) + ".";
            }
        }
        if (problem != null) {
            item.setMatchStatus(ControlledCopyRecallItem.MATCH_BLOCKED);
            item.setMatchMessage(problem);
        } else {
            item.setMatchStatus(ControlledCopyRecallItem.MATCH_READY);
            item.setMatchMessage(null);
        }
    }

    private static boolean isReadAndComply(ControlledCopyRecord copy) {
        return copy != null && ControlledCopyService.USAGE_READ_AND_COMPLY.equals(copy.getUsagePurpose());
    }

    /** Why this copy cannot be recalled by scan right now, or null when it can. */
    private String recallProblem(ControlledCopyRecord copy, UserAccount actor) {
        if (!StringUtils.hasText(copy.getScanToken())) {
            return "Controlled copy " + copy.getControlledCopyNumber()
                    + " carries no scan code (it was printed before codes were introduced). Recall it from its own page.";
        }
        String status = copy.getStatusCode() == null ? "" : copy.getStatusCode().trim().toUpperCase(java.util.Locale.ROOT);
        boolean recallable = STATUS_DISTRIBUTED.equals(status) || (STATUS_OBSOLETED.equals(status) && copy.getRecalledAt() == null);
        if (!recallable) {
            return STATUS_OBSOLETED.equals(status) && copy.getRecalledAt() != null
                    ? "Controlled copy " + copy.getControlledCopyNumber() + " was already recalled on " + copy.getRecalledAt() + "."
                    : "Controlled copy " + copy.getControlledCopyNumber() + " is " + copy.getStatus() + "; only a Distributed copy can be recalled.";
        }
        try {
            controlledCopyAuthorizationService.requireRecallControlledCopy(actor, copy);
        } catch (AccessDeniedException ex) {
            return ex.getMessage();
        }
        return null;
    }

    private static String unmatchedMessage(ControlledCopyRecallItem item) {
        if (isLoosePage(item) && StringUtils.hasText(item.getPageNote())) {
            return item.getPageNote() + " Enter its controlled copy number and its page number.";
        }
        return switch (item.getQrStatus() == null ? "" : item.getQrStatus()) {
            case ControlledCopyRecallItem.QR_DECODED -> "The code on this scan does not belong to any controlled copy. Identify the copy by number.";
            case ControlledCopyRecallItem.QR_FOREIGN -> "The code on this scan is not an EQMS controlled copy code. Identify the copy by number.";
            case ControlledCopyRecallItem.QR_MULTIPLE -> "More than one code was found on this scan. Identify the copy by number.";
            case ControlledCopyRecallItem.QR_UNREADABLE_FILE -> "The file could not be opened. Re-scan it, or identify the copy by number.";
            default -> "No code could be read on this scan. Rescan it, or identify the copy by number.";
        };
    }

    // ------------------------------------------------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------------------------------------------------

    private void requireOperator(UserAccount user) {
        if (!permissionEvaluationService.hasPermission(user, PERMISSION_RECALL)) {
            throw new AccessDeniedException("Not permitted to recall controlled copies");
        }
        // The scans belong to copies held by other people, so the operator must be allowed to see every controlled copy.
        if (!documentAuthorizationService.canViewAllControlledCopies(user)) {
            throw new AccessDeniedException("Recalling by scan needs permission to view all controlled copies");
        }
    }

    private ControlledCopyRecallBatch requireBatch(UUID id) {
        return batchRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Recall batch not found"));
    }

    /** A draft can only be changed, committed or discarded by the user who started it. */
    private ControlledCopyRecallBatch requireOwnDraft(UUID id, UserAccount actor) {
        ControlledCopyRecallBatch batch = requireBatch(id);
        if (!ControlledCopyRecallBatch.STATUS_DRAFT.equals(batch.getStatus())) {
            throw new IllegalStateException("Recall batch " + batch.getBatchNumber() + " is " + batch.getStatus() + " and can no longer be changed.");
        }
        if (batch.getCreatedBy() == null || !actor.getId().equals(batch.getCreatedBy().getId())) {
            throw new AccessDeniedException("Recall batch " + batch.getBatchNumber() + " was started by another user.");
        }
        return batch;
    }

    private static List<MultipartFile> nonEmpty(List<MultipartFile> files) {
        List<MultipartFile> uploads = files == null ? List.of() : files.stream().filter(file -> file != null && !file.isEmpty()).toList();
        if (uploads.isEmpty()) {
            throw new IllegalArgumentException("Choose at least one scan to upload.");
        }
        return uploads;
    }

    private static void requireFileCount(long count) {
        if (count > MAX_FILES) {
            throw new IllegalArgumentException("A recall batch holds at most " + MAX_FILES + " scans.");
        }
    }

    private static Instant parseReceivedAt(String value, Instant now) {
        if (!StringUtils.hasText(value)) {
            return now;
        }
        String trimmed = value.trim();
        try {
            Instant parsed = Instant.parse(trimmed);
            if (parsed.isAfter(now.plusSeconds(CLOCK_SKEW_SECONDS))) {
                throw new IllegalArgumentException("The date the paper was received cannot be in the future.");
            }
            return parsed.isAfter(now) ? now : parsed;
        } catch (DateTimeParseException ignored) {
            // fall through to a plain date
        }
        try {
            LocalDate day = LocalDate.parse(trimmed);
            Instant endOfDay = day.plusDays(1).atStartOfDay(SYSTEM_ZONE).toInstant().minusSeconds(1);
            if (day.isAfter(LocalDate.now(SYSTEM_ZONE))) {
                throw new IllegalArgumentException("The date the paper was received cannot be in the future.");
            }
            return endOfDay.isAfter(now) ? now : endOfDay;
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException("The date the paper was received is not valid.");
        }
    }

    private static String safeFileName(String name) {
        String leaf = StringUtils.hasText(name) ? name.trim().replace('\\', '/') : "scan";
        leaf = leaf.substring(leaf.lastIndexOf('/') + 1);
        if (!StringUtils.hasText(leaf)) {
            leaf = "scan";
        }
        return leaf.length() > 255 ? leaf.substring(leaf.length() - 255) : leaf;
    }

    private static String truncate(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }

    private RecallBatchResponse toResponse(ControlledCopyRecallBatch batch) {
        List<ControlledCopyRecallItem> items = itemRepository.findAllByBatch_IdOrderByItemNoAsc(batch.getId());
        int ready = 0;
        int blocked = 0;
        int unmatched = 0;
        int excluded = 0;
        List<RecallItemResponse> responses = new ArrayList<>();
        for (ControlledCopyRecallItem item : items) {
            if (item.isExcluded()) {
                excluded++;
            } else if (ControlledCopyRecallItem.MATCH_READY.equals(item.getMatchStatus())) {
                ready++;
            } else if (ControlledCopyRecallItem.MATCH_BLOCKED.equals(item.getMatchStatus())) {
                blocked++;
            } else {
                unmatched++;
            }
            responses.add(toItemResponse(item));
        }
        boolean draft = ControlledCopyRecallBatch.STATUS_DRAFT.equals(batch.getStatus());
        return new RecallBatchResponse(
                batch.getId().toString(),
                batch.getBatchNumber(),
                batch.getStatus(),
                batch.getCreatedBy() == null ? null : batch.getCreatedBy().getFullName(),
                batch.getCreatedAt(),
                batch.getCommittedBy() == null ? null : batch.getCommittedBy().getFullName(),
                batch.getCommittedAt(),
                batch.getReceivedAt(),
                batch.getRecallReason(),
                items.size(), ready, blocked, unmatched, excluded,
                draft && ready > 0 && blocked == 0 && unmatched == 0,
                responses);
    }

    private RecallItemResponse toItemResponse(ControlledCopyRecallItem item) {
        ControlledCopyRecord copy = item.getControlledCopy();
        RecallItemCopyResponse copyResponse = copy == null ? null : new RecallItemCopyResponse(
                copy.getId().toString(),
                copy.getControlledCopyNumber(),
                copy.getDocumentNumber(),
                copy.getDocumentTitle(),
                copy.getRevisionNumber(),
                copy.getRecipientUser() != null ? copy.getRecipientUser().getFullName() : copy.getRecipientName(),
                copy.getStatus(),
                copy.getDistributedAt(),
                copy.getRecalledAt());
        return new RecallItemResponse(
                item.getId().toString(),
                item.getItemNo(),
                item.getFileName(),
                item.getContentType(),
                item.getFileSize(),
                item.getSha256(),
                item.getVirusStatus(),
                item.getVirusSignature(),
                item.getQrStatus(),
                item.getQrValue(),
                item.getMatchSource(),
                item.getMatchStatus(),
                item.getMatchMessage(),
                item.isExcluded(),
                item.getOutcome(),
                item.getOutcomeMessage(),
                item.getExecutedRecordId() == null ? null : item.getExecutedRecordId().toString(),
                StringUtils.hasText(item.getStoredPath()),
                copyResponse,
                item.getSourceFileName(),
                item.getSourcePages(),
                item.getPageNumbers(),
                item.getExpectedPages(),
                isLoosePage(item),
                isReadAndComply(copy));
    }
}
