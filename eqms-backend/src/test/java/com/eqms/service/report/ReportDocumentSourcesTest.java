package com.eqms.service.report;

import static org.junit.jupiter.api.Assertions.*;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import java.util.*;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * REPORT-DOCUMENT-SOURCES-2026-11-12: the Report Types that report on documents (Document Register, Document Revisions, Controlled Copies, Uncontrolled Copies) keep the
 * same promises: the data scope of the template decides the rows, a person cannot widen it from the request, every value is a parameter, and no secret is a column.
 */
class ReportDocumentSourcesTest {
    static List<ReportMetadataProvider> providers() {
        return List.of(new DocumentReportMetadataProvider(ReportTestVisibility.everything()), new RevisionReportMetadataProvider(ReportTestVisibility.everything()), new ControlledCopyReportMetadataProvider(ReportTestVisibility.everything()), new UncontrolledCopyReportMetadataProvider(ReportTestVisibility.everything()));
    }

    private UserAccount actor() {
        var actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        actor.setStatus(UserStatus.Active);
        return actor;
    }

    /** A value for every filter the type offers: a date for a DATE filter, text otherwise. */
    private Map<String, Object> everyFilter(ReportMetadataProvider provider) {
        var values = new HashMap<String, Object>();
        for (var filter : provider.filters()) values.put(filter.get("code"), "DATE".equals(filter.get("type")) ? "2026-01-15" : "NUMBER".equals(filter.get("type")) ? "60" : "x");
        return values;
    }

    @ParameterizedTest @MethodSource("providers")
    void noScopeOrAnUnknownScopeIsRefused(ReportMetadataProvider provider) {
        assertThrows(SecurityException.class, () -> provider.query(actor(), List.of(), Map.of()));
        assertThrows(SecurityException.class, () -> provider.query(actor(), List.of("GLOBAL"), Map.of()));
        assertThrows(SecurityException.class, () -> provider.query(actor(), List.of("DEPARTMENT"), Map.of()), "a person with no department has nothing to see");
        assertThrows(SecurityException.class, () -> provider.query(actor(), List.of("BUSINESS_UNIT"), Map.of()));
    }

    @ParameterizedTest @MethodSource("providers")
    void theDepartmentAndTheBusinessUnitComeFromThePersonNeverFromTheRequest(ReportMetadataProvider provider) {
        var actor = actor();
        actor.setDepartment("QA");
        actor.setBusinessUnit("Factory");
        var query = provider.query(actor, List.of("DEPARTMENT", "BUSINESS_UNIT"), Map.of("department", "another-id", "businessUnit", "another-unit"));
        assertEquals(List.of("QA", "Factory", "another-id", "another-unit"), query.arguments());
        assertTrue(query.fromWhere().contains("dep.name=?") && query.fromWhere().contains("bu.name=?"));
    }

    @ParameterizedTest @MethodSource("providers")
    void aPersonalScopeSeesOnlyWhatThePersonTookPartIn(ReportMetadataProvider provider) {
        var actor = actor();
        var query = provider.query(actor, List.of("PERSONAL"), Map.of());
        assertEquals(List.of(actor.getId(), actor.getId(), actor.getId()), query.arguments());
        assertFalse(query.fromWhere().replaceAll("\\s+", "").contains("where(true"));
    }

    @ParameterizedTest @MethodSource("providers")
    void theSystemScopeAddsNoCondition(ReportMetadataProvider provider) {
        var query = provider.query(actor(), List.of("SYSTEM"), Map.of());
        assertTrue(query.fromWhere().replaceAll("\\s+", "").contains("where(true)"));
        assertTrue(query.arguments().isEmpty());
    }

    @ParameterizedTest @MethodSource("providers")
    void aFilterThatTheTypeDoesNotHaveOrANonTextValueIsRefused(ReportMetadataProvider provider) {
        assertThrows(IllegalArgumentException.class, () -> provider.query(actor(), List.of("SYSTEM"), Map.of("sql", "select 1")));
        assertThrows(IllegalArgumentException.class, () -> provider.query(actor(), List.of("SYSTEM"), Map.of("search", 5)));
    }

