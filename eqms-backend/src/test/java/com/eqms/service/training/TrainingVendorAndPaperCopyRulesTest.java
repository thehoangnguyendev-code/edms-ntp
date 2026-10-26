package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ElectronicSignatureService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The register of approved training vendors (SOP.0025) and the state of a numbered paper copy: what the rules say, without a database. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TrainingVendorAndPaperCopyRulesTest {
    @Mock JdbcTemplate jdbc;
    @Mock TrainingAccess access;
    @Mock ElectronicSignatureService signatures;
    @Mock AuditTrailService audit;
    @Mock TrainingStore store;

    private final UserAccount actor = mock(UserAccount.class);

    private TrainingVendorService vendors() {
        return new TrainingVendorService(jdbc, access, signatures, audit);
    }

    private static java.sql.Date date(LocalDate d) {
        return java.sql.Date.valueOf(d);
    }

    @Test
    void aUnitThatIsNotNamedOrNotInTheRegisterGetsAWarning() {
        assertThat(vendors().check(null)).isEqualTo("VENDOR_NOT_NAMED");
        assertThat(vendors().check("  ")).isEqualTo("VENDOR_NOT_NAMED");
        when(jdbc.queryForList(contains("training_approved_providers"), anyString())).thenReturn(List.of());
        assertThat(vendors().check("Unknown Ltd")).isEqualTo("VENDOR_NOT_APPROVED");
    }

    @Test
    void anApprovedUnitHasNoWarningUntilItsApprovalEnds() {
        when(jdbc.queryForList(contains("training_approved_providers"), eq("Acme"))).thenReturn(List.of(Map.of("valid_until", date(LocalDate.now().plusDays(5)))));
        assertThat(vendors().check("Acme")).isNull();
        when(jdbc.queryForList(contains("training_approved_providers"), eq("Old Co"))).thenReturn(List.of(Map.of("valid_until", date(LocalDate.now().minusDays(1)))));
        assertThat(vendors().check("Old Co")).isEqualTo("VENDOR_APPROVAL_ENDED");
        java.util.Map<String, Object> noEnd = new java.util.HashMap<>();
        noEnd.put("valid_until", null);
        when(jdbc.queryForList(contains("training_approved_providers"), eq("Forever"))).thenReturn(List.of(noEnd));
        assertThat(vendors().check("Forever")).isNull();
    }

    @Test
    void aVendorNeedsANameAndAValidityThatHasNotPassed() {
        TrainingVendorService service = vendors();
        assertThatThrownBy(() -> service.create(actor, new TrainingVendorService.SaveRequest(" ", null, null))).hasMessage("TRAINING_VENDOR_NAME_REQUIRED");
        assertThatThrownBy(() -> service.create(actor, new TrainingVendorService.SaveRequest("Acme", null, LocalDate.now().minusDays(1)))).hasMessage("TRAINING_VENDOR_VALIDITY_PAST");
        verify(signatures, never()).createEntitySignature(any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void theSameNameCannotBeInTheRegisterTwice() {
        when(jdbc.queryForObject(contains("lower(btrim(name))"), eq(Integer.class), any(Object[].class))).thenReturn(1);
        assertThatThrownBy(() -> vendors().create(actor, new TrainingVendorService.SaveRequest("Acme", null, null)))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("TRAINING_VENDOR_EXISTS");
    }

    @Test
    void theWriterOfAVendorCannotApproveIt() {
        UUID me = UUID.randomUUID();
        when(actor.getId()).thenReturn(me);
        UUID id = UUID.randomUUID();
        when(jdbc.queryForList(contains("for update"), any(Object[].class))).thenReturn(List.of(Map.of("status", "DRAFT", "created_by", me, "name", "Acme")));
        assertThatThrownBy(() -> vendors().approve(actor, id, new TrainingVendorService.SignRequest("token"))).hasMessage(TrainingApprovalService.SEGREGATION);
        verify(signatures, never()).createEntitySignature(any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void aVendorThatIsNotInactiveIsNotActivatedAndOneThatIsNotActiveIsNotDeactivated() {
        UUID id = UUID.randomUUID();
        when(jdbc.queryForList(contains("for update"), any(Object[].class))).thenReturn(List.of(Map.of("status", "DRAFT", "created_by", UUID.randomUUID(), "name", "Acme")));
        assertThatThrownBy(() -> vendors().activate(actor, id, new TrainingVendorService.ChangeRequest("why", "token", null))).hasMessageContaining("TRAINING_VENDOR_NOT_INACTIVE");
        assertThatThrownBy(() -> vendors().deactivate(actor, id, new TrainingVendorService.ChangeRequest("why", "token", null))).hasMessageContaining("TRAINING_VENDOR_NOT_ACTIVE");
    }

    @Test
    void aClosedPaperCopyDoesNotChangeAndAStateThatIsNotAClosingOneIsRefused() {
        TrainingPaperService paper = new TrainingPaperService(jdbc, access, store);
        UUID pack = UUID.randomUUID();
        assertThatThrownBy(() -> paper.markPack(actor, pack, "ISSUED", null)).hasMessage("TRAINING_PAPER_STATUS_INVALID");
        assertThatThrownBy(() -> paper.markPack(actor, pack, null, null)).hasMessage("TRAINING_PAPER_STATUS_INVALID");
    }
}
