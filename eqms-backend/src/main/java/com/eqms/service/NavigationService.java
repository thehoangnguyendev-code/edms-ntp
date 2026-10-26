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
        // Every authenticated user has a private calendar. Source data retains its own authorization.
        menu.add(new NavigationItemResponse("calendar", "Calendar", "CalendarDays", "/calendar", false, null));
        // Self-Service groups the two personal-workspace surfaces (Dashboard, Knowledge) that used
        // to live at top-level / nested inside Document Control -- shown if either child is visible.
        List<NavigationItemResponse> selfServiceChildren = new ArrayList<>();
        if (hasPermission(normalizedPermissions, "dashboard.module.view")
                && systemConfigurationService.isFeatureEnabled("feat-dashboard")) {
            selfServiceChildren.add(new NavigationItemResponse("dashboard", "Dashboard", "IconLayoutGrid", "/dashboard", false, null));
        }
        if (hasPermission(normalizedPermissions, "self_service.knowledge.view")
                && systemConfigurationService.isFeatureEnabled("feat-edms-kb")) {
            selfServiceChildren.add(new NavigationItemResponse("knowledge-base", "Knowledge", null, "/self-service/knowledge", false, null));
        }
        if (!selfServiceChildren.isEmpty()) {
            menu.add(new NavigationItemResponse("self-service", "Self-Service", "IconLayoutGrid", null, true, selfServiceChildren));
        }
        if (hasPermission(normalizedPermissions, "documents.module.view")
                && systemConfigurationService.isFeatureEnabled("feat-edms")) {
            List<NavigationItemResponse> docChildren = new ArrayList<>();
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
                // Uncontrolled Copies: a separate feature/table/API from Controlled Copies, listed as a sibling node.
                if (hasAnyPermission(normalizedPermissions, "documents.uncontrolled_copy.view", "documents.uncontrolled_copy.request")) {
                    List<NavigationItemResponse> uncontrolledChildren = new ArrayList<>();
                    uncontrolledChildren.add(new NavigationItemResponse("uc-all", "All Uncontrolled Copies", null, "/documents/uncontrolled-copies/all", false, null));
                    uncontrolledChildren.add(new NavigationItemResponse("uc-pending-approval", "Pending Approval", null, "/documents/uncontrolled-copies/pending-approval", false, null));
                    uncontrolledChildren.add(new NavigationItemResponse("uc-distributed", "Distributed Copies", null, "/documents/uncontrolled-copies/distributed", false, null));
                    docChildren.add(new NavigationItemResponse("uncontrolled-copies", "Uncontrolled Copies", null, null, false, uncontrolledChildren));
                }
            }

            // Records: the scan of every returned paper copy. The server shows each user only the records of copies they may see.
            if (hasPermission(normalizedPermissions, "documents.form.view_executed_records")) {
                docChildren.add(new NavigationItemResponse("records", "Records", null, "/documents/records", false, null));
            }

            if (!docChildren.isEmpty()) {
                menu.add(new NavigationItemResponse("doc-control", "Document Control", "IconFileDescription", null, false, docChildren));
            }
        }

        if (hasPermission(normalizedPermissions, "training.module.view")
                && systemConfigurationService.isFeatureEnabled("feat-tms")) {
            List<NavigationItemResponse> trainingChildren = new ArrayList<>();
            // My Training stands alone at the top: it is the page every person uses. The other pages are grouped by what they are for.
            if (hasPermission(normalizedPermissions, "training.self.view")) {
                trainingChildren.add(new NavigationItemResponse("my-training", "My Training", null, "/training-management/my-training", false, null));
            }
            List<NavigationItemResponse> planning = new ArrayList<>();
            if (hasPermission(normalizedPermissions, "training.requirement.view")) {
                planning.add(new NavigationItemResponse("training-requirements", "Training Requirements", null, "/training-management/requirements", false, null));
            }
            if (hasPermission(normalizedPermissions, "training.activity.view")) {
                planning.add(new NavigationItemResponse("training-activities", "Training Activities", null, "/training-management/activities", false, null));
            }
            if (hasPermission(normalizedPermissions, "training.matrix.view")) {
                planning.add(new NavigationItemResponse("training-matrices", "Training Matrices", null, "/training-management/matrices", false, null));
            }
            if (hasPermission(normalizedPermissions, "training.assessment.design") || hasPermission(normalizedPermissions, "training.assessment.approve")) {
                planning.add(new NavigationItemResponse("training-assessments", "Training Assessments", null, "/training-management/assessments", false, null));
            }
            if (hasPermission(normalizedPermissions, "training.matrix.view")) {
                planning.add(new NavigationItemResponse("training-document-trainings", "Document Trainings", null, "/training-management/document-trainings", false, null));
            }
            if (!planning.isEmpty()) {
                trainingChildren.add(new NavigationItemResponse("training-planning", "Training Programme", null, null, false, planning));
            }
            List<NavigationItemResponse> people = new ArrayList<>();
            if (hasPermission(normalizedPermissions, "training.job_assignment.view")) {
                people.add(new NavigationItemResponse("training-job-assignments", "Job Assignments", null, "/training-management/job-assignments", false, null));
                people.add(new NavigationItemResponse("training-personnel-reviews", "Training Reviews", null, "/training-management/personnel-reviews", false, null));
            }
            if (hasPermission(normalizedPermissions, "training.signature.view") || hasPermission(normalizedPermissions, "training.signature.manage")
                    || hasPermission(normalizedPermissions, "training.signature.confirm") || hasPermission(normalizedPermissions, "training.self.view")) {
                people.add(new NavigationItemResponse("training-specimen-signatures", "Specimen Signatures", null, "/training-management/specimen-signatures", false, null));
            }
            if (!people.isEmpty()) {
                trainingChildren.add(new NavigationItemResponse("training-people", "Personnel Qualification", null, null, false, people));
            }
            List<NavigationItemResponse> records = new ArrayList<>();
            if (hasPermission(normalizedPermissions, "training.record.view")) {
                records.add(new NavigationItemResponse("training-records", "Training Records", null, "/training-management/records", false, null));
            }
            if (hasPermission(normalizedPermissions, "training.compliance.view")) {
                records.add(new NavigationItemResponse("training-compliance", "Training Compliance", null, "/training-management/compliance", false, null));
                records.add(new NavigationItemResponse("training-number-log", "Training Number Register", null, "/training-management/number-log", false, null));
            }
            if (hasPermission(normalizedPermissions, "training.record.export")) {
                records.add(new NavigationItemResponse("training-record-exports", "Training Record Exports", null, "/training-management/record-exports", false, null));
            }
            if (hasPermission(normalizedPermissions, "training.activity.view")) {
                records.add(new NavigationItemResponse("training-legacy-evidence", "Legacy Training Evidence", null, "/training-management/legacy-evidence", false, null));
            }
            if (!records.isEmpty()) {
                trainingChildren.add(new NavigationItemResponse("training-records-compliance", "Training Records & Compliance", null, null, false, records));
            }
            if (!trainingChildren.isEmpty()) {
                menu.add(new NavigationItemResponse("training-management", "Training Management", "GraduationCap", null, false, trainingChildren));
            }
        }

        if (hasPermission(normalizedPermissions, "report.module.view")
                && systemConfigurationService.isFeatureEnabled("feat-system-reports")) {
            List<NavigationItemResponse> reportChildren = new ArrayList<>();
            // REPORT-ANALYTICS-PRODUCTION-2026-10-14: the analytics screens are sample-data previews, listed only when enabled.
            if (systemConfigurationService.isFeatureEnabled("feat-report-analytics")) {
                reportChildren.add(new NavigationItemResponse("report-overview", "Reports Overview", null, "/report/overview", false, null));
                reportChildren.add(new NavigationItemResponse("report-analytics", "Quality Analytics", null, "/report/analytics", false, null));
            }
            reportChildren.add(new NavigationItemResponse("report-templates", "Report Library", null, "/report/templates", false, null));
            reportChildren.add(new NavigationItemResponse("report-history", "Report Run History", null, "/report/history", false, null));
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
                menu.add(new NavigationItemResponse("audit-trail", "Audit Trail", "IconFilter2Search", null, false, auditChildren));
            }
        }

        // Backup & Restore: one screen per sub-menu; the UI is a preview until the feature is developed. Gated by its own view permission.
        if (hasPermission(normalizedPermissions, "backup.module.view")) {
            List<NavigationItemResponse> backupChildren = new ArrayList<>();
            backupChildren.add(new NavigationItemResponse("backup-overview", "Backup Status Overview", null, "/backup-restore/overview", false, null));
            List<NavigationItemResponse> backupGroupChildren = new ArrayList<>();
            backupGroupChildren.add(new NavigationItemResponse("backup-backups", "Backup History", null, "/backup-restore/backups", false, null));
            backupGroupChildren.add(new NavigationItemResponse("backup-verifications", "Backup Verification Results", null, "/backup-restore/backups/verifications", false, null));
            backupGroupChildren.add(new NavigationItemResponse("backup-schedules", "Backup Schedules", null, "/backup-restore/backups/schedules", false, null));
            backupGroupChildren.add(new NavigationItemResponse("backup-exports", "Export Requests", null, "/backup-restore/backups/exports", false, null));
            // Each screen is listed only when the person may open it, the same permission its route checks.
            if (hasPermission(normalizedPermissions, "backup.admin.alerts.view")) {
                backupGroupChildren.add(new NavigationItemResponse("backup-alerts", "Backup Alerts & Recipients", null, "/backup-restore/alerts", false, null));
            }
            backupChildren.add(new NavigationItemResponse("backup-group", "Backup", null, null, false, backupGroupChildren));
            List<NavigationItemResponse> restoreGroupChildren = new ArrayList<>();
            restoreGroupChildren.add(new NavigationItemResponse("backup-restores", "Restore Requests", null, "/backup-restore/restores", false, null));
            restoreGroupChildren.add(new NavigationItemResponse("restore-verifications", "Restore Verification Reports", null, "/backup-restore/restores/verification-reports", false, null));
            restoreGroupChildren.add(new NavigationItemResponse("restore-history", "Restore History & Evidence", null, "/backup-restore/restores/history", false, null));
            restoreGroupChildren.add(new NavigationItemResponse("backup-inspections", "Backup Inspections", null, "/backup-restore/restores/inspections", false, null));
            if (hasPermission(normalizedPermissions, "backup.admin.restore_controls.view")) {
                restoreGroupChildren.add(new NavigationItemResponse("restore-rules", "Restore Approval & Execution Rules", null, "/backup-restore/restore-rules", false, null));
            }
            if (hasPermission(normalizedPermissions, "backup.admin.disaster_recovery.view")) {
                restoreGroupChildren.add(new NavigationItemResponse("backup-dr-drills", "Disaster Recovery Drills", null, "/backup-restore/dr-drills", false, null));
            }
            backupChildren.add(new NavigationItemResponse("restore-group", "Restore", null, null, false, restoreGroupChildren));
            menu.add(new NavigationItemResponse("backup-restore", "Backup & Restore", "DatabaseBackup", null, true, backupChildren));
        }

        List<NavigationItemResponse> securityChildren = new ArrayList<>();
        // Phase 4 Authorization Console (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md §5.3) --
        // this server-side list is the authoritative source Sidebar.tsx filters against
        if (hasPermission(normalizedPermissions, "settings.user.view")) {
            // "User Administration" nested group -- User Management, Time-Limited User and
            // Logged in Users all read the same settings.user.view audience; the group only
            // appears (and only once) when at least one child does.
            List<NavigationItemResponse> userAdminChildren = new ArrayList<>();
            userAdminChildren.add(new NavigationItemResponse("sec-user-management", "User Management", null, "/settings/users", false, null));
            userAdminChildren.add(new NavigationItemResponse("sec-time-limited-roles", "Time-Limited User", null, "/settings/users/time-limited", false, null));
            userAdminChildren.add(new NavigationItemResponse("sec-logged-in-users", "Logged in Users", null, "/settings/users/logged-in", false, null));
            securityChildren.add(new NavigationItemResponse("sec-user-administration", "User Administration", "IconUsers", null, false, userAdminChildren));
        }
        if (hasPermission(normalizedPermissions, "security.access_profiles.view")) {
            securityChildren.add(new NavigationItemResponse("sec-access-profiles", "Access Profiles", "IconUserKey", "/security/access-profiles", false, null));
        }
        if (hasPermission(normalizedPermissions, "security.workflow_authorization.view")) {
            securityChildren.add(new NavigationItemResponse("sec-workflow-authorization", "Workflow Authorization", "IconSwitch2", "/security/lifecycle-policies", false, null));
        }
        if (hasPermission(normalizedPermissions, "security.access_review.view")) {
            securityChildren.add(new NavigationItemResponse("sec-access-review", "Access Review", "ScanSearch", "/security/access-review", false, null));
        }
        if (hasAnyPermission(normalizedPermissions, "security.sod.view")) {
            securityChildren.add(new NavigationItemResponse("sec-sod-violation-review", "SoD Violation Review", "BrickWallShield", "/security/sod-violation-review", false, null));
        }

        List<NavigationItemResponse> securityAdvancedChildren = new ArrayList<>();
        if (hasPermission(normalizedPermissions, "security.permission_sets.view")) {
            securityAdvancedChildren.add(new NavigationItemResponse("sec-permission-sets", "Shared Permission Sets", null, "/security/permission-sets", false, null));
        }
        if (hasPermission(normalizedPermissions, "security.workflow_authorization.view")) {
            securityAdvancedChildren.add(new NavigationItemResponse("sec-workflow-role-catalog", "Workflow Role Catalog", null, "/security/advanced/workflow-roles", false, null));
            securityAdvancedChildren.add(new NavigationItemResponse("sec-authorization-diagnostics", "Engine Diagnostics", "IconActivity", "/security/authorization-diagnostics", false, null));
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
            // "Dictionaries" nested group -- each dictionary used to be a tab on one page; now
            // each is its own page/menu entry, in the same left-to-right order the tabs had.
            List<NavigationItemResponse> dictionaryChildren = new ArrayList<>();
            if (hasAnyPermission(normalizedPermissions, "settings.business_unit.view", "settings.business_unit.manage")) {
                dictionaryChildren.add(new NavigationItemResponse("dict-business-units", "Business Units", null, "/settings/dictionaries/business-units", false, null));
            }
            if (hasAnyPermission(normalizedPermissions, "settings.department.view", "settings.department.manage")) {
                dictionaryChildren.add(new NavigationItemResponse("dict-departments", "Departments", null, "/settings/dictionaries/departments", false, null));
            }
            if (hasAnyPermission(normalizedPermissions, "settings.position.view", "settings.position.manage")) {
                dictionaryChildren.add(new NavigationItemResponse("dict-positions", "Positions", null, "/settings/dictionaries/positions", false, null));
            }
            if (hasAnyPermission(normalizedPermissions, "settings.storage_location.view", "settings.storage_location.manage")) {
                dictionaryChildren.add(new NavigationItemResponse("dict-storage-locations", "Storage Locations", null, "/settings/dictionaries/storage-locations", false, null));
            }
            if (hasAnyPermission(normalizedPermissions, "settings.retention_policy.view", "settings.retention_policy.manage")) {
                dictionaryChildren.add(new NavigationItemResponse("dict-retention-policies", "Retention Policies", null, "/settings/dictionaries/retention-policies", false, null));
            }
            if (!dictionaryChildren.isEmpty()) {
                settingsChildren.add(new NavigationItemResponse("dictionaries", "Dictionaries", "BookText", null, false, dictionaryChildren));
            }
            List<NavigationItemResponse> educationChildren = new ArrayList<>();
            if (hasAnyPermission(normalizedPermissions, "settings.education.degree_level.view", "settings.education.degree_level.manage")) {
                educationChildren.add(new NavigationItemResponse("education-degree-levels", "Degree Levels", null, "/settings/education/degree-levels", false, null));
            }
            if (hasAnyPermission(normalizedPermissions, "settings.education.school.view", "settings.education.school.manage")) {
                educationChildren.add(new NavigationItemResponse("education-schools", "Schools", null, "/settings/education/schools", false, null));
            }
            if (!educationChildren.isEmpty()) {
                settingsChildren.add(new NavigationItemResponse("education", "Education", "GraduationCap", null, false, educationChildren));
            }
            if (hasAnyPermission(normalizedPermissions, "settings.email_template.view", "settings.email_template.manage", "settings.configuration.view")) {
                settingsChildren.add(new NavigationItemResponse("email-templates", "Email Templates", "IconMailForward", "/settings/email-templates", false, null));
            }
            if (hasAnyPermission(normalizedPermissions, "settings.announcement.view", "settings.announcement.manage")) {
                settingsChildren.add(new NavigationItemResponse("system-announcements", "System Announcements", "IconSpeakerphone", "/settings/announcements", false, null));
            }
            if (hasPermission(normalizedPermissions, "settings.configuration.view")) {
                settingsChildren.add(new NavigationItemResponse("notification-policy", "Notification In-app", "Bell", "/settings/notification-policy", false, null));
            }

            // "Document Administration" moved to the System Administration group (see below).

            if (!settingsChildren.isEmpty()) {
                menu.add(new NavigationItemResponse("settings", "Application Settings", "IconSettings2", null, false, settingsChildren));
            }
        }

        if (systemConfigurationService.isFeatureEnabled("feat-system-admin")) {
            List<NavigationItemResponse> sysAdminChildren = new ArrayList<>();
            if (hasPermission(normalizedPermissions, "settings.configuration.view")) {
                sysAdminChildren.add(new NavigationItemResponse("config", "Configuration", "IconDeviceDesktopCog", "/settings/configuration", false, null));
                sysAdminChildren.add(new NavigationItemResponse("electronic-signature-policies", "E-Sign Config", "PenTool", "/settings/electronic-signature", false, null));
            }

            // "Document Administration" -- moved here from the Document Control module (was nested
            // under doc-control until this move). Each screen keeps its own, independent
            // documents.admin.<screen>.view permission -- deliberately NOT gated behind
            // settings.configuration.view too, so a Document-Administration-only Access Profile
            // (holding none of the System Administration permissions) still sees this group.
            List<NavigationItemResponse> docAdminChildren = new ArrayList<>();
            if (hasAnyPermission(normalizedPermissions, "documents.admin.properties.view", "documents.admin.properties.manage")) {
                docAdminChildren.add(new NavigationItemResponse("doc-admin-properties", "Document Properties", null, "/documents/administration/properties", false, null));
            }
            if (hasAnyPermission(normalizedPermissions, "documents.admin.name_formats.view", "documents.admin.name_formats.manage")) {
                docAdminChildren.add(new NavigationItemResponse("doc-admin-name-formats", "Document Name Formats", null, "/documents/administration/name-formats", false, null));
                docAdminChildren.add(new NavigationItemResponse("doc-admin-document-components", "Document Components", null, "/documents/administration/document-components", false, null));
            }
            if (hasAnyPermission(normalizedPermissions, "documents.admin.document_types.view", "documents.admin.document_types.manage")) {
                docAdminChildren.add(new NavigationItemResponse("doc-admin-document-types", "Document Types", null, "/documents/administration/document-types", false, null));
                docAdminChildren.add(new NavigationItemResponse("doc-admin-document-sub-types", "Document Sub-Types", null, "/documents/administration/document-sub-types", false, null));
            }
            if (hasAnyPermission(normalizedPermissions, "documents.admin.knowledge_categories.view", "documents.admin.knowledge_categories.manage")) {
                docAdminChildren.add(new NavigationItemResponse("doc-admin-knowledge-categories", "Knowledge Categories Hierarchies", null, "/documents/administration/knowledge-categories", false, null));
                // Parity fix: the frontend fallback nav (navigation.ts) already listed this item;
                // it was missing here, so a user relying on the server-authoritative response alone
                // never saw it.
                docAdminChildren.add(new NavigationItemResponse("doc-admin-knowledge-components", "Knowledge Category Components", null, "/documents/administration/knowledge-components", false, null));
            }
            if (hasAnyPermission(normalizedPermissions, "documents.admin.publishing_templates.view", "documents.admin.publishing_templates.manage")) {
                docAdminChildren.add(new NavigationItemResponse("publishing-templates", "Publishing Templates", null, "/documents/administration/publishing-templates", false, null));
            }
            if (hasAnyPermission(normalizedPermissions, "documents.admin.controlled_copies_policy.view", "documents.admin.controlled_copies_policy.manage")) {
                docAdminChildren.add(new NavigationItemResponse("controlled-copy-policy", "Controlled Copies Policy", null, "/documents/administration/controlled-copies-policy", false, null));
            }
            if (hasAnyPermission(normalizedPermissions, "documents.admin.uncontrolled_copies_policy.view", "documents.admin.uncontrolled_copies_policy.manage")) {
                docAdminChildren.add(new NavigationItemResponse("uncontrolled-copy-policy", "Uncontrolled Copies Policy", null, "/documents/administration/uncontrolled-copies-policy", false, null));
            }
            if (!docAdminChildren.isEmpty()) {
                sysAdminChildren.add(new NavigationItemResponse("doc-administration", "Document Administration", "IconFileDescription", null, false, docAdminChildren));
            }

            // "Training Administration" -- coming soon sub-screens, no real functionality behind
            // them yet. Each screen keeps its own granular training.admin.<screen>.view
            // permission, mirroring the Document Administration per-screen permission split.
            List<NavigationItemResponse> trainingAdminChildren = new ArrayList<>();
            if (hasPermission(normalizedPermissions, "training.admin.properties.view") || hasPermission(normalizedPermissions, "training.settings.view")) {
                trainingAdminChildren.add(new NavigationItemResponse("training-admin-properties", "Training Properties", null, "/settings/administration/training/properties", false, null));
            }
            if (hasPermission(normalizedPermissions, "training.admin.manage")) {
                trainingAdminChildren.add(new NavigationItemResponse("training-admin-topics", "Training Topics", null, "/settings/administration/training/topics", false, null));
                trainingAdminChildren.add(new NavigationItemResponse("training-admin-vendors", "Training Vendors", null, "/settings/administration/training/vendors", false, null));
                trainingAdminChildren.add(new NavigationItemResponse("training-admin-job-roles", "Job Roles", null, "/settings/administration/training/job-roles", false, null));
                trainingAdminChildren.add(new NavigationItemResponse("training-admin-notifications", "Training Notifications", null, "/settings/administration/training/notifications", false, null));
            }
            if (!trainingAdminChildren.isEmpty()) {
                sysAdminChildren.add(new NavigationItemResponse("training-administration", "Training Administration", "GraduationCap", null, false, trainingAdminChildren));
            }

            // "Backup & Restore Administration" -- UI preview, one screen per sub-menu; each keeps its own
            // backup.admin.<screen>.view permission, mirroring the Training / Document Administration split.
            List<NavigationItemResponse> backupAdminChildren = new ArrayList<>();
            if (hasPermission(normalizedPermissions, "backup.admin.policy.view")) {
                backupAdminChildren.add(new NavigationItemResponse("backup-admin-policy", "Backup Policy", null, "/settings/administration/backup/policy", false, null));
            }
            if (hasPermission(normalizedPermissions, "backup.admin.storage.view")) {
                backupAdminChildren.add(new NavigationItemResponse("backup-admin-storage", "Backup Storage & Encryption", null, "/settings/administration/backup/storage", false, null));
            }
            // One screen with a tab for each of these three views; it is listed when the person may open any of them.
            if (hasPermission(normalizedPermissions, "backup.admin.restore_controls.view")
                    || hasPermission(normalizedPermissions, "backup.admin.verification.view")
                    || hasPermission(normalizedPermissions, "backup.admin.retention.view")) {
                backupAdminChildren.add(new NavigationItemResponse("backup-admin-controls", "Backup Controls", null, "/settings/administration/backup/controls", false, null));
            }
            if (hasPermission(normalizedPermissions, "backup.admin.alerts.view")) {
                backupAdminChildren.add(new NavigationItemResponse("backup-admin-alerts", "Backup Alerts & Recipients", null, "/settings/administration/backup/alerts", false, null));
            }
            if (hasPermission(normalizedPermissions, "backup.admin.disaster_recovery.view")) {
                backupAdminChildren.add(new NavigationItemResponse("backup-admin-disaster-recovery", "Disaster Recovery Plan", null, "/settings/administration/backup/disaster-recovery", false, null));
            }
            if (!backupAdminChildren.isEmpty()) {
                sysAdminChildren.add(new NavigationItemResponse("backup-restore-administration", "Backup & Restore Administration", "DatabaseBackup", null, false, backupAdminChildren));
            }

            // "Report Administration" -- definitions are real; the other screens are previews. Gated by existing report permissions.
            List<NavigationItemResponse> reportAdminChildren = new ArrayList<>();
            if (hasAnyPermission(normalizedPermissions, "reports.properties.view", "reports.properties.manage")) {
                reportAdminChildren.add(new NavigationItemResponse("report-admin-properties", "Report Properties", null, "/settings/report-properties", false, null));
            }
            if (hasAnyPermission(normalizedPermissions, "reports.types.view", "reports.types.manage")) {
                reportAdminChildren.add(new NavigationItemResponse("report-admin-types", "Report Types", null, "/settings/report-types", false, null));
            }
            if (hasAnyPermission(normalizedPermissions, "reports.definition.view", "settings.configuration.view")) {
                reportAdminChildren.add(new NavigationItemResponse("report-admin-definitions", "Report Definitions", null, "/settings/report-configuration", false, null));
                reportAdminChildren.add(new NavigationItemResponse("report-admin-name-formats", "Report Name Formats", null, "/settings/report-name-formats", false, null));
                reportAdminChildren.add(new NavigationItemResponse("report-admin-access", "Report Access & Data Scope", null, "/settings/administration/report/access", false, null));
            }
            if (hasAnyPermission(normalizedPermissions, "reports.definition.view", "settings.configuration.view")) {
                reportAdminChildren.add(new NavigationItemResponse("report-admin-retention", "Report Retention & Legal Hold", null, "/settings/administration/report/retention", false, null));
            }
            if (hasAnyPermission(normalizedPermissions, "reports.definition.view", "settings.configuration.view")) {
                reportAdminChildren.add(new NavigationItemResponse("report-admin-delivery", "Scheduled Report Delivery", null, "/settings/administration/report/delivery", false, null));
            }
            if (hasAnyPermission(normalizedPermissions, "reports.definition.view", "settings.configuration.view")) {
            }
            if (!reportAdminChildren.isEmpty()) {
                sysAdminChildren.add(new NavigationItemResponse("report-administration", "Report Administration", "IconChartBar", null, false, reportAdminChildren));
            }

            if (!sysAdminChildren.isEmpty()) {
                menu.add(new NavigationItemResponse("system-administration", "System Administration", "UserStar", null, false, sysAdminChildren));
            }
        }

        if (hasPermission(normalizedPermissions, "preferences.module.view")
                && systemConfigurationService.isFeatureEnabled("feat-system-preferences")) {
            menu.add(new NavigationItemResponse("preferences", "Preferences", "IconAdjustmentsHorizontal", "/preferences", false, null));
        }

        if (systemConfigurationService.isFeatureEnabled("feat-system-admin")
                && hasPermission(normalizedPermissions, "settings.configuration.view")) {
            menu.add(new NavigationItemResponse("system-information", "System Information", "IconAlertSquareRounded", "/settings/system-info", false, null));
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

    private boolean hasAnyPermission(Set<String> permissions, String... codes) {
        for (String code : codes) {
            if (hasPermission(permissions, code)) return true;
        }
        return false;
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
