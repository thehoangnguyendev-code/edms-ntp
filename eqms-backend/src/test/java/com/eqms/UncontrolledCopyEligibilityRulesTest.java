package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyEligibilityRuleRequest;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentType;
import com.eqms.entity.UncontrolledCopyEligibilityRule;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentTypeRepository;
import com.eqms.repository.UncontrolledCopyEligibilityRuleRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.UncontrolledCopyService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UncontrolledCopyEligibilityRulesTest {
    @Mock private UncontrolledCopyEligibilityRuleRepository eligibilityRuleRepository;
    @Mock private DocumentTypeRepository documentTypeRepository;
    @Mock private CurrentUserService currentUserService;
    @Mock private AuditTrailService auditTrailService;
    @InjectMocks private UncontrolledCopyService service;

    private UncontrolledCopyEligibilityRule rule(boolean system, boolean active, boolean allowed) {
        var rule = new UncontrolledCopyEligibilityRule();
        rule.setId(UUID.randomUUID());
        rule.setSystem(system);
        rule.setActive(active);
        rule.setAllowed(allowed);
        rule.setUpdatedAt(Instant.parse("2026-09-30T00:00:00Z"));
        return rule;
    }

    @Test void defaultRuleCanBeDeactivatedAndAudited() {
        var rule = rule(true, true, false);
        var actor = new UserAccount();
        when(currentUserService.requireCurrentUser()).thenReturn(actor);
        when(eligibilityRuleRepository.findById(rule.getId())).thenReturn(Optional.of(rule));
        var result = service.updateEligibilityRule(rule.getId(), new UncontrolledCopyEligibilityRuleRequest(null, true, false, "test"));
        assertFalse(result.active());
        assertTrue(result.allowed());
        verify(eligibilityRuleRepository).saveAndFlush(rule);
        verify(auditTrailService).logAs(eq(actor), eq("UNCONTROLLED_COPY_ELIGIBILITY_RULE"), anyString(), eq(rule.getId()),
                eq("UPDATED"), anyString(), anyString(), anyString(), argThat(changes -> changes.size() == 2), isNull());
    }

    @Test void defaultRuleCanChangeDocumentType() {
        var rule = rule(true, true, false);
        var type = new DocumentType();
        type.setId(UUID.randomUUID());
        type.setName("SOP");
        when(currentUserService.requireCurrentUser()).thenReturn(new UserAccount());
        when(eligibilityRuleRepository.findById(rule.getId())).thenReturn(Optional.of(rule));
        when(documentTypeRepository.findById(type.getId())).thenReturn(Optional.of(type));
        when(eligibilityRuleRepository.findAllByActiveTrue()).thenReturn(List.of(rule));
        var result = service.updateEligibilityRule(rule.getId(), new UncontrolledCopyEligibilityRuleRequest(type.getId(), true, true, null));
        assertEquals(type.getId(), result.documentTypeId());
        assertFalse(result.system());
    }

    @Test void defaultRuleCanBeDeletedAndAudited() {
        var rule = rule(true, true, false);
        var actor = new UserAccount();
        when(currentUserService.requireCurrentUser()).thenReturn(actor);
        when(eligibilityRuleRepository.findById(rule.getId())).thenReturn(Optional.of(rule));
        service.deleteEligibilityRule(rule.getId(), "test");
        verify(eligibilityRuleRepository).delete(rule);
        verify(auditTrailService).logAs(eq(actor), eq("UNCONTROLLED_COPY_ELIGIBILITY_RULE"), anyString(), eq(rule.getId()),
                eq("DELETED"), anyString(), isNull(), anyString(), anyList(), isNull());
    }

    @Test void activatingDuplicateAnyRuleIsRejected() {
        var inactive = rule(true, false, false);
        when(currentUserService.requireCurrentUser()).thenReturn(new UserAccount());
        when(eligibilityRuleRepository.findById(inactive.getId())).thenReturn(Optional.of(inactive));
        when(eligibilityRuleRepository.findAllByActiveTrue()).thenReturn(List.of(rule(false, true, true)));
        assertThrows(IllegalArgumentException.class, () -> service.updateEligibilityRule(inactive.getId(),
                new UncontrolledCopyEligibilityRuleRequest(null, true, true, null)));
        verify(eligibilityRuleRepository, never()).saveAndFlush(any());
        verifyNoInteractions(auditTrailService);
    }

    @Test void noActiveMatchingRuleStillDeniesIssuance() {
        when(eligibilityRuleRepository.findAllByActiveTrue()).thenReturn(List.of());
        assertFalse(service.resolveEligibility(new DocumentRecord()).allowed());
    }

    @Test void sortingAppliesBeforePaginationAndDoesNotPinSystemRow() {
        var any = rule(true, true, false);
        var sop = rule(false, false, true);
        var type = new DocumentType();
        type.setId(UUID.randomUUID());
        type.setName("SOP");
        sop.setDocumentType(type);
        when(eligibilityRuleRepository.findAll(any(org.springframework.data.domain.Sort.class))).thenReturn(List.of(any, sop));
        assertEquals(sop.getId(), service.listEligibilityRulesPaged(1, 1, null, null, "documentTypeName", "desc").data().get(0).id());
        assertEquals(any.getId(), service.listEligibilityRulesPaged(2, 1, null, null, "documentTypeName", "desc").data().get(0).id());
        assertEquals(sop.getId(), service.listEligibilityRulesPaged(1, 20, "sop", "INACTIVE", "allowed", "asc").data().get(0).id());
        assertThrows(IllegalArgumentException.class, () -> service.listEligibilityRulesPaged(1, 20, null, null, "invalid", "asc"));
        assertThrows(IllegalArgumentException.class, () -> service.listEligibilityRulesPaged(1, 20, null, null, "active", "invalid"));
    }
}
