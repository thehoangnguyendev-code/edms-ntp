package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.controlledcopyrecall.RecallBatchCommitRequest;
import com.eqms.dto.controlledcopyrecall.RecallBatchResponse;
import com.eqms.dto.controlledcopyrecall.RecallItemResponse;
import com.eqms.dto.controlledcopyrecall.RecallItemUpdateRequest;
import com.eqms.entity.ControlledCopyRecallBatch;
import com.eqms.entity.ControlledCopyRecallItem;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.ExecutedRecord;
import com.eqms.entity.UserAccount;
import com.eqms.exception.ControlledCopyAuthorizationException;
import com.eqms.exception.RecallBatchNotReadyException;
import com.eqms.repository.ControlledCopyRecallBatchRepository;
import com.eqms.repository.ControlledCopyRecallItemRepository;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ClamAvScanService;
import com.eqms.service.ControlledCopyAuthorizationService;
import com.eqms.service.ControlledCopyPdfMarkingService;
import com.eqms.service.ControlledCopyRecallBatchService;
import com.eqms.service.ControlledCopyScanCodeService;
import com.eqms.service.ControlledCopyService;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.ElectronicSignatureService;
import com.eqms.service.ExecutedRecordService;
import com.eqms.service.FileStorageService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SignatureTokenConsumptionService;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Recall paper Controlled Copies in bulk by scan (Decision COPY-RECALL-SCAN-2026-10-06): matching, the negative cases a DCO
 * will actually hit, and a commit that is all-or-nothing under ONE signature.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ControlledCopyRecallBatchServiceTest {

    @Mock private ControlledCopyRecallBatchRepository batchRepository;
    @Mock private ControlledCopyRecallItemRepository itemRepository;
    @Mock private ControlledCopyRepository controlledCopyRepository;
    @Mock private CurrentUserService currentUserService;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private DocumentAuthorizationService documentAuthorizationService;
    @Mock private ControlledCopyAuthorizationService controlledCopyAuthorizationService;
    @Mock private ControlledCopyService controlledCopyService;
    @Mock private ExecutedRecordService executedRecordService;
    @Mock private ClamAvScanService clamAvScanService;
    @Mock private FileStorageService fileStorageService;
    @Mock private AuditTrailService auditTrailService;
    @Mock private ElectronicSignatureService electronicSignatureService;
    @Mock private SignatureTokenConsumptionService signatureTokenConsumptionService;

    @InjectMocks private ControlledCopyRecallBatchService service;

    private final ControlledCopyPdfMarkingService marking = new ControlledCopyPdfMarkingService();
    private final List<ControlledCopyRecallItem> storedItems = new ArrayList<>();
    private final List<ControlledCopyRecallBatch> storedBatches = new ArrayList<>();
    private final java.util.Map<String, byte[]> storedFiles = new java.util.HashMap<>();
    private UserAccount dco;
    private UUID signatureId;

    @BeforeEach
    void setUp() throws Exception {
        dco = user("Dco User");
        when(currentUserService.requireCurrentUser()).thenReturn(dco);
        when(permissionEvaluationService.hasPermission(dco, "documents.controlled_copy.recall")).thenReturn(true);
        when(documentAuthorizationService.canViewAllControlledCopies(dco)).thenReturn(true);
        when(clamAvScanService.isEnabled()).thenReturn(false);

        when(batchRepository.nextBatchSequence()).thenReturn(7L);
        when(batchRepository.saveAndFlush(any(ControlledCopyRecallBatch.class))).thenAnswer(inv -> {
            ControlledCopyRecallBatch batch = inv.getArgument(0);
            storedBatches.removeIf(existing -> existing.getId().equals(batch.getId()));
            storedBatches.add(batch);
            return batch;
        });
        when(batchRepository.save(any(ControlledCopyRecallBatch.class))).thenAnswer(inv -> inv.getArgument(0));
        when(batchRepository.findById(any(UUID.class))).thenAnswer(inv ->
                storedBatches.stream().filter(batch -> batch.getId().equals(inv.getArgument(0))).findFirst());

        when(itemRepository.save(any(ControlledCopyRecallItem.class))).thenAnswer(inv -> {
            ControlledCopyRecallItem item = inv.getArgument(0);
            storedItems.removeIf(existing -> existing.getId().equals(item.getId()));
            storedItems.add(item);
            return item;
        });
        when(itemRepository.findAllByBatch_IdOrderByItemNoAsc(any(UUID.class))).thenAnswer(inv ->
                storedItems.stream().sorted(Comparator.comparingInt(ControlledCopyRecallItem::getItemNo)).toList());
        when(itemRepository.countByBatch_Id(any(UUID.class))).thenAnswer(inv -> (long) storedItems.size());
        when(itemRepository.findByIdAndBatch_Id(any(UUID.class), any(UUID.class))).thenAnswer(inv ->
                storedItems.stream().filter(item -> item.getId().equals(inv.getArgument(0))).findFirst());
        when(itemRepository.findAllByControlledCopy_IdInAndBatch_StatusAndBatch_IdNot(any(), anyString(), any())).thenReturn(List.of());

        when(fileStorageService.storeControlledCopyRecallScan(any(), any(), anyString(), any(InputStream.class))).thenAnswer(inv -> {
            storedFiles.put("stored://" + inv.getArgument(2), ((InputStream) inv.getArgument(3)).readAllBytes());
            return new FileStorageService.StorageWriteResult(null, "stored://" + inv.getArgument(2), "local", null, "key", null, "sum");
        });
        when(fileStorageService.readFile(anyString(), any())).thenAnswer(inv -> storedFiles.get(inv.<String>getArgument(0)));
        when(itemRepository.findAllByBatch_IdOrderByItemNoAsc(any(UUID.class))).thenAnswer(inv ->
                storedItems.stream().sorted(Comparator.comparingInt(ControlledCopyRecallItem::getItemNo)).toList());
        org.mockito.Mockito.doAnswer(inv -> {
            storedItems.removeIf(existing -> existing.getId().equals(inv.<ControlledCopyRecallItem>getArgument(0).getId()));
            return null;
        }).when(itemRepository).delete(any(ControlledCopyRecallItem.class));

        signatureId = UUID.randomUUID();
        ElectronicSignature signature = new ElectronicSignature();
        signature.setId(signatureId);
        when(electronicSignatureService.createEntitySignature(anyString(), any(), anyString(), any(), anyString(), anyString(),
                anyString(), any(), any(), any())).thenReturn(signature);
        when(executedRecordService.recordRecalledCopyScan(any(), any(), any(), any(), any(), anyString(), any())).thenAnswer(inv -> {
            ExecutedRecord record = new ExecutedRecord();
            record.setId(UUID.randomUUID());
            record.setRecordNumber("EXEC-1");
            return record;
        });
    }

    // ── fixtures ─────────────────────────────────────────────────────────────

    private static UserAccount user(String name) {
        UserAccount account = new UserAccount();
        account.setId(UUID.randomUUID());
        account.setFullName(name);
        return account;
    }

    private ControlledCopyRecord copyWithToken(String number, String status) {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setId(UUID.randomUUID());
        copy.setControlledCopyNumber(number);
        copy.setScanToken(ControlledCopyScanCodeService.newToken());
        copy.setStatusCode(status);
        copy.setStatus(status);
        copy.setDistributedAt(Instant.now().minusSeconds(3 * 86400));
        copy.setRecipientUser(user("Recipient of " + number));
        when(controlledCopyRepository.findByScanToken(copy.getScanToken())).thenReturn(Optional.of(copy));
        // The real repository method is case-insensitive; mirror that.
        when(controlledCopyRepository.findByControlledCopyNumberIgnoreCase(org.mockito.ArgumentMatchers.argThat(
                typed -> typed != null && typed.equalsIgnoreCase(number)))).thenReturn(Optional.of(copy));
        return copy;
    }

    private byte[] scanOf(ControlledCopyRecord copy) throws Exception {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            document.addPage(new PDPage(PDRectangle.A4));
            document.save(out);
            byte[] blank = out.toByteArray();
            if (copy == null) {
                return blank;
            }
            return marking.applyScanCode(blank,
                    ControlledCopyScanCodeService.encode(ControlledCopyScanCodeService.payload(copy.getScanToken())),
                    copy.getControlledCopyNumber(), "BOTTOM_RIGHT", 20, 4, List.of()).pdf();
        }
    }

    private static MockMultipartFile file(String name, byte[] bytes) {
        return new MockMultipartFile("files", name, "application/pdf", bytes);
    }

    private static RecallItemResponse item(RecallBatchResponse batch, int itemNo) {
        return batch.items().stream().filter(item -> item.itemNo() == itemNo).findFirst().orElseThrow();
    }

    // ── matching ─────────────────────────────────────────────────────────────

    @Test
    void a_scan_with_a_readable_code_is_matched_to_its_copy_and_ready() throws Exception {
        ControlledCopyRecord copy = copyWithToken("CC-001", "DISTRIBUTED");

        RecallBatchResponse batch = service.createDraft(List.of(file("a.pdf", scanOf(copy))));

        assertThat(batch.status()).isEqualTo("DRAFT");
        assertThat(batch.batchNumber()).matches("RCB-\\d{4}-00007");
        RecallItemResponse item = item(batch, 1);
        assertThat(item.matchStatus()).isEqualTo("READY");
        assertThat(item.matchSource()).isEqualTo("QR");
        assertThat(item.copy().number()).isEqualTo("CC-001");
        assertThat(batch.readyToCommit()).isTrue();
        // Upload alone never touches a copy.
        verifyNoInteractions(controlledCopyService, executedRecordService, signatureTokenConsumptionService, electronicSignatureService);
    }

    @Test
    void the_scans_of_a_batch_are_searched_and_sorted_on_the_server() throws Exception {
        ControlledCopyRecord one = copyWithToken("CC-001", "DISTRIBUTED");
        ControlledCopyRecord two = copyWithToken("CC-002", "DISTRIBUTED");
        RecallBatchResponse draft = service.createDraft(List.of(
                file("zeta.pdf", scanOf(one)), file("alpha.pdf", scanOf(two)), file("blurry.pdf", scanOf(null))));
        UUID batchId = UUID.fromString(draft.id());

        // Default: the order they were uploaded in.
        assertThat(service.listItems(batchId, null, "itemNo", "asc")).extracting(RecallItemResponse::fileName)
                .containsExactly("zeta.pdf", "alpha.pdf", "blurry.pdf");
        // Sorted by file name, both directions.
        assertThat(service.listItems(batchId, null, "file", "asc")).extracting(RecallItemResponse::fileName)
                .containsExactly("alpha.pdf", "blurry.pdf", "zeta.pdf");
        assertThat(service.listItems(batchId, null, "file", "desc")).extracting(RecallItemResponse::fileName)
                .containsExactly("zeta.pdf", "blurry.pdf", "alpha.pdf");
        // Every column of the table can be sorted by the server.
        assertThat(service.listItems(batchId, null, "size", "asc")).extracting(RecallItemResponse::fileSize).isSorted();
        assertThat(service.listItems(batchId, null, "size", "desc")).extracting(RecallItemResponse::fileSize).isSortedAccordingTo(java.util.Comparator.reverseOrder());
        for (String key : List.of("code", "copy", "document", "recipient", "result")) {
            assertThat(service.listItems(batchId, null, key, "asc")).hasSize(3);
        }
        // The scan without a code has no copy, so it sorts first by copy number and last when descending.
        assertThat(service.listItems(batchId, null, "copy", "asc").get(0).fileName()).isEqualTo("blurry.pdf");
        assertThat(service.listItems(batchId, null, "copy", "desc").get(2).fileName()).isEqualTo("blurry.pdf");
        // Search by copy number or by file name, ignoring case; no match is an empty list, not an error.
        assertThat(service.listItems(batchId, "cc-002", "itemNo", "asc")).extracting(RecallItemResponse::fileName).containsExactly("alpha.pdf");
        assertThat(service.listItems(batchId, "BLURR", "itemNo", "asc")).extracting(RecallItemResponse::fileName).containsExactly("blurry.pdf");
        assertThat(service.listItems(batchId, "nothing like this", "itemNo", "asc")).isEmpty();
        // An unknown sort key falls back to the upload order.
        assertThat(service.listItems(batchId, null, "bogus", "asc")).extracting(RecallItemResponse::fileName)
                .containsExactly("zeta.pdf", "alpha.pdf", "blurry.pdf");
    }

    @Test
    void a_scan_without_a_code_is_unmatched_until_the_dco_identifies_the_copy_by_number() throws Exception {
        ControlledCopyRecord copy = copyWithToken("CC-002", "DISTRIBUTED");

        RecallBatchResponse draft = service.createDraft(List.of(file("blurry.pdf", scanOf(null))));
        assertThat(item(draft, 1).matchStatus()).isEqualTo("UNMATCHED");
        assertThat(item(draft, 1).qrStatus()).isEqualTo("NOT_FOUND");
        assertThat(draft.readyToCommit()).isFalse();

        UUID batchId = UUID.fromString(draft.id());
        UUID itemId = UUID.fromString(item(draft, 1).id());
        RecallBatchResponse matched = service.updateItem(batchId, itemId, new RecallItemUpdateRequest(null, "cc-002", null));

        assertThat(item(matched, 1).matchStatus()).isEqualTo("READY");
        assertThat(item(matched, 1).matchSource()).isEqualTo("MANUAL");
        assertThat(item(matched, 1).copy().id()).isEqualTo(copy.getId().toString());
        verify(auditTrailService).logAs(eq(dco), eq("Controlled Copy Recall Batch"), anyString(), any(), eq("MATCH_ITEM"), any(), any(),
                org.mockito.ArgumentMatchers.contains("matched by hand"));
    }

    @Test
    void an_unknown_copy_number_is_rejected() throws Exception {
        RecallBatchResponse draft = service.createDraft(List.of(file("x.pdf", scanOf(null))));
        UUID batchId = UUID.fromString(draft.id());
        UUID itemId = UUID.fromString(item(draft, 1).id());
        when(controlledCopyRepository.findByControlledCopyNumberIgnoreCase("NOPE")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateItem(batchId, itemId, new RecallItemUpdateRequest(null, "NOPE", null)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("NOPE");
    }

    @Test
    void a_copy_printed_before_codes_existed_cannot_be_recalled_by_scan_even_if_named_by_hand() throws Exception {
        ControlledCopyRecord old = copyWithToken("CC-OLD", "DISTRIBUTED");
        old.setScanToken(null);
        RecallBatchResponse draft = service.createDraft(List.of(file("x.pdf", scanOf(null))));

        RecallBatchResponse result = service.updateItem(UUID.fromString(draft.id()), UUID.fromString(item(draft, 1).id()),
                new RecallItemUpdateRequest(null, "CC-OLD", null));

        assertThat(item(result, 1).matchStatus()).isEqualTo("BLOCKED");
        assertThat(item(result, 1).matchMessage()).contains("no scan code");
        assertThat(result.readyToCommit()).isFalse();
    }

    @Test
    void copies_that_cannot_be_recalled_are_blocked_with_the_reason() throws Exception {
        ControlledCopyRecord ready = copyWithToken("CC-READY", "READY_FOR_DISTRIBUTION");
        ControlledCopyRecord recalled = copyWithToken("CC-RECALLED", "OBSOLETED");
        recalled.setRecalledAt(Instant.now().minusSeconds(3600));
        ControlledCopyRecord obsoletedNotRecalled = copyWithToken("CC-OBS", "OBSOLETED");

        RecallBatchResponse batch = service.createDraft(List.of(
                file("1.pdf", scanOf(ready)), file("2.pdf", scanOf(recalled)), file("3.pdf", scanOf(obsoletedNotRecalled))));

        assertThat(item(batch, 1).matchStatus()).isEqualTo("BLOCKED");
        assertThat(item(batch, 1).matchMessage()).contains("only a Distributed copy");
        assertThat(item(batch, 2).matchStatus()).isEqualTo("BLOCKED");
        assertThat(item(batch, 2).matchMessage()).contains("already recalled");
        // Obsoleted by its document's lifecycle but never retrieved: recalling it records the retrieval.
        assertThat(item(batch, 3).matchStatus()).isEqualTo("READY");
    }

    @Test
    void the_same_copy_twice_in_one_batch_blocks_the_second_scan() throws Exception {
        ControlledCopyRecord copy = copyWithToken("CC-DUP", "DISTRIBUTED");

        RecallBatchResponse batch = service.createDraft(List.of(file("1.pdf", scanOf(copy)), file("2.pdf", scanOf(copy))));

        assertThat(item(batch, 1).matchStatus()).isEqualTo("READY");
        assertThat(item(batch, 2).matchStatus()).isEqualTo("BLOCKED");
        assertThat(item(batch, 2).matchMessage()).contains("already on scan 1");
    }

    @Test
    void a_user_not_allowed_to_recall_that_copy_sees_it_blocked() throws Exception {
        ControlledCopyRecord copy = copyWithToken("CC-DENY", "DISTRIBUTED");
        org.mockito.Mockito.doThrow(new AccessDeniedException("You are outside the permitted scope for this controlled copy."))
                .when(controlledCopyAuthorizationService).requireRecallControlledCopy(dco, copy);

        RecallBatchResponse batch = service.createDraft(List.of(file("1.pdf", scanOf(copy))));

        assertThat(item(batch, 1).matchStatus()).isEqualTo("BLOCKED");
        assertThat(item(batch, 1).matchMessage()).contains("outside the permitted scope");
    }

    // ── file handling ────────────────────────────────────────────────────────

    @Test
    void files_that_are_not_pdf_or_images_are_rejected_and_never_stored() throws Exception {
        RecallBatchResponse batch = service.createDraft(List.of(
                file("evil.pdf", "MZ this is an executable".getBytes()),
                file("notes.txt", "hello".getBytes())));

        assertThat(item(batch, 1).matchStatus()).isEqualTo("BLOCKED");
        assertThat(item(batch, 1).matchMessage()).contains("Unsupported file");
        assertThat(item(batch, 1).previewAvailable()).isFalse();
        assertThat(item(batch, 2).matchStatus()).isEqualTo("BLOCKED");
        verify(fileStorageService, never()).storeControlledCopyRecallScan(any(), any(), anyString(), any());
    }

    @Test
    void only_pdf_scans_are_accepted_an_image_is_rejected_even_if_it_is_a_real_picture() throws Exception {
        byte[] png = new byte[64];
        png[0] = (byte) 0x89; png[1] = 'P'; png[2] = 'N'; png[3] = 'G';
        RecallBatchResponse batch = service.createDraft(List.of(file("scan.png", png)));

        assertThat(item(batch, 1).matchStatus()).isEqualTo("BLOCKED");
        assertThat(item(batch, 1).matchMessage()).contains("only PDF scans are accepted");
        verify(fileStorageService, never()).storeControlledCopyRecallScan(any(), any(), anyString(), any());
    }

    @Test
    void a_file_that_starts_like_a_pdf_but_does_not_open_is_rejected_and_never_stored() throws Exception {
        RecallBatchResponse batch = service.createDraft(List.of(file("broken.pdf", "%PDF-1.7 this is not really a pdf".getBytes())));

        assertThat(item(batch, 1).matchStatus()).isEqualTo("BLOCKED");
        assertThat(item(batch, 1).matchMessage()).contains("not a valid PDF");
        verify(fileStorageService, never()).storeControlledCopyRecallScan(any(), any(), anyString(), any());
    }

    @Test
    void a_password_protected_pdf_is_rejected_because_the_stamp_cannot_be_drawn_on_it() throws Exception {
        byte[] locked;
        try (org.apache.pdfbox.pdmodel.PDDocument doc = new org.apache.pdfbox.pdmodel.PDDocument()) {
            doc.addPage(new org.apache.pdfbox.pdmodel.PDPage());
            var policy = new org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy("owner", "user",
                    new org.apache.pdfbox.pdmodel.encryption.AccessPermission());
            policy.setEncryptionKeyLength(128);
            doc.protect(policy);
            var out = new java.io.ByteArrayOutputStream();
            doc.save(out);
            locked = out.toByteArray();
        }
        RecallBatchResponse batch = service.createDraft(List.of(file("locked.pdf", locked)));

        assertThat(item(batch, 1).matchStatus()).isEqualTo("BLOCKED");
        assertThat(item(batch, 1).matchMessage()).containsAnyOf("password-protected", "not a valid PDF");
        verify(fileStorageService, never()).storeControlledCopyRecallScan(any(), any(), anyString(), any());
    }

    @Test
    void an_infected_file_is_rejected_and_never_stored() throws Exception {
        ControlledCopyRecord copy = copyWithToken("CC-VIRUS", "DISTRIBUTED");
        when(clamAvScanService.isEnabled()).thenReturn(true);
        when(clamAvScanService.scan(any(byte[].class))).thenReturn(ClamAvScanService.ScanResult.ofInfected("Eicar-Test-Signature"));

        RecallBatchResponse batch = service.createDraft(List.of(file("1.pdf", scanOf(copy))));

        RecallItemResponse item = item(batch, 1);
        assertThat(item.virusStatus()).isEqualTo("INFECTED");
        assertThat(item.matchStatus()).isEqualTo("BLOCKED");
        assertThat(item.matchMessage()).contains("Eicar-Test-Signature");
        assertThat(batch.readyToCommit()).isFalse();
        verify(fileStorageService, never()).storeControlledCopyRecallScan(any(), any(), anyString(), any());
    }

    @Test
    void when_the_scanner_is_enabled_but_unreachable_the_upload_fails_instead_of_skipping_the_scan() throws Exception {
        ControlledCopyRecord copy = copyWithToken("CC-DOWN", "DISTRIBUTED");
        when(clamAvScanService.isEnabled()).thenReturn(true);
        when(clamAvScanService.scan(any(byte[].class))).thenThrow(
                new ClamAvScanService.VirusScanUnavailableException("ClamAV unreachable", new RuntimeException("down")));
        byte[] bytes = scanOf(copy);

        assertThatThrownBy(() -> service.createDraft(List.of(file("1.pdf", bytes))))
                .isInstanceOf(ClamAvScanService.VirusScanUnavailableException.class);
        verify(fileStorageService, never()).storeControlledCopyRecallScan(any(), any(), anyString(), any());
    }

    @Test
    void at_most_fifty_scans_per_batch() {
        List<MockMultipartFile> files = new ArrayList<>();
        for (int i = 0; i < 51; i++) {
            files.add(file("f" + i + ".pdf", new byte[] {1}));
        }

        assertThatThrownBy(() -> service.createDraft(new ArrayList<>(files)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("at most 50");
    }

    // ── authorization ────────────────────────────────────────────────────────

    @Test
    void recalling_needs_the_recall_permission() throws Exception {
        when(permissionEvaluationService.hasPermission(dco, "documents.controlled_copy.recall")).thenReturn(false);
        byte[] bytes = scanOf(null);

        assertThatThrownBy(() -> service.createDraft(List.of(file("1.pdf", bytes)))).isInstanceOf(AccessDeniedException.class);
        verify(fileStorageService, never()).storeControlledCopyRecallScan(any(), any(), anyString(), any());
    }

    @Test
    void recalling_needs_permission_to_see_every_controlled_copy() throws Exception {
        when(documentAuthorizationService.canViewAllControlledCopies(dco)).thenReturn(false);
        byte[] bytes = scanOf(null);

        assertThatThrownBy(() -> service.createDraft(List.of(file("1.pdf", bytes)))).isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("view all controlled copies");
    }

    @Test
    void a_draft_started_by_someone_else_cannot_be_changed_or_committed() throws Exception {
        RecallBatchResponse draft = service.createDraft(List.of(file("1.pdf", scanOf(null))));
        UUID batchId = UUID.fromString(draft.id());
        UUID itemId = UUID.fromString(item(draft, 1).id());
        UserAccount other = user("Another DCO");
        when(currentUserService.requireCurrentUser()).thenReturn(other);
        when(permissionEvaluationService.hasPermission(other, "documents.controlled_copy.recall")).thenReturn(true);
        when(documentAuthorizationService.canViewAllControlledCopies(other)).thenReturn(true);

        assertThatThrownBy(() -> service.updateItem(batchId, itemId, new RecallItemUpdateRequest(true, null, null)))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.commit(batchId, new RecallBatchCommitRequest("reason", null, "token")))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.discard(batchId)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(signatureTokenConsumptionService, controlledCopyService);
    }

    // ── commit ───────────────────────────────────────────────────────────────

    @Test
    void commit_recalls_every_included_copy_under_one_signature_and_files_each_scan() throws Exception {
        ControlledCopyRecord first = copyWithToken("CC-A", "DISTRIBUTED");
        ControlledCopyRecord second = copyWithToken("CC-B", "DISTRIBUTED");
        ControlledCopyRecord skipped = copyWithToken("CC-C", "DISTRIBUTED");
        RecallBatchResponse draft = service.createDraft(List.of(
                file("a.pdf", scanOf(first)), file("b.pdf", scanOf(second)), file("c.pdf", scanOf(skipped))));
        UUID batchId = UUID.fromString(draft.id());
        service.updateItem(batchId, UUID.fromString(item(draft, 3).id()), new RecallItemUpdateRequest(true, null, null));

        RecallBatchResponse result = service.commit(batchId, new RecallBatchCommitRequest("Annual SOP refresh", null, "sig-token"));

        assertThat(result.status()).isEqualTo("COMMITTED");
        assertThat(result.recallReason()).isEqualTo("Annual SOP refresh");
        assertThat(result.committedAt()).isNotNull();
        assertThat(item(result, 1).outcome()).isEqualTo("RECALLED");
        assertThat(item(result, 2).outcome()).isEqualTo("RECALLED");
        assertThat(item(result, 3).outcome()).isEqualTo("SKIPPED");
        // ONE signature for the whole reviewed list, created after the token was consumed once.
        InOrder order = inOrder(signatureTokenConsumptionService, electronicSignatureService, controlledCopyService);
        order.verify(signatureTokenConsumptionService).requireAndConsume("sig-token", dco);
        order.verify(electronicSignatureService).createEntitySignature(eq("ControlledCopyRecallBatch"), eq(batchId), anyString(), eq(dco),
                eq("sig-token"), eq("CONTROLLED_COPY_RECALLED"), eq("Annual SOP refresh"), org.mockito.ArgumentMatchers.contains("CC-A, CC-B"),
                any(), any());
        order.verify(controlledCopyService).recallFromScanBatch(eq(first.getId()), eq(dco), eq("Annual SOP refresh"), any(Instant.class), anyString(), eq(signatureId));
        order.verify(controlledCopyService).recallFromScanBatch(eq(second.getId()), eq(dco), eq("Annual SOP refresh"), any(Instant.class), anyString(), eq(signatureId));
        verify(controlledCopyService, never()).recallFromScanBatch(eq(skipped.getId()), any(), anyString(), any(), anyString(), any());
        verify(signatureTokenConsumptionService, org.mockito.Mockito.times(1)).requireAndConsume(anyString(), any());
        verify(electronicSignatureService, org.mockito.Mockito.times(1)).createEntitySignature(
                anyString(), any(), anyString(), any(), anyString(), anyString(), anyString(), any(), any(), any());
        verify(executedRecordService, org.mockito.Mockito.times(2)).recordRecalledCopyScan(
                any(), any(), eq(dco), any(Instant.class), eq(batchId), anyString(), eq(signatureId));
    }

    @Test
    void a_batch_with_a_scan_that_is_not_ready_changes_nothing_and_consumes_no_signature() throws Exception {
        ControlledCopyRecord good = copyWithToken("CC-GOOD", "DISTRIBUTED");
        RecallBatchResponse draft = service.createDraft(List.of(file("good.pdf", scanOf(good)), file("blurry.pdf", scanOf(null))));
        UUID batchId = UUID.fromString(draft.id());

        assertThatThrownBy(() -> service.commit(batchId, new RecallBatchCommitRequest("reason", null, "sig-token")))
                .isInstanceOf(RecallBatchNotReadyException.class)
                .hasMessageContaining("Scan 2")
                .hasMessageContaining("Nothing was recalled");

        verifyNoInteractions(signatureTokenConsumptionService, electronicSignatureService, controlledCopyService, executedRecordService);
        assertThat(storedBatches.get(0).getStatus()).isEqualTo("DRAFT");
    }

    @Test
    void a_copy_that_changed_state_after_upload_is_caught_at_commit() throws Exception {
        ControlledCopyRecord copy = copyWithToken("CC-RACE", "DISTRIBUTED");
        RecallBatchResponse draft = service.createDraft(List.of(file("1.pdf", scanOf(copy))));
        UUID batchId = UUID.fromString(draft.id());
        // Someone recalled it individually while the DCO was reviewing.
        copy.setStatusCode("OBSOLETED");
        copy.setStatus("OBSOLETED");
        copy.setRecalledAt(Instant.now());

        assertThatThrownBy(() -> service.commit(batchId, new RecallBatchCommitRequest("reason", null, "sig-token")))
                .isInstanceOf(RecallBatchNotReadyException.class).hasMessageContaining("already recalled");
        verifyNoInteractions(signatureTokenConsumptionService, controlledCopyService);
    }

    @Test
    void commit_requires_a_reason_and_a_signature() throws Exception {
        ControlledCopyRecord copy = copyWithToken("CC-R", "DISTRIBUTED");
        UUID batchId = UUID.fromString(service.createDraft(List.of(file("1.pdf", scanOf(copy)))).id());

        assertThatThrownBy(() -> service.commit(batchId, new RecallBatchCommitRequest("  ", null, "sig-token")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Reason");
        assertThatThrownBy(() -> service.commit(batchId, new RecallBatchCommitRequest("reason", null, " ")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("signature");
        verifyNoInteractions(signatureTokenConsumptionService);
    }

    @Test
    void the_received_date_cannot_be_in_the_future_or_before_distribution() throws Exception {
        ControlledCopyRecord copy = copyWithToken("CC-D", "DISTRIBUTED");
        UUID batchId = UUID.fromString(service.createDraft(List.of(file("1.pdf", scanOf(copy)))).id());

        assertThatThrownBy(() -> service.commit(batchId, new RecallBatchCommitRequest("reason",
                Instant.now().plusSeconds(86400).toString(), "sig-token")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("future");
        assertThatThrownBy(() -> service.commit(batchId, new RecallBatchCommitRequest("reason",
                Instant.now().minusSeconds(30L * 86400).toString(), "sig-token")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("before controlled copy CC-D was distributed");
        assertThatThrownBy(() -> service.commit(batchId, new RecallBatchCommitRequest("reason", "not a date", "sig-token")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not valid");
        verifyNoInteractions(signatureTokenConsumptionService, controlledCopyService);
    }

    @Test
    void an_all_excluded_batch_has_nothing_to_commit() throws Exception {
        ControlledCopyRecord copy = copyWithToken("CC-X", "DISTRIBUTED");
        RecallBatchResponse draft = service.createDraft(List.of(file("1.pdf", scanOf(copy))));
        UUID batchId = UUID.fromString(draft.id());
        service.updateItem(batchId, UUID.fromString(item(draft, 1).id()), new RecallItemUpdateRequest(true, null, null));

        assertThatThrownBy(() -> service.commit(batchId, new RecallBatchCommitRequest("reason", null, "sig-token")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("nothing to recall");
        verifyNoInteractions(signatureTokenConsumptionService, controlledCopyService);
    }

    @Test
    void a_committed_batch_can_no_longer_be_changed_or_committed_again() throws Exception {
        ControlledCopyRecord copy = copyWithToken("CC-ONCE", "DISTRIBUTED");
        RecallBatchResponse draft = service.createDraft(List.of(file("1.pdf", scanOf(copy))));
        UUID batchId = UUID.fromString(draft.id());
        service.commit(batchId, new RecallBatchCommitRequest("reason", null, "sig-token"));

        assertThatThrownBy(() -> service.commit(batchId, new RecallBatchCommitRequest("reason", null, "sig-token-2")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("COMMITTED");
        assertThatThrownBy(() -> service.discard(batchId)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void discarding_a_draft_recalls_nothing() throws Exception {
        ControlledCopyRecord copy = copyWithToken("CC-DISC", "DISTRIBUTED");
        UUID batchId = UUID.fromString(service.createDraft(List.of(file("1.pdf", scanOf(copy)))).id());

        RecallBatchResponse result = service.discard(batchId);

        assertThat(result.status()).isEqualTo("DISCARDED");
        verifyNoInteractions(controlledCopyService, executedRecordService, signatureTokenConsumptionService);
    }

    @Test
    void a_copy_claimed_by_another_open_draft_is_blocked() throws Exception {
        ControlledCopyRecord copy = copyWithToken("CC-CLAIM", "DISTRIBUTED");
        ControlledCopyRecallBatch other = new ControlledCopyRecallBatch();
        other.setId(UUID.randomUUID());
        other.setBatchNumber("RCB-2026-00002");
        ControlledCopyRecallItem theirs = new ControlledCopyRecallItem();
        theirs.setBatch(other);
        theirs.setControlledCopy(copy);
        when(itemRepository.findAllByControlledCopy_IdInAndBatch_StatusAndBatch_IdNot(any(), eq("DRAFT"), any())).thenReturn(List.of(theirs));

        RecallBatchResponse batch = service.createDraft(List.of(file("1.pdf", scanOf(copy))));

        assertThat(item(batch, 1).matchStatus()).isEqualTo("BLOCKED");
        assertThat(item(batch, 1).matchMessage()).contains("RCB-2026-00002");
    }

    @Test
    void authorization_failures_for_one_copy_do_not_hide_which_copy_it_was() throws Exception {
        ControlledCopyRecord copy = copyWithToken("CC-AUTH", "DISTRIBUTED");
        org.mockito.Mockito.doThrow(new ControlledCopyAuthorizationException("OUT_OF_SCOPE", "You are outside the permitted scope.",
                        "documents.controlled_copy.recall", null))
                .when(controlledCopyAuthorizationService).requireRecallControlledCopy(dco, copy);

        RecallBatchResponse batch = service.createDraft(List.of(file("1.pdf", scanOf(copy))));

        assertThat(item(batch, 1).copy().number()).isEqualTo("CC-AUTH");
        assertThat(item(batch, 1).matchStatus()).isEqualTo("BLOCKED");
    }

    // ── scans that hold the loose pages of several copies ────────────────────

    /** A copy of {@code pages} pages whose every page carries its own code (copy token, page, page count), as printed now. */
    private byte[] pagedCopy(ControlledCopyRecord copy, int pages) throws Exception {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (int i = 0; i < pages; i++) {
                document.addPage(new PDPage(PDRectangle.A4));
            }
            document.save(out);
            return marking.applyScanCodes(out.toByteArray(),
                    index -> ControlledCopyScanCodeService.encode(ControlledCopyScanCodeService.pagePayload(copy.getScanToken(), index + 1, pages)),
                    true, copy.getControlledCopyNumber(), "BOTTOM_RIGHT", null, null, 20, 4, List.of()).pdf();
        }
    }

    private static byte[] blankPage() throws Exception {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            document.addPage(new PDPage(PDRectangle.A4));
            document.save(out);
            return out.toByteArray();
        }
    }

    /** One scan made of the given pages (source, zero-based index), in the given order. */
    private static byte[] shuffled(List<byte[]> sources, List<int[]> picks) throws Exception {
        List<PDDocument> open = new ArrayList<>();
        try (PDDocument target = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (byte[] source : sources) {
                open.add(Loader.loadPDF(source));
            }
            for (int[] pick : picks) {
                target.importPage(open.get(pick[0]).getPage(pick[1]));
            }
            target.save(out);
            return out.toByteArray();
        } finally {
            for (PDDocument document : open) {
                document.close();
            }
        }
    }

    /** The page number each page of a stored file says it is, in file order. */
    private List<Integer> pageNumbersIn(RecallItemResponse item) throws Exception {
        List<Integer> numbers = new ArrayList<>();
        for (ControlledCopyScanCodeService.PageScan scan : ControlledCopyScanCodeService.decodePages(storedFiles.get("stored://" + item.fileName()))) {
            numbers.add(scan.code() == null ? null : scan.code().page());
        }
        return numbers;
    }

    @Test
    void one_scan_of_mixed_up_pages_is_split_by_copy_and_each_copy_is_put_in_page_order() throws Exception {
        ControlledCopyRecord a = copyWithToken("CC-A", "DISTRIBUTED");
        ControlledCopyRecord b = copyWithToken("CC-B", "DISTRIBUTED");
        byte[] copyA = pagedCopy(a, 3);
        byte[] copyB = pagedCopy(b, 2);
        // B2, A3, A1, B1, A2: pages of two copies shuffled together, as they come out of the photocopier.
        byte[] scan = shuffled(List.of(copyA, copyB), List.of(new int[] {1, 1}, new int[] {0, 2}, new int[] {0, 0}, new int[] {1, 0}, new int[] {0, 1}));

        RecallBatchResponse batch = service.createDraft(List.of(file("pile.pdf", scan)));

        assertThat(batch.items()).hasSize(2);
        RecallItemResponse itemA = batch.items().stream().filter(item -> item.copy() != null && "CC-A".equals(item.copy().number())).findFirst().orElseThrow();
        RecallItemResponse itemB = batch.items().stream().filter(item -> item.copy() != null && "CC-B".equals(item.copy().number())).findFirst().orElseThrow();
        assertThat(itemA.matchStatus()).isEqualTo("READY");
        assertThat(itemB.matchStatus()).isEqualTo("READY");
        assertThat(pageNumbersIn(itemA)).containsExactly(1, 2, 3);
        assertThat(pageNumbersIn(itemB)).containsExactly(1, 2);
        assertThat(itemA.pageNumbers()).isEqualTo("1,2,3");
        assertThat(itemA.expectedPages()).isEqualTo(3);
        assertThat(itemA.sourceFileName()).isEqualTo("pile.pdf");
        assertThat(batch.readyToCommit()).isTrue();
    }

    @Test
    void a_page_without_a_readable_code_is_listed_and_a_copy_missing_it_cannot_be_recalled() throws Exception {
        ControlledCopyRecord a = copyWithToken("CC-A", "DISTRIBUTED");
        byte[] copyA = pagedCopy(a, 3);
        byte[] scan = shuffled(List.of(copyA, blankPage()), List.of(new int[] {0, 2}, new int[] {1, 0}, new int[] {0, 0}));

        RecallBatchResponse batch = service.createDraft(List.of(file("pile.pdf", scan)));

        assertThat(batch.items()).hasSize(2);
        RecallItemResponse group = batch.items().stream().filter(item -> !item.loosePage()).findFirst().orElseThrow();
        RecallItemResponse loose = batch.items().stream().filter(RecallItemResponse::loosePage).findFirst().orElseThrow();
        assertThat(group.matchStatus()).isEqualTo("BLOCKED");
        assertThat(group.matchMessage()).contains("CC-A is incomplete").contains("page 2 of 3 missing");
        assertThat(loose.matchStatus()).isEqualTo("UNMATCHED");
        assertThat(loose.sourcePages()).isEqualTo("page 2 of pile.pdf");
        assertThat(loose.matchMessage()).contains("No code could be read on this page").contains("page number");
        assertThat(batch.readyToCommit()).isFalse();
    }

    @Test
    void assigning_the_loose_page_by_copy_number_and_page_number_puts_it_in_its_place() throws Exception {
        ControlledCopyRecord a = copyWithToken("CC-A", "DISTRIBUTED");
        byte[] scan = shuffled(List.of(pagedCopy(a, 3), blankPage()), List.of(new int[] {0, 2}, new int[] {1, 0}, new int[] {0, 0}));
        RecallBatchResponse draft = service.createDraft(List.of(file("pile.pdf", scan)));
        UUID batchId = UUID.fromString(draft.id());
        UUID looseId = UUID.fromString(draft.items().stream().filter(RecallItemResponse::loosePage).findFirst().orElseThrow().id());

        RecallBatchResponse placed = service.updateItem(batchId, looseId, new RecallItemUpdateRequest(null, "cc-a", null, 2));

        assertThat(placed.items()).hasSize(1);
        RecallItemResponse whole = placed.items().get(0);
        assertThat(whole.matchStatus()).isEqualTo("READY");
        assertThat(whole.pageNumbers()).isEqualTo("1,2,3");
        // The typed-in page sits between the pages that carry codes, so the order is exact.
        List<Integer> numbers = pageNumbersIn(whole);
        assertThat(numbers).hasSize(3);
        assertThat(numbers.get(0)).isEqualTo(1);
        assertThat(numbers.get(1)).isNull();
        assertThat(numbers.get(2)).isEqualTo(3);
        assertThat(placed.readyToCommit()).isTrue();
    }

    @Test
    void a_loose_page_needs_a_page_number_inside_the_copy_that_is_not_taken() throws Exception {
        ControlledCopyRecord a = copyWithToken("CC-A", "DISTRIBUTED");
        byte[] scan = shuffled(List.of(pagedCopy(a, 3), blankPage()), List.of(new int[] {0, 2}, new int[] {1, 0}, new int[] {0, 0}));
        RecallBatchResponse draft = service.createDraft(List.of(file("pile.pdf", scan)));
        UUID batchId = UUID.fromString(draft.id());
        UUID looseId = UUID.fromString(draft.items().stream().filter(RecallItemResponse::loosePage).findFirst().orElseThrow().id());

        assertThatThrownBy(() -> service.updateItem(batchId, looseId, new RecallItemUpdateRequest(null, "CC-A", null, null)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("page number").hasMessageContaining("1 to 3");
        assertThatThrownBy(() -> service.updateItem(batchId, looseId, new RecallItemUpdateRequest(null, "CC-A", null, 4)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("1 to 3");
        assertThatThrownBy(() -> service.updateItem(batchId, looseId, new RecallItemUpdateRequest(null, "CC-A", null, 3)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("already on scan");
        // Nothing changed: the page is still loose and the copy still lacks it.
        assertThat(service.get(batchId).items()).hasSize(2);
    }

    @Test
    void a_page_scanned_twice_is_a_duplicate_to_exclude_not_a_second_page() throws Exception {
        ControlledCopyRecord a = copyWithToken("CC-A", "DISTRIBUTED");
        byte[] copyA = pagedCopy(a, 2);
        byte[] scan = shuffled(List.of(copyA), List.of(new int[] {0, 0}, new int[] {0, 1}, new int[] {0, 1}));

        RecallBatchResponse batch = service.createDraft(List.of(file("pile.pdf", scan)));

        assertThat(batch.items()).hasSize(2);
        RecallItemResponse group = batch.items().stream().filter(item -> !item.loosePage()).findFirst().orElseThrow();
        RecallItemResponse duplicate = batch.items().stream().filter(RecallItemResponse::loosePage).findFirst().orElseThrow();
        assertThat(group.matchStatus()).isEqualTo("READY");
        assertThat(pageNumbersIn(group)).containsExactly(1, 2);
        assertThat(duplicate.matchMessage()).contains("duplicate");
        // The duplicate blocks the batch until the DCO excludes it.
        assertThat(batch.readyToCommit()).isFalse();
        RecallBatchResponse excluded = service.updateItem(UUID.fromString(batch.id()), UUID.fromString(duplicate.id()), new RecallItemUpdateRequest(true, null, null));
        assertThat(excluded.readyToCommit()).isTrue();
    }

    @Test
    void a_page_whose_code_belongs_to_no_copy_is_listed_for_the_dco() throws Exception {
        ControlledCopyRecord ghost = new ControlledCopyRecord();
        ghost.setScanToken(ControlledCopyScanCodeService.newToken());
        ghost.setControlledCopyNumber("CC-GHOST");
        byte[] scan = pagedCopy(ghost, 1);

        RecallBatchResponse batch = service.createDraft(List.of(file("ghost.pdf", scan)));

        assertThat(batch.items()).hasSize(1);
        assertThat(batch.items().get(0).loosePage()).isTrue();
        assertThat(batch.items().get(0).matchMessage()).contains("does not belong to any controlled copy");
    }
}
