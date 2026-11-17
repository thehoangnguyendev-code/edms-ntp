package com.eqms.bootstrap;

import com.eqms.service.AuditTrailService;
import com.eqms.service.ObjectNumberService;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * AUDIT-OBJECT-REGISTRY-2026-11-17 (D6): the records that were made before their kind had a number get one, oldest first, each in the year it was made, using the
 * format that is set when this runs. It runs at every start and does nothing once every record has a number. Each kind that had records to number has one entry
 * in the Audit Trail (actor "System") that says how many were numbered, so the numbering of old records is itself on record.
 * A backup alert is not here: it lives in the Backup Agent's database and is numbered the first time this system sees it.
 */
@Component
@Order(200)
public class ObjectNumberBackfill implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(ObjectNumberBackfill.class);

    private record Target(String kind, String table, String column, String created, String label) {
    }

    private static final Target[] TARGETS = {
            new Target(ObjectNumberService.SCHEDULED_REPORT, "report_schedules", "schedule_number", "created_at", "Scheduled Report Number"),
            new Target(ObjectNumberService.AUDIT_TRAIL_CAMPAIGN, "audit_trail_review_campaigns", "campaign_number", "created_at", "Audit Trail Campaign Number"),
            new Target(ObjectNumberService.ACCESS_REVIEW_CAMPAIGN, "access_review_campaigns", "campaign_number", "created_at", "Access Review Campaign Number"),
            new Target(ObjectNumberService.OBJECT_ACCESS_RULE, "object_access_rules", "rule_number", "created_at", "Object Access Rule Number"),
            new Target(ObjectNumberService.ANNOUNCEMENT, "system_announcements", "announcement_number", "created_at", "Announcement Number"),
    };

    private final ObjectNumberService numbers;
    private final AuditTrailService audit;

    public ObjectNumberBackfill(ObjectNumberService numbers, AuditTrailService audit) {
        this.numbers = numbers;
        this.audit = audit;
    }

    @Override
    public void run(ApplicationArguments args) {
        for (Target target : TARGETS) {
            try {
                int count = numbers.backfill(target.kind(), target.table(), target.column(), target.created());
                if (count > 0) {
                    audit.logSystem("OBJECT_NUMBER_FORMAT", target.label(), UUID.nameUUIDFromBytes(("OBJECT_NUMBER_FORMAT:" + target.kind()).getBytes(StandardCharsets.UTF_8)),
                            "OBJECT_NUMBERS_BACKFILLED", null, null,
                            count + " existing record(s) were given a " + target.label() + ", oldest first, in the year each was made, with the format set at that time");
                    log.info("{} existing record(s) numbered for {}", count, target.kind());
                }
            } catch (RuntimeException e) {
                // a failure here must not stop the application; the records stay unnumbered and the next start tries again
                log.warn("Numbering the existing records of {} failed: {}", target.kind(), e.getMessage());
            }
        }
    }
}
