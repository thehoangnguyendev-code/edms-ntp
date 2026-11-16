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
 * REPORT-SECURITY-SOURCES-2026-11-12: the Report Types of authentication, electronic signatures, users, access review, Knowledge share links and storage. The ones that are logs
 * need audit.view and audit.export, a date range and the whole system scope; the others need the permission of the screen they report on; none shows a secret.
 */
class ReportSecuritySourcesTest {
    static List<ReportMetadataProvider> providers() {
        return List.of(new AuthEventReportMetadataProvider(), new ElectronicSignatureReportMetadataProvider(), new UserAccessReportMetadataProvider(),
                new AccessReviewReportMetadataProvider(), new KnowledgeShareReportMetadataProvider(), new StorageUsageReportMetadataProvider(), new BackupActivityReportMetadataProvider());
    }

    private UserAccount actor() {
        var actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        actor.setStatus(UserStatus.Active);
        actor.setDepartment("QA");
        actor.setBusinessUnit("Factory");
        return actor;
    }

    private Map<String, Object> everyFilter(ReportMetadataProvider provider) {
        var values = new HashMap<String, Object>();
        for (var filter : provider.filters()) values.put(filter.get("code"), "DATE".equals(filter.get("type")) ? "2026-01-15" : "x");
        return values;
    }

    private static boolean systemOnly(ReportMetadataProvider provider) { return provider.allowedScopes().equals(List.of("SYSTEM")); }

    @ParameterizedTest @MethodSource("providers")
    void aTypeNeedsAPermissionOfItsOwnAndAUserOfNoScopeIsRefused(ReportMetadataProvider provider) {
        assertFalse(provider.usePermissions().isEmpty() && provider.requiredPermissions().isEmpty(), "a type of security data is not open to everyone who holds a template scope");
        assertThrows(SecurityException.class, () -> provider.query(actor(), List.of(), Map.of()));
        assertThrows(SecurityException.class, () -> provider.query(actor(), List.of("GLOBAL"), Map.of()));
    }

    @ParameterizedTest @MethodSource("providers")
    void aTypeThatIsNotDividedByDepartmentIsShownUnderTheSystemScopeOnly(ReportMetadataProvider provider) {
        if (!systemOnly(provider)) return;
        for (var scope : List.of("DEPARTMENT", "BUSINESS_UNIT", "PERSONAL")) {
            assertThrows(SecurityException.class, () -> provider.query(actor(), List.of(scope), Map.of()), provider.code() + " under " + scope);
        }
        assertDoesNotThrow(() -> provider.query(actor(), List.of("SYSTEM"), logRange(provider)));
    }

    /** A log type needs its range at the run; for the other types the range is not asked. */
    private Map<String, Object> logRange(ReportMetadataProvider provider) {
        return switch (provider.code()) {
            case "AUTH_EVENTS", "BACKUP_ACTIVITY" -> Map.of("createdFrom", "2026-01-01", "createdTo", "2026-01-31");
            case "ELECTRONIC_SIGNATURES" -> Map.of("signedFrom", "2026-01-01", "signedTo", "2026-01-31");
            default -> Map.of();
        };
    }

    @Test
    void theLogTypesNeedBothAuditPermissionsAndARangeOfAtMost92Days() {
        for (var provider : List.of(new AuthEventReportMetadataProvider(), new ElectronicSignatureReportMetadataProvider())) {
            assertEquals(List.of("audit.view", "audit.export"), provider.requiredPermissions());
            assertEquals("Audit", provider.category());
            var from = provider.code().equals("AUTH_EVENTS") ? "createdFrom" : "signedFrom";
            var to = provider.code().equals("AUTH_EVENTS") ? "createdTo" : "signedTo";
            assertThrows(IllegalArgumentException.class, () -> provider.validateRun(Map.of()), "both dates are required");
            assertEquals("REPORT_AUDIT_RANGE_REQUIRED", assertThrows(IllegalArgumentException.class, () -> provider.validateRun(Map.of(from, "2026-01-01"))).getMessage());
            assertEquals("REPORT_DATE_RANGE_INVALID", assertThrows(IllegalArgumentException.class, () -> provider.validateRun(Map.of(from, "2026-02-01", to, "2026-01-01"))).getMessage());
            assertEquals("REPORT_AUDIT_RANGE_TOO_WIDE", assertThrows(IllegalArgumentException.class, () -> provider.validateRun(Map.of(from, "2026-01-01", to, "2026-04-03"))).getMessage());
            assertDoesNotThrow(() -> provider.validateRun(Map.of(from, "2026-01-01", to, "2026-04-02")), "92 days, both days counted");
            assertThrows(IllegalArgumentException.class, () -> provider.validateRun(Map.of(from, "not-a-date", to, "2026-01-01")));
        }
    }

