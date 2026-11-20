package com.eqms;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.dto.controlledcopyrecall.RecallBatchCommitRequest;
import com.eqms.dto.controlledcopyrecall.RecallBatchResponse;
import com.eqms.dto.controlledcopyrecall.RecallItemResponse;
import com.eqms.dto.executedrecord.ExecutedRecordResponse;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.ExecutedRecord;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.ExecutedRecordRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.ClamAvScanService;
import com.eqms.service.ControlledCopyAuthorizationService;
import com.eqms.service.ControlledCopyPdfMarkingService;
import com.eqms.service.ControlledCopyRecallBatchService;
import com.eqms.service.ControlledCopyScanCodeService;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.ElectronicSignatureService;
import com.eqms.service.ExecutedRecordService;
import com.eqms.service.FileStorageService;
import com.eqms.service.SignatureTokenConsumptionService;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * The whole recall-by-scan flow on the real schema and real beans (Decision COPY-RECALL-SCAN-2026-10-06): QR printed on a
 * PDF, uploaded, matched to real Distributed copies, committed under one signature, filed as records, and shown only to
 * those allowed to see them. File storage, the virus scanner and the signature itself are stubbed so nothing is written
 * outside the database; the test transaction rolls back every row.
 */
@SpringBootTest
@Transactional
class ControlledCopyRecallByScanIntegrationTest {

    @Autowired private ControlledCopyRecallBatchService recallService;
    @Autowired private ExecutedRecordService executedRecordService;
    @Autowired private ControlledCopyRepository controlledCopyRepository;
    @Autowired private ExecutedRecordRepository executedRecordRepository;
    @Autowired private UserAccountRepository userAccountRepository;
    @Autowired private ControlledCopyAuthorizationService controlledCopyAuthorizationService;
    @Autowired private com.eqms.repository.ControlledCopyRecallItemRepository recallItemRepository;
    @Autowired private org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired private com.eqms.service.ControlledCopyPolicyService policyService;
    @Autowired private DocumentAuthorizationService documentAuthorizationService;

    @MockitoBean private FileStorageService fileStorageService;
    @MockitoBean private ClamAvScanService clamAvScanService;
    @MockitoBean private SignatureTokenConsumptionService signatureTokenConsumptionService;
    @MockitoBean private ElectronicSignatureService electronicSignatureService;

    private final Map<String, byte[]> storage = new ConcurrentHashMap<>();
    private UserAccount admin;
    private UUID signatureId;

    @BeforeEach
    void setUp() throws Exception {
        admin = userAccountRepository.findByUsername("admin")
                .orElseThrow(() -> new AssertionError("Seeded 'admin' user not found"));
        authenticateAs(admin);

        when(clamAvScanService.isEnabled()).thenReturn(false);
        when(fileStorageService.storeControlledCopyRecallScan(any(), any(), anyString(), any(InputStream.class))).thenAnswer(inv -> {
            String path = "mem://" + inv.getArgument(1) + "/" + inv.getArgument(2);
            storage.put(path, ((InputStream) inv.getArgument(3)).readAllBytes());
            return new FileStorageService.StorageWriteResult(null, path, "local", null, path, null, "unused");
        });
        when(fileStorageService.readFile(anyString())).thenAnswer(inv -> storage.get((String) inv.getArgument(0)));
        when(fileStorageService.readFile(anyString(), any())).thenAnswer(inv -> storage.get((String) inv.getArgument(0)));

        signatureId = UUID.randomUUID();
        ElectronicSignature signature = new ElectronicSignature();
        signature.setId(signatureId);
        when(signatureTokenConsumptionService.requireAndConsume(anyString(), any())).thenReturn(UUID.randomUUID());
        when(electronicSignatureService.createEntitySignature(anyString(), any(), anyString(), any(), anyString(), anyString(),
                anyString(), any(), any(), any())).thenReturn(signature);
    }

    private static void authenticateAs(UserAccount user) {
        AuthenticatedUser principal = new AuthenticatedUser(user.getId(), UUID.randomUUID(), user.getUsername(),
                user.getRoleName() != null ? user.getRoleName() : "USER", Collections.emptySet());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
    }

