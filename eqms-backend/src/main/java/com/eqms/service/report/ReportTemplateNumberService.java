package com.eqms.service.report;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The number of a report template (REPORT-TEMPLATE-NUMBER-2026-10-14). The system issues it from the numbering settings of Report Properties, as a
 * Document Number is issued: prefix, ".", and a zero-padded serial (RPT.0001). A user never types it. The serial only moves forward, so a number is
 * never issued twice, and a change of the settings affects only the numbers issued afterwards; templates that exist keep their number.
 */
@Service
public class ReportTemplateNumberService {
    public static final String SEPARATOR = ".";

    private final JdbcTemplate jdbc;

    public ReportTemplateNumberService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** prefix + "." + serial padded to the digits of the setting. */
    public static String format(String prefix, int digits, long serial) {
        return prefix + SEPARATOR + String.format("%0" + digits + "d", serial);
    }

    /** Issues the next template number. Runs in the caller's transaction, holding the settings row locked until it ends, so two creations never share a number. */
    @Transactional
    public String allocate() {
        var rule = jdbc.queryForMap("select template_number_prefix as prefix, template_number_digits as digits, template_number_sequence as sequence from report_properties where id=1 for update");
        String prefix = String.valueOf(rule.get("prefix"));
        int digits = ((Number) rule.get("digits")).intValue();
        long serial = ((Number) rule.get("sequence")).longValue();
        String candidate;
        do {
            serial++;
            candidate = format(prefix, digits, serial);
        } while (!jdbc.queryForList("select 1 from report_definitions where code=?", candidate).isEmpty());
        jdbc.update("update report_properties set template_number_sequence=? where id=1", serial);
        return candidate;
    }
}
