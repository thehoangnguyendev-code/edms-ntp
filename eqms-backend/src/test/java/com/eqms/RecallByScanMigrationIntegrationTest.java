package com.eqms;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V540/V541 against the real schema: the dedicated view-all permissions exist and were granted to the sets that relied on the
 * administration permissions, and the recall-by-scan tables and columns are there.
 */
@SpringBootTest
@Transactional
class RecallByScanMigrationIntegrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    private boolean columnExists(String table, String column) {
        Integer count = jdbc.queryForObject(
                "select count(*) from information_schema.columns where table_name = ? and column_name = ?", Integer.class, table, column);
        return count != null && count > 0;
    }

    @Test
    void the_dedicated_view_all_permissions_exist() {
        List<String> codes = jdbc.queryForList(
                "select code from permissions where code in (?, ?, ?)", String.class,
                "documents.document.view_all", "documents.controlled_copy.view_all", "documents.uncontrolled_copy.view_all");

        assertThat(codes).containsExactlyInAnyOrder(
                "documents.document.view_all", "documents.controlled_copy.view_all", "documents.uncontrolled_copy.view_all");
    }

    private static final List<String> DCO_AND_ADMINISTRATOR_SETS = List.of(
            "PS_DCO_TEST", "PS_DOCUMENT_DCO", "PS_UAT_DOCUMENT_DCO", "PS_DOCUMENT_VIEW_ALL",
            "ROLE_DCO", "ROLE_ADMINISTRATOR", "ROLE_DOCUMENT_CONTROLLER", "SYSTEM_ADMINISTRATION");

    @Test
    void document_and_controlled_copy_blanket_visibility_is_held_only_by_dco_and_administrator_sets() {
        // V540 granted the dedicated permissions to every set that relied on an administration permission; V542 (owner
        // decision) removed them again from the sets that are neither DCO nor Administrator.
        List<String> holders = jdbc.queryForList("""
                select distinct ps.code
                from permission_sets ps
                join permission_set_items i on i.permission_set_id = ps.id
                join permissions p on p.id = i.permission_id
                where p.code in ('documents.document.view_all', 'documents.controlled_copy.view_all')
                """, String.class);

        assertThat(holders).isNotEmpty().isSubsetOf(DCO_AND_ADMINISTRATOR_SETS);
    }

    @Test
    void the_dco_and_administrator_sets_that_hold_blanket_visibility_hold_all_three_permissions() {
        List<String> incomplete = jdbc.queryForList("""
                select ps.code
                from permission_sets ps
                join permission_set_items i on i.permission_set_id = ps.id
                join permissions p on p.id = i.permission_id
                where p.code in ('documents.document.view_all', 'documents.controlled_copy.view_all', 'documents.uncontrolled_copy.view_all')
                  and ps.code in (?, ?, ?, ?, ?, ?, ?, ?)
                group by ps.code
                having count(distinct p.code) < 3
                """, String.class, DCO_AND_ADMINISTRATOR_SETS.toArray());

        assertThat(incomplete).isEmpty();
    }

    @Test
    void other_sets_may_hold_uncontrolled_copy_blanket_visibility_only_because_they_decide_requests() {
        // V540 kept uncontrolled_copy.view_all for sets that approve, reject or distribute uncontrolled copy requests, because
        // an approver must see the requests they decide (before, those permissions implied seeing every copy). This is OUTSIDE
        // the owner's removal list and awaits a decision; if the decision is to remove it, change this test with the migration.
        List<String> others = jdbc.queryForList("""
                select distinct ps.code
                from permission_sets ps
                join permission_set_items i on i.permission_set_id = ps.id
                join permissions p on p.id = i.permission_id
                where p.code = 'documents.uncontrolled_copy.view_all'
                  and ps.code not in (?, ?, ?, ?, ?, ?, ?, ?)
                """, String.class, DCO_AND_ADMINISTRATOR_SETS.toArray());

        for (String code : others) {
            Integer decides = jdbc.queryForObject("""
                    select count(*) from permission_sets ps
                    join permission_set_items i on i.permission_set_id = ps.id
                    join permissions p on p.id = i.permission_id
                    where ps.code = ?
                      and p.code in ('documents.uncontrolled_copy.approve_request', 'documents.uncontrolled_copy.reject_request',
                                     'documents.uncontrolled_copy.distribute')
                    """, Integer.class, code);
            assertThat(decides).as("set %s holds uncontrolled_copy.view_all", code).isPositive();
        }
    }

    @Test
    void the_retired_electronic_form_tables_are_gone_and_so_is_the_controlled_copy_delivery_mode() {
        for (String table : List.of("eform_artifact_writes", "eform_design_engine_writes", "eform_edit_sessions", "eform_fill_runs",
                "eform_pdf_signature_steps", "eform_retirement_history", "eform_signer_assignments", "form_settings")) {
            assertThat(jdbc.queryForObject("select to_regclass(?) is null", Boolean.class, table))
                    .as("table %s should have been dropped", table).isTrue();
        }
        assertThat(jdbc.queryForObject("select count(*) from pg_proc where proname = 'reject_retired_eform_write'", Integer.class)).isZero();
        assertThat(jdbc.queryForList(
                "select tgname from pg_trigger where tgname in ('controlled_copy_paper_only', 'executed_record_paper_only')", String.class))
                .containsExactly("executed_record_paper_only");
        // A copy has no delivery mode any more (V545); the paper-only guard on Executed Records stays.
        assertThat(columnExists("controlled_copies", "delivery_mode")).isFalse();
        // Records of returned copies and the copies themselves are untouched.
        assertThat(jdbc.queryForObject("select count(*) from executed_records", Integer.class)).isNotNegative();
    }

    @Test
    void the_scan_code_and_recall_batch_schema_is_in_place() {
        assertThat(columnExists("controlled_copies", "scan_token")).isTrue();
        assertThat(columnExists("controlled_copy_policy_settings", "qr_code_enabled")).isTrue();
        assertThat(columnExists("controlled_copy_policy_settings", "qr_code_position")).isTrue();
        assertThat(columnExists("controlled_copy_policy_settings", "qr_code_size_mm")).isTrue();
        assertThat(columnExists("uncontrolled_copies", "recipient_user_id")).isTrue();
        assertThat(columnExists("executed_records", "recall_batch_id")).isTrue();
        assertThat(columnExists("executed_records", "file_name")).isTrue();
        assertThat(columnExists("executed_records", "content_type")).isTrue();
        assertThat(columnExists("executed_records", "file_size")).isTrue();
        assertThat(columnExists("controlled_copy_recall_batches", "signature_id")).isTrue();
        assertThat(columnExists("controlled_copy_recall_items", "match_status")).isTrue();
    }

    @Test
    void a_scan_token_can_belong_to_only_one_controlled_copy() {
        Integer unique = jdbc.queryForObject(
                "select count(*) from pg_indexes where indexname = 'ux_controlled_copies_scan_token' and indexdef like '%UNIQUE%'", Integer.class);

        assertThat(unique).isEqualTo(1);
    }

    @Test
    void existing_uncontrolled_copies_with_a_recipient_were_backfilled() {
        Integer unmatched = jdbc.queryForObject("""
                select count(*) from uncontrolled_copies c
                where c.recipient_user_id is null
                  and c.recipient_snapshot is not null
                  and (c.recipient_snapshot ->> 'userId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                  and exists (select 1 from app_users u where u.id = (c.recipient_snapshot ->> 'userId')::uuid)
                """, Integer.class);

        assertThat(unmatched).isZero();
    }
}
