package com.eqms.service.training;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** What the check of a template says against the contract of its form: the real tokenized files agree, and a file that does not is refused with the reason. */
class TrainingAnnexContractTest {
    private static byte[] real(String code) throws Exception {
        for (Path root : new Path[] {Path.of("src/main/resources/training-annex"), Path.of("eqms-backend/src/main/resources/training-annex")}) {
            if (Files.exists(root.resolve(code + ".docx"))) return Files.readAllBytes(root.resolve(code + ".docx"));
        }
        throw new IllegalStateException(code);
    }

    private static byte[] file(String... paragraphs) throws Exception {
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (String p : paragraphs) doc.createParagraph().createRun().setText(p);
            doc.write(out);
            return out.toByteArray();
        }
    }

    @Test
    void everyStarterFileShippedWithTheSystemAgreesWithItsContract() throws Exception {
        for (String code : List.of("APD.0011", "APD.0014", "APD.0024", "APD.0108", "APD.0117", "APD.0118")) {
            TrainingAnnexCheck check = TrainingAnnexCheck.of(code, real(code));
            assertThat(check.mode()).isEqualTo("TOKENS");
            assertThat(check.problems()).as(code).isEmpty();
        }
    }

    @Test
    void aFileWithoutTokensIsLegacyAndNotAProblem() throws Exception {
        TrainingAnnexCheck check = TrainingAnnexCheck.of("APD.0118", file("Year: .....", "Request No: ....."));
        assertThat(check.mode()).isEqualTo("LEGACY");
        assertThat(check.problems()).isEmpty();
        assertThat(check.summary()).isEqualTo(TrainingAnnexCheck.LEGACY_WARNING);
    }

    @Test
    void theAssessmentFormHasNoTokensToCheck() throws Exception {
        assertThat(TrainingAnnexCheck.of("APD.0009", file("anything {{X}}")).mode()).isEqualTo("NOT_APPLICABLE");
    }

    @Test
    void aMissingTokenAndAnUnknownTokenAreBothReported() throws Exception {
        TrainingAnnexCheck check = TrainingAnnexCheck.of("APD.0118", file("Year {{YEAR}}", "Typo {{REQUEST_NUMBER}}"));
        assertThat(check.mode()).isEqualTo("TOKENS");
        assertThat(check.problems()).contains("unknown token: REQUEST_NUMBER", "missing token: REQUEST_NO", "missing token: SIGNATURE:PREPARED");
    }

    @Test
    void aMarkerThatIsNotClosedIsReported() throws Exception {
        TrainingAnnexCheck check = TrainingAnnexCheck.of("APD.0014", file("{{#OMIT}}", "a note"));
        assertThat(check.problems()).anyMatch(p -> p.contains("OMIT") && p.contains("not closed"));
    }

    @Test
    void aFileThatCannotBeReadAsWordIsRefused() {
        org.junit.jupiter.api.Assertions.assertThrows(Exception.class, () -> TrainingAnnexCheck.of("APD.0118", new byte[] {1, 2, 3}));
    }

    @Test
    void everyFormOfTheListHasAContractAndATitle() {
        for (String code : TrainingAnnexContract.codes()) {
            assertThat(TrainingAnnexContract.of(code)).as(code).isNotNull();
            assertThat(TrainingAnnexContract.title(code)).isNotEqualTo(code);
        }
        assertThat(TrainingAnnexContract.of("FRM.0044")).isNull();
    }

    @Test
    void everySignatureSlotNamesTheMeaningOfTheSignatureThatFillsIt() {
        for (String code : TrainingAnnexContract.codes()) {
            TrainingAnnexContract contract = TrainingAnnexContract.of(code);
            contract.slots().values().forEach(s -> assertThat(s.meanings()).as(code + " " + s.name()).isNotEmpty());
        }
    }

    @Test
    void theCodeOfAFormIsTheDocumentNumberAndTheRevisionInForce() {
        assertThat(TrainingAnnexContract.fullCode("APD.0024", "2.0.0")).isEqualTo("APD.0024.02");
        assertThat(TrainingAnnexContract.fullCode("APD.0117", "1.0.0")).isEqualTo("APD.0117.01");
        assertThat(TrainingAnnexContract.fullCode("APD.0011", "10")).isEqualTo("APD.0011.10");
        assertThat(TrainingAnnexContract.fullCode("APD.0011", "E51-TOKENS")).isEqualTo("APD.0011");
        assertThat(TrainingAnnexContract.validRevision("2.0.0")).isTrue();
        assertThat(TrainingAnnexContract.validRevision("1")).isTrue();
        assertThat(TrainingAnnexContract.validRevision("E51-TOKENS")).isFalse();
        assertThat(TrainingAnnexContract.validRevision("2.0.0 (APD.0024.02)")).isFalse();
        assertThat(TrainingAnnexData.forForm("APD.0024", "2.0.0")).isNotNull();
    }
}
