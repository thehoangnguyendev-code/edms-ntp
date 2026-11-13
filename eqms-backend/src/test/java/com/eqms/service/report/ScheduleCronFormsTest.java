package com.eqms.service.report;

import org.junit.jupiter.api.Test;
import org.springframework.scheduling.support.CronExpression;
import java.time.ZonedDateTime;
import static org.junit.jupiter.api.Assertions.*;

/** The frequencies the Scheduled Report page builds are all cron expressions the server accepts, with a next occurrence. */
class ScheduleCronFormsTest {
    @Test
    void everyFormOfThePageIsAcceptedAndHasANextOccurrence() {
        for (String cron : new String[]{"0 15 * * * *", "0 0 */6 * * *", "0 0 */12 * * *", "0 30 6 * * *", "0 0 8 * * MON-FRI", "0 0 8 * * MON,WED,FRI,SAT", "0 0 8 * * MON-WED,FRI-SUN",
                "0 0 8 1 * *", "0 0 8 28 * *", "0 45 17 L * *"}) {
            var parsed = CronExpression.parse(cron);
            assertNotNull(parsed.next(ZonedDateTime.now()), cron);
        }
    }

    @Test
    void theLastDayOfTheMonthIsTheLastDayOfEachMonth() {
        var cron = CronExpression.parse("0 0 8 L * *");
        var february = cron.next(ZonedDateTime.parse("2027-02-01T00:00:00+07:00"));
        assertEquals(28, february.getDayOfMonth());
        var leap = cron.next(ZonedDateTime.parse("2028-02-01T00:00:00+07:00"));
        assertEquals(29, leap.getDayOfMonth());
        assertEquals(30, cron.next(ZonedDateTime.parse("2027-04-01T00:00:00+07:00")).getDayOfMonth());
    }
}
