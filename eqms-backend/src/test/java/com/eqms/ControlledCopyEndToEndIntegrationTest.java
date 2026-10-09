package com.eqms;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.dto.controlledcopyrecall.RecallBatchCommitRequest;
import com.eqms.dto.controlledcopyrecall.RecallBatchResponse;
import com.eqms.dto.controlledcopyrecall.RecallItemUpdateRequest;
import com.eqms.dto.document.ControlledCopyDistributeRequest;
import com.eqms.dto.document.ControlledCopyListItemResponse;
import com.eqms.dto.document.ControlledCopyRequestCreateRequest;
import com.eqms.entity.ControlledCopyPolicySetting;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyPolicySettingRepository;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.ClamAvScanService;
import com.eqms.service.ControlledCopyAuthorizationService;
import com.eqms.service.ControlledCopyPdfMarkingService;
import com.eqms.service.ControlledCopyPdfMarkingService.Placement;
import com.eqms.service.ControlledCopyPolicyService;
import com.eqms.service.ControlledCopyPreviewGrantService;
import com.eqms.service.ControlledCopyRecallBatchService;
import com.eqms.service.ControlledCopyScanCodeService;
import com.eqms.service.ControlledCopyService;
import com.eqms.service.ElectronicSignatureService;
import com.eqms.service.ExecutedRecordService;
import com.eqms.service.FileStorageService;
import com.eqms.service.SignatureTokenConsumptionService;
import com.fasterxml.jackson.databind.JsonNode;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * The whole life of a paper Controlled Copy on the real schema and the real services: policy (download allowed, stamp,
 * watermark, a QR code placed by hand), request, distribution, issuing (the marks and the QR code are printed), download, and
 * the recall by scan, ending with the scan filed as a Record that is shown with the "Obsoleted" marking.
 *
 * <p>Only storage, the virus scanner and the e-signature are replaced; everything runs inside one transaction that is rolled
 * back, so the live policy (including "allow download") is never changed.</p>
 */
@SpringBootTest
@Transactional
class ControlledCopyEndToEndIntegrationTest {

    @Autowired private ControlledCopyService copyService;
    @Autowired private ControlledCopyRecallBatchService recallService;
    @Autowired private ExecutedRecordService executedRecordService;
    @Autowired private ControlledCopyPolicyService policyService;
    @Autowired private ControlledCopyPolicySettingRepository policyRepository;
    @Autowired private ControlledCopyRepository copyRepository;
    @Autowired private DocumentRecordRepository documentRepository;
    @Autowired private DocumentRevisionRepository revisionRepository;
    @Autowired private UserAccountRepository userAccountRepository;
    @Autowired private ControlledCopyAuthorizationService authorizationService;
    @Autowired private ControlledCopyPreviewGrantService grantService;
    @Autowired private ControlledCopyPdfMarkingService markingService;
    @Autowired private com.eqms.service.ControlledCopyExpiryLimitService expiryLimitService;
    @Autowired private com.eqms.repository.ExecutedRecordRepository executedRecordRepository;
    @Autowired private com.eqms.repository.AuditLogRepository auditLogRepository;
    @Autowired private com.eqms.repository.AuditLogChangeRepository auditLogChangeRepository;

    @MockitoBean private FileStorageService fileStorageService;
    @MockitoBean private ClamAvScanService clamAvScanService;
    @MockitoBean private SignatureTokenConsumptionService signatureTokenConsumptionService;
    @MockitoBean private ElectronicSignatureService electronicSignatureService;

    private final Map<String, byte[]> storage = new ConcurrentHashMap<>();
    private UserAccount admin;