    @Test
    void theBackupActivityTypeNeverShowsAnIdentifierAsTheRecord() {
        String sql = new BackupActivityReportMetadataProvider().columns().get("record");
        assertTrue(sql.contains("[0-9a-f]{8}-[0-9a-f]{4}"), "a record known only by its identifier is left empty");
    }

    @Test
    void theBackupActivityTypeIsAnAuditLogOfTheBackupModuleOnly() {
        var provider = new BackupActivityReportMetadataProvider();
        assertEquals(List.of("backup.module.view", "audit.view", "audit.export"), provider.requiredPermissions());
        assertEquals(List.of("SYSTEM"), provider.allowedScopes());
        assertEquals("REPORT_AUDIT_RANGE_REQUIRED", assertThrows(IllegalArgumentException.class, () -> provider.validateRun(Map.of())).getMessage());
        assertEquals("REPORT_AUDIT_RANGE_TOO_WIDE", assertThrows(IllegalArgumentException.class, () -> provider.validateRun(Map.of("createdFrom", "2026-01-01", "createdTo", "2026-04-03"))).getMessage());
        var query = provider.query(actor(), List.of("SYSTEM"), Map.of());
        assertTrue(query.fromWhere().contains("BACKUP\\_%") && query.fromWhere().contains("entity_type='BACKUP'"), "only the records of the module, and nothing else of the Audit Trail");
    }

    @Test
    void theWholeOfTheLastDayIsInTheRangeOfALog() {
        var provider = new AuthEventReportMetadataProvider();
        var query = provider.query(actor(), List.of("SYSTEM"), Map.of("createdFrom", "2026-01-01", "createdTo", "2026-01-31"));
        assertTrue(query.fromWhere().contains("al.created_at>=?") && query.fromWhere().contains("al.created_at<?"));
        assertEquals(java.sql.Timestamp.valueOf("2026-02-01 00:00:00"), query.arguments().get(1), "the day after the last day, not included");
    }

    @Test
    void theUserTypeFollowsTheScopesOfTheTemplateAndSeesNoPrivateData() {
        var provider = new UserAccessReportMetadataProvider();
        var actor = actor();
        var department = provider.query(actor, List.of("DEPARTMENT", "BUSINESS_UNIT"), Map.of("department", "another"));
        assertEquals(List.of("QA", "Factory", "another"), department.arguments());
        assertEquals(List.of(actor.getId()), provider.query(actor, List.of("PERSONAL"), Map.of()).arguments());
        assertEquals(List.of("settings.user.view"), provider.usePermissions());
    }

    @ParameterizedTest @MethodSource("providers")
    void aSearchIsEscapedAndEveryValueIsAParameter(ReportMetadataProvider provider) {
        var filters = new HashMap<String, Object>(logRange(provider));
        if (provider.filters().stream().anyMatch(f -> "search".equals(f.get("code")))) filters.put("search", "%_\\");
        var lookup = provider.filters().stream().filter(f -> "LOOKUP".equals(f.get("type"))).findFirst();
        lookup.ifPresent(f -> filters.put(f.get("code"), "x' OR true--"));
        var query = provider.query(actor(), List.of("SYSTEM"), filters);
        if (filters.containsKey("search")) assertTrue(query.arguments().stream().anyMatch(a -> "%\\%\\_\\\\%".equals(a)));
        lookup.ifPresent(f -> assertTrue(query.arguments().contains("x' OR true--")));
        assertFalse(query.fromWhere().contains("OR true"));
    }

    @ParameterizedTest @MethodSource("providers")
    void aFilterTheTypeDoesNotHaveOrANonTextValueOrALongSearchIsRefused(ReportMetadataProvider provider) {
        assertThrows(IllegalArgumentException.class, () -> provider.query(actor(), List.of("SYSTEM"), Map.of("sql", "select 1")));
        assertThrows(IllegalArgumentException.class, () -> provider.query(actor(), List.of("SYSTEM"), Map.of("search", 5)));
        if (provider.filters().stream().anyMatch(f -> "search".equals(f.get("code")))) {
            assertThrows(IllegalArgumentException.class, () -> provider.query(actor(), List.of("SYSTEM"), Map.of("search", "a".repeat(201))));
        }
    }

