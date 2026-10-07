package com.eqms;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyRequestContextResponse;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UncontrolledCopyPolicySetting;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.UncontrolledCopyPolicySettingRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.UncontrolledCopyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * The request screen shows exactly how long an uncontrolled copy will be valid: with the document basis, the date and time the server
 * works out from the document's Valid Until date plus the policy's hours. Real schema (V552 adds the basis); rolled back.
 */
@SpringBootTest
@Transactional
class UncontrolledCopyValidityIntegrationTest {

    @Autowired private UncontrolledCopyService service;
    @Autowired private UncontrolledCopyPolicySettingRepository policyRepository;
    @Autowired private DocumentRecordRepository documentRepository;
    @Autowired private DocumentRevisionRepository revisionRepository;
    @Autowired private UserAccountRepository userAccountRepository;

    private DocumentRecord document;
    private DocumentRevisionRecord revision;

    @BeforeEach
    void setUp() {
        UserAccount admin = userAccountRepository.findByUsername("admin").orElseThrow(() -> new AssertionError("Seeded admin user not found"));
        AuthenticatedUser principal = new AuthenticatedUser(admin.getId(), UUID.randomUUID(), admin.getUsername(),
                admin.getRoleName() != null ? admin.getRoleName() : "USER", Collections.emptySet());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
        for (DocumentRecord candidate : documentRepository.findAll()) {
            DocumentRevisionRecord effective = revisionRepository
                    .findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(candidate.getId(), "EFFECTIVE").orElse(null);
            if (effective != null && !candidate.isTemplate()) {
                document = candidate;
                revision = effective;
                break;
            }
        }
        assumeTrue(document != null, "Seed data needs a document with an Effective revision");
    }

    private UncontrolledCopyPolicySetting policy(String basis, int hours) {
        UncontrolledCopyPolicySetting policy = policyRepository.findById(UncontrolledCopyPolicySetting.DEFAULT_ID).orElseGet(UncontrolledCopyPolicySetting::new);
        policy.setValidityBasis(basis);
        policy.setValidityHours(hours);
        return policyRepository.saveAndFlush(policy);
    }

    private void validUntil(LocalDate date) {
        document.setValidUntil(date);
        revision.setValidUntil(date);
        documentRepository.saveAndFlush(document);
        revisionRepository.saveAndFlush(revision);
    }

    @Test
    void with_the_document_basis_the_context_carries_the_exact_date_and_time() {
        policy("DOCUMENT_VALID_UNTIL", 72);
        validUntil(LocalDate.of(2099, 10, 27));

        UncontrolledCopyRequestContextResponse context = service.getRequestContext(document.getId().toString(), null);

        assertThat(context.validityBasis()).isEqualTo("DOCUMENT_VALID_UNTIL");
        assertThat(context.validityHours()).isEqualTo(72);
        assertThat(context.documentValidUntil()).contains("27").contains("2099");
        assertThat(context.computedValidUntil()).as("27/10/2099 + 72 hours ends on the 30th").contains("30").contains("2099").contains("23:59");
    }

    @Test
    void with_the_default_basis_nothing_is_computed_in_advance() {
        policy("DISTRIBUTION", 72);

        UncontrolledCopyRequestContextResponse context = service.getRequestContext(document.getId().toString(), null);

        assertThat(context.validityBasis()).isEqualTo("DISTRIBUTION");
        assertThat(context.computedValidUntil()).isNull();
    }

    @Test
    void a_document_without_a_valid_until_date_cannot_be_requested_under_the_document_basis() {
        policy("DOCUMENT_VALID_UNTIL", 0);
        validUntil(null);

        UncontrolledCopyRequestContextResponse context = service.getRequestContext(document.getId().toString(), null);

        assertThat(context.canRequest()).isFalse();
        assertThat(context.message()).contains("no Valid Until date");
        assertThat(context.computedValidUntil()).isNull();
    }

    @Test
    void a_document_whose_valid_until_date_has_passed_cannot_be_requested_either() {
        policy("DOCUMENT_VALID_UNTIL", 0);
        validUntil(LocalDate.now().minusDays(3));

        UncontrolledCopyRequestContextResponse context = service.getRequestContext(document.getId().toString(), null);

        assertThat(context.canRequest()).isFalse();
        assertThat(context.message()).contains("already passed");
    }
}
