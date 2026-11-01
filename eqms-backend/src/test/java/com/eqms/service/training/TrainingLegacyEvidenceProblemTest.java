package com.eqms.service.training;

import com.eqms.entity.Department;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ClamAvScanService;
import com.eqms.service.ElectronicSignatureService;
import com.eqms.service.FileStorageService;
import com.eqms.service.TrainingRevisionHooks.LegacyTraining;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** What Document Control may be told about the paper training entered for a revision of a Legacy Import: every refusal has its words, and a good entry has none. */
class TrainingLegacyEvidenceProblemTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final TrainingAccess access = mock(TrainingAccess.class);
    private final ClamAvScanService virus = mock(ClamAvScanService.class);
    private final TrainingNumberService numbers = mock(TrainingNumberService.class);
    private final UserAccount actor = mock(UserAccount.class);
    private final UUID actorId = UUID.randomUUID();
    private final UUID departmentId = UUID.randomUUID();
    private final UUID trainee = UUID.randomUUID();
    private final DocumentRecord document = new DocumentRecord();
    private TrainingLegacyEvidenceService service;
    private final MockMultipartFile pdf = new MockMultipartFile("scan", "scan.pdf", "application/pdf", "%PDF-1.4 scan of the record".getBytes());

    @BeforeEach
    void setUp() {
        service = new TrainingLegacyEvidenceService(jdbc, access, mock(ElectronicSignatureService.class), mock(AuditTrailService.class), mock(FileStorageService.class), virus,
                numbers, mock(TrainingRecipients.class), mock(TrainingNotifier.class));
        Department department = new Department();
        department.setId(departmentId);
        document.setDepartment(department);
        when(actor.getId()).thenReturn(actorId);
        when(access.has(any(UserAccount.class), anyString())).thenReturn(true);
        when(virus.scan(any(byte[].class))).thenReturn(new ClamAvScanService.ScanResult(true, null));
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());
        when(jdbc.queryForObject(anyString(), any(Class.class), any(Object[].class))).thenReturn(1);
    }

    private LegacyTraining entry(String number, List<UUID> people, boolean lost, String reason, org.springframework.web.multipart.MultipartFile scan) {
        return new LegacyTraining(number, null, people, List.of(), lost, reason, null, null, null, scan);
    }

    /** An entry with everything the paper record needs: the topic, the trainer and the mode as well. */
    private LegacyTraining full(String number, List<UUID> people, org.springframework.web.multipart.MultipartFile scan) {
        return new LegacyTraining(number, null, people, List.of(), false, null, "Gowning procedure", "Nguyen Van A", "CLASSROOM", scan);
    }

    private LegacyTraining entryWith(String topic, String trainer, String method) {
        return new LegacyTraining("TRN/QA/26-500", null, List.of(), List.of(), false, null, topic, trainer, method, pdf);
    }

    private String problem(LegacyTraining entry) {
        return service.problem(actor, document, "1.0.0", entry);
    }

    @Test
    void aTrainingDocumentWithoutAnyEntryHasAProblem() {
        assertTrue(problem(null).contains("paper training record"));
    }

    @Test
    void aGoodEntryWithAScanHasNoProblem() {
        assertNull(problem(full("TRN/QA/26-500", List.of(trainee), pdf)));
    }

    @Test
    void aScanThatIsNotAPdfIsRefused() {
        assertTrue(problem(entry("TRN/QA/26-500", List.of(), false, null, new MockMultipartFile("scan", "x.pdf", "application/pdf", "plain text".getBytes()))).contains("must be a PDF file"));
        // a picture is not a scan any more: it cannot carry the watermark of the preview
        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0};
        assertTrue(problem(entry("TRN/QA/26-500", List.of(), false, null, new MockMultipartFile("scan", "x.png", "image/png", png))).contains("must be a PDF file"));
    }

    @Test
    void aScanThatTheVirusCheckRejectsIsRefused() {
        when(virus.scan(any(byte[].class))).thenReturn(new ClamAvScanService.ScanResult(false, "Eicar"));
        assertTrue(problem(entry("TRN/QA/26-500", List.of(), false, null, pdf)).contains("virus"));
    }

    @Test
    void noScanAndNoDeclarationIsRefused() {
        assertTrue(problem(entry("TRN/QA/26-500", List.of(), false, null, null)).contains("attach the scan"));
    }

    @Test
    void aLostPaperNeedsAReasonAndNoScanOrPersons() {
        assertTrue(problem(entry(null, List.of(), true, " ", null)).contains("say why"));
        assertTrue(problem(entry("TRN/QA/26-500", List.of(trainee), true, "lost", null)).contains("cannot come with"));
        assertNull(problem(entry(null, List.of(), true, "lost in the archive move", null)));
    }

    @Test
    void theTopicTheTrainerAndTheModeAreAskedForANewActivity() {
        assertTrue(problem(entryWith(" ", "Nguyen Van A", "CLASSROOM")).contains("Training Topic"));
        assertTrue(problem(entryWith("Gowning", null, "CLASSROOM")).contains("Trainer"));
        assertTrue(problem(entryWith("Gowning", "Nguyen Van A", null)).contains("Mode"));
        assertTrue(problem(entryWith("Gowning", "Nguyen Van A", "WEBINAR")).contains("Mode is not one of"));
        assertNull(problem(entryWith("Gowning", "Nguyen Van A", "PRACTICAL")));
    }

    @Test
    void theTopicTheTrainerAndTheModeNeedTheNumberAndAreNotAskedWhenThePaperIsLost() {
        assertTrue(problem(new LegacyTraining(null, null, List.of(), List.of(), false, null, "Gowning", null, null, pdf)).contains("Training Number"));
        assertNull(problem(new LegacyTraining("TRN/QA/26-500", null, List.of(), List.of(), true, "lost", null, null, null, null)));
    }

    @Test
    void personsTrainedNeedTheNumberOfThePaperRecord() {
        assertTrue(problem(full(null, List.of(trainee), pdf)).contains("Training Number"));
    }

    @Test
    void aNumberThatTheSystemIssuedCannotBeAPaperNumber() {
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(Map.of("id", UUID.randomUUID(), "kind", "INITIAL", "revision_id", UUID.randomUUID())));
        assertTrue(problem(entry("TRN/QA/26-001", List.of(), false, null, pdf)).contains("issued by Training Management"));
    }

    @Test
    void aNumberUsedByAnotherRecordIsRefused() {
        when(numbers.isUsed("TRN/QA/26-002")).thenReturn(true);
        assertTrue(problem(entry("TRN/QA/26-002", List.of(), false, null, pdf)).contains("already used by another record"));
    }

    @Test
    void aNumberThatAlreadyHasItsEvidenceIsJoinedAndNothingIsAttachedAgain() {
        UUID activity = UUID.randomUUID();
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenAnswer(call -> {
            String sql = call.getArgument(0);
            if (sql.contains("from training_activities")) return List.of(Map.of("id", activity, "kind", "LEGACY", "revision_id", UUID.randomUUID()));
            if (sql.contains("from training_legacy_evidence")) return List.of(Map.of("id", UUID.randomUUID(), "status", "VERIFIED"));
            return List.of();
        });
        assertNull(problem(entry("TRN/QA/26-500", List.of(), false, null, null)));
        assertTrue(problem(entry("TRN/QA/26-500", List.of(), false, null, pdf)).contains("already has its evidence"));
        assertTrue(problem(entry("TRN/QA/26-500", List.of(trainee), false, null, null)).contains("already has its evidence"));
    }

    @Test
    void aPersonWithoutTheTrainingPermissionsCannotAttachEvidence() {
        when(access.has(any(UserAccount.class), anyString())).thenReturn(false);
        assertTrue(problem(entry("TRN/QA/26-500", List.of(), false, null, pdf)).contains("Training permission"));
    }

    @Test
    void aPersonChosenAsTrainedWhoIsNotAUserIsRefused() {
        when(jdbc.queryForObject(anyString(), any(Class.class), any(Object[].class))).thenReturn(0);
        assertTrue(problem(full("TRN/QA/26-500", List.of(trainee), pdf)).contains("not a user of the system"));
    }
}