    @ParameterizedTest @MethodSource("providers")
    void everyFilterIsAcceptedAndEachValueIsOneParameter(ReportMetadataProvider provider) {
        var filters = everyFilter(provider);
        var query = provider.query(actor(), List.of("SYSTEM"), filters);
        long marks = query.fromWhere().chars().filter(c -> c == '?').count();
        assertEquals(marks, query.arguments().size(), "one argument for each question mark of the SQL");
        assertTrue(query.arguments().size() >= filters.size(), "no filter is dropped silently");
    }

    @ParameterizedTest @MethodSource("providers")
    void dateRangesAreCheckedInOrder(ReportMetadataProvider provider) {
        var from = provider.filters().stream().filter(f -> "DATE".equals(f.get("type"))).map(f -> f.get("code")).filter(code -> code.endsWith("From")).findFirst().orElseThrow();
        var to = from.substring(0, from.length() - 4) + "To";
        assertThrows(IllegalArgumentException.class, () -> provider.query(actor(), List.of("SYSTEM"), Map.of(from, "2026-10-02", to, "2026-10-01")));
        assertThrows(IllegalArgumentException.class, () -> provider.query(actor(), List.of("SYSTEM"), Map.of(from, "not-a-date")));
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
        assertTrue(provider.identityColumn().endsWith(".id") || provider.identityColumn().endsWith("::uuid"), "the identity is a uuid: " + provider.identityColumn());
    }

    /** A secret, a device, a token, a private detail of a person, a free text: never a column. */
    @ParameterizedTest @MethodSource("providers")
    void noSecretDeviceTokenOrPrivateDetailIsAColumn(ReportMetadataProvider provider) {
        var forbidden = List.of("user_agent", "details_json", "token", "password_hash", "password_history", "verification_id", "checksum", "description", "mfa_secret", "avatar", "by_domain", "by_file_type",
                "notification_preferences", "localization_preferences", "by_domain", "by_file_type");
        for (var entry : provider.columns().entrySet()) {
            var sql = entry.getValue().toLowerCase();
            for (var word : forbidden) assertFalse(sql.contains(word), provider.code() + "." + entry.getKey() + " must not report " + word + " (" + sql + ")");
        }
        // REPORT-FIELD-CATALOG-2026-11-15: what describes a person may be reported, but only as a field labelled sensitive.
        for (var entry : provider.columns().entrySet()) {
            var sql = entry.getValue().toLowerCase();
            for (var word : List.of(".email", "secondary_notification_email", ".phone", "date_of_birth", "u.address", "id_number", ".gender", "nationality"))
                if (sql.contains(word)) assertTrue(provider.sensitiveFields().contains(entry.getKey()), provider.code() + "." + entry.getKey() + " describes a person and must be a sensitive field");
        }
        // The address of a signer is reported only as a sensitive field.
        if (provider.code().equals("ELECTRONIC_SIGNATURES")) provider.columns().forEach((code, sql) -> { if (sql.contains("ip_address")) assertTrue(provider.sensitiveFields().contains(code), "the address of a signer is sensitive"); });
    }

    @Test
    void theTypesAreCodedAndCategorisedAndDistinctFromTheOthers() {
        var codes = providers().stream().map(ReportMetadataProvider::code).toList();
        assertEquals(List.of("AUTH_EVENTS", "ELECTRONIC_SIGNATURES", "USER_ACCESS", "ACCESS_REVIEW_ITEMS", "KNOWLEDGE_SHARE_LINKS", "STORAGE_USAGE", "BACKUP_ACTIVITY"), codes);
        var all = new ArrayList<>(codes);
        ReportDocumentSourcesTest.providers().forEach(p -> all.add(p.code()));
        all.add("AUDIT_TRAIL");
        assertEquals(all.size(), new HashSet<>(all).size());
        assertEquals(List.of("Audit", "Audit", "Security", "Security", "Security", "Storage", "Backup and Restore"), providers().stream().map(ReportMetadataProvider::category).toList());
    }

    @Test
    void aShareLinkIsActiveExpiredOrRevokedAndNeverShowsItsToken() {
        var provider = new KnowledgeShareReportMetadataProvider();
        assertTrue(provider.columns().get("state").contains("revoked_at is not null") && provider.columns().get("state").contains("expires_at"));
        assertFalse(provider.columns().values().stream().anyMatch(sql -> sql.contains("token_hash")));
    }
}
