package com.eqms.service.training;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** APD.0117: the session number, the meaning of the signature and the two result columns of a person who was absent or failed. */
class TrainingAttendanceListColumnsTest {
    private static final UUID PERSON = UUID.randomUUID();

    private static Map<String, Object> person(String state, String result) {
        Map<String, Object> p = new HashMap<>();
        p.put("state", state);
        p.put("result", result);
        p.put("participation_role", "TRAINEE");
        return p;
    }

    @Test
    void theSessionNumberIsTwoDigitsWithoutLetters() {
        assertEquals("01", TrainingAttendanceListService.sessionLabel(Map.of("session_no", 1)));
        assertEquals("12", TrainingAttendanceListService.sessionLabel(Map.of("session_no", 12)));
    }

    @Test
    void whoeverTookTheAttendanceTheMeaningOfTheSignatureIsAttendanceHasBeenTaken() {
        List<String> trainer = TrainingAttendanceListService.taken(List.of("Nguyen The Hoang", "Attendance List Sent to QA · 31/10/2026 17:47 (UTC+07)"));
        assertEquals("Attendance Has Been Taken · 31/10/2026 17:47 (UTC+07)", trainer.get(1));
        List<String> own = TrainingAttendanceListService.taken(List.of("Nguyen Van An", "Attendance Confirmed by Trainee · 31/10/2026 09:00 (UTC+07)"));
        assertEquals("Attendance Has Been Taken · 31/10/2026 09:00 (UTC+07)", own.get(1));
        assertFalse(String.join(" ", trainer).contains("Sent to QA"));
    }

    @Test
    void aPersonWhoFailedHasTheFailInTheResultColumnAndTheLatestTrainingAfterIt() {
        assertArrayEquals(new String[] {"Không đạt / Failed", "Đạt / Passed"},
                TrainingAttendanceListService.resultColumns(person("ATTENDED", "FAILED"), PERSON, Map.of(PERSON, List.of("Không đạt / Failed", "Đạt / Passed"))));
        assertArrayEquals(new String[] {"Đạt / Passed", ""}, TrainingAttendanceListService.resultColumns(person("ATTENDED", "PASSED"), PERSON, Map.of()));
    }

    @Test
    void aPersonWhoWasAbsentHasTheOutcomeOfTheMakeUpInTheResultColumnAndOnlyAFurtherTrainingInTheNextOne() {
        assertArrayEquals(new String[] {"", ""}, TrainingAttendanceListService.resultColumns(person("ABSENT", ""), PERSON, Map.of()));
        assertArrayEquals(new String[] {"Đạt / Passed", ""}, TrainingAttendanceListService.resultColumns(person("ABSENT", ""), PERSON, Map.of(PERSON, List.of("Đạt / Passed"))));
        assertArrayEquals(new String[] {"Không đạt / Failed", "Đạt / Passed"},
                TrainingAttendanceListService.resultColumns(person("ABSENT", ""), PERSON, Map.of(PERSON, List.of("Không đạt / Failed", "Đạt / Passed"))));
        assertTrue(TrainingAttendanceListService.resultColumns(person("ABSENT", ""), null, Map.of())[0].isEmpty());
    }
}
