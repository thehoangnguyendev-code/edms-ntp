package com.eqms;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.dto.executedrecord.ExecutedRecordResponse;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.ExecutedRecord;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.ExecutedRecordRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.ExecutedRecordService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * The Records tables sort on the server, one key per column. Two records that differ in every column are added; one of them has
 * NO controlled copy and NO recipient (an older record), which must neither disappear from the list nor break the order when the
 * list is sorted by those columns.
 */
@SpringBootTest
@Transactional
class ExecutedRecordSortIntegrationTest {

    @Autowired private ExecutedRecordService service;
    @Autowired private ExecutedRecordRepository recordRepository;
    @Autowired private ControlledCopyRepository copyRepository;
    @Autowired private DocumentRecordRepository documentRepository;
    @Autowired private DocumentRevisionRepository revisionRepository;
    @Autowired private UserAccountRepository userAccountRepository;

    @BeforeEach
    void setUp() {
        UserAccount admin = userAccountRepository.findByUsername("admin").orElseThrow(() -> new AssertionError("Seeded admin user not found"));
        AuthenticatedUser principal = new AuthenticatedUser(admin.getId(), UUID.randomUUID(), admin.getUsername(),
                admin.getRoleName() != null ? admin.getRoleName() : "USER", Collections.emptySet());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));

        ControlledCopyRecord copy = copyRepository.findAll().stream()
                .filter(c -> c.getRevision() != null && c.getDocument() != null && c.getDocument().getDocumentNumber() != null)
                .findFirst().orElse(null);
        assumeTrue(copy != null, "Seed data needs a controlled copy");
        DocumentRecord document = copy.getDocument();
        DocumentRevisionRecord revision = copy.getRevision();
        DocumentRecord otherDocument = documentRepository.findAll().stream()
                .filter(d -> !d.getId().equals(document.getId()) && d.getDocumentNumber() != null)
                .filter(d -> revisionRepository.findAll().stream().anyMatch(r -> r.getDocument() != null && r.getDocument().getId().equals(d.getId())))
                .findFirst().orElse(null);
        assumeTrue(otherDocument != null, "Seed data needs a second document with a revision");
        DocumentRevisionRecord otherRevision = revisionRepository.findAll().stream()
                .filter(r -> r.getDocument() != null && r.getDocument().getId().equals(otherDocument.getId())).findFirst().orElseThrow();

        save("SORT-B-WITH", document, revision, copy, admin, Instant.parse("2020-03-01T00:00:00Z"), Instant.parse("2020-03-02T00:00:00Z"), "b-scan.pdf");
        save("SORT-A-WITHOUT", otherDocument, otherRevision, null, null, Instant.parse("2020-01-01T00:00:00Z"), Instant.parse("2020-01-02T00:00:00Z"), "a-scan.pdf");
    }

    private void save(String number, DocumentRecord document, DocumentRevisionRecord revision, ControlledCopyRecord copy,
                      UserAccount filledBy, Instant filledAt, Instant createdAt, String fileName) {
        ExecutedRecord record = new ExecutedRecord();
        record.setId(UUID.randomUUID());
        record.setRecordNumber(number);
        record.setFormDocument(document);
        record.setFormRevision(revision);
        record.setCaptureMethod("PAPER_SCAN");
        record.setStatus("EXECUTED");
        record.setSourceControlledCopy(copy);
        record.setFilledBy(filledBy);
        record.setFilledAt(filledAt);
        record.setFileName(fileName);
        record.setCreatedAt(createdAt);
        recordRepository.saveAndFlush(record);
    }

    /** Every page, so a record that fell out of a join would be missed. */
    private List<String> numbers(String sortBy, String direction) {
        var first = service.list(1, 100, null, null, null, null, null, sortBy, direction);
        List<String> all = new ArrayList<>(first.data().stream().map(ExecutedRecordResponse::recordNumber).toList());
        for (int page = 2; page <= first.pagination().totalPages(); page++) {
            all.addAll(service.list(page, 100, null, null, null, null, null, sortBy, direction).data().stream()
                    .map(ExecutedRecordResponse::recordNumber).toList());
        }
        return all;
    }

    private boolean before(String key, String direction, String earlier, String later) {
        List<String> order = numbers(key, direction);
        return order.indexOf(earlier) >= 0 && order.indexOf(earlier) < order.indexOf(later);
    }

    @Test
    void every_column_sorts_both_ways_and_no_record_is_lost_to_an_empty_relation() {
        int total = numbers("created", "desc").size();
        for (String key : List.of("number", "document", "copy", "recipient", "filled", "scan", "created")) {
            for (String direction : List.of("asc", "desc")) {
                assertThat(numbers(key, direction)).as(key + " " + direction + " keeps every record")
                        .hasSize(total).contains("SORT-B-WITH", "SORT-A-WITHOUT");
            }
        }
    }

    @Test
    void the_columns_put_the_two_records_in_the_expected_order() {
        assertThat(before("number", "asc", "SORT-A-WITHOUT", "SORT-B-WITH")).isTrue();
        assertThat(before("number", "desc", "SORT-B-WITH", "SORT-A-WITHOUT")).isTrue();
        assertThat(before("filled", "asc", "SORT-A-WITHOUT", "SORT-B-WITH")).isTrue();
        assertThat(before("filled", "desc", "SORT-B-WITH", "SORT-A-WITHOUT")).isTrue();
        assertThat(before("created", "asc", "SORT-A-WITHOUT", "SORT-B-WITH")).isTrue();
        assertThat(before("created", "desc", "SORT-B-WITH", "SORT-A-WITHOUT")).isTrue();
        assertThat(before("scan", "asc", "SORT-A-WITHOUT", "SORT-B-WITH")).isTrue();
        assertThat(before("scan", "desc", "SORT-B-WITH", "SORT-A-WITHOUT")).isTrue();
        // A record without a copy or a recipient has nothing to sort on: the database puts the empty value after the others
        // ascending and before them descending, and the record still appears.
        assertThat(before("copy", "asc", "SORT-B-WITH", "SORT-A-WITHOUT")).isTrue();
        assertThat(before("copy", "desc", "SORT-A-WITHOUT", "SORT-B-WITH")).isTrue();
        assertThat(before("recipient", "asc", "SORT-B-WITH", "SORT-A-WITHOUT")).isTrue();
        assertThat(before("recipient", "desc", "SORT-A-WITHOUT", "SORT-B-WITH")).isTrue();
    }

    @Test
    void an_unknown_key_keeps_the_default_order_newest_first() {
        assertThat(numbers("nonsense", "asc")).isEqualTo(numbers("created", "desc"));
    }

    @Test
    void recorded_date_filters_created_at_with_inclusive_local_days_and_independent_received_dates() {
        ExecutedRecord template = recordRepository.findAll().stream()
                .filter(r -> "SORT-A-WITHOUT".equals(r.getRecordNumber())).findFirst().orElseThrow();
        Instant received = Instant.parse("2020-01-09T00:00:00Z");
        String[] suffixes = {"BEFORE", "START", "LAST", "NEXT"};
        String[] times = {"2020-01-01T16:59:59Z", "2020-01-01T17:00:00Z", "2020-01-02T16:59:59.999999Z", "2020-01-02T17:00:00Z"};
        for (int i = 0; i < times.length; i++) {
            save("RECORDED-DATE-" + suffixes[i], template.getFormDocument(), template.getFormRevision(), null, null,
                    received, Instant.parse(times[i]), "recorded-date.pdf");
        }

        var day = service.list(1, 20, "RECORDED-DATE-", null, null, null, null,
                "2020-01-02", "2020-01-02", "created", "asc");
        assertThat(day.data()).extracting(ExecutedRecordResponse::recordNumber)
                .containsExactly("RECORDED-DATE-START", "RECORDED-DATE-LAST");
        assertThat(day.pagination().total()).isEqualTo(2);

        assertThat(service.list(1, 20, "RECORDED-DATE-", null, null, null, null,
                "2020-01-02", null, "created", "asc").data()).hasSize(3);
        assertThat(service.list(1, 20, "RECORDED-DATE-", null, null, null, null,
                null, "2020-01-02", "created", "asc").data()).hasSize(3);
        assertThat(service.list(1, 20, "RECORDED-DATE-", null, null, "2020-01-02", "2020-01-02",
                "2020-01-02", "2020-01-02", "created", "asc").data()).isEmpty();
        assertThat(service.list(1, 20, "RECORDED-DATE-", null, null, null, null,
                "2020-01-03", "2020-01-02", "created", "asc").data()).isEmpty();
    }
}
