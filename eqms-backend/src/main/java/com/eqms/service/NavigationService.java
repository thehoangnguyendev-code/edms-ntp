package com.eqms.service;

import com.eqms.dto.navigation.NavigationItemResponse;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class NavigationService {

    private static final Map<String, Set<String>> PERMISSION_ALIASES = Map.ofEntries(
            Map.entry("DOCUMENTS.MODULE.VIEW", Set.of("VIEW_DOCUMENTS")),
            Map.entry("DOCUMENTS.REVISION.REVIEW", Set.of("REVIEW_DOCUMENTS", "COMPLETE_REVIEW")),
            Map.entry("DOCUMENTS.REVISION.APPROVE", Set.of("APPROVE_DOCUMENTS", "APPROVE_REVISION")),
            Map.entry("DOCUMENTS.REVISION.PUBLISH", Set.of("PUBLISH_DOCUMENTS", "PUBLISH_REVISION")),
            Map.entry("REPORT.MODULE.VIEW", Set.of("VIEW_REPORTS")),
            Map.entry("AUDITTRAIL.MODULE.VIEW", Set.of("VIEW_AUDIT_TRAIL"))
    );

    private final SystemConfigurationService systemConfigurationService;

    public NavigationService(SystemConfigurationService systemConfigurationService) {
        this.systemConfigurationService = systemConfigurationService;
    }

    /**
     * Every menu item is gated purely by the caller's actual granted permission codes
     * (resolved from their Access Profile). There is no super-admin bypass here — per GMP
     * Segregation of Duties, visibility must come from explicit grants, including for admins.
     */
    public List<NavigationItemResponse> getNavigation(Set<String> permissions) {
        Set<String> normalizedPermissions = permissions == null
                ? Set.of()
                : permissions.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(value -> value.trim().toUpperCase(Locale.ROOT))
                .collect(Collectors.toSet());

        List<NavigationItemResponse> menu = new ArrayList<>();

        if (hasPermission(normalizedPermissions, "notifications.module.view")
                && systemConfigurationService.isFeatureEnabled("feat-notifications")) {
            menu.add(new NavigationItemResponse("notifications", "Notifications", "Bell", "/notifications", false, null));
        }
        if (hasPermission(normalizedPermissions, "dashboard.module.view")
                && systemConfigurationService.isFeatureEnabled("feat-dashboard")) {
            menu.add(new NavigationItemResponse("dashboard", "Dashboard", "IconLayoutGrid", "/dashboard", true, null));
        }
        if (hasPermission(normalizedPermissions, "documents.module.view")
                && systemConfigurationService.isFeatureEnabled("feat-edms")) {
            List<NavigationItemResponse> docChildren = new ArrayList<>();
            if (systemConfigurationService.isFeatureEnabled("feat-edms-kb")) {
                docChildren.add(new NavigationItemResponse("knowledge-base", "Knowledge Base", null, "/documents/knowledge", false, null));
            }
            if (systemConfigurationService.isFeatureEnabled("feat-edms-owned")) {
                docChildren.add(new NavigationItemResponse("doc-owned-me", "Documents Owned By Me", null, "/documents/owned", false, null));
            }
            if (systemConfigurationService.isFeatureEnabled("feat-edms-all")) {
                docChildren.add(new NavigationItemResponse("doc-all", "All Documents", null, "/documents/all", false, null));
            }

            if (systemConfigurationService.isFeatureEnabled("feat-edms-revisions")) {
                List<NavigationItemResponse> revisionChildren = new ArrayList<>();
                revisionChildren.add(new NavigationItemResponse("rev-owned-me", "Revisions Owned By Me", null, "/documents/revisions/owned", false, null));
                revisionChildren.add(new NavigationItemResponse("rev-all", "All Revisions", null, "/documents/revisions/all", false, null));
                revisionChildren.add(new NavigationItemResponse("pending-review", "Pending My Review", null, "/documents/revisions/pending-review", false, null));
                revisionChildren.add(new NavigationItemResponse("pending-approval", "Pending My Approval", null, "/documents/revisions/pending-approval", false, null));
                docChildren.add(new NavigationItemResponse("doc-revisions", "Document Revisions", null, null, false, revisionChildren));
            }

            if (systemConfigurationService.isFeatureEnabled("feat-edms-copies")) {
                List<NavigationItemResponse> copyChildren = new ArrayList<>();
                copyChildren.add(new NavigationItemResponse("cc-all", "All Controlled Copies", null, "/documents/controlled-copies/all", false, null));
                copyChildren.add(new NavigationItemResponse("cc-ready", "Ready for Distribution", null, "/documents/controlled-copies/ready", false, null));
                copyChildren.add(new NavigationItemResponse("cc-distributed", "Distributed Copies", null, "/documents/controlled-copies/distributed", false, null));
                docChildren.add(new NavigationItemResponse("controlled-copies", "Controlled Copies", null, null, false, copyChildren));
            }

            if (!docChildren.isEmpty()) {
                menu.add(new NavigationItemResponse("doc-control", "Document Control", "IconFileDescription", null, false, docChildren));
            }
        }

        if (hasPermission(normalizedPermissions, "training.module.view")
                && systemConfigurationService.isFeatureEnabled("feat-tms")) {
            List<NavigationItemResponse> trainingChildren = new ArrayList<>();
            if (systemConfigurationService.isFeatureEnabled("feat-tms-my")) {
                trainingChildren.add(new NavigationItemResponse("my-training", "My Training", null, "/training-management/my-training", false, null));
            }
            if (systemConfigurationService.isFeatureEnabled("feat-tms-materials")) {
                trainingChildren.add(new NavigationItemResponse("training-materials", "Training Materials", null, "/training-management/materials", false, null));
            }

            if (systemConfigurationService.isFeatureEnabled("feat-tms-courses")) {
                List<NavigationItemResponse> courseChildren = new ArrayList<>();
                courseChildren.add(new NavigationItemResponse("courses-list", "Courses List", null, "/training-management/courses-list", false, null));
                courseChildren.add(new NavigationItemResponse("training-pending-review", "Pending Review", null, "/training-management/pending-review", false, null));
                courseChildren.add(new NavigationItemResponse("training-pending-approval", "Pending Approval", null, "/training-management/pending-approval", false, null));
                trainingChildren.add(new NavigationItemResponse("course-inventory", "Course Inventory", null, null, false, courseChildren));
            }

            if (systemConfigurationService.isFeatureEnabled("feat-tms-compliance")) {
                List<NavigationItemResponse> complianceChildren = new ArrayList<>();
                complianceChildren.add(new NavigationItemResponse("auto-assignment-rules", "Auto-Assignment Rules", null, "/training-management/assignment-rules", false, null));
                complianceChildren.add(new NavigationItemResponse("training-matrix", "Training Matrix", null, "/training-management/training-matrix", false, null));
                complianceChildren.add(new NavigationItemResponse("course-status", "Course Status", null, "/training-management/course-status", false, null));
                trainingChildren.add(new NavigationItemResponse("compliance-tracking", "Compliance Tracking", null, null, false, complianceChildren));
            }

            if (systemConfigurationService.isFeatureEnabled("feat-tms-records")) {
                List<NavigationItemResponse> recordsChildren = new ArrayList<>();
                recordsChildren.add(new NavigationItemResponse("employee-training-files", "Employee Training Files", null, "/training-management/employee-training-files", false, null));
                recordsChildren.add(new NavigationItemResponse("export-records", "Export Records", null, "/training-management/export-records", false, null));
                trainingChildren.add(new NavigationItemResponse("records-archive", "Records & Archive", null, null, false, recordsChildren));
            }

            if (!trainingChildren.isEmpty()) {
                menu.add(new NavigationItemResponse("training-management", "Training Management", "GraduationCap", null, false, trainingChildren));
            }
        }

        if (hasPermission(normalizedPermissions, "report.module.view")
                && systemConfigurationService.isFeatureEnabled("feat-system-reports")) {
            List<NavigationItemResponse> reportChildren = new ArrayList<>();
            reportChildren.add(new NavigationItemResponse("report-templates", "Report Templates", null, "/report/templates", false, null));
            reportChildren.add(new NavigationItemResponse("report-compliance", "Compliance Reports", null, "/report/compliance", false, null));
            reportChildren.add(new NavigationItemResponse("report-history", "Report History", null, "/report/history", false, null));
            reportChildren.add(new NavigationItemResponse("report-scheduled", "Scheduled Reports", null, "/report/scheduled", false, null));
            menu.add(new NavigationItemResponse("report", "Reports & Analytics", "IconChartBar", null, false, reportChildren));
        }

        if (hasPermission(normalizedPermissions, "audittrail.module.view")
                && systemConfigurationService.isFeatureEnabled("feat-system-audit-trail")) {
            List<NavigationItemResponse> auditChildren = new ArrayList<>();
            if (hasPermission(normalizedPermissions, "audittrail.module.view")) {
                auditChildren.add(new NavigationItemResponse("audit-trail-all", "All Records", null, "/audit-trail", false, null));
            }
            if (hasPermission(normalizedPermissions, "audit.review.view")) {
                auditChildren.add(new NavigationItemResponse("audit-trail-review", "Periodic Review", null, "/audit-trail/reviews", false, null));
            }
            if (!auditChildren.isEmpty()) {
                menu.add(new NavigationItemResponse("audit-trail", "Audit Trail", "IconFilter2Search", null, true, auditChildren));
            }
        }

        List<NavigationItemResponse> securityChildren = new ArrayList<>();
        // Phase 4 Authorization Console (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md §5.3) --
        // this server-side list is the authoritative source Sidebar.tsx filters against
        if (hasPermission(normalizedPermissions, "settings.user.view")) {
            securityChildren.add(new NavigationItemResponse("sec-user-management", "User Management", "IconUsers", "/settings/users", false, null));
        }
        if (hasPermission(normalizedPermissions, "security.access_profiles.view")) {
            securityChildren.add(new NavigationItemResponse("sec-access-profiles", "Access Profiles", "IconUserKey", "/security/access-profiles", false, null));
        }
        if (hasPermission(normalizedPermissions, "security.workflow_authorization.view")) {
            securityChildren.add(new NavigationItemResponse("sec-workflow-authorization", "Workflow Authorization", "IconSwitch2", "/security/lifecycle-policies", false, null));
            securityChildren.add(new NavigationItemResponse("sec-authorization-diagnostics", "Engine Diagnostics", "IconActivity", "/security/authorization-diagnostics", false, null));
        }
        if (hasPermission(normalizedPermissions, "security.access_review.view")) {
            securityChildren.add(new NavigationItemResponse("sec-access-review", "Access Review", "ScanSearch", "/security/access-review", false, null));
        }

        List<NavigationItemResponse> securityAdvancedChildren = new ArrayList<>();
        if (hasPermission(normalizedPermissions, "security.permission_sets.view")) {
            securityAdvancedChildren.add(new NavigationItemResponse("sec-permission-sets", "Shared Permission Sets", null, "/security/permission-sets", false, null));
        }
        if (hasPermission(normalizedPermissions, "security.workflow_authorization.view")) {
            securityAdvancedChildren.add(new NavigationItemResponse("sec-workflow-role-catalog", "Workflow Role Catalog", null, "/security/advanced/workflow-roles", false, null));
        }
        if (hasPermission(normalizedPermissions, "security.object_rules.view")) {
            securityAdvancedChildren.add(new NavigationItemResponse("sec-object-rules", "Object Access Rules", null, "/security/object-rules", false, null));
        }
        if (hasPermission(normalizedPermissions, "security.sod.view")) {
            securityAdvancedChildren.add(new NavigationItemResponse("sec-sod", "Segregation of Duties", null, "/security/sod", false, null));
        }
        if (!securityAdvancedChildren.isEmpty()) {
            securityChildren.add(new NavigationItemResponse("sec-advanced", "Advanced", "BrickWallShield", null, false, securityAdvancedChildren));
        }

        if (!securityChildren.isEmpty()) {
            menu.add(new NavigationItemResponse("security-authorization", "Security & Authorization", "ShieldCheck", null, false, securityChildren));
        }

        if (systemConfigurationService.isFeatureEnabled("feat-system-settings")) {
            List<NavigationItemResponse> settingsChildren = new ArrayList<>();
            if (hasPermission(normalizedPermissions, "settings.configuration.view")) {
                settingsChildren.add(new NavigationItemResponse("dictionaries", "Dictionaries", "BookText", "/settings/dictionaries", false, null));
                settingsChildren.add(new NavigationItemResponse("email-templates", "Email Templates", "IconMailForward", "/settings/email-templates", false, null));
                settingsChildren.add(new NavigationItemResponse("notification-policy", "Notification In-app", "Bell", "/settings/notification-policy", false, null));
            }
            if (hasPermission(normalizedPermissions, "reports.definition.view") || hasPermission(normalizedPermissions, "settings.configuration.view")) {
                settingsChildren.add(new NavigationItemResponse("report-configuration", "Report Configuration", "IconFileDescription", "/settings/report-configuration", false, null));
            }

            List<NavigationItemResponse> docControlSettingsChildren = new ArrayList<>();
            if (hasPermission(normalizedPermissions, "settings.configuration.view")
                    || hasPermission(normalizedPermissions, "settings.publishing_template.view")) {
                docControlSettingsChildren.add(new NavigationItemResponse("publishing-templates", "Publishing Templates", null, "/settings/publishing-templates", false, null));
            }
            if (hasPermission(normalizedPermissions, "settings.controlled_copy_policy.view")) {
                docControlSettingsChildren.add(new NavigationItemResponse("controlled-copy-policy", "Controlled Copies Policy", null, "/settings/controlled-copy-policy", false, null));
            }
            if (!docControlSettingsChildren.isEmpty()) {
                settingsChildren.add(new NavigationItemResponse("settings-document-control", "Document Control", "IconFileDescription", null, false, docControlSettingsChildren));
            }

            if (!settingsChildren.isEmpty()) {
                menu.add(new NavigationItemResponse("settings", "Application Settings", "IconSettings2", null, false, settingsChildren));
            }
        }

        if (systemConfigurationService.isFeatureEnabled("feat-system-admin")
                && hasPermission(normalizedPermissions, "settings.configuration.view")) {
            List<NavigationItemResponse> sysAdminChildren = new ArrayList<>();
            sysAdminChildren.add(new NavigationItemResponse("config", "Configuration", "IconDeviceDesktopCog", "/settings/configuration", false, null));
            sysAdminChildren.add(new NavigationItemResponse("electronic-signature-policies", "E-Sign Config", "PenTool", "/settings/electronic-signature", false, null));
            sysAdminChildren.add(new NavigationItemResponse("info-sys", "System Information", "IconAlertSquareRounded", "/settings/system-info", false, null));
            menu.add(new NavigationItemResponse("system-administration", "System Administration", "UserStar", null, false, sysAdminChildren));
        }

        if (hasPermission(normalizedPermissions, "preferences.module.view")
                && systemConfigurationService.isFeatureEnabled("feat-system-preferences")) {
            menu.add(new NavigationItemResponse("preferences", "Preferences", "IconAdjustmentsHorizontal", "/preferences", false, null));
        }

        return applyConfiguredLabels(menu, systemConfigurationService.getNavigationLabelOverrides());
    }

    private List<NavigationItemResponse> applyConfiguredLabels(
            List<NavigationItemResponse> items,
            Map<String, String> overrides
    ) {
        if (items == null || items.isEmpty() || overrides == null || overrides.isEmpty()) {
            return items;
        }
        return items.stream()
                .map(item -> new NavigationItemResponse(
                        item.id(),
                        overrides.getOrDefault(item.id(), item.label()),
                        item.icon(),
                        item.path(),
                        item.showDividerAfter(),
                        applyConfiguredLabels(item.children(), overrides)
                ))
                .toList();
    }

    public List<FlatMenuItem> searchNavigation(String query, Set<String> permissions) {
        if (query == null || query.isBlank()) {
            return Collections.emptyList();
        }
        String q = query.trim().toLowerCase(Locale.ROOT);
        List<NavigationItemResponse> menu = getNavigation(permissions);
        List<FlatMenuItem> flatList = new ArrayList<>();
        flattenAndFilter(menu, null, null, q, flatList);

        if (flatList.size() > 8) {
            return flatList.subList(0, 8);
        }
        return flatList;
    }

    private boolean hasPermission(Set<String> permissions, String code) {
        String normalizedCode = code.trim().toUpperCase(Locale.ROOT);
        if (permissions.contains("*") || permissions.contains(normalizedCode)) {
            return true;
        }
        return PERMISSION_ALIASES.getOrDefault(normalizedCode, Set.of()).stream()
                .anyMatch(permissions::contains);
    }

    private void flattenAndFilter(List<NavigationItemResponse> items, String parentLabel, String parentIcon, String query, List<FlatMenuItem> result) {
        if (items == null) return;
        for (NavigationItemResponse item : items) {
            String fullLabel = parentLabel != null ? parentLabel + " > " + item.label() : item.label();
            String iconToUse = parentIcon != null ? parentIcon : item.icon();

            if (item.path() != null) {
                boolean matches = item.label().toLowerCase(Locale.ROOT).contains(query)
                        || fullLabel.toLowerCase(Locale.ROOT).contains(query);
                if (matches) {
                    result.add(new FlatMenuItem(item.id(), item.label(), iconToUse, item.path(), fullLabel));
                }
            }

            if (item.children() != null) {
                flattenAndFilter(item.children(), fullLabel, iconToUse, query, result);
            }
        }
    }

    public record FlatMenuItem(
            String id,
            String label,
            String icon,
            String path,
            String fullPath
    ) {}
}
