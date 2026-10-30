package com.eqms.service;

import com.eqms.entity.UserAccount;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class StorageUsagePolicyServiceTest {
    @Test void rejectsInvalidBudgetAndThresholdBeforeChangingDatabase() {
        var jdbc = mock(JdbcTemplate.class);
        var audit = mock(AuditTrailService.class);
        var service = new StorageUsagePolicyService(jdbc, audit);
        var actor = mock(UserAccount.class);
        assertThrows(IllegalArgumentException.class, () -> service.save(actor, new StorageUsagePolicyService.Policy(0L, 80)));
        assertThrows(IllegalArgumentException.class, () -> service.save(actor, new StorageUsagePolicyService.Policy(100L, 0)));
        assertThrows(IllegalArgumentException.class, () -> service.save(actor, new StorageUsagePolicyService.Policy(100L, 101)));
        verifyNoInteractions(jdbc, audit);
    }
}
