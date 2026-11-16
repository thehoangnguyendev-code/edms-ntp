package com.eqms.service;

import com.eqms.dto.navigation.NavigationItemResponse;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Making and approving a report template is work of Reports, not an administration setting (REPORT-TEMPLATE-MENU-2026-11-15). */
class NavigationReportTemplatesTest {
    private List<NavigationItemResponse> menuFor(String... permissions) {
        var configuration = mock(SystemConfigurationService.class);
        when(configuration.isFeatureEnabled(anyString())).thenReturn(true);
        var all = new java.util.HashSet<>(Set.of(permissions));
        return new NavigationService(configuration).getNavigation(all);
    }

    private static NavigationItemResponse find(List<NavigationItemResponse> items, String id) {
        for (var item : items) {
            if (id.equals(item.id())) return item;
            if (item.children() != null) {
                var found = find(item.children(), id);
                if (found != null) return found;
            }
        }
        return null;
    }

    @Test
    void aPersonWhoOnlyRunsReportsSeesNeitherTheTemplatesNorTheirRevisions() {
        var menu = menuFor("report.module.view");
        assertNotNull(find(menu, "report-templates"));
        assertNull(find(menu, "report-template-management"));
        assertNull(find(menu, "report-template-revisions"));
    }

    @Test
    void aPersonWhoMayManageTemplatesSeesThemAndTheirRevisionsInReportsAndNotInReportAdministration() {
        var menu = menuFor("report.module.view", "reports.definition.view", "reports.properties.view");
        var templates = find(menu, "report-template-management");
        assertNotNull(templates);
        assertEquals("/report/template-management", templates.path());
        var all = find(menu, "report-template-revisions-all");
        assertNotNull(all);
        assertEquals("/report/template-revisions", all.path());
        assertNull(find(menu, "report-template-revisions-pending"), "no approval permission, no Pending My Approval");
        assertNull(find(menu, "report-admin-definitions"), "Report Definitions is no longer an administration screen");
        assertNotNull(find(menu, "report-admin-properties"), "the settings stay in Report Administration");
    }

    @Test
    void anApproverSeesPendingMyApprovalUnderTheRevisions() {
        var menu = menuFor("report.module.view", "reports.definition.view", "reports.definition.approve_gmp");
        var pending = find(menu, "report-template-revisions-pending");
        assertNotNull(pending);
        assertEquals("/report/template-revisions/pending-approval", pending.path());
    }

    /** REPORT-MENU-2026-11-15: Legal Hold Register and Delivery Log are tabs of Run History and Scheduled Reports, so they are no longer menu entries. */
    @Test
    void theRegistersThatFollowTheReportsAreTabsAndNotMenuEntries() {
        var menu = menuFor("report.module.view", "reports.definition.view", "reports.properties.view");
        assertNull(find(menu, "report-legal-holds"));
        assertNull(find(menu, "report-delivery-log"));
        assertNull(find(menu, "report-admin-retention"));
        assertNull(find(menu, "report-admin-delivery"));
    }

    @Test
    void theMenuHasFourEntriesAndEveryScreenIsStillReachable() {
        var menu = menuFor("report.module.view", "reports.definition.view", "reports.definition.approve");
        var report = find(menu, "report");
        assertNotNull(report);
        assertEquals(List.of("report-templates", "report-history", "report-scheduled", "report-template-group"), report.children().stream().map(NavigationItemResponse::id).toList());
        assertEquals("/report/templates", find(menu, "report-templates").path());
        assertEquals("/report/history", find(menu, "report-history").path());
        assertNull(find(menu, "report-dashboards"), "no Dashboards group and no Reports Overview");
        assertNull(find(menu, "report-reports"), "no Reports group");
        assertNull(find(menu, "report-overview"));
        assertEquals("/report/scheduled", find(menu, "report-scheduled").path());
        assertEquals(List.of("/report/template-management", "/report/template-revisions", "/report/template-revisions/pending-approval"),
                find(menu, "report-template-group").children().stream().map(NavigationItemResponse::path).toList());
        // A person who only runs reports has no template group.
        assertNull(find(menuFor("report.module.view"), "report-template-group"));
    }
}
