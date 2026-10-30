package com.eqms.service.training;

import java.time.DayOfWeek;
import java.time.LocalDate;

/**
 * Counting days for a time limit of the SOP. SOP.0003 5.3.7 gives the time to send the results to QA in working days; the company decides which days are working days
 * (Training Properties): Monday to Friday, Monday to Saturday, or every day. The public holidays are not known to the system (the calendar of non-working days was removed by V633),
 * so a holiday counts as a working day.
 */
public final class TrainingWorkingDays {
    public static final String MON_FRI = "WORKING_MON_FRI";
    public static final String MON_SAT = "WORKING_MON_SAT";
    public static final String CALENDAR = "CALENDAR";

    private TrainingWorkingDays() {}

    public static boolean valid(String type) {
        return MON_FRI.equals(type) || MON_SAT.equals(type) || CALENDAR.equals(type);
    }

    /** Whether the day counts under the type. */
    public static boolean counts(LocalDate day, String type) {
        if (CALENDAR.equals(type)) return true;
        DayOfWeek d = day.getDayOfWeek();
        if (d == DayOfWeek.SUNDAY) return false;
        return !(MON_FRI.equals(type) && d == DayOfWeek.SATURDAY);
    }

    /** The date that is {@code days} days after {@code from}, counting only the days of the type; the day {@code from} itself is not counted. */
    public static LocalDate add(LocalDate from, int days, String type) {
        if (days <= 0) return from;
        LocalDate day = from;
        int left = days;
        while (left > 0) {
            day = day.plusDays(1);
            if (counts(day, type)) left--;
        }
        return day;
    }
}