    @BeforeEach
    void setUp() throws Exception {
        admin = userAccountRepository.findByUsername("admin").orElseThrow(() -> new AssertionError("Seeded 'admin' user not found"));
        AuthenticatedUser principal = new AuthenticatedUser(admin.getId(), UUID.randomUUID(), admin.getUsername(),
                admin.getRoleName() != null ? admin.getRoleName() : "USER", Collections.emptySet());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));

        when(clamAvScanService.isEnabled()).thenReturn(false);
        // Anything that was not stored by this test (the published PDF of a real revision, templates) reads as a plain page.
        when(fileStorageService.readFile(anyString())).thenAnswer(inv -> storage.computeIfAbsent(inv.getArgument(0), key -> page("Published document")));
        when(fileStorageService.readFile(anyString(), any())).thenAnswer(inv -> storage.computeIfAbsent(inv.getArgument(0), key -> page("Published document")));
        when(fileStorageService.storeControlledCopyPdf(any(ControlledCopyRecord.class), any(InputStream.class))).thenAnswer(inv -> {
            ControlledCopyRecord copy = inv.getArgument(0);
            String path = "mem://copy/" + copy.getId() + "/" + UUID.randomUUID();
            storage.put(path, ((InputStream) inv.getArgument(1)).readAllBytes());
            return new FileStorageService.StorageWriteResult(null, path, "local", null, path, null, "sum");
        });
        when(fileStorageService.storeControlledCopyRecallScan(any(), any(), anyString(), any(InputStream.class))).thenAnswer(inv -> {
            String path = "mem://scan/" + inv.getArgument(1) + "/" + inv.getArgument(2);
            storage.put(path, ((InputStream) inv.getArgument(3)).readAllBytes());
            return new FileStorageService.StorageWriteResult(null, path, "local", null, path, null, "unused");
        });

        ElectronicSignature signature = new ElectronicSignature();
        signature.setId(UUID.randomUUID());
        when(signatureTokenConsumptionService.requireAndConsume(anyString(), any())).thenReturn(UUID.randomUUID());
        when(electronicSignatureService.createEntitySignature(anyString(), any(), anyString(), any(), anyString(), anyString(),
                anyString(), any(), any(), any())).thenReturn(signature);
    }

    private static byte[] page(String text) {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                content.beginText();
                content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                content.newLineAtOffset(72, 700);
                content.showText(text);
                content.endText();
            }
            document.save(out);
            return out.toByteArray();
        } catch (java.io.IOException ex) {
            throw new IllegalStateException(ex);
        }
    }

    /** A real document the admin may request a copy of: effective revision with a published PDF, not a template. */
    private DocumentRecord requestableDocument() {
        for (DocumentRecord document : documentRepository.findAll()) {
            if (document.isTemplate()) {
                continue;
            }
            DocumentRevisionRecord revision = revisionRepository
                    .findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "EFFECTIVE").orElse(null);
            if (revision == null || revision.getPreviewFilePath() == null || revision.getPreviewFilePath().isBlank()) {
                continue;
            }
            try {
                authorizationService.requireRequestControlledCopy(admin, document, revision);
                // A copy expires with its document: give the seed document a Valid Until date that is still ahead.
                withValidUntil(document, revision, java.time.LocalDate.now().plusYears(1));
                return document;
            } catch (AccessDeniedException ex) {
                // try the next one
            }
        }
        assumeTrue(false, "Seed data has no document the admin may request a controlled copy of");
        return null;
    }

    private void withValidUntil(DocumentRecord document, DocumentRevisionRecord revision, java.time.LocalDate validUntil) {
        document.setValidUntil(validUntil);
        revision.setValidUntil(validUntil);
        documentRepository.saveAndFlush(document);
        revisionRepository.saveAndFlush(revision);
    }

    private DocumentRevisionRecord effectiveRevisionOf(DocumentRecord document) {
        return revisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "EFFECTIVE").orElseThrow();
    }

    private ControlledCopyPolicySetting configurePolicy(boolean allowDownload) {
        ControlledCopyPolicySetting policy = policyService.loadOrDefault();
        policy.setAllowDownload(allowDownload);
        policy.setDownloadOnce(false);
        policy.setAllowPrint(true);
        policy.setPrintOnce(true);
        policy.setQrCodeEnabled(true);
        policy.setQrCodePosition("BOTTOM_RIGHT");
        policy.setQrCodeSizeMm(20);
        // Dragged to the middle of the page, where the stamp or the watermark may be: it must never be printed on top of them.
        policy.setQrCodeX(0.40);
        policy.setQrCodeY(0.45);
        policy.setStampEnabled(true);
        policy.setWatermarkEnabled(true);
        return policyRepository.saveAndFlush(policy);
    }

    private ControlledCopyRecord requestAndDistribute(DocumentRecord document) {
        return requestAndDistribute(document, "RECORD_KEEPING");
    }

    private ControlledCopyRecord requestAndDistribute(DocumentRecord document, String usagePurpose) {
        ControlledCopyRequestCreateRequest request = new ControlledCopyRequestCreateRequest(
                document.getId().toString(), null, null, admin.getFullName(), null, null, "End to end test", 1,
                "INTERNAL", "individual", false, null, List.of(), List.of(), List.of(), List.of(), List.of(),
                "End to end test of the whole copy life", 1, null, "request-token",
                List.of(new ControlledCopyRequestCreateRequest.ControlledCopyRecipientRequest(
                        "USER", admin.getId().toString(), null, admin.getDepartment(), null, 1)), usagePurpose);
        ControlledCopyListItemResponse created = copyService.requestControlledCopy(request);
        ControlledCopyRecord copy = copyRepository.findById(UUID.fromString(created.id())).orElseThrow();
        assertThat(copy.getStatusCode()).isEqualTo("READY_FOR_DISTRIBUTION");
        assertThat(copy.getScanToken()).as("no code before the copy is issued").isNull();

        copyService.distributeBatch(copy.getDistributionBatch().getId(),
                new ControlledCopyDistributeRequest(null, null, null, "Issued for the end to end test", "distribute-token", Map.of()));
        copyService.finalizeDistributedCopy(copy.getId(), admin.getId());
        return copyRepository.findById(copy.getId()).orElseThrow();
    }

    private static boolean overlapsMarks(Placement qr, List<Placement> marks) {
        return marks.stream().filter(mark -> !"QR".equals(mark.kind())).anyMatch(mark -> qr.overlaps(mark, 0f));
    }

    @Test
    void a_copy_is_issued_with_its_code_downloaded_and_recalled_by_scan_from_that_download() throws Exception {
        DocumentRecord document = requestableDocument();
        configurePolicy(true);

        // 1-3. Request, distribution and issuing.
        ControlledCopyRecord copy = requestAndDistribute(document);
        assertThat(copy.getStatusCode()).isEqualTo("DISTRIBUTED");
        assertThat(copy.getScanToken()).as("the copy carries its own code once issued").isNotBlank();

        // 4. The stored PDF carries the code, and the code is not on the stamp or the watermark.
        byte[] issued = storage.get(copy.getControlledCopyFilePath());
        assertThat(ControlledCopyScanCodeService.decode(issued).token()).isEqualTo(copy.getScanToken());
        // Every page carries its own code, with its page number and the page count, so loose pages can be put back in order.
        List<ControlledCopyScanCodeService.PageScan> pages = ControlledCopyScanCodeService.decodePages(issued);
        assertThat(pages).isNotEmpty().allSatisfy(page -> assertThat(page.code().token()).isEqualTo(copy.getScanToken()));
        assertThat(pages).extracting(page -> page.code().page()).containsExactlyElementsOf(java.util.stream.IntStream.rangeClosed(1, pages.size()).boxed().toList());
        assertThat(pages).extracting(page -> page.code().pages()).containsOnly(pages.size());
        List<Placement> layout = markingService.fromJson(copy.getMarkingLayout());
        Placement qr = layout.stream().filter(mark -> "QR".equals(mark.kind())).findFirst().orElseThrow();
        assertThat(layout).extracting(Placement::kind).as("the stamp and the watermark were printed too").contains("STAMP", "WATERMARK");
        assertThat(overlapsMarks(qr, layout)).as("QR code overlaps the stamp or the watermark").isFalse();
        System.out.println("E2E layout: " + layout);

        // 5. Download is allowed by the policy, and the downloaded file is that same PDF with the code.
        String grant = grantService.issue(copy);
        ControlledCopyService.FileDownload download = copyService.downloadControlledCopy(copy.getId(), grant, null);
        assertThat(download.contentType()).isEqualTo("application/pdf");
        assertThat(ControlledCopyScanCodeService.decode(download.bytes()).token()).isEqualTo(copy.getScanToken());

        // 6. Recall by scan, using the downloaded paper as the scan.
        RecallBatchResponse draft = recallService.createDraft(List.of(new MockMultipartFile("files", "scan.pdf", "application/pdf", download.bytes())));
        assertThat(draft.items().get(0).matchStatus()).as(draft.items().get(0).matchMessage()).isEqualTo("READY");
        assertThat(draft.items().get(0).copy().id()).isEqualTo(copy.getId().toString());
        RecallBatchResponse committed = recallService.commit(UUID.fromString(draft.id()), new RecallBatchCommitRequest("End to end", null, "recall-token"));
        assertThat(committed.items().get(0).outcome()).isEqualTo("RECALLED");

        ControlledCopyRecord recalled = copyRepository.findById(copy.getId()).orElseThrow();
        assertThat(recalled.getStatusCode()).isEqualTo("OBSOLETED");
        assertThat(recalled.getRecalledAt()).isNotNull();

        // 7. The scan is a Record of that copy, found by copy, and shown with the "Obsoleted" marking.
        var records = executedRecordService.list(1, 10, null, null, copy.getId().toString(), null, null, "created", "desc");
        assertThat(records.data()).hasSize(1);
        ExecutedRecordService.RecordFile shown = executedRecordService.previewFile(UUID.fromString(records.data().get(0).id()));
        assertThat(shown.contentType()).isEqualTo("application/pdf");
        try (PDDocument document2 = Loader.loadPDF(shown.bytes())) {
            assertThat(new PDFTextStripper().getText(document2)).contains(policyService.statusMarkingFor(policyService.loadOrDefault(), "OBSOLETED").stampText());
        }
        // The stored scan itself was not touched by the marking.
        assertThat(storage.values().stream().anyMatch(bytes -> java.util.Arrays.equals(bytes, download.bytes()))).isTrue();
    }

    @Test
    void download_is_refused_while_the_policy_does_not_allow_it() throws Exception {
        DocumentRecord document = requestableDocument();
        configurePolicy(false);
        ControlledCopyRecord copy = requestAndDistribute(document);

        assertThatThrownBy(() -> copyService.downloadControlledCopy(copy.getId(), grantService.issue(copy), null))
                .isInstanceOf(AccessDeniedException.class).hasMessageContaining("Download is disabled");
        // The code is printed all the same: it does not depend on the download or print settings.
        assertThat(ControlledCopyScanCodeService.decode(storage.get(copy.getControlledCopyFilePath())).token()).isEqualTo(copy.getScanToken());
    }

    /**
     * Found on the preview page: the Print button did nothing. The recipient opens the link without an eQMS session, and the one-time
     * print (like the download) is consumed by an update query that clears the persistence context, after which the audit entry of
     * that guest read the recipient's lazy proxy and failed: the request answered 500, the transaction rolled back, nothing printed.
     */
    @Test
    void a_recipient_without_a_session_can_print_and_download_once_through_the_preview_link() throws Exception {
        DocumentRecord document = requestableDocument();
        configurePolicy(true);
        ControlledCopyRecord copy = requestAndDistribute(document);
        String grant = grantService.issue(copy);
        SecurityContextHolder.clearContext(); // the link is opened by a person who is not logged in

        copyService.consumePreviewPrint(copy.getId(), grant);
        assertThat(copyRepository.findById(copy.getId()).orElseThrow().getPrintCount()).isEqualTo(1);
        // One print per record: the second one is refused, with a message, not an error.
        assertThatThrownBy(() -> copyService.consumePreviewPrint(copy.getId(), grant))
                .isInstanceOf(AccessDeniedException.class).hasMessageContaining("Print limit reached");

        ControlledCopyService.FileDownload download = copyService.downloadControlledCopy(copy.getId(), grant, null);
        assertThat(download.bytes()).isNotEmpty();
    }

    @Test
    void printing_is_refused_with_a_message_while_the_policy_does_not_allow_it() throws Exception {
        DocumentRecord document = requestableDocument();
        ControlledCopyPolicySetting policy = configurePolicy(true);
        ControlledCopyRecord copy = requestAndDistribute(document);
        policy.setAllowPrint(false);
        policyRepository.saveAndFlush(policy);
        String grant = grantService.issue(copy);
        SecurityContextHolder.clearContext();

        assertThatThrownBy(() -> copyService.consumePreviewPrint(copy.getId(), grant))
                .isInstanceOf(AccessDeniedException.class).hasMessageContaining("Printing is disabled");
    }

    @Test
    void the_code_is_in_every_issued_copy_whatever_the_marking_settings_are() throws Exception {
        DocumentRecord document = requestableDocument();
        ControlledCopyPolicySetting policy = configurePolicy(true);
        policy.setStampEnabled(false);
        policy.setWatermarkEnabled(false);
        policy.setQrCodeX(null);
        policy.setQrCodeY(null);
        policyRepository.saveAndFlush(policy);

        ControlledCopyRecord copy = requestAndDistribute(document);

        List<Placement> layout = new ArrayList<>(markingService.fromJson(copy.getMarkingLayout()));
        assertThat(layout).extracting(Placement::kind).contains("QR");
        assertThat(ControlledCopyScanCodeService.decode(storage.get(copy.getControlledCopyFilePath())).token()).isEqualTo(copy.getScanToken());
    }

    @SuppressWarnings("unused")
    private JsonNode unused;

    // ── a copy expires with its document; the policy only limits the e-mail link ─────────────────

    @Test
    void a_copy_expires_on_the_valid_until_date_of_its_document_not_on_a_policy_duration() {
        DocumentRecord document = requestableDocument();
        java.time.LocalDate validUntil = java.time.LocalDate.now().plusDays(400);
        withValidUntil(document, effectiveRevisionOf(document), validUntil);
        configurePolicy(false);

        ControlledCopyRecord copy = requestAndDistribute(document);

        assertThat(copy.getExpiryDate()).isEqualTo(validUntil.atStartOfDay(java.time.ZoneId.systemDefault()).toInstant());
        assertThat(copy.getHasExpiryDate()).isTrue();
        assertThat(copy.getExpiryAnchoredToDistribution()).isFalse();
    }

    @Test
    void a_document_without_a_valid_until_date_gives_a_copy_without_an_expiry_that_can_still_be_issued() {
        DocumentRecord document = requestableDocument();
        withValidUntil(document, effectiveRevisionOf(document), null);
        configurePolicy(false);

        ControlledCopyRecord copy = requestAndDistribute(document);

        assertThat(copy.getExpiryDate()).isNull();
        assertThat(copy.getHasExpiryDate()).isFalse();
        assertThat(copy.getStatusCode()).isEqualTo("DISTRIBUTED");
    }

    @Test
    void a_request_cannot_ask_for_an_expiry_later_than_the_document_s_valid_until_date() {
        DocumentRecord document = requestableDocument();
        withValidUntil(document, effectiveRevisionOf(document), java.time.LocalDate.now().plusDays(30));
        configurePolicy(false);
        ControlledCopyRequestCreateRequest request = new ControlledCopyRequestCreateRequest(
                document.getId().toString(), null, null, admin.getFullName(), null, null, "Too long", 1,
                "INTERNAL", "individual", true, java.time.Instant.now().plus(java.time.Duration.ofDays(90)).toString(),
                List.of(), List.of(), List.of(), List.of(), List.of(),
                "Too long", 1, null, "request-token",
                List.of(new ControlledCopyRequestCreateRequest.ControlledCopyRecipientRequest(
                        "USER", admin.getId().toString(), null, admin.getDepartment(), null, 1)), "RECORD_KEEPING");

        assertThatThrownBy(() -> copyService.requestControlledCopy(request))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Valid Until");
    }

    @Test
    void the_link_in_the_email_stops_working_for_a_guest_after_the_policy_duration_but_not_for_someone_signed_in() {
        DocumentRecord document = requestableDocument();
        configurePolicy(false);
        ControlledCopyRecord copy = requestAndDistribute(document);
        copy.setPreviewPasswordHash(null); // the password step is not what is tested here
        java.time.Instant sent = java.time.Instant.now().minusSeconds(60);
        copy.setDistributedAt(sent);
        copyRepository.saveAndFlush(copy);
        String token = copy.getAccessToken();
        Authentication signedIn = SecurityContextHolder.getContext().getAuthentication();

        // Within the duration: a guest can open it.
        SecurityContextHolder.clearContext();
        assertThat(copyService.openPreview(copy.getId(), token, null)).isNotNull();

        // After the duration of the most specific rule has passed since it was sent: the guest is refused, with a message that says what to do.
        java.time.Instant linkEnds = expiryLimitService.resolveExpiryFrom(document.getDocumentType(), document.getDepartment(), sent);
        copy.setDistributedAt(sent.minus(java.time.Duration.between(sent, linkEnds)).minusSeconds(3600));
        copyRepository.saveAndFlush(copy);
        assertThatThrownBy(() -> copyService.openPreview(copy.getId(), token, null))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("link in the distribution e-mail has expired")
                .hasMessageContaining("new link");

        // Somebody signed in to eQMS does not need the link, so it does not bind them.
        SecurityContextHolder.getContext().setAuthentication(signedIn);
        assertThat(copyService.openPreview(copy.getId(), token, null)).isNotNull();
    }

    // ── usage purpose: read and comply, or record-keeping (CC-PURPOSE-2026-10-07) ─────────────────────

    private ControlledCopyRequestCreateRequest requestWith(DocumentRecord document, String usagePurpose) {
        return new ControlledCopyRequestCreateRequest(
                document.getId().toString(), null, null, admin.getFullName(), null, null, "Purpose test", 1,
                "INTERNAL", "individual", false, null, List.of(), List.of(), List.of(), List.of(), List.of(),
                "Purpose test", 1, null, "request-token",
                List.of(new ControlledCopyRequestCreateRequest.ControlledCopyRecipientRequest(
                        "USER", admin.getId().toString(), null, admin.getDepartment(), null, 1)), usagePurpose);
    }

    @Test
    void a_request_without_exactly_one_of_the_two_purposes_is_refused_and_creates_nothing() {
        DocumentRecord document = requestableDocument();
        configurePolicy(false);
        long copies = copyRepository.count();

        for (String bad : new String[] {null, "", "  ", "BOTH", "read", "READ_AND_COMPLY,RECORD_KEEPING", "Đọc và tuân thủ"}) {
            assertThatThrownBy(() -> copyService.requestControlledCopy(requestWith(document, bad)))
                    .as("purpose [" + bad + "]").isInstanceOf(IllegalArgumentException.class).satisfies(ex -> assertThat(ex.getMessage().toLowerCase()).contains("usage purpose"));
        }

        assertThat(copyRepository.count()).as("a refused request leaves no copy behind").isEqualTo(copies);
    }

    @Test
    void the_purpose_is_stored_on_the_batch_and_on_every_copy_and_written_in_the_audit_trail() {
        DocumentRecord document = requestableDocument();
        configurePolicy(false);

        ControlledCopyListItemResponse created = copyService.requestControlledCopy(requestWith(document, "READ_AND_COMPLY"));

        ControlledCopyRecord copy = copyRepository.findById(UUID.fromString(created.id())).orElseThrow();
        assertThat(created.usagePurpose()).isEqualTo("READ_AND_COMPLY");
        assertThat(copy.getUsagePurpose()).isEqualTo("READ_AND_COMPLY");
        assertThat(copy.getDistributionBatch().getUsagePurpose()).isEqualTo("READ_AND_COMPLY");
        for (UUID entityId : List.of(copy.getId(), copy.getDistributionBatch().getId())) {
            var requestEntry = auditLogRepository.findAll().stream()
                    .filter(entry -> entityId.equals(entry.getEntityId()) && "REQUEST".equals(entry.getAction())).findFirst().orElseThrow();
            assertThat(auditLogChangeRepository.findAllByAuditLogIdOrderByChangeOrderAscCreatedAtAsc(requestEntry.getId()))
                    .anySatisfy(change -> {
                        assertThat(change.getFieldName()).isEqualTo("usagePurpose");
                        assertThat(change.getNewValue()).isEqualTo("Read and comply");
                    });
        }
    }

    @Test
    void the_lists_filter_and_sort_by_purpose_on_the_server_and_old_copies_show_only_under_all() {
        DocumentRecord document = requestableDocument();
        configurePolicy(false);
        ControlledCopyRecord read = copyRepository.findById(UUID.fromString(copyService.requestControlledCopy(requestWith(document, "READ_AND_COMPLY")).id())).orElseThrow();
        ControlledCopyRecord record = copyRepository.findById(UUID.fromString(copyService.requestControlledCopy(requestWith(document, "RECORD_KEEPING")).id())).orElseThrow();
        ControlledCopyRecord old = copyRepository.findById(UUID.fromString(copyService.requestControlledCopy(requestWith(document, "RECORD_KEEPING")).id())).orElseThrow();
        old.setUsagePurpose(null);
        old.getDistributionBatch().setUsagePurpose(null);
        copyRepository.saveAndFlush(old);

        java.util.function.Function<String, List<String>> copiesFor = filter -> copyService.list(1, 50, null, null, null, document.getId().toString(),
                null, null, null, null, null, null, null, null, filter, "created", "desc").data().stream().map(ControlledCopyListItemResponse::id).toList();
        assertThat(copiesFor.apply("READ_AND_COMPLY")).contains(read.getId().toString()).doesNotContain(record.getId().toString(), old.getId().toString());
        assertThat(copiesFor.apply("RECORD_KEEPING")).contains(record.getId().toString()).doesNotContain(read.getId().toString(), old.getId().toString());
        assertThat(copiesFor.apply("All")).contains(read.getId().toString(), record.getId().toString(), old.getId().toString());
        assertThat(copiesFor.apply(null)).contains(old.getId().toString());
        assertThat(copiesFor.apply("record_keeping")).as("the value is read case-insensitively").contains(record.getId().toString());
        assertThat(copiesFor.apply("NONSENSE")).as("an unknown value matches nothing, it is not ignored").isEmpty();

        java.util.function.Function<String, List<String>> batchesFor = filter -> copyService.listDistributionBatches(1, 50, null, null, document.getId().toString(),
                null, null, null, null, null, null, null, null, filter, "created", "desc").data().stream().map(b -> b.id()).toList();
        assertThat(batchesFor.apply("READ_AND_COMPLY")).contains(read.getDistributionBatch().getId().toString())
                .doesNotContain(record.getDistributionBatch().getId().toString(), old.getDistributionBatch().getId().toString());
        assertThat(batchesFor.apply("RECORD_KEEPING")).contains(record.getDistributionBatch().getId().toString()).doesNotContain(read.getDistributionBatch().getId().toString());
        assertThat(batchesFor.apply("All")).contains(read.getDistributionBatch().getId().toString(), old.getDistributionBatch().getId().toString());

        for (String direction : List.of("asc", "desc")) {
            List<String> sorted = copyService.list(1, 50, null, null, null, document.getId().toString(), null, null, null, null, null, null, null, null,
                    null, "usagePurpose", direction).data().stream().map(ControlledCopyListItemResponse::usagePurpose).toList();
            assertThat(sorted).as("sorted " + direction).hasSizeGreaterThanOrEqualTo(3);
            List<String> known = sorted.stream().filter(java.util.Objects::nonNull).toList();
            assertThat(known).isSortedAccordingTo(direction.equals("asc") ? java.util.Comparator.<String>naturalOrder() : java.util.Comparator.<String>reverseOrder());
            assertThat(copyService.listDistributionBatches(1, 50, null, null, document.getId().toString(), null, null, null, null, null, null, null, null,
                    null, "usagePurpose", direction).data()).isNotEmpty();
        }
    }

    @Test
    void a_copy_for_reading_found_in_a_scan_is_set_apart_blocks_signing_until_removed_and_is_never_recalled_by_the_scan() throws Exception {
        DocumentRecord document = requestableDocument();
        configurePolicy(true);
        ControlledCopyRecord read = requestAndDistribute(document, "READ_AND_COMPLY");
        ControlledCopyRecord written = requestAndDistribute(document, "RECORD_KEEPING");
        byte[] readScan = copyService.downloadControlledCopy(read.getId(), grantService.issue(read), null).bytes();
        byte[] writtenScan = copyService.downloadControlledCopy(written.getId(), grantService.issue(written), null).bytes();

        RecallBatchResponse draft = recallService.createDraft(List.of(
                new MockMultipartFile("files", "read.pdf", "application/pdf", readScan),
                new MockMultipartFile("files", "written.pdf", "application/pdf", writtenScan)));

        var readItem = draft.items().stream().filter(item -> item.copy() != null && read.getId().toString().equals(item.copy().id())).findFirst().orElseThrow();
        var writtenItem = draft.items().stream().filter(item -> item.copy() != null && written.getId().toString().equals(item.copy().id())).findFirst().orElseThrow();
        assertThat(readItem.readAndComply()).isTrue();
        assertThat(readItem.matchStatus()).isEqualTo("BLOCKED");
        assertThat(readItem.matchMessage()).contains("for reading only").contains("not recalled by scan");
        assertThat(writtenItem.readAndComply()).isFalse();
        assertThat(writtenItem.matchStatus()).isEqualTo("READY");
        assertThat(draft.readyToCommit()).as("the scan for reading holds the batch until it is removed").isFalse();
        assertThatThrownBy(() -> recallService.commit(UUID.fromString(draft.id()), new RecallBatchCommitRequest("Purpose test", null, "recall-token")))
                .hasMessageContaining("for reading only");
        assertThat(copyRepository.findById(read.getId()).orElseThrow().getStatusCode()).isNotEqualTo("OBSOLETED");

        // One click removes it (excludes it); the record-keeping copy is then processed as usual.
        RecallBatchResponse removed = recallService.updateItem(UUID.fromString(draft.id()), UUID.fromString(readItem.id()), new RecallItemUpdateRequest(true, null, null));
        assertThat(removed.readyToCommit()).isTrue();
        RecallBatchResponse committed = recallService.commit(UUID.fromString(draft.id()), new RecallBatchCommitRequest("Purpose test", null, "recall-token"));

        ControlledCopyRecord untouchedRead = copyRepository.findById(read.getId()).orElseThrow();
        assertThat(untouchedRead.getStatusCode()).as("the copy for reading stays distributed until recalled by hand").isNotEqualTo("OBSOLETED");
        assertThat(untouchedRead.getRecalledAt()).isNull();
        assertThat(executedRecordRepository.existsBySourceControlledCopy_IdAndStatusNot(read.getId(), "REJECTED")).isFalse();
        assertThat(executedRecordRepository.existsBySourceControlledCopy_IdAndStatusNot(written.getId(), "REJECTED")).isTrue();
        assertThat(copyRepository.findById(written.getId()).orElseThrow().getStatusCode()).isEqualTo("OBSOLETED");
        assertThat(committed.items()).anySatisfy(item -> assertThat(item.outcome()).isEqualTo("RECALLED"));
    }

    @Test
    void records_never_list_or_serve_a_copy_for_reading_and_still_show_the_others_and_the_old_ones() throws Exception {
        DocumentRecord document = requestableDocument();
        configurePolicy(true);
        ControlledCopyRecord read = requestAndDistribute(document, "READ_AND_COMPLY");
        ControlledCopyRecord written = requestAndDistribute(document, "RECORD_KEEPING");
        ControlledCopyRecord old = requestAndDistribute(document, "RECORD_KEEPING");
        old.setUsagePurpose(null);
        copyRepository.saveAndFlush(old);
        RecallBatchResponse draft = recallService.createDraft(List.of(
                new MockMultipartFile("files", "written.pdf", "application/pdf", copyService.downloadControlledCopy(written.getId(), grantService.issue(written), null).bytes()),
                new MockMultipartFile("files", "old.pdf", "application/pdf", copyService.downloadControlledCopy(old.getId(), grantService.issue(old), null).bytes())));
        recallService.commit(UUID.fromString(draft.id()), new RecallBatchCommitRequest("Purpose test", null, "recall-token"));
        // A record that somehow exists for a copy for reading (made before this rule, or by another route) is hidden all the same.
        com.eqms.entity.ExecutedRecord stray = new com.eqms.entity.ExecutedRecord();
        stray.setId(UUID.randomUUID());
        stray.setRecordNumber("PURPOSE-STRAY-" + System.nanoTime());
        stray.setFormDocument(document);
        stray.setFormRevision(read.getRevision());
        stray.setCaptureMethod("PAPER_SCAN");
        stray.setStatus("EXECUTED");
        stray.setSourceControlledCopy(read);
        stray.setFileName("stray.pdf");
        executedRecordRepository.saveAndFlush(stray);

        var all = executedRecordService.list(1, 100, null, document.getId().toString(), null, null, null, "created", "desc");

        assertThat(all.data()).extracting(r -> r.recordNumber()).doesNotContain(stray.getRecordNumber());
        assertThat(all.data()).hasSize(2); // the one written on and the old one
        assertThat(executedRecordService.list(1, 100, null, null, read.getId().toString(), null, null, "created", "desc").data()).isEmpty();
        assertThat(executedRecordService.list(1, 100, null, null, written.getId().toString(), null, null, "created", "desc").data()).hasSize(1);
        assertThat(executedRecordService.list(1, 100, null, null, old.getId().toString(), null, null, "created", "desc").data()).hasSize(1);
        assertThatThrownBy(() -> executedRecordService.getDetail(stray.getId())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> executedRecordService.previewFile(stray.getId())).isInstanceOf(AccessDeniedException.class);
    }
}
