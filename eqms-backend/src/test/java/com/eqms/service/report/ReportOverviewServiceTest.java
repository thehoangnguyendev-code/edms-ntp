package com.eqms.service.report;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.EffectivePermissionService;
import com.eqms.service.ReportPlatformService;
import com.eqms.service.training.TrainingAccess;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

/** REPORT-OVERVIEW-2026-11-12: the Reports Overview, the pins and Quality Analytics read only what the person may see, and a figure is never made up. */
class ReportOverviewServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final EffectivePermissionService permissions = mock(EffectivePermissionService.class);
    private final ReportPlatformService reports = mock(ReportPlatformService.class);
    private final TrainingAccess trainingAccess = mock(TrainingAccess.class);
    private final ReportOverviewService service = new ReportOverviewService(jdbc, permissions, reports, trainingAccess, ReportTestVisibility.everything());
    private final List<String> sqls = new ArrayList<>();
    private final List<List<Object>> argLists = new ArrayList<>();
    private final Map<String, Long> counts = new HashMap<>();

    @BeforeEach
    void setUp() {
        // Every count answers by a word of its SQL; a count that nobody set is zero.
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(Object[].class))).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            Object[] args = (Object[]) invocation.getRawArguments()[2];
            sqls.add(sql);
            argLists.add(Arrays.asList(args));
            return counts.entrySet().stream().filter(entry -> sql.contains(entry.getKey())).map(Map.Entry::getValue).findFirst().orElse(0L);
        });
    }

    private UserAccount actor(String department, String... codes) {
        var user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setStatus(UserStatus.Active);
        user.setDepartment(department);
        when(permissions.getEffectivePermissionCodes(user)).thenReturn(Set.of(codes));
        return user;
    }

    // ---- Reports Overview
    @Test
    void everyReadNeedsTheModulePermission() {
        var nobody = actor("QA");
        assertThrows(SecurityException.class, () -> service.overview(nobody));
        assertThrows(SecurityException.class, () -> service.pins(nobody));
        assertThrows(SecurityException.class, () -> service.pin(nobody, "RPT.0001"));
        assertThrows(SecurityException.class, () -> service.unpin(nobody, "RPT.0001"));
        assertThrows(SecurityException.class, () -> service.documentControl(nobody));
        assertThrows(SecurityException.class, () -> service.training(nobody));
        assertThrows(SecurityException.class, () -> service.usage(nobody));
        assertThrows(SecurityException.class, () -> service.overview(null));
        verifyNoInteractions(jdbc);
    }

    @Test
    void onlyWhatNeedsAttentionIsListedWithItsCount() {
        var user = actor("QA", "report.module.view");
        counts.put("status='FAILED'", 1L);
        counts.put("status like 'SUSPENDED%'", 3L);
        counts.put("status='COMPLETED'", 0L);
        var items = (List<Map<String, Object>>) service.overview(user).get("attention");
        assertEquals(List.of("FAILED_RUNS", "SUSPENDED_SCHEDULES"), items.stream().map(i -> i.get("code")).toList());
        assertEquals("1 run failed", items.get(0).get("title"));
        assertEquals("3 schedules suspended", items.get(1).get("title"));
        assertEquals("red", items.get(0).get("tone"));
        assertTrue(items.stream().allMatch(i -> ((Number) i.get("count")).longValue() > 0), "an item with nothing to attend to is not listed");
    }

    @Test
    void nothingToAttendToIsAnEmptyListNotAZeroItem() {
        var items = (List<?>) service.overview(actor("QA", "report.module.view")).get("attention");
        assertTrue(items.isEmpty());
    }

    @Test
    void aPersonSeesTheirOwnRunsAndSchedulesAndAnApproverAlsoTheTemplatesWaiting() {
        var user = actor("QA", "report.module.view");
        service.overview(user);
        assertTrue(argLists.stream().allMatch(args -> args.equals(List.of(user.getId()))), "every count is of the person's own runs and schedules");
        assertFalse(sqls.stream().anyMatch(sql -> sql.contains("PENDING_APPROVAL")), "a person who cannot approve is not shown what waits for approval");
        counts.put("approval_status='PENDING_APPROVAL'", 2L);
        sqls.clear();
        var approver = actor("QA", "report.module.view", "reports.definition.approve");
        var items = (List<Map<String, Object>>) service.overview(approver).get("attention");
        assertEquals("2 templates waiting for approval", items.stream().filter(i -> "TEMPLATES_TO_APPROVE".equals(i.get("code"))).findFirst().orElseThrow().get("title"));
    }

    @Test
    void aPersonWhoMayViewAllRunsAndManageSchedulesSeesAll() {
        var user = actor("QA", "report.module.view", "reports.run.view_all", "reports.schedule.manage");
        service.overview(user);
        assertTrue(argLists.stream().allMatch(List::isEmpty), "no condition on the person");
    }

    // ---- Pins
    @Test
    void aPinIsRefusedForAReportThePersonCannotRunAndForTooManyPins() {
        var user = actor("QA", "report.module.view");
        when(reports.catalog(user)).thenReturn(List.of(Map.of("code", "RPT.0001")));
        assertEquals("REPORT_TEMPLATE_NOT_FOUND", assertThrows(IllegalArgumentException.class, () -> service.pin(user, "RPT.0099")).getMessage());
        assertThrows(IllegalArgumentException.class, () -> service.pin(user, " "));
        assertThrows(IllegalArgumentException.class, () -> service.pin(user, "R".repeat(101)));
        counts.put("from report_pins", 20L);
        assertEquals("REPORT_PIN_LIMIT", assertThrows(IllegalArgumentException.class, () -> service.pin(user, "RPT.0001")).getMessage());
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void aPinIsStoredForThePersonAndOnlyIfTheyMayRunTheReport() {
        var user = actor("QA", "report.module.view");
        when(reports.catalog(user)).thenReturn(List.of(Map.of("code", "RPT.0001")));
        service.pin(user, "RPT.0001");
        verify(jdbc).update(contains("insert into report_pins"), eq(user.getId()), eq("RPT.0001"));
        service.unpin(user, "RPT.0001");
        verify(jdbc).update(contains("delete from report_pins"), eq(user.getId()), eq("RPT.0001"));
    }

    @Test
    void aPinedReportThatThePersonMayNoLongerRunIsNotListed() {
        var user = actor("QA", "report.module.view");
        when(reports.catalog(user)).thenReturn(List.of(Map.of("code", "RPT.0001")));
        when(jdbc.queryForList(contains("from report_pins"), any(Object[].class))).thenReturn(List.of(Map.of("code", "RPT.0001", "name", "A"), Map.of("code", "RPT.0002", "name", "B")));
        var pins = service.pins(user);
        assertEquals(List.of("RPT.0001"), pins.stream().map(p -> p.get("code")).toList(), "a pin grants nothing");
    }

    // ---- Analytics
    @Test
    void eachSectionNeedsThePermissionOfItsModule() {
        var reportsOnly = actor("QA", "report.module.view");
        assertThrows(SecurityException.class, () -> service.documentControl(reportsOnly));
        assertThrows(SecurityException.class, () -> service.training(reportsOnly));
        assertDoesNotThrow(() -> when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of()));
        assertNotNull(service.usage(reportsOnly), "the use of the reports needs the module permission only");
        var documentsOnly = actor("QA", "report.module.view", "training.compliance.view");
        assertThrows(SecurityException.class, () -> service.documentControl(documentsOnly), "the Training permission does not open Document Control");
    }

    /**
     * A Java text block drops the spaces at the end of its lines, so "where " followed by an appended condition became "wheretrue" and the Document Control figures failed with an SQL error on
     * DEV (found 2026-11-13, not by a unit test). The SQL that reaches the database must have a space after every keyword that an appended condition follows.
     */
    @Test
    void theDocumentControlSqlIsWellFormedWhereAConditionIsAppended() {
        var user = actor("QA", "report.module.view", "documents.module.view");
        var seen = new ArrayList<String>();
        when(jdbc.queryForMap(anyString(), any(Object[].class))).thenAnswer(invocation -> {
            seen.add(invocation.getArgument(0));
            return new HashMap<String, Object>(Map.of("effective", 0L, "revised90", 0L, "review_due", 0L, "review_overdue", 0L, "out", 0L, "expired", 0L));
        });
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenAnswer(invocation -> {
            seen.add(invocation.getArgument(0));
            return List.of();
        });
        try { service.documentControl(user); } catch (RuntimeException ignored) { /* only the SQL is looked at */ }
        assertFalse(seen.isEmpty());
        for (String sql : seen) assertFalse(java.util.regex.Pattern.compile("(?i)(?<![._\\w])(where|and|from|on)(?=[a-z0-9(])").matcher(sql).find(), "a keyword is stuck to what follows it: " + sql);
    }

    @Test
    void aTrainingFigureOfAPersonWithNoDepartmentIsNotZeroItIsANote() {
        var user = actor(null, "report.module.view", "training.compliance.view");
        var result = service.training(user);
        assertEquals("NO_DEPARTMENT", result.get("note"));
        assertEquals(1, result.size(), "no figure is given");
        verifyNoInteractions(jdbc);
    }

    @Test
    void theTrainingFiguresAreOfTheOwnDepartmentUnlessThePersonMaySeeAll() {
        var user = actor("Quality Control", "report.module.view", "training.activity.view");
        when(jdbc.queryForMap(anyString(), any(Object[].class))).thenReturn(Map.of("required", 0L, "ok", 0L, "missing", 0L, "due", 0L));
        var result = service.training(user);
        assertTrue(argLists.stream().allMatch(args -> args.equals(List.of("Quality Control"))), "every count is of the own department");
        assertNull(result.get("percentTrained"), "no requirement, no percentage: not 0%");
        reset(trainingAccess);
        when(trainingAccess.allDepartments(user)).thenReturn(true);
        argLists.clear();
        service.training(user);
        assertTrue(argLists.stream().allMatch(List::isEmpty), "no condition of department");
    }

    @Test
    void theUseOfTheReportsIsOfThePersonUnlessTheyMayViewAllRuns() {
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());
        var user = actor("QA", "report.module.view");
        assertEquals(false, service.usage(user).get("allUsers"));
        assertTrue(argLists.stream().allMatch(args -> args.equals(List.of(user.getId()))));
        argLists.clear();
        var all = actor("QA", "report.module.view", "reports.run.view_all");
        assertEquals(true, service.usage(all).get("allUsers"));
        assertTrue(argLists.stream().allMatch(List::isEmpty));
    }
}
