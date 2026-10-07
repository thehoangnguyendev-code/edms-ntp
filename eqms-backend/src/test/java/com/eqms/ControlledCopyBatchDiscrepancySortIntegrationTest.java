package com.eqms;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.dto.document.ControlledCopyBatchStatusDiscrepancyResponse;
import com.eqms.entity.ControlledCopyBatchStatusDiscrepancy;
import com.eqms.entity.ControlledCopyDistributionBatch;
import com.eqms.repository.ControlledCopyBatchStatusDiscrepancyRepository;
import com.eqms.repository.ControlledCopyDistributionBatchRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.ControlledCopyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The review list of batch status discrepancies is sorted by the server, one key per column of the screen. */
@SpringBootTest
@Transactional
class ControlledCopyBatchDiscrepancySortIntegrationTest {

    @Autowired private ControlledCopyService copyService;
    @Autowired private ControlledCopyBatchStatusDiscrepancyRepository discrepancyRepository;
    @Autowired private ControlledCopyDistributionBatchRepository batchRepository;
    @Autowired private UserAccountRepository userAccountRepository;

    private ControlledCopyBatchStatusDiscrepancy first;
    private ControlledCopyBatchStatusDiscrepancy second;

    @BeforeEach
    void setUp() {
        var admin = userAccountRepository.findByUsername("admin").orElseThrow(() -> new AssertionError("Seeded 'admin' user not found"));
        AuthenticatedUser principal = new AuthenticatedUser(admin.getId(), UUID.randomUUID(), admin.getUsername(),
                admin.getRoleName() != null ? admin.getRoleName() : "USER", Collections.emptySet());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));

        List<ControlledCopyDistributionBatch> batches = batchRepository.findAll().stream()
                .filter(batch -> batch.getDocumentNumber() != null)
                .collect(java.util.stream.Collectors.toMap(ControlledCopyDistributionBatch::getDocumentNumber, b -> b, (a, b) -> a))
                .values().stream().sorted(java.util.Comparator.comparing(ControlledCopyDistributionBatch::getDocumentNumber)).limit(2).toList();
        org.junit.jupiter.api.Assumptions.assumeTrue(batches.size() == 2, "Seed data needs batches of two different documents");
        // Two alerts that differ in every column, in the opposite order of each other.
        first = open(batches.get(0), "AAA-BATCH", "DISTRIBUTED", "OBSOLETED", Instant.parse("2020-01-01T00:00:00Z"), Instant.parse("2020-06-01T00:00:00Z"));
        second = open(batches.get(1), "ZZZ-BATCH", "READY_FOR_DISTRIBUTION", "CLOSED_CANCELLED", Instant.parse("2020-02-01T00:00:00Z"), Instant.parse("2020-05-01T00:00:00Z"));
    }

    private ControlledCopyBatchStatusDiscrepancy open(ControlledCopyDistributionBatch batch, String number, String actual, String expected,
                                                      Instant detected, Instant checked) {
        ControlledCopyBatchStatusDiscrepancy row = new ControlledCopyBatchStatusDiscrepancy();
        row.setBatch(batch);
        row.setBatchNumber(number);
        row.setActualStatusCode(actual);
        row.setExpectedStatusCode(expected);
        row.setStatus(ControlledCopyBatchStatusDiscrepancy.STATUS_OPEN);
        row.setDetectedAt(detected);
        row.setLastCheckedAt(checked);
        return discrepancyRepository.saveAndFlush(row);
    }

    private List<UUID> order(String sortBy, String direction) {
        return copyService.listBatchStatusDiscrepancies(1, 100, sortBy, direction).data().stream()
                .map(ControlledCopyBatchStatusDiscrepancyResponse::id).toList();
    }

    private void assertFirstBeforeSecond(String sortBy, boolean ascendingPutsFirstFirst) {
        List<UUID> asc = order(sortBy, "asc");
        List<UUID> desc = order(sortBy, "desc");
        boolean ascFirst = asc.indexOf(first.getId()) < asc.indexOf(second.getId());
        boolean descFirst = desc.indexOf(first.getId()) < desc.indexOf(second.getId());
        assertThat(ascFirst).as(sortBy + " ascending").isEqualTo(ascendingPutsFirstFirst);
        assertThat(descFirst).as(sortBy + " descending").isEqualTo(!ascendingPutsFirstFirst);
    }

    @Test
    void every_column_of_the_screen_sorts_both_ways_on_the_server() {
        assertFirstBeforeSecond("batchNumber", true);       // AAA < ZZZ
        assertFirstBeforeSecond("document", true);          // the first batch belongs to the smaller document number
        assertFirstBeforeSecond("storedStatus", true);      // DISTRIBUTED < READY_FOR_DISTRIBUTION
        assertFirstBeforeSecond("expectedStatus", false);   // OBSOLETED > CLOSED_CANCELLED
        assertFirstBeforeSecond("detectedAt", true);        // January before February
        assertFirstBeforeSecond("lastCheckedAt", false);    // June after May
    }

    @Test
    void the_default_is_the_newest_detection_first_and_an_unknown_key_does_not_break_it() {
        List<UUID> defaultOrder = order(null, null);
        assertThat(defaultOrder.indexOf(second.getId())).isLessThan(defaultOrder.indexOf(first.getId()));
        // A key that is not a column is ignored, whatever direction is asked for.
        assertThat(order("nonsense; drop table", "asc")).isEqualTo(defaultOrder);
    }
}
