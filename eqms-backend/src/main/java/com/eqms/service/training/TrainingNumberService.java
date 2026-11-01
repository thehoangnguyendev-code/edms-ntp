package com.eqms.service.training;

import com.eqms.util.DateTimeFormatUtils;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Issues Training Numbers: {@code TRN/<department code>/<YY>-<XXX>} (SOP.0003 section 5.1.4, TR-01 to TR-04). The serial counts up for each
 * (department, year), is taken by one atomic statement so that two people at the same moment never get the same number, and is never given back: a number
 * that is cancelled stays in the log. A make-up or retraining activity keeps the number of its root activity and adds a letter suffix (a, b, ... z, aa, ab).
 */
@Service
public class TrainingNumberService {
    public static final ZoneId ZONE = DateTimeFormatUtils.ZONE;
    private static final Pattern DEPARTMENT_CODE = Pattern.compile("[A-Z0-9]{1,40}");
    private static final Pattern PAPER_NUMBER = Pattern.compile("(?i)^TRN/([A-Z0-9]{1,40})/([0-9]{2})-([0-9]{1,6})$");
    private static final int MAX_SKIPPED = 1000;

    private final JdbcTemplate jdbc;

    public TrainingNumberService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** A number taken from the counter. */
    public record Issued(String baseNumber, int year, int serial, String departmentCode) {}

    public static String format(String departmentCode, int year, int serial) {
        return "TRN/" + departmentCode + "/" + String.format("%02d", year % 100) + "-" + String.format("%03d", serial);
    }

    /** Takes the next serial of the department for the current year. Must run inside the transaction of the thing that uses the number. */
    @Transactional(propagation = Propagation.MANDATORY)
    public Issued issueRoot(UUID departmentId) {
        List<Map<String, Object>> rows = jdbc.queryForList("select code from departments where id=?", departmentId);
        if (rows.isEmpty()) throw new IllegalArgumentException("TRAINING_DEPARTMENT_NOT_FOUND");
        String code = String.valueOf(rows.getFirst().get("code")).trim();
        // The code of the department is part of the number: letters and digits only.
        if (!DEPARTMENT_CODE.matcher(code).matches()) throw new IllegalArgumentException("TRAINING_DEPARTMENT_CODE_INVALID");
        int year = LocalDate.now(ZONE).getYear();
        // A number that is already used (typed from a paper record at Legacy Import, or on another revision) is never issued again: the counter goes on to the next serial. The serial
        // that was skipped is not given back, like a cancelled number.
        for (int attempt = 0; attempt < MAX_SKIPPED; attempt++) {
            Integer serial = jdbc.queryForObject("""
                insert into training_number_sequences(department_id, year, last_serial) values (?, ?, 1)
                on conflict (department_id, year) do update set last_serial = training_number_sequences.last_serial + 1
                returning last_serial
                """, Integer.class, departmentId, year);
            if (serial == null) throw new IllegalStateException("TRAINING_NUMBER_UNAVAILABLE");
            if (!isUsed(format(code, year, serial))) return new Issued(format(code, year, serial), year, serial, code);
        }
        throw new IllegalStateException("TRAINING_NUMBER_UNAVAILABLE");
    }

    /** True when a training activity or a document revision already carries the number (any case). */
    public boolean isUsed(String trainingNumber) {
        Boolean used = jdbc.queryForObject(
                "select exists(select 1 from training_activities where upper(training_number)=upper(?)) or exists(select 1 from document_revisions where upper(training_number)=upper(?))",
                Boolean.class, trainingNumber, trainingNumber);
        return Boolean.TRUE.equals(used);
    }

    /**
     * A number typed from a paper record in the form of this system (TRN/DC/YY-XXX) raises the counter of its department and year to at least its serial, so that the numbers the system
     * issues go on after the paper log. A number of another form, or of a department that is not found, changes nothing.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void reserveFromPaper(String trainingNumber) {
        if (trainingNumber == null) return;
        Matcher m = PAPER_NUMBER.matcher(trainingNumber.trim());
        if (!m.matches()) return;
        List<UUID> department = jdbc.queryForList("select id from departments where upper(trim(code)) = upper(?)", UUID.class, m.group(1));
        if (department.size() != 1) return;
        int year = 2000 + Integer.parseInt(m.group(2));
        int serial = Integer.parseInt(m.group(3));
        jdbc.update("""
            insert into training_number_sequences(department_id, year, last_serial) values (?, ?, ?)
            on conflict (department_id, year) do update set last_serial = greatest(training_number_sequences.last_serial, excluded.last_serial)
            """, department.getFirst(), year, serial);
    }

    /** The next unused suffix under a root activity: a to z, then aa, ab, ... The caller holds the lock of the root activity. */
    public String nextSuffix(UUID rootActivityId) {
        List<String> used = jdbc.queryForList("select suffix from training_activities where parent_activity_id=? and suffix is not null", String.class, rootActivityId);
        int index = 0;
        while (used.contains(suffixOf(index))) index++;
        return suffixOf(index);
    }

    /** 0 gives a, 25 gives z, 26 gives aa, 27 gives ab (like the columns of a spreadsheet, in lower case). */
    public static String suffixOf(int index) {
        StringBuilder out = new StringBuilder();
        int n = index;
        do {
            out.insert(0, (char) ('a' + n % 26));
            n = n / 26 - 1;
        } while (n >= 0);
        return out.toString();
    }
}
