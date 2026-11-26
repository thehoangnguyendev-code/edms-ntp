package com.eqms.service;

import com.eqms.util.ConfigurationAuditPage;
import com.eqms.dto.navigation.NavigationItemResponse;
import com.eqms.entity.UserAccount;
import org.springframework.beans.factory.annotation.Autowired;
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

    /** Optional so the menu can still be built from permissions alone (tests, and the fallback when the signed-in user cannot be loaded). */
    private DocumentControlMenuAccess documentControlMenuAccess;

    public NavigationService(SystemConfigurationService systemConfigurationService) {
        this.systemConfigurationService = systemConfigurationService;
    }

    @Autowired(required = false)
    void setDocumentControlMenuAccess(DocumentControlMenuAccess documentControlMenuAccess) {
        this.documentControlMenuAccess = documentControlMenuAccess;
    }

    /**
     * Every menu item is gated purely by the caller's actual granted permission codes
     * (resolved from their Access Profile). There is no super-admin bypass here — per GMP
     * Segregation of Duties, visibility must come from explicit grants, including for admins.
     */
    public List<NavigationItemResponse> getNavigation(Set<String> permissions) {
        return getNavigation(null, permissions);
    }

    /**
     * Same, and the Document Control groups are listed only where the person has something to do (DC-VISIBILITY-TIERS-2026-11-07):
     * the permission AND (the matching view-everything permission OR a name in that flow). Without a user the groups follow permissions alone.
     */
    public List<NavigationItemResponse> getNavigation(UserAccount user, Set<String> permissions) {
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
        // Self-Service groups the two personal-workspace surfaces (Dashboard, Knowledge) that used
        // to live at top-level / nested inside Document Control -- shown if either child is visible.
        List<NavigationItemResponse> selfServiceChildren = new ArrayList<>();
        if (hasPermission(normalizedPermissions, "dashboard.module.view")
                && systemConfigurationService.isFeatureEnabled("feat-dashboard")) {
            selfServiceChildren.add(new NavigationItemResponse("dashboard", "Dashboard", "IconLayoutGrid", "/dashboard", false, null));
        }
        if (hasPermission(normalizedPermissions, "self_service.knowledge.view")
                && systemConfigurationService.isFeatureEnabled("feat-edms-kb")) {
            selfServiceChildren.add(new NavigationItemResponse("knowledge-base", "Knowledge Base", null, "/documents/knowledge/explorer", false, null));
        }
        if (!selfServiceChildren.isEmpty()) {
            menu.add(new NavigationItemResponse("self-service", "Self-Service", "IconLayoutGrid", null, true, selfServiceChildren));
        }
        if (hasPermission(normalizedPermissions, "documents.module.view")
                && systemConfigurationService.isFeatureEnabled("feat-edms")) {
            List<NavigationItemResponse> docChildren = new ArrayList<>();
            DocumentControlMenuAccess.Sections sections = user == null || documentControlMenuAccess == null ? null : documentControlMenuAccess.sectionsFor(user);
            boolean showDocuments = sections == null || sections.documents();
            boolean showControlledCopies = sections == null || sections.controlledCopies();
            boolean showUncontrolledCopies = sections == null || sections.uncontrolledCopies();
            if (showDocuments && systemConfigurationService.isFeatureEnabled("feat-edms-owned")) {
                docChildren.add(new NavigationItemResponse("doc-owned-me", "Documents Owned By Me", null, "/documents/owned", false, null));
            }
            if (showDocuments && systemConfigurationService.isFeatureEnabled("feat-edms-all")) {
                docChildren.add(new NavigationItemResponse("doc-all", "All Documents", null, "/documents/all", false, null));
            }

            if (showDocuments && systemConfigurationService.isFeatureEnabled("feat-edms-revisions")) {
                List<NavigationItemResponse> revisionChildren = new ArrayList<>();
                revisionChildren.add(new NavigationItemResponse("rev-owned-me", "Revisions Owned By Me", null, "/documents/revisions/owned", false, null));
                revisionChildren.add(new NavigationItemResponse("rev-all", "All Revisions", null, "/documents/revisions/all", false, null));
                revisionChildren.add(new NavigationItemResponse("pending-review", "Pending My Review", null, "/documents/revisions/pending-review", false, null));
                revisionChildren.add(new NavigationItemResponse("pending-approval", "Pending My Approval", null, "/documents/revisions/pending-approval", false, null));
                docChildren.add(new NavigationItemResponse("doc-revisions", "Document Revisions", null, null, false, revisionChildren));
            }

            if (systemConfigurationService.isFeatureEnabled("feat-edms-copies")) {
                if (showControlledCopies) {
                    List<NavigationItemResponse> copyChildren = new ArrayList<>();
                    copyChildren.add(new NavigationItemResponse("cc-all", "All Controlled Copies", null, "/documents/controlled-copies/all", false, null));
                    copyChildren.add(new NavigationItemResponse("cc-ready", "Ready for Distribution", null, "/documents/controlled-copies/ready", false, null));
                    copyChildren.add(new NavigationItemResponse("cc-distributed", "Distributed Copies", null, "/documents/controlled-copies/distributed", false, null));
                    docChildren.add(new NavigationItemResponse("controlled-copies", "Controlled Copies", null, null, false, copyChildren));
                }
                // Uncontrolled Copies: a separate feature/table/API from Controlled Copies, listed as a sibling node.
                if (showUncontrolledCopies && hasAnyPermission(normalizedPermissions, "documents.uncontrolled_copy.view", "documents.uncontrolled_copy.request")) {
                    List<NavigationItemResponse> uncontrolledChildren = new ArrayList<>();
                    uncontrolledChildren.add(new NavigationItemResponse("uc-all", "All Uncontrolled Copies", null, "/documents/uncontrolled-copies/all", false, null));
                    uncontrolledChildren.add(new NavigationItemResponse("uc-ready", "Ready for Distribution", null, "/documents/uncontrolled-copies/ready", false, null));
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
                List<NavigationItemResponse> mine = new ArrayList<>();
                mine.add(new NavigationItemResponse("my-tasks", "My Tasks", null, "/training-management/my-training/tasks", false, null));
                mine.add(new NavigationItemResponse("my-records", "My Records", null, "/training-management/my-training/records", false, null));
                trainingChildren.add(new NavigationItemResponse("my-training", "My Training", null, null, false, mine));
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
            if (hasPermission(normalizedPermissions, "training.assessment.view") || hasPermission(normalizedPermissions, "training.assessment.manage") || hasPermission(normalizedPermissions, "training.assessment.manage_all") || hasPermission(normalizedPermissions, "training.assessment.approve")) {
                planning.add(new NavigationItemResponse("training-assessments", "Training Assessments", null, "/training-management/assessments", false, null));
            }
            if (hasPermission(normalizedPermissions, "training.matrix.view")) {
                planning.add(new NavigationItemResponse("training-document-impact-assessment", "Document Impact Assessment", null, "/training-management/document-impact-assessment", false, null));
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
                records.add(new NavigationItemResponse("training-number-allocation-log", "Training Number Allocation Log", null, "/training-management/number-allocation-log", false, null));
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
            // REPORT-MODULE-FLAT-2026-11-16: Report Library and Report Run History are entries of their own (level 2); no Overview, no Dashboards group, no Reports group.
            // Run History / Legal Hold Register and Scheduled Reports / Delivery Log share one entry each; the second of each pair is a tab on the same page, shown to the people who may see it.
            reportChildren.add(new NavigationItemResponse("report-templates", "Report Library", null, "/report/templates", false, null));
            reportChildren.add(new NavigationItemResponse("report-history", "Report Run History", null, "/report/history", false, null));
            reportChildren.add(new NavigationItemResponse("report-scheduled", "Scheduled Reports", null, "/report/scheduled", false, null));
            // Making a report template and approving it are the work of the module, not an administration setting. Like Document Revisions in
            // Document Control: the templates, every revision, and the ones waiting for the approval this person may give.
            if (hasPermission(normalizedPermissions, "reports.definition.view")) {
                List<NavigationItemResponse> templateChildren = new ArrayList<>();
                templateChildren.add(new NavigationItemResponse("report-template-management", "Report Templates", null, "/report/template-management", false, null));
                templateChildren.add(new NavigationItemResponse("report-template-revisions-all", "All Revisions", null, "/report/template-revisions", false, null));
                if (hasAnyPermission(normalizedPermissions, "reports.definition.approve", "reports.definition.approve_gmp")) {
                    templateChildren.add(new NavigationItemResponse("report-template-revisions-pending", "Pending My Approval", null, "/report/template-revisions/pending-approval", false, null));
                }
                reportChildren.add(new NavigationItemResponse("report-template-group", "Template Management", null, null, false, templateChildren));
            }
            menu.add(new NavigationItemResponse("report", "Reports", "IconChartBar", null, false, reportChildren));
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

        // Backup & Restore: one screen per sub-menu. Gated by its own view permission.
        if (hasPermission(normalizedPermissions, "backup.module.view")) {
            List<NavigationItemResponse> backupChildren = new ArrayList<>();
            List<NavigationItemResponse> backupGroupChildren = new ArrayList<>();
            backupGroupChildren.add(new NavigationItemResponse("backup-backups", "Backup History", null, "/backup-restore/backups", false, null));
            backupGroupChildren.add(new NavigationItemResponse("backup-schedules", "Backup Schedules", null, "/backup-restore/backups/schedules", false, null));
            backupChildren.add(new NavigationItemResponse("backup-group", "Backup", null, null, false, backupGroupChildren));
            List<NavigationItemResponse> restoreGroupChildren = new ArrayList<>();
            // One screen: the list of restores, the restore dialog, and finalize / roll back. The approval flow was removed (SDS-BR-003).
            restoreGroupChildren.add(new NavigationItemResponse("production-restores", "Restore Backup", null, "/backup-restore/production-restores", false, null));
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
            userAdminChildren.add(new NavigationItemResponse("sec-access-explorer", "Access Explorer", null, "/settings/users/access-explorer", false, null));
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
            securityAdvancedChildren.add(new NavigationItemResponse("sec-authorization-diagnostics", "Engine Diagnostics", "IconActivity", "/security/authorization-diagnostics", false, null));
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
            // "Notifications Administration" lives in System Administration (see below).
            if (hasAnyPermission(normalizedPermissions, "settings.announcement.view", "settings.announcement.manage")) {
                settingsChildren.add(new NavigationItemResponse("system-announcements", "System Announcements", "IconSpeakerphone", "/settings/announcements", false, null));
            }

            // "Document Administration" moved to the System Administration group (see below).

            if (!settingsChildren.isEmpty()) {
                menu.add(new NavigationItemResponse("settings", "Application Settings", "IconSettings2", null, false, settingsChildren));
            }
        }

        if (systemConfigurationService.isFeatureEnabled("feat-system-admin")) {
            List<NavigationItemResponse> sysAdminChildren = new ArrayList<>();
            // A group: each page of Configuration used to be a tab of one screen (?tab=...) and is now its own page and menu entry, in the order the tabs had. Each page shows to the people who hold the View
            // permission of that page (V806); the group shows when at least one page does.
            List<NavigationItemResponse> configurationChildren = new ArrayList<>();
            if (hasPermission(normalizedPermissions, ConfigurationAuditPage.GENERAL.viewPermission())) {
                configurationChildren.add(new NavigationItemResponse("config-general", "General", null, "/settings/configuration/general", false, null));
            }
            if (hasPermission(normalizedPermissions, ConfigurationAuditPage.NAVIGATION_LABELS.viewPermission())) {
                configurationChildren.add(new NavigationItemResponse("config-navigation-labels", "Navigation Labels", null, "/settings/configuration/navigation-labels", false, null));
            }
            if (hasPermission(normalizedPermissions, ConfigurationAuditPage.SECURITY.viewPermission())) {
                configurationChildren.add(new NavigationItemResponse("config-security", "Security", null, "/settings/configuration/security", false, null));
            }
            if (hasPermission(normalizedPermissions, ConfigurationAuditPage.NOTIFICATIONS.viewPermission())) {
                configurationChildren.add(new NavigationItemResponse("config-notifications", "Notifications", null, "/settings/configuration/notifications", false, null));
            }
            if (hasPermission(normalizedPermissions, ConfigurationAuditPage.INTEGRATIONS.viewPermission())) {
                configurationChildren.add(new NavigationItemResponse("config-integrations", "Integrations", null, "/settings/configuration/integrations", false, null));
            }
            if (hasPermission(normalizedPermissions, ConfigurationAuditPage.PREVIEW_FILE.viewPermission())) {
                configurationChildren.add(new NavigationItemResponse("config-preview-file", "Preview File", null, "/settings/configuration/preview-file", false, null));
            }
            if (hasPermission(normalizedPermissions, ConfigurationAuditPage.IMAGE_WATERMARK.viewPermission())) {
                configurationChildren.add(new NavigationItemResponse("config-image-watermark", "Image Watermark", null, "/settings/configuration/image-watermark", false, null));
            }
            if (hasPermission(normalizedPermissions, ConfigurationAuditPage.FEATURES.viewPermission())) {
                configurationChildren.add(new NavigationItemResponse("config-features", "Features", null, "/settings/configuration/features", false, null));
            }
            if (!configurationChildren.isEmpty()) {
                sysAdminChildren.add(new NavigationItemResponse("config", "Configuration", "IconDeviceDesktopCog", null, false, configurationChildren));
            }
            if (hasPermission(normalizedPermissions, "settings.electronic_signature.view")) {
                sysAdminChildren.add(new NavigationItemResponse("electronic-signature-policies", "E-Sign Config", "PenTool", "/settings/electronic-signature", false, null));
            }
            if (hasAnyPermission(normalizedPermissions, "settings.object_numbering.view", "settings.object_numbering.manage")) {
                sysAdminChildren.add(new NavigationItemResponse("object-numbering", "Object Numbering", null, "/settings/object-numbering", false, null));
            }
            if (hasAnyPermission(normalizedPermissions, "settings.notification_policy.view", "settings.notification_policy.manage",
                    "settings.email_template.view", "settings.email_template.manage")) {
                sysAdminChildren.add(new NavigationItemResponse("notification-settings", "Notifications Administration", "Bell", "/settings/notifications", false, null));
            }

            // "Document Administration" -- moved here from the Document Control module (was nested
            // under doc-control until this move). Each screen keeps its own, independent
            // documents.admin.<screen>.view permission -- deliberately NOT gated behind
            // a permission of System Administration too, so a Document-Administration-only Access Profile
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
                trainingAdminChildren.add(new NavigationItemResponse("training-admin-code-rules", "Training Code Rules", null, "/settings/administration/training/code-rules", false, null));
            }
            if (hasPermission(normalizedPermissions, "training.admin.manage")) {
                trainingAdminChildren.add(new NavigationItemResponse("training-admin-vendors", "Training Vendors", null, "/settings/administration/training/vendors", false, null));
                trainingAdminChildren.add(new NavigationItemResponse("training-admin-job-roles", "Work Positions", null, "/settings/administration/training/job-roles", false, null));
                trainingAdminChildren.add(new NavigationItemResponse("training-admin-notifications", "Training Notifications", null, "/settings/administration/training/notifications", false, null));
            }
            if (hasPermission(normalizedPermissions, "training.annex.view")) {
                trainingAdminChildren.add(new NavigationItemResponse("training-admin-annex", "Training Annex", null, "/settings/administration/training/annex", false, null));
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
            if (hasAnyPermission(normalizedPermissions, "reports.appearance.view", "reports.appearance.manage")) {
                reportAdminChildren.add(new NavigationItemResponse("report-admin-appearance", "Report Appearance", null, "/settings/report-appearance", false, null));
            }
            if (hasAnyPermission(normalizedPermissions, "reports.types.view", "reports.types.manage")) {
                reportAdminChildren.add(new NavigationItemResponse("report-admin-types", "Report Types", null, "/settings/report-types", false, null));
            }
            if (hasPermission(normalizedPermissions, "reports.definition.view")) {
                reportAdminChildren.add(new NavigationItemResponse("report-admin-name-formats", "Report Name Formats", null, "/settings/report-name-formats", false, null));
            }
            if (hasPermission(normalizedPermissions, "reports.definition.view")) {
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
                && hasPermission(normalizedPermissions, "settings.system_info.view")) {
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
        return searchNavigation(query, null, permissions);
    }

    public List<FlatMenuItem> searchNavigation(String query, UserAccount user, Set<String> permissions) {
        if (query == null || query.isBlank()) {
            return Collections.emptyList();
        }
        String q = query.trim().toLowerCase(Locale.ROOT);
        List<NavigationItemResponse> menu = getNavigation(user, permissions);
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
