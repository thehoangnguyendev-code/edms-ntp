package com.eqms.service.report;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.training.TrainingAccess;
import com.eqms.service.training.TrainingComplianceService;
import java.util.*;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * REPORT-TRAINING-SOURCES-2026-11-12: the Training Report Types keep the promises of the document ones, and add the rule of the Training module: a person who may not see all
 * departments (training.scope.all) sees the own department only, whatever scope the template gives; a type needs the permission of the screen it reports on.
 */
class ReportTrainingSourcesTest {
    static final TrainingAccess ACCESS_OF_ONE_DEPARTMENT = mock(TrainingAccess.class);
    static final TrainingAccess ACCESS_OF_ALL_DEPARTMENTS = mock(TrainingAccess.class);
    static {
        when(ACCESS_OF_ALL_DEPARTMENTS.allDepartments(any())).thenReturn(true);
    }

    static List<ReportMetadataProvider> providers(TrainingAccess access) {
        return List.of(new TrainingRecordReportMetadataProvider(access), new TrainingActivityReportMetadataProvider(access),
                new TrainingParticipantReportMetadataProvider(access), new TrainingComplianceReportMetadataProvider(access));
    }

    static List<ReportMetadataProvider> providers() { return providers(ACCESS_OF_ONE_DEPARTMENT); }

    private UserAccount actor(String department) {
        var actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        actor.setStatus(UserStatus.Active);
        actor.setDepartment(department);
        return actor;
    }

    private Map<String, Object> everyFilter(ReportMetadataProvider provider) {
        var values = new HashMap<String, Object>();
        for (var filter : provider.filters()) values.put(filter.get("code"), "DATE".equals(filter.get("type")) ? "2026-01-15" : "x");
        return values;
    }

    @ParameterizedTest @MethodSource("providers")
    void aTypeOfTrainingHasNoBusinessUnitScopeAndNeedsThePermissionOfItsScreen(ReportMetadataProvider provider) {
        assertEquals(List.of("PERSONAL", "DEPARTMENT", "SYSTEM"), provider.allowedScopes());
        assertEquals("Training", provider.category());
        assertFalse(provider.usePermissions().isEmpty(), "a type of training is not open to everyone who holds a template scope");
        assertTrue(provider.usePermissions().stream().allMatch(code -> code.startsWith("training.")));
        assertThrows(SecurityException.class, () -> provider.query(actor("QA"), List.of("BUSINESS_UNIT"), Map.of()));
        assertThrows(SecurityException.class, () -> provider.query(actor("QA"), List.of(), Map.of()));
        assertThrows(SecurityException.class, () -> provider.query(actor("QA"), List.of("GLOBAL"), Map.of()));
        assertThrows(SecurityException.class, () -> provider.query(actor(null), List.of("DEPARTMENT"), Map.of()), "no department, nothing to see");
        assertThrows(SecurityException.class, () -> provider.query(actor(" "), List.of("DEPARTMENT"), Map.of()));
    }

    @ParameterizedTest @MethodSource("providers")
    void withoutTheScopeOfAllDepartmentsTheSystemScopeShowsTheOwnDepartmentOnly(ReportMetadataProvider provider) {
        var query = provider.query(actor("Quality Control"), List.of("SYSTEM"), Map.of());
        assertFalse(query.fromWhere().replaceAll("\\s+", "").contains("where(true)"), "the scope of the template does not widen the rule of the module");
        assertTrue(query.fromWhere().contains("lower(trim("));
        assertTrue(query.arguments().contains("Quality Control"));
    }

    @ParameterizedTest @MethodSource("providers")
    void aPersonWhoMaySeeAllDepartmentsSeesAllUnderTheSystemScope(ReportMetadataProvider provider) {
        var allDepartments = providers(ACCESS_OF_ALL_DEPARTMENTS).stream().filter(p -> p.code().equals(provider.code())).findFirst().orElseThrow();
        var query = allDepartments.query(actor("Quality Control"), List.of("SYSTEM"), Map.of());
        assertTrue(query.fromWhere().replaceAll("\\s+", "").contains("where(true)"));
        assertTrue(query.arguments().isEmpty());
    }