    /** Real Distributed paper copies that the admin is allowed to recall, given a scan code now (as if issued with one). */
    private List<ControlledCopyRecord> recallableCopies(int wanted) {
        List<ControlledCopyRecord> found = new ArrayList<>();
        for (ControlledCopyRecord copy : controlledCopyRepository.findAll()) {
            if (found.size() >= wanted) {
                break;
            }
            if (!"DISTRIBUTED".equals(copy.getStatusCode())
                    || copy.getRevision() == null || copy.getDocument() == null || copy.getRecalledAt() != null) {
                continue;
            }
            // A copy the recall by scan itself would block is not a fixture of this test: one issued for reading only (it is not recalled by scan), and one that a scan of an open draft already claims
            // (the shared dev database keeps the drafts of earlier runs).
            if (com.eqms.service.ControlledCopyService.USAGE_READ_AND_COMPLY.equals(copy.getUsagePurpose())) {
                continue;
            }
            boolean claimed = recallItemRepository.findAllByControlledCopy_IdInAndBatch_StatusAndBatch_IdNot(
                    List.of(copy.getId()), com.eqms.entity.ControlledCopyRecallBatch.STATUS_DRAFT, UUID.randomUUID()).stream().anyMatch(item -> !item.isExcluded());
            if (claimed) {
                continue;
            }
            try {
                controlledCopyAuthorizationService.requireRecallControlledCopy(admin, copy);
            } catch (AccessDeniedException ex) {
                continue;
            }
            copy.setScanToken(ControlledCopyScanCodeService.newToken());
            controlledCopyRepository.saveAndFlush(copy);
            found.add(copy);
        }
        // A recall is permanent (the copy becomes Obsoleted for good) and the shared dev database cannot delete a copy, so every run uses the copies up: when too few are left this test makes the Distributed paper
        // copies it needs, as copies of one that exists (same document and revision, a new number and a new code), instead of skipping the check.
        while (found.size() < wanted) {
            ControlledCopyRecord made = newDistributedPaperCopy();
            made.setScanToken(ControlledCopyScanCodeService.newToken());
            controlledCopyRepository.saveAndFlush(made);
            found.add(made);
        }
        return found;
    }

    private ControlledCopyRecord newDistributedPaperCopy() {
        UUID template = jdbc.queryForObject("select id from controlled_copies where document_id is not null and revision_id is not null and distributed_at is not null order by distributed_at asc limit 1", UUID.class);
        assumeTrue(template != null, "The dev database has no controlled copy to make a Distributed copy from");
        UUID id = UUID.randomUUID();
        String number = "CC-RECALLSCAN-" + id.toString().substring(0, 8).toUpperCase();
        jdbc.update("""
                insert into controlled_copies
                select r.* from controlled_copies t, lateral jsonb_populate_record(null::controlled_copies, to_jsonb(t) || jsonb_build_object(
                    'id', ?::text, 'controlled_copy_number', ?::text, 'access_token', ?::text, 'status', 'Distributed', 'status_code', 'DISTRIBUTED', 'usage_purpose', null,
                    'scan_token', null, 'replaces_controlled_copy_id', null, 'replaced_controlled_copy_id', null, 'recalled_at', null, 'recalled_by_user_id', null, 'recall_reason', null,
                    'obsoleted_at', null, 'obsoleted_by_user_id', null, 'obsolete_reason', null, 'destroyed_at', null, 'destroyed_by_user_id', null, 'destroy_reason', null,
                    'cancelled_at', null, 'cancelled_by_user_id', null, 'distribution_batch_id', null, 'valid_until', null, 'has_expiry_date', false, 'expiry_date', null)) r
                where t.id = ?
                """, id.toString(), number, UUID.randomUUID().toString(), template);
        return controlledCopyRepository.findById(id).orElseThrow();
    }

