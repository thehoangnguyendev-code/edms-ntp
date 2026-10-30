package com.eqms.service.training;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/** SOP.0003 5.3.7: the results go to QA within working days; the days that count are a setting of Training Properties. */
class TrainingWorkingDaysTest {
    private static final LocalDate FRIDAY = LocalDate.of(2026, 10, 23);

    @Test
    void mondayToFridayDoesNotCountTheWeekend() {
        assertThat(TrainingWorkingDays.add(FRIDAY, 1, TrainingWorkingDays.MON_FRI)).isEqualTo(LocalDate.of(2026, 10, 26));
        assertThat(TrainingWorkingDays.add(FRIDAY, 5, TrainingWorkingDays.MON_FRI)).isEqualTo(LocalDate.of(2026, 10, 30));
        assertThat(TrainingWorkingDays.add(LocalDate.of(2026, 10, 22), 7, TrainingWorkingDays.MON_FRI)).isEqualTo(LocalDate.of(2026, 11, 2));
    }

    @Test
    void mondayToSaturdayCountsTheSaturdayOnly() {
        assertThat(TrainingWorkingDays.add(FRIDAY, 1, TrainingWorkingDays.MON_SAT)).isEqualTo(LocalDate.of(2026, 10, 24));
        assertThat(TrainingWorkingDays.add(LocalDate.of(2026, 10, 24), 1, TrainingWorkingDays.MON_SAT)).isEqualTo(LocalDate.of(2026, 10, 26));
    }

    @Test
    void calendarDaysCountEveryDay() {
        assertThat(TrainingWorkingDays.add(FRIDAY, 7, TrainingWorkingDays.CALENDAR)).isEqualTo(LocalDate.of(2026, 10, 30));
    }

    @Test
    void theDayItselfIsNotCountedAndZeroDaysIsTheSameDay() {
        assertThat(TrainingWorkingDays.add(FRIDAY, 0, TrainingWorkingDays.MON_FRI)).isEqualTo(FRIDAY);
        assertThat(TrainingWorkingDays.add(LocalDate.of(2026, 10, 24), 1, TrainingWorkingDays.MON_FRI)).isEqualTo(LocalDate.of(2026, 10, 26));
    }

    @Test
    void onlyTheThreeTypesAreValid() {
        assertThat(TrainingWorkingDays.valid("WORKING_MON_FRI")).isTrue();
        assertThat(TrainingWorkingDays.valid("WORKING_MON_SAT")).isTrue();
        assertThat(TrainingWorkingDays.valid("CALENDAR")).isTrue();
        assertThat(TrainingWorkingDays.valid("WEEKLY")).isFalse();
        assertThat(TrainingWorkingDays.valid(null)).isFalse();
    }
}