    @ParameterizedTest @MethodSource("providers")
    void aPersonWithNoDepartmentUnderTheSystemScopeSeesNothingAndIsNotAnError(ReportMetadataProvider provider) {
        var query = provider.query(actor(null), List.of("SYSTEM"), Map.of());
        assertTrue(query.fromWhere().replaceAll("\\s+", "").contains("where(false)"));
    }

    @ParameterizedTest @MethodSource("providers")
    void theDepartmentIsTheOneOfThePersonNeverOneOfTheRequest(ReportMetadataProvider provider) {
        var query = provider.query(actor("Quality Control"), List.of("DEPARTMENT"), Map.of("department", "another"));
        assertTrue(query.arguments().contains("Quality Control"));
        assertTrue(query.arguments().indexOf("Quality Control") < query.arguments().indexOf("another"), "the scope comes before the filter");
    }

    @ParameterizedTest @MethodSource("providers")
    void aPersonalScopeSeesOnlyWhatIsOfThePerson(ReportMetadataProvider provider) {
        var actor = actor("QA");
        var query = provider.query(actor, List.of("PERSONAL"), Map.of());
        assertTrue(query.arguments().contains(actor.getId()));
        assertFalse(query.fromWhere().replaceAll("\\s+", "").contains("where(true"));
    }

    @ParameterizedTest @MethodSource("providers")
    void aFilterTheTypeDoesNotHaveOrANonTextValueOrALongSearchIsRefused(ReportMetadataProvider provider) {
        assertThrows(IllegalArgumentException.class, () -> provider.query(actor("QA"), List.of("SYSTEM"), Map.of("sql", "select 1")));
        assertThrows(IllegalArgumentException.class, () -> provider.query(actor("QA"), List.of("SYSTEM"), Map.of("search", 5)));
        assertThrows(IllegalArgumentException.class, () -> provider.query(actor("QA"), List.of("SYSTEM"), Map.of("search", "a".repeat(201))));
    }

    @ParameterizedTest @MethodSource("providers")
    void aSearchIsEscapedAndEveryValueIsAParameter(ReportMetadataProvider provider) {
        var query = provider.query(actor("QA"), List.of("SYSTEM"), Map.of("search", "%_\\"));
        assertTrue(query.arguments().stream().anyMatch(a -> "%\\%\\_\\\\%".equals(a)));
        var injected = provider.query(actor("QA"), List.of("SYSTEM"), Map.of(provider.filters().stream().filter(f -> "LOOKUP".equals(f.get("type"))).findFirst().orElseThrow().get("code"), "x' OR true--"));
        assertTrue(injected.arguments().contains("x' OR true--"));
        assertFalse(injected.fromWhere().contains("OR true"));
    }

    @ParameterizedTest @MethodSource("providers")
    void everyFilterIsAcceptedAndEachValueIsOneParameter(ReportMetadataProvider provider) {
        var filters = everyFilter(provider);
        var query = provider.query(actor("QA"), List.of("SYSTEM", "PERSONAL"), filters);
        long marks = query.fromWhere().chars().filter(c -> c == '?').count();
        assertEquals(marks, query.arguments().size(), "one argument for each question mark of the SQL");
        assertTrue(query.arguments().size() >= filters.size());
    }

    @ParameterizedTest @MethodSource("providers")
    void dateRangesAreCheckedInOrderAndWithinOneYear(ReportMetadataProvider provider) {
        var from = provider.filters().stream().filter(f -> "DATE".equals(f.get("type"))).map(f -> f.get("code")).filter(code -> code.endsWith("From")).findFirst();
        if (from.isEmpty()) return; // the compliance report has no date filter
        var to = from.get().substring(0, from.get().length() - 4) + "To";
        assertThrows(IllegalArgumentException.class, () -> provider.query(actor("QA"), List.of("SYSTEM"), Map.of(from.get(), "2026-10-02", to, "2026-10-01")));
        assertThrows(IllegalArgumentException.class, () -> provider.query(actor("QA"), List.of("SYSTEM"), Map.of(from.get(), "2020-01-01", to, "2026-10-01")));
        assertThrows(IllegalArgumentException.class, () -> provider.query(actor("QA"), List.of("SYSTEM"), Map.of(from.get(), "not-a-date")));
    }

