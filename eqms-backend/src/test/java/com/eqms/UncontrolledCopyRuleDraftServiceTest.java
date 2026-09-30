package com.eqms;

import com.eqms.dto.uncontrolledcopypolicy.UncontrolledCopyRuleChange;
import com.eqms.entity.UncontrolledCopyEligibilityRule;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentTypeRepository;
import com.eqms.repository.UncontrolledCopyEligibilityRuleRepository;
import com.eqms.service.UncontrolledCopyRuleDraftService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

@ExtendWith(MockitoExtension.class)
class UncontrolledCopyRuleDraftServiceTest {
    @Mock UncontrolledCopyEligibilityRuleRepository repository;
    @Mock DocumentTypeRepository types;
    @InjectMocks UncontrolledCopyRuleDraftService service;

    private UncontrolledCopyEligibilityRule existing() {
        var row = new UncontrolledCopyEligibilityRule();
        row.setId(UUID.randomUUID());
        row.setUpdatedAt(Instant.parse("2026-09-30T00:00:00Z"));
        row.setActive(true);
        row.setAllowed(false);
        row.setSystem(true);
        return row;
    }

    @Test void duplicateFinalScopesRejectEntireDraftBeforeMutating() {
        var row = existing();
        when(repository.findAll()).thenReturn(List.of(row));
        assertThrows(IllegalArgumentException.class, () -> service.apply(List.of(
                new UncontrolledCopyRuleChange(row.getId(), row.getUpdatedAt(), false, null, true, true),
                new UncontrolledCopyRuleChange(null, null, false, null, true, true)), new UserAccount()));
        assertFalse(row.isAllowed());
        assertTrue(row.isActive());
        verify(repository, never()).save(any());
        verify(repository, never()).flush();
    }

    @Test void staleRuleRejectsDraftBeforeMutating() {
        var row = existing();
        when(repository.findAll()).thenReturn(List.of(row));
        var ex = assertThrows(ResponseStatusException.class, () -> service.apply(List.of(
                new UncontrolledCopyRuleChange(row.getId(), row.getUpdatedAt().minusSeconds(1), true, null, false, false)), new UserAccount()));
        assertEquals(409, ex.getStatusCode().value());
        verify(repository, never()).delete(any());
        verify(repository, never()).flush();
    }

    @Test void replacingDefaultInOneSaveReleasesScopeAndReturnsDetailedAudit() {
        var row = existing();
        when(repository.findAll()).thenReturn(List.of(row));
        var changes = service.apply(List.of(
                new UncontrolledCopyRuleChange(row.getId(), row.getUpdatedAt(), true, null, false, false),
                new UncontrolledCopyRuleChange(null, null, false, null, true, true)), new UserAccount());
        assertEquals(2, changes.size());
        var order = inOrder(repository);
        order.verify(repository).findAll();
        order.verify(repository).delete(row);
        order.verify(repository).flush();
        order.verify(repository).save(any(UncontrolledCopyEligibilityRule.class));
        order.verify(repository).flush();
    }

    @Test void updatesReportOldAndNewValuesForBothStates() {
        var row = existing();
        when(repository.findAll()).thenReturn(List.of(row));
        var audit = service.apply(List.of(new UncontrolledCopyRuleChange(row.getId(), row.getUpdatedAt(), false, null, true, false)), new UserAccount());
        assertEquals(2, audit.size());
        assertTrue(row.isAllowed());
        assertFalse(row.isActive());
    }
}
