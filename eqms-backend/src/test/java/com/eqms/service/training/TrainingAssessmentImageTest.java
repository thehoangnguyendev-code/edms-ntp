package com.eqms.service.training;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** A question of a test may carry a picture; a checklist line may not; the picture is checked by its content. */
class TrainingAssessmentImageTest {
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};
    private static String png() { return "data:image/png;base64," + Base64.getEncoder().encodeToString(PNG); }

    private static TrainingAssessmentLibraryService.ItemDto single(String image) {
        return new TrainingAssessmentLibraryService.ItemDto("SINGLE", "Which?", List.of(new TrainingAssessmentLibraryService.OptionDto("a"), new TrainingAssessmentLibraryService.OptionDto("b")), List.of("A"), BigDecimal.ONE, null, null, null, image);
    }

    @Test
    void aQuestionOfATestKeepsItsPicture() {
        List<Map<String, Object>> items = TrainingAssessmentLibraryService.normalize("QUESTIONS", List.of(single(png())));
        assertThat(items.getFirst().get("image")).isEqualTo(png());
    }

    @Test
    void aQuestionWithoutAPictureHasNone() {
        assertThat(TrainingAssessmentLibraryService.normalize("QUESTIONS", List.of(single(null))).getFirst().get("image")).isNull();
        assertThat(TrainingAssessmentLibraryService.normalize("QUESTIONS", List.of(single(" "))).getFirst().get("image")).isNull();
    }

    @Test
    void aChecklistLineHasNoPicture() {
        var line = new TrainingAssessmentLibraryService.ItemDto("CHECK", "Wash hands", List.of(), List.of("CORRECT"), BigDecimal.ONE, null, null, null, png());
        assertThatThrownBy(() -> TrainingAssessmentLibraryService.normalize("CHECKLIST", List.of(line))).hasMessage("TRAINING_ASSESSMENT_IMAGE_INVALID");
    }

    @Test
    void aFileThatIsNotThePictureItSaysIsRefused() {
        String fake = "data:image/png;base64," + Base64.getEncoder().encodeToString("not a picture".getBytes());
        assertThatThrownBy(() -> TrainingAssessmentLibraryService.normalize("QUESTIONS", List.of(single(fake)))).hasMessage("TRAINING_ASSESSMENT_IMAGE_INVALID");
        assertThatThrownBy(() -> TrainingAssessmentLibraryService.normalize("QUESTIONS", List.of(single("data:image/gif;base64,R0lGODlh")))).hasMessage("TRAINING_ASSESSMENT_IMAGE_INVALID");
        assertThatThrownBy(() -> TrainingAssessmentLibraryService.normalize("QUESTIONS", List.of(single("javascript:alert(1)")))).hasMessage("TRAINING_ASSESSMENT_IMAGE_INVALID");
    }

    @Test
    void aPictureOverTheLimitIsRefused() {
        byte[] big = new byte[1_600_000];
        System.arraycopy(PNG, 0, big, 0, PNG.length);
        assertThatThrownBy(() -> TrainingAssessmentLibraryService.normalize("QUESTIONS", List.of(single("data:image/png;base64," + Base64.getEncoder().encodeToString(big))))).hasMessage("TRAINING_ASSESSMENT_IMAGE_INVALID");
    }
}
