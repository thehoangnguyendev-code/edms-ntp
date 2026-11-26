package com.eqms.service.report;

import static org.junit.jupiter.api.Assertions.*;

import com.eqms.entity.UserAccount;
import java.util.*;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/**
 * REPORT-DOCUMENT-SOURCES / REPORT-TRAINING-SOURCES-2026-11-12: runs the SQL of the document and training Report Types against a real database with the schema of the application. Read-only: it only selects.
 * Opt in with EQMS_REPORT_TEST_DB (JDBC url), EQMS_REPORT_TEST_USER and EQMS_REPORT_TEST_PASSWORD, as the other report database tests.
 */
@EnabledIfEnvironmentVariable(named = "EQMS_REPORT_TEST_DB", matches = ".+")
class ReportDocumentSourcesDatabaseTest {
    private final JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(System.getenv("EQMS_REPORT_TEST_DB"), System.getenv("EQMS_REPORT_TEST_USER"),
            System.getenv("EQMS_REPORT_TEST_PASSWORD")));

    private static final List<ReportMetadataProvider> PROVIDERS = new ArrayList<>(ReportDocumentSourcesTest.providers());
    static {
        PROVIDERS.addAll(ReportTrainingSourcesTest.providers());
        PROVIDERS.addAll(ReportSecuritySourcesTest.providers());
        PROVIDERS.addAll(ReportFieldCatalogTest.catalogueSources());
    }

    private UserAccount actor() {
        var actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        actor.setDepartment("Quality Assurance");
        actor.setBusinessUnit("Quality Unit");
        return actor;
    }

    private Map<String, Object> everyFilter(ReportMetadataProvider provider) {
        var values = new HashMap<String, Object>();
        for (var filter : provider.filters()) values.put(filter.get("code"), "DATE".equals(filter.get("type")) ? "2026-01-15" : "NUMBER".equals(filter.get("type")) ? "30" : "x");
        return values;
    }

    @Test
    void everyColumnOfEveryTypeIsValidSqlAndEveryScopeAndFilterRuns() {
        for (var provider : PROVIDERS) {
            var columns = new ArrayList<>(provider.columns().values());
            var projection = provider.identityColumn() + "," + String.join(",", columns);
            var scopeSets = provider.allowedScopes().equals(List.of("SYSTEM")) ? List.of(List.of("SYSTEM"))
                    : provider.allowedScopes().contains("BUSINESS_UNIT") ? List.of(List.of("SYSTEM"), List.of("PERSONAL"), List.of("DEPARTMENT", "BUSINESS_UNIT"))
                    : List.of(List.of("SYSTEM"), List.of("PERSONAL"), List.of("DEPARTMENT"));
            for (var scopes : scopeSets) {
                for (var filters : List.of(Map.<String, Object>of(), everyFilter(provider))) {
                    var query = provider.query(actor(), scopes, filters);
                    jdbc.queryForObject("select count(*) " + query.fromWhere(), Long.class, query.arguments().toArray());
                    var rows = jdbc.queryForList("select " + projection + " " + query.fromWhere() + " order by " + provider.columns().get(provider.defaultSort())
                            + " asc nulls last," + provider.identityColumn() + " asc limit 5", query.arguments().toArray());
                    assertTrue(rows.size() <= 5, provider.code());
                }
            }
        }
    }

    @Test
    void theLookupOfEveryFilterAnswers() {
        for (var provider : PROVIDERS) {
            var query = provider.query(actor(), List.of("SYSTEM"), Map.of());
            for (var entry : provider.lookupColumns().entrySet()) {
                var args = new ArrayList<Object>(query.arguments());
                args.add("%");
                var rows = jdbc.queryForList("select distinct cast(" + entry.getValue() + " as text) as value," + provider.columns().get(entry.getKey()) + " as label "
                        + query.fromWhere() + " and " + provider.columns().get(entry.getKey()) + " ilike ? order by label,value limit 100", args.toArray());
                assertNotNull(rows, provider.code() + " " + entry.getKey());
            }
        }
    }

    @Test
    void aSystemRunListsAsManyRecordsAsTheTableHoldsForTheTypesWithAnInnerJoinOnlyOnTheirOwnKey() {
        // A report never drops a record silently: the revision report (left joins) lists every revision.
        var revisions = new RevisionReportMetadataProvider(ReportTestVisibility.everything());
        var query = revisions.query(actor(), List.of("SYSTEM"), Map.of());
        long listed = Objects.requireNonNull(jdbc.queryForObject("select count(*) " + query.fromWhere(), Long.class, query.arguments().toArray()));
        long all = Objects.requireNonNull(jdbc.queryForObject("select count(*) from document_revisions", Long.class));
        assertEquals(all, listed);
        var codes = PROVIDERS.stream().map(ReportMetadataProvider::code).collect(Collectors.toSet());
        // Includes Permission Holders, added to the security sources after the original 22 types.
        assertEquals(23, codes.size());
        assertEquals(PROVIDERS.size(), codes.size(), "each tested type has a distinct code");
    }
}
