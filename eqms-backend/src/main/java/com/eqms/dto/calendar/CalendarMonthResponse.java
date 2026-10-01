package com.eqms.dto.calendar;

import java.time.LocalDate;
import java.util.List;

public record CalendarMonthResponse(String month, String label, String previousMonth, String nextMonth,
                                    LocalDate today, String currentMonth, String timeZone,
                                    List<String> weekdays, List<Day> days) {
    public record Day(LocalDate date, int number, boolean inMonth, boolean today, List<CalendarEventResponse> events) { }
}
