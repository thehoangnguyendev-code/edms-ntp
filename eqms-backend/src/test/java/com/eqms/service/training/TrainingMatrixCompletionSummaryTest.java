package com.eqms.service.training;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The per-row totals of Matrix completion: every state is counted, and only people still to be trained are named, up to a limit. */
class TrainingMatrixCompletionSummaryTest {

    private static Map<String, Object> row() {
        Map<String, Object> counts = new LinkedHashMap<>();
        for (String s : List.of("NOT_REQUIRED", "IN_PROGRESS", "QUALIFIED", "UPDATE_NEEDED", "DUE", "REQUIRED")) counts.put(s, 0);
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("counts", counts);
        row.put("open", new java.util.ArrayList<Map<String, Object>>());
        row.put("moreOpen", 0);
        return row;
    }

    private static Map<String, Object> person(String name) {
        return Map.of("pid", UUID.randomUUID(), "full_name", name, "employee_code", "E");
    }

    @Test
    @SuppressWarnings("unchecked")
    void everyStateIsCountedButOnlyPeopleStillToBeTrainedAreNamed() {
        Map<String, Object> row = row();
        TrainingMatrixCompletionService.countInRow(row, person("An"), "QUALIFIED");
        TrainingMatrixCompletionService.countInRow(row, person("Binh"), "REQUIRED");
        TrainingMatrixCompletionService.countInRow(row, person("Chi"), "IN_PROGRESS");
        TrainingMatrixCompletionService.countInRow(row, person("Dung"), "NOT_REQUIRED");

        Map<String, Object> counts = (Map<String, Object>) row.get("counts");
        assertThat(counts).containsEntry("QUALIFIED", 1).containsEntry("REQUIRED", 1).containsEntry("IN_PROGRESS", 1).containsEntry("NOT_REQUIRED", 1);
        assertThat((List<Map<String, Object>>) row.get("open")).extracting(m -> m.get("fullName")).containsExactly("Binh", "Chi");
    }

    @Test
    @SuppressWarnings("unchecked")
    void theNamedListOfARowIsCutAndSaysHowManyMore() {
        Map<String, Object> row = row();
        for (int i = 0; i < TrainingMatrixCompletionService.MAX_NAMED_PER_ROW + 5; i++) TrainingMatrixCompletionService.countInRow(row, person("P" + i), "DUE");

        assertThat((List<?>) row.get("open")).hasSize(TrainingMatrixCompletionService.MAX_NAMED_PER_ROW);
        assertThat(row.get("moreOpen")).isEqualTo(5);
        assertThat(((Map<String, Object>) row.get("counts")).get("DUE")).isEqualTo(TrainingMatrixCompletionService.MAX_NAMED_PER_ROW + 5);
    }
}