    @ParameterizedTest @MethodSource("providers")
    void aSearchIsEscapedAndEveryValueIsAParameter(ReportMetadataProvider provider) {
        var query = provider.query(actor(), List.of("SYSTEM"), Map.of("search", "%_\\", "status", "x' OR true--"));
        assertTrue(query.arguments().contains("x' OR true--"));
        assertTrue(query.arguments().stream().anyMatch(a -> "%\\%\\_\\\\%".equals(a)));
        assertFalse(query.fromWhere().contains("OR true"));
        assertFalse(query.fromWhere().contains("select 1"));
    }

    @org.junit.jupiter.api.Test
    void theDocumentRegisterListsDocumentsDueForReviewWithinANumberOfDaysFromTheRunDay() {
        var provider = new DocumentReportMetadataProvider(ReportTestVisibility.everything());
        var query = provider.query(actor(), List.of("SYSTEM"), Map.of("reviewWithinDays", "60"));
        assertTrue(query.fromWhere().contains("d.review_date is not null and d.review_date <= current_date + ?"));
        assertTrue(query.arguments().contains(60), "the number is a parameter, not part of the SQL");
        assertTrue(provider.columns().get("daysToReview").contains("d.review_date - current_date"));
        assertTrue(provider.columns().get("reviewStatus").contains("d.review_date < current_date then 'Overdue'"), "overdue means before the day of the run");
        for (String bad : List.of("-1", "3651", "ten", "1.5")) {
            assertEquals("REPORT_REVIEW_DAYS_INVALID", assertThrows(IllegalArgumentException.class, () -> provider.query(actor(), List.of("SYSTEM"), Map.of("reviewWithinDays", bad))).getMessage(), bad);
        }
        assertEquals("reviewDate", provider.filterColumns().get("reviewWithinDays"), "a person who may not see the review date cannot filter by it");
    }

    @ParameterizedTest @MethodSource("providers")
    void aSearchOfMoreThan200CharactersIsRefused(ReportMetadataProvider provider) {
        assertThrows(IllegalArgumentException.class, () -> provider.query(actor(), List.of("SYSTEM"), Map.of("search", "a".repeat(201))));
    }

    @ParameterizedTest @MethodSource("providers")
    void everyFilterTheTypeOffersIsAccepted_andEachValueIsOneParameter(ReportMetadataProvider provider) {
        var filters = everyFilter(provider);
        var query = provider.query(actor(), List.of("SYSTEM"), filters);
        long marks = query.fromWhere().chars().filter(c -> c == '?').count();
        assertEquals(marks, query.arguments().size(), "one argument for each question mark of the SQL");
        assertTrue(query.arguments().size() >= filters.size(), "no filter is dropped silently");
    }

    @ParameterizedTest @MethodSource("providers")
    void dateRangesAreCheckedInOrderAndWithinOneYear(ReportMetadataProvider provider) {
        var dateFilters = provider.filters().stream().filter(f -> "DATE".equals(f.get("type"))).map(f -> f.get("code")).collect(Collectors.toList());
        var from = dateFilters.stream().filter(code -> code.endsWith("From")).findFirst().orElseThrow();
        var to = from.substring(0, from.length() - 4) + "To";
        assertThrows(IllegalArgumentException.class, () -> provider.query(actor(), List.of("SYSTEM"), Map.of(from, "2026-10-02", to, "2026-10-01")));
        assertThrows(IllegalArgumentException.class, () -> provider.query(actor(), List.of("SYSTEM"), Map.of(from, "2020-01-01", to, "2026-10-01")));
        assertThrows(IllegalArgumentException.class, () -> provider.query(actor(), List.of("SYSTEM"), Map.of(from, "not-a-date")));
    }

