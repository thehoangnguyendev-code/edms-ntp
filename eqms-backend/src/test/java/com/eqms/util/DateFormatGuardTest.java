package com.eqms.util;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Keeps the display format of dates and times in one place. A date or time a person reads is {@code dd/MM/yyyy} or {@code dd/MM/yyyy HH:mm:ss}, written by
 * {@link DateTimeFormatUtils}. This test fails the build when code builds another pattern, uses a locale-dependent format, or turns a temporal into text with the tricks that
 * produce ISO ({@code substring(0, 10)}, {@code replace('T', ' ')}, {@code withNano(0)} on a date-time).
 */
class DateFormatGuardTest {

    private static final Path MAIN = Path.of("src/main/java");

    /** The patterns that may be written as a literal: the display formats, parsing of what the display format or a form sends, and two labels that are not dates. */
    private static final Set<String> ALLOWED_PATTERNS = Set.of(
            "dd/MM/yyyy", "dd/MM/yyyy HH:mm:ss", "dd/MM/yyyy HH:mm", "dd/MM/uuuu HH:mm:ss",
            "HH:mm",                    // a time of day of a notification window
            "yyyy",                     // the year in a signature number
            "MMMM yyyy",                // the title of a month of the calendar
            "yyyy-MM-dd'T'HH:mm");      // what a datetime-local field sends (parsed, never shown)

    /** Files that may read an ISO text or cut one (they parse a value, they do not show it). */
    private static final Set<String> MAY_CUT_ISO = Set.of(
            "DateTimeFormatUtils.java", "DocumentService.java", "RevisionService.java", "UncontrolledCopyService.java", "UserManagementService.java",
            "DictionaryManagementService.java", "DictionaryQuerySupport.java", "TrainingMatrixCompletionService.java", "ControlledCopyService.java");

    private static List<Path> sources() throws IOException {
        try (Stream<Path> walk = Files.walk(MAIN)) {
            return walk.filter(p -> p.toString().endsWith(".java")).toList();
        }
    }

    private static String read(Path p) throws IOException {
        return Files.readString(p, StandardCharsets.UTF_8);
    }

    @Test
    void noOtherDisplayPatternIsBuilt() throws IOException {
        Pattern literal = Pattern.compile("ofPattern\\(\\s*\"([^\"]*)\"");
        List<String> found = new ArrayList<>();
        for (Path p : sources()) {
            Matcher m = literal.matcher(read(p));
            while (m.find()) if (!ALLOWED_PATTERNS.contains(m.group(1))) found.add(p.getFileName() + ": ofPattern(\"" + m.group(1) + "\")");
        }
        assertThat(found).as("Use DateTimeFormatUtils: dates are dd/MM/yyyy, moments dd/MM/yyyy HH:mm:ss").isEmpty();
    }

    @Test
    void aPatternThatIsNotALiteralIsOnlyUsedWhereTheSignatureCatalogControlsIt() throws IOException {
        Pattern variable = Pattern.compile("ofPattern\\(\\s*(?!\")([A-Za-z_][A-Za-z0-9_.]*)");
        List<String> found = new ArrayList<>();
        for (Path p : sources()) {
            String name = p.getFileName().toString();
            Matcher m = variable.matcher(read(p));
            while (m.find()) {
                boolean fromTheUtility = m.group(1).startsWith("DATE_PATTERN") || m.group(1).startsWith("DATETIME_PATTERN") || m.group(1).startsWith("DateTimeFormatUtils.");
                boolean catalogControlled = name.equals("ElectronicSignatureRendererService.java") && m.group(1).equals("pattern");
                if (!fromTheUtility && !catalogControlled) found.add(name + ": ofPattern(" + m.group(1) + ")");
            }
        }
        assertThat(found).isEmpty();
    }

    @Test
    void noLocaleDependentOrOldStyleDateFormatting() throws IOException {
        List<String> found = new ArrayList<>();
        for (Path p : sources()) {
            String text = read(p);
            for (String banned : List.of("SimpleDateFormat", "DateFormat.getDate", "DateFormat.getTime", "FormatStyle.", "ofLocalizedDate", "ofLocalizedDateTime", "ofLocalizedTime")) {
                if (text.contains(banned)) found.add(p.getFileName() + " uses " + banned);
            }
        }
        assertThat(found).isEmpty();
    }

    @Test
    void noIsoTricksOnATemporalOutsideTheFilesThatParse() throws IOException {
        List<String> found = new ArrayList<>();
        for (Path p : sources()) {
            String name = p.getFileName().toString();
            String text = read(p);
            if (text.contains("replace('T', ' ')") || text.contains("replace(\"T\", \" \")")) found.add(name + " replaces T by a space");
            if (text.contains("toLocalDateTime().withNano(0)") || text.contains("LocalDateTime.now().withNano(0)")) found.add(name + " prints a date-time with its ISO toString");
            if (!MAY_CUT_ISO.contains(name) && text.contains("substring(0, 10)")) found.add(name + " cuts a date out of an ISO text");
            if (!MAY_CUT_ISO.contains(name) && text.contains("DateTimeFormatter.ISO_")) found.add(name + " uses an ISO formatter");
        }
        assertThat(found).as("Show a date with DateTimeFormatUtils.display(...)").isEmpty();
    }

    @Test
    void theTrainingPrintsAndExportsUseTheUtility() throws IOException {
        for (String file : List.of("TrainingPrintService.java", "TrainingRecordExportService.java", "TrainingPaperService.java", "TrainingExamPackService.java")) {
            Path p = MAIN.resolve("com/eqms/service/training/" + file);
            assertThat(read(p)).as(file).contains("DateTimeFormatUtils");
        }
    }
    /** The zone of the site is the only zone: nobody reads the zone of the machine, picks another one, or cuts a day in UTC. */
    @Test
    void theZoneIsAlwaysTheZoneOfTheSite() throws IOException {
        Set<String> mayNameAZone = Set.of(
                "DateTimeFormatUtils.java",                    // the one definition
                "ElectronicSignatureRendererService.java",     // reads the zone written on a signature that was already made
                "ControlledCopyAuthorizationService.java");   // reads the expiry that rows saved in UTC hold
        List<String> found = new ArrayList<>();
        for (Path p : sources()) {
            String name = p.getFileName().toString();
            if (mayNameAZone.contains(name)) continue;
            String text = read(p);
            if (text.contains("ZoneId.systemDefault()")) found.add(name + " reads the zone of the machine");
            if (text.contains("ZoneId.of(")) found.add(name + " builds a zone");
            if (text.contains("ZoneOffset.UTC") && (text.contains("atStartOfDay(java.time.ZoneOffset.UTC") || text.contains("atStartOfDay(ZoneOffset.UTC") || text.contains("atZone(ZoneOffset.UTC"))) {
                found.add(name + " cuts a day in UTC");
            }
        }
        assertThat(found).as("Use DateTimeFormatUtils.ZONE").isEmpty();
    }
}