    private static byte[] scanOf(ControlledCopyRecord copy) throws Exception {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            document.addPage(new PDPage(PDRectangle.A4));
            document.save(out);
            return new ControlledCopyPdfMarkingService().applyScanCode(out.toByteArray(),
                    ControlledCopyScanCodeService.encode(ControlledCopyScanCodeService.payload(copy.getScanToken())),
                    copy.getControlledCopyNumber(), "BOTTOM_RIGHT", 20, 4, List.of()).pdf();
        }
    }

    private static MockMultipartFile upload(String name, byte[] bytes) {
        return new MockMultipartFile("files", name, "application/pdf", bytes);
    }

    private Set<String> visibleRecordIds() {
        Set<String> ids = new HashSet<>();
        for (int page = 1; ; page++) {
            var result = executedRecordService.list(page, 100, null, null, null, null, null, "created", "desc");
            result.data().forEach(record -> ids.add(record.id()));
            if (result.data().isEmpty() || page >= result.pagination().totalPages()) {
                return ids;
            }
        }
    }

    @Test
    void two_real_copies_are_matched_by_their_codes_recalled_under_one_signature_and_filed_as_records() throws Exception {
        List<ControlledCopyRecord> copies = recallableCopies(2);

        RecallBatchResponse draft = recallService.createDraft(List.of(
                upload("one.pdf", scanOf(copies.get(0))), upload("two.pdf", scanOf(copies.get(1)))));

        assertThat(draft.status()).isEqualTo("DRAFT");
        assertThat(draft.items()).extracting(RecallItemResponse::matchStatus).containsOnly("READY");
        assertThat(draft.items()).extracting(item -> item.copy().id())
                .containsExactly(copies.get(0).getId().toString(), copies.get(1).getId().toString());
        assertThat(draft.readyToCommit()).isTrue();
        // A draft changes nothing about any copy.
        assertThat(copies).extracting(ControlledCopyRecord::getStatusCode).containsOnly("DISTRIBUTED");

        RecallBatchResponse committed = recallService.commit(UUID.fromString(draft.id()),
                new RecallBatchCommitRequest("Annual SOP refresh", null, "token"));

        assertThat(committed.status()).isEqualTo("COMMITTED");
        assertThat(committed.items()).extracting(RecallItemResponse::outcome).containsOnly("RECALLED");
        for (ControlledCopyRecord copy : copies) {
            ControlledCopyRecord reloaded = controlledCopyRepository.findById(copy.getId()).orElseThrow();
            assertThat(reloaded.getStatusCode()).isEqualTo("OBSOLETED");
            assertThat(reloaded.getObsoleteReason()).isEqualTo("RECALLED");
            assertThat(reloaded.getRecalledAt()).isNotNull();
            assertThat(reloaded.getRecalledBy().getId()).isEqualTo(admin.getId());
            assertThat(reloaded.getRecallReason()).isEqualTo("Annual SOP refresh");
        }
        List<ExecutedRecord> records = executedRecordRepository.findAll().stream()
                .filter(record -> record.getRecallBatchId() != null && record.getRecallBatchId().toString().equals(draft.id()))
                .toList();
        assertThat(records).hasSize(2);
        assertThat(records).allSatisfy(record -> {
            assertThat(record.getCaptureMethod()).isEqualTo("PAPER_SCAN");
            assertThat(record.getStatus()).isEqualTo("EXECUTED");
            assertThat(record.getSubmitSignatureId()).isEqualTo(signatureId);
            assertThat(record.getFileName()).isIn("one.pdf", "two.pdf");
            assertThat(record.getContentType()).isEqualTo("application/pdf");
            assertThat(record.getChecksum()).hasSize(64);
        });
    }

    @Test
    void a_committed_batch_cannot_recall_the_same_copies_again() throws Exception {
        List<ControlledCopyRecord> copies = recallableCopies(1);
        RecallBatchResponse first = recallService.createDraft(List.of(upload("a.pdf", scanOf(copies.get(0)))));
        recallService.commit(UUID.fromString(first.id()), new RecallBatchCommitRequest("reason", null, "token"));

        RecallBatchResponse again = recallService.createDraft(List.of(upload("a-again.pdf", scanOf(copies.get(0)))));

        assertThat(again.items().get(0).matchStatus()).isEqualTo("BLOCKED");
        assertThat(again.items().get(0).matchMessage()).containsIgnoringCase("already recalled");
        assertThat(again.readyToCommit()).isFalse();
    }

    @Test
    void the_filed_scans_are_searchable_previewable_and_shown_only_to_those_who_may_see_the_copy() throws Exception {
        List<ControlledCopyRecord> copies = recallableCopies(1);
        ControlledCopyRecord copy = copies.get(0);
        byte[] scan = scanOf(copy);
        RecallBatchResponse draft = recallService.createDraft(List.of(upload("scan.pdf", scan)));
        recallService.commit(UUID.fromString(draft.id()), new RecallBatchCommitRequest("reason", null, "token"));
        ExecutedRecord record = executedRecordRepository.findAll().stream()
                .filter(candidate -> candidate.getSourceControlledCopy() != null && candidate.getSourceControlledCopy().getId().equals(copy.getId()))
                .findFirst().orElseThrow();

        // The administrator holds the blanket copy permission: sees it, finds it by the copy number, previews the scan inline.
        assertThat(visibleRecordIds()).contains(record.getId().toString());
        var searched = executedRecordService.list(1, 50, copy.getControlledCopyNumber(), null, null, null, null, "created", "desc");
        assertThat(searched.data()).extracting(ExecutedRecordResponse::id).contains(record.getId().toString());
        // The copy's own Records tab asks for the records of that one copy; another copy has none.
        assertThat(executedRecordService.list(1, 50, null, null, copy.getId().toString(), null, null, "created", "desc").data())
                .extracting(ExecutedRecordResponse::id).containsExactly(record.getId().toString());
        assertThat(executedRecordService.list(1, 50, null, null, UUID.randomUUID().toString(), null, null, "created", "desc").data())
                .isEmpty();
        ExecutedRecordService.RecordFile file = executedRecordService.previewFile(record.getId());
        assertThat(file.contentType()).isEqualTo("application/pdf");
        // The scan is shown with the "Obsoleted" stamp and watermark drawn on a copy; the stored bytes are never touched.
        assertThat(file.bytes()).isNotEqualTo(scan);
        try (org.apache.pdfbox.pdmodel.PDDocument shown = org.apache.pdfbox.Loader.loadPDF(file.bytes())) {
            assertThat(new org.apache.pdfbox.text.PDFTextStripper().getText(shown)).contains(policyService.statusMarkingFor(policyService.loadOrDefault(), "OBSOLETED").stampText());
        }
        assertThat(file.fileName()).isEqualTo("scan.pdf");

        // DC-VISIBILITY-TIERS-2026-11-07: a Record has no flow of its own, so whoever holds the Records permission sees all of them, whoever the copy was issued to (the one exception, a copy issued for
        // reading, is not recalled by scan). Whoever does not hold the permission sees none and is refused.
        UserAccount recipient = copy.getRecipientUser();
        if (recipient != null && userHasViewPermission(recipient)) {
            authenticateAs(recipient);
            assertThat(visibleRecordIds()).contains(record.getId().toString());
            assertThat(executedRecordService.previewFile(record.getId()).bytes()).isNotEmpty();
        }
        UserAccount holder = userAccountRepository.findAll().stream()
                .filter(user -> copy.getRecipientUser() == null || !copy.getRecipientUser().getId().equals(user.getId()))
                .filter(this::userHasViewPermission)
                .findFirst().orElse(null);
        if (holder != null) {
            authenticateAs(holder);
            assertThat(visibleRecordIds()).contains(record.getId().toString());
            assertThat(executedRecordService.previewFile(record.getId()).bytes()).isNotEmpty();
        }
        UserAccount withoutPermission = userAccountRepository.findAll().stream()
                .filter(user -> user.getStatus() == com.eqms.entity.UserStatus.Active)
                .filter(user -> !userHasViewPermission(user))
                .findFirst().orElse(null);
        if (withoutPermission != null) {
            authenticateAs(withoutPermission);
            assertThatThrownBy(() -> executedRecordService.previewFile(record.getId())).isInstanceOf(AccessDeniedException.class);
        }
    }

    private boolean userHasViewPermission(UserAccount user) {
        authenticateAs(user);
        try {
            executedRecordService.list(1, 1, null, null, null, null, null, "created", "desc");
            return true;
        } catch (AccessDeniedException ex) {
            return false;
        }
    }
}