    @ParameterizedTest @MethodSource("providers")
    void theContractOfTheTypeIsConsistent(ReportMetadataProvider provider) {
        assertEquals(provider.columns().keySet(), provider.labels().keySet(), "every column has a label");
        assertTrue(provider.columns().keySet().containsAll(provider.requiredFields()));
        assertTrue(provider.columns().containsKey(provider.defaultSort()));
        assertTrue(provider.columns().values().stream().noneMatch(String::isBlank));
        var filterCodes = provider.filters().stream().map(f -> f.get("code")).collect(Collectors.toSet());
        assertTrue(filterCodes.containsAll(provider.filterColumns().keySet()), "a filter column is for a filter the type has");
        assertTrue(provider.columns().keySet().containsAll(provider.filterColumns().values()), "a filter is tied to a column of the type");
        assertTrue(filterCodes.containsAll(provider.lookupColumns().keySet()));
        provider.lookupColumns().keySet().forEach(code -> assertTrue(provider.columns().containsKey(code), "a lookup shows the label of its column: " + code));
        assertEquals(filterCodes.size(), provider.narrowingFilters().size());
        assertEquals(List.of("PERSONAL", "DEPARTMENT", "BUSINESS_UNIT", "SYSTEM"), provider.allowedScopes().stream().sorted(Comparator.comparingInt(
                scope -> List.of("PERSONAL", "DEPARTMENT", "BUSINESS_UNIT", "SYSTEM").indexOf(scope))).toList());
    }

    /** What must never be offered as a column of a document report: a secret, a file, a free text of a person. */
    @ParameterizedTest @MethodSource("providers")
    void noSecretFileOrFreeTextIsAColumn(ReportMetadataProvider provider) {
        var forbidden = List.of("access_token", "preview_password", "recipient_signature", "checksum", "file_path", "storage_", "source_storage", "password", "token",
                "scan_token", "description", "rejection_reason", "cancel_reason", "recall_reason", "destroy_reason", "distribution_list", "custom_placeholder");
        for (var sql : provider.columns().values()) {
            for (var word : forbidden) assertFalse(sql.toLowerCase().contains(word), provider.code() + " must not report " + word + " (" + sql + ")");
        }
    }

    @ParameterizedTest @MethodSource("providers")
    void aColumnShowsAReadableLabelNotAMachineCodeForStatusAndPurpose(ReportMetadataProvider provider) {
        var status = provider.columns().get("status");
        assertNotNull(status);
        assertTrue(status.contains("label") || status.contains("when '"), "the status is shown as its label: " + status);
    }

    @ParameterizedTest @MethodSource("providers")
    void everyDateColumnIsAColumnAndTheColumnsOfDateFiltersAreDates(ReportMetadataProvider provider) {
        var dates = provider.dateColumns();
        assertTrue(provider.columns().keySet().containsAll(dates));
        provider.filters().stream().filter(f -> "DATE".equals(f.get("type"))).map(f -> provider.filterColumns().get(f.get("code")))
                .forEach(column -> assertTrue(dates.contains(column), "the column of a date filter is a date: " + column));
        // a date a report may group by starts with yyyy-MM-dd: a date as such, or a moment written to the second
        dates.forEach(code -> assertTrue(provider.columns().get(code).matches("^(?:[a-z]+\\.[a-z_]+|to_char\\(.*)$"), "a plain date or a moment as text: " + code));
    }

    @Test
    void theCodesOfTheTypesAreDistinctAndStable() {
        var codes = providers().stream().map(ReportMetadataProvider::code).toList();
        assertEquals(List.of("DOCUMENT_STATUS", "DOCUMENT_REVISIONS", "CONTROLLED_COPIES", "UNCONTROLLED_COPIES"), codes);
        assertEquals(codes.size(), new HashSet<>(codes).size());
        providers().forEach(provider -> assertEquals("Documents", provider.category()));
    }

    @Test
    void theRegisterNowHasThePeopleValidityAndReviewColumns() {
        var columns = new DocumentReportMetadataProvider(ReportTestVisibility.everything()).columns().keySet();
        assertTrue(columns.containsAll(List.of("revision", "author", "owner", "validUntil", "reviewDate", "reviewCycle", "requiresTraining", "language", "subType", "updatedAt")));
        // the first eight columns are unchanged, so a template made before keeps its columns
        assertTrue(columns.containsAll(List.of("documentNumber", "documentName", "status", "department", "businessUnit", "effectiveDate", "createdAt", "documentType")));
    }

    @Test
    void theRevisionReportShowsHowLongARevisionHasBeenInItsStatus() {
        var days = new RevisionReportMetadataProvider(ReportTestVisibility.everything()).columns().get("daysInStatus");
        assertTrue(days.contains("revision_workflow_history") && days.contains("from_status is distinct from"), "a save inside one status does not restart the clock");
    }
}
