package com.eqms;

import com.eqms.dto.uncontrolledcopypolicy.UncontrolledCopyPolicyRequest;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UncontrolledCopyPolicySetting;
import com.eqms.service.UncontrolledCopyPolicyService;
import com.eqms.service.UncontrolledCopyService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * An Uncontrolled Copy is valid either for N hours after it is distributed (the default, unchanged), or until the end of its
 * document's Valid Until date plus N hours (UC-VALIDITY-2026-10-07).
 */
class UncontrolledCopyValidityBasisTest {

    private static final ZoneId ZONE = ZoneId.systemDefault();
    private final UncontrolledCopyPolicyService policyService = new UncontrolledCopyPolicyService(null, null, null, null, null, null, null);

    private static UncontrolledCopyPolicySetting policy(String basis, int hours) {
        UncontrolledCopyPolicySetting policy = new UncontrolledCopyPolicySetting();
        policy.setValidityBasis(basis);
        policy.setValidityHours(hours);
        return policy;
    }

    private static DocumentRecord document(LocalDate validUntil) {
        DocumentRecord document = new DocumentRecord();
        document.setValidUntil(validUntil);
        return document;
    }

    private static Instant at(int year, int month, int day, int hour, int minute, int second) {
        return LocalDateTime.of(year, month, day, hour, minute, second).atZone(ZONE).toInstant();
    }

    private void apply(UncontrolledCopyPolicySetting setting, Integer hours, String basis) {
        ReflectionTestUtils.invokeMethod(policyService, "applyRequest", setting,
                new UncontrolledCopyPolicyRequest(null, hours, basis, null, null, null, null, null));
    }

    @Test
    void counted_from_the_distribution_it_is_the_distribution_plus_the_hours_as_before() {
        Instant distributed = at(2026, 10, 7, 9, 0, 0);

        assertThat(UncontrolledCopyService.computeValidUntil(policy("DISTRIBUTION", 72), null, document(null), distributed))
                .contains(at(2026, 10, 10, 9, 0, 0));
        // The document's Valid Until plays no part in it.
        assertThat(UncontrolledCopyService.computeValidUntil(policy("DISTRIBUTION", 72), null, document(LocalDate.of(2027, 10, 27)), distributed))
                .contains(at(2026, 10, 10, 9, 0, 0));
    }

    @Test
    void counted_from_the_document_it_is_the_end_of_its_valid_until_day_plus_the_hours() {
        Instant distributed = at(2026, 10, 7, 9, 0, 0);

        // 27/10/2027 + 72 hours: valid through the whole of 27/10/2027, then 72 hours more.
        assertThat(UncontrolledCopyService.computeValidUntil(policy("DOCUMENT_VALID_UNTIL", 72), null, document(LocalDate.of(2027, 10, 27)), distributed))
                .contains(at(2027, 10, 30, 23, 59, 59));
        // 0 hours: that day only.
        assertThat(UncontrolledCopyService.computeValidUntil(policy("DOCUMENT_VALID_UNTIL", 0), null, document(LocalDate.of(2027, 10, 27)), distributed))
                .contains(at(2027, 10, 27, 23, 59, 59));
    }

    @Test
    void the_revisions_valid_until_is_used_before_the_documents() {
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setValidUntil(LocalDate.of(2027, 1, 31));

        assertThat(UncontrolledCopyService.computeValidUntil(policy("DOCUMENT_VALID_UNTIL", 0), revision, document(LocalDate.of(2027, 10, 27)), Instant.now()))
                .contains(at(2027, 1, 31, 23, 59, 59));
    }

    @Test
    void a_document_without_a_valid_until_date_cannot_be_issued_under_the_document_basis_and_says_why() {
        UncontrolledCopyPolicySetting policy = policy("DOCUMENT_VALID_UNTIL", 0);

        assertThat(UncontrolledCopyService.computeValidUntil(policy, null, document(null), Instant.now())).isEmpty();
        assertThat(UncontrolledCopyService.validityProblem(policy, null, document(null), Instant.now())).contains("no Valid Until date");
        // Under the distribution basis the same document is fine.
        assertThat(UncontrolledCopyService.validityProblem(policy("DISTRIBUTION", 72), null, document(null), Instant.now())).isNull();
    }

    @Test
    void a_copy_that_would_already_be_expired_is_refused_with_the_reason() {
        UncontrolledCopyPolicySetting policy = policy("DOCUMENT_VALID_UNTIL", 24);
        DocumentRecord expired = document(LocalDate.now().minusDays(5));

        assertThat(UncontrolledCopyService.validityProblem(policy, null, expired, Instant.now()))
                .contains("already passed").contains("24 hours");
        // Still inside the extra hours: allowed.
        assertThat(UncontrolledCopyService.validityProblem(policy, null, document(LocalDate.now()), Instant.now())).isNull();
    }

    @Test
    void the_policy_accepts_zero_hours_only_with_the_document_basis() {
        UncontrolledCopyPolicySetting setting = new UncontrolledCopyPolicySetting();

        apply(setting, 0, "DOCUMENT_VALID_UNTIL");
        assertThat(setting.getValidityBasis()).isEqualTo("DOCUMENT_VALID_UNTIL");
        assertThat(setting.getValidityHours()).isZero();

        assertThatThrownBy(() -> apply(setting, 0, "DISTRIBUTION")).hasMessageContaining("between 1 and 8760");
        assertThatThrownBy(() -> apply(setting, 8761, "DOCUMENT_VALID_UNTIL")).hasMessageContaining("between 0 and 8760");
        assertThatThrownBy(() -> apply(setting, 10, "FOREVER")).hasMessageContaining("DISTRIBUTION or DOCUMENT_VALID_UNTIL");
    }

    @Test
    void changing_only_the_basis_is_checked_against_the_stored_hours_and_the_default_changes_nothing() {
        UncontrolledCopyPolicySetting fresh = new UncontrolledCopyPolicySetting();
        assertThat(fresh.getValidityBasis()).isEqualTo("DISTRIBUTION");
        assertThat(fresh.getValidityHours()).isEqualTo(72);

        UncontrolledCopyPolicySetting zero = policy("DOCUMENT_VALID_UNTIL", 0);
        assertThatThrownBy(() -> apply(zero, null, "DISTRIBUTION")).hasMessageContaining("between 1 and 8760");
    }
}
