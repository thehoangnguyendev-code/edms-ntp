package com.eqms.service.training;

import com.eqms.service.training.TrainingAssessmentLibraryService.ItemDto;
import com.eqms.service.training.TrainingAssessmentLibraryService.OptionDto;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** The rules of the items of a Training Assessment (APD.0009): what is stored, and what is refused with a stable code. */
class TrainingAssessmentLibraryRulesTest {

    private static ItemDto single(String prompt, List<String> options, List<String> correct) {
        return new ItemDto("SINGLE", prompt, options.stream().map(OptionDto::new).toList(), correct, BigDecimal.ONE, null);
    }

    private static void refused(String kind, ItemDto item) {
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class, () -> TrainingAssessmentLibraryService.normalize(kind, List.of(item)));
        assertEquals("TRAINING_ASSESSMENT_ITEM_INVALID", e.getMessage());
    }

    @Test
    void singleChoiceGetsLettersAndOneRightAnswer() {
        List<Map<String, Object>> out = TrainingAssessmentLibraryService.normalize("QUESTIONS", List.of(single("Q", List.of("Một", "Hai", "Ba"), List.of("B"))));
        assertEquals(1, out.size());
        assertEquals(List.of(Map.of("id", "A", "text", "Một"), Map.of("id", "B", "text", "Hai"), Map.of("id", "C", "text", "Ba")), out.getFirst().get("options"));
        assertEquals(List.of("B"), out.getFirst().get("correct"));
        assertEquals(1, out.getFirst().get("no"));
    }

    @Test
    void singleChoiceNeedsExactlyOneRightAnswerAndTwoAnswers() {
        refused("QUESTIONS", single("Q", List.of("a", "b"), List.of()));
        refused("QUESTIONS", single("Q", List.of("a", "b"), List.of("A", "B")));
        refused("QUESTIONS", single("Q", List.of("a"), List.of("A")));
        refused("QUESTIONS", single("Q", List.of("a", " "), List.of("A")));
        refused("QUESTIONS", single("Q", List.of("a", "b"), List.of("C")));
        refused("QUESTIONS", single(" ", List.of("a", "b"), List.of("A")));
    }

    @Test
    void multipleChoiceTakesSeveralRightAnswers() {
        List<Map<String, Object>> out = TrainingAssessmentLibraryService.normalize("QUESTIONS",
                List.of(new ItemDto("MULTI", "Q", List.of(new OptionDto("a"), new OptionDto("b"), new OptionDto("c")), List.of("A", "C", "A"), new BigDecimal("2.5"), null)));
        assertEquals(List.of("A", "C"), out.getFirst().get("correct"));
        assertEquals(new BigDecimal("2.50"), out.getFirst().get("points"));
    }

    @Test
    void trueFalseHasItsTwoAnswersAndOneRight() {
        List<Map<String, Object>> out = TrainingAssessmentLibraryService.normalize("QUESTIONS", List.of(new ItemDto("TRUE_FALSE", "Q", List.of(), List.of("B"), BigDecimal.ONE, null)));
        assertEquals(2, ((List<?>) out.getFirst().get("options")).size());
        assertEquals(List.of("B"), out.getFirst().get("correct"));
        refused("QUESTIONS", new ItemDto("TRUE_FALSE", "Q", List.of(), List.of("C"), BigDecimal.ONE, null));
        refused("QUESTIONS", new ItemDto("TRUE_FALSE", "Q", List.of(), List.of(), BigDecimal.ONE, null));
    }

    @Test
    void essayKeepsTheModelAnswerAndNothingToTick() {
        List<Map<String, Object>> out = TrainingAssessmentLibraryService.normalize("QUESTIONS", List.of(new ItemDto("ESSAY", "Q", List.of(new OptionDto("ignored")), List.of("A"), new BigDecimal("5"), " Ý chính ")));
        assertEquals(List.of(), out.getFirst().get("options"));
        assertEquals(List.of(), out.getFirst().get("correct"));
        assertEquals("Ý chính", out.getFirst().get("modelAnswer"));
    }

    @Test
    void aChecklistLineHasCorrectOrIncorrectAsItsKey() {
        List<Map<String, Object>> out = TrainingAssessmentLibraryService.normalize("CHECKLIST", List.of(new ItemDto("CHECK", "Line", List.of(), List.of("INCORRECT"), BigDecimal.ONE, null)));
        assertEquals(List.of("INCORRECT"), out.getFirst().get("correct"));
        refused("CHECKLIST", new ItemDto("CHECK", "Line", List.of(), List.of("MAYBE"), BigDecimal.ONE, null));
        refused("CHECKLIST", new ItemDto("CHECK", "Line", List.of(), List.of(), BigDecimal.ONE, null));
    }

    @Test
    void aChecklistLineHasNoPointsOfItsOwn() {
        List<Map<String, Object>> out = TrainingAssessmentLibraryService.normalize("CHECKLIST", List.of(new ItemDto("CHECK", "Line", List.of(), List.of("CORRECT"), new BigDecimal("5"), null)));
        assertEquals(BigDecimal.ONE, out.getFirst().get("points"));
        // even a missing or a wrong value of points does not refuse a checklist line
        TrainingAssessmentLibraryService.normalize("CHECKLIST", List.of(new ItemDto("CHECK", "Line", List.of(), List.of("CORRECT"), null, null)));
        TrainingAssessmentLibraryService.normalize("CHECKLIST", List.of(new ItemDto("CHECK", "Line", List.of(), List.of("CORRECT"), BigDecimal.ZERO, null)));
    }

    @Test
    void aChecklistTakesOnlyChecklistLinesAndATestTakesNoChecklistLine() {
        refused("CHECKLIST", single("Q", List.of("a", "b"), List.of("A")));
        refused("QUESTIONS", new ItemDto("CHECK", "Line", List.of(), List.of("CORRECT"), BigDecimal.ONE, null));
    }

    @Test
    void pointsMustBeAboveZeroAndAtMostOneHundred() {
        refused("QUESTIONS", new ItemDto("ESSAY", "Q", List.of(), List.of(), BigDecimal.ZERO, null));
        refused("QUESTIONS", new ItemDto("ESSAY", "Q", List.of(), List.of(), new BigDecimal("-1"), null));
        refused("QUESTIONS", new ItemDto("ESSAY", "Q", List.of(), List.of(), new BigDecimal("100.01"), null));
    }

    @Test
    void anEmptyAssessmentAndTooManyItemsAreRefused() {
        assertEquals("TRAINING_ASSESSMENT_ITEMS_REQUIRED", assertThrows(IllegalArgumentException.class, () -> TrainingAssessmentLibraryService.normalize("QUESTIONS", List.of())).getMessage());
        assertEquals("TRAINING_ASSESSMENT_ITEMS_REQUIRED", assertThrows(IllegalArgumentException.class, () -> TrainingAssessmentLibraryService.normalize("QUESTIONS", null)).getMessage());
        List<ItemDto> many = java.util.Collections.nCopies(201, new ItemDto("ESSAY", "Q", List.of(), List.of(), BigDecimal.ONE, null));
        assertEquals("TRAINING_ASSESSMENT_TOO_LARGE", assertThrows(IllegalArgumentException.class, () -> TrainingAssessmentLibraryService.normalize("QUESTIONS", many)).getMessage());
    }

    @Test
    void itemsAreNumberedInTheOrderGiven() {
        List<Map<String, Object>> out = TrainingAssessmentLibraryService.normalize("QUESTIONS", List.of(
                new ItemDto("ESSAY", "First", List.of(), List.of(), BigDecimal.ONE, null), new ItemDto("ESSAY", "Second", List.of(), List.of(), BigDecimal.ONE, null)));
        assertEquals(List.of(1, 2), out.stream().map(m -> m.get("no")).toList());
        assertEquals("Second", out.get(1).get("prompt"));
    }
}