    @ParameterizedTest @MethodSource("providers")
    void theContractOfTheTypeIsConsistent(ReportMetadataProvider provider) {
        assertEquals(provider.columns().keySet(), provider.labels().keySet());
        assertTrue(provider.columns().keySet().containsAll(provider.requiredFields()));
        assertTrue(provider.columns().containsKey(provider.defaultSort()));
        var filterCodes = provider.filters().stream().map(f -> f.get("code")).collect(Collectors.toSet());
        assertTrue(filterCodes.containsAll(provider.filterColumns().keySet()));
        assertTrue(provider.columns().keySet().containsAll(provider.filterColumns().values()));
        assertTrue(filterCodes.containsAll(provider.lookupColumns().keySet()));
        provider.lookupColumns().keySet().forEach(code -> assertTrue(provider.columns().containsKey(code), "a lookup shows the label of its column: " + code));
        assertTrue(provider.columns().keySet().containsAll(provider.dateColumns()));
        provider.filters().stream().filter(f -> "DATE".equals(f.get("type"))).map(f -> provider.filterColumns().get(f.get("code")))
                .forEach(column -> assertTrue(provider.dateColumns().contains(column), "the column of a date filter is a date: " + column));
    }

    /** A free text about a person, a hash, an exemption: never a column. (The reason of a void is the one free text on purpose: the screen shows it to the same people.) */
    @ParameterizedTest @MethodSource("providers")
    void noHashFreeTextAboutAPersonOrExemptionIsAColumn(ReportMetadataProvider provider) {
        var forbidden = List.of("content_sha256", "sha256", "absence_reason", "added_reason", "planned_absence", "participation_reason", "remarks", "cancel_reason", "exempt",
                "kind_reason_text", "password", "token", "signature", "avatar", "email", "phone");
        for (var sql : provider.columns().values()) {
            for (var word : forbidden) assertFalse(sql.toLowerCase().contains(word), provider.code() + " must not report " + word + " (" + sql + ")");
        }
    }

    @ParameterizedTest @MethodSource("providers")
    void aMachineCodeIsShownAsItsLabel(ReportMetadataProvider provider) {
        var statusKey = List.of("status", "state", "recordStatus").stream().filter(provider.columns()::containsKey).findFirst().orElseThrow();
        var status = provider.columns().get(statusKey);
        assertTrue(status.contains("when '") || status.contains("then '"), "the status is turned into its label: " + status);
        provider.columns().entrySet().stream().filter(e -> List.of("method", "result", "source", "kind", "state", "activityStatus", "participationRole").contains(e.getKey()))
                .forEach(e -> assertTrue(e.getValue().contains("when '"), e.getKey() + " is turned into its label"));
    }

    @Test
    void theComplianceReportUsesTheRuleOfTheScreenAndNothingElse() {
        var provider = new TrainingComplianceReportMetadataProvider(ACCESS_OF_ONE_DEPARTMENT);
        var query = provider.query(actor("Quality Control"), List.of("DEPARTMENT"), Map.of());
        assertTrue(query.fromWhere().contains(TrainingComplianceService.coverageSql("dep.id")), "the same SQL as the Compliance screens, for each department");
        assertFalse(TrainingComplianceService.coverageSql("dep.id").contains("?"), "the department comes from the outer query, not from a parameter");
        assertTrue(provider.identityColumn().contains("row_id"), "a row is one person and one requirement of the matrix");
    }

    @Test
    void theCodesOfTheTrainingTypesAreDistinctAndStable() {
        var codes = providers().stream().map(ReportMetadataProvider::code).toList();
        assertEquals(List.of("TRAINING_RECORDS", "TRAINING_ACTIVITIES", "TRAINING_PARTICIPANTS", "TRAINING_COMPLIANCE"), codes);
        var all = new ArrayList<>(ReportDocumentSourcesTest.providers().stream().map(ReportMetadataProvider::code).toList());
        all.addAll(codes);
        assertEquals(all.size(), new HashSet<>(all).size());
    }

    @Test
    void aLabelIsBuiltFromCodeAndLabelPairs() {
        assertEquals("case x.s when 'A' then 'Alpha' when 'B' then 'Beta' else x.s end", ReportQueryKit.labelCase("x.s", "A", "Alpha", "B", "Beta"));
    }
}
