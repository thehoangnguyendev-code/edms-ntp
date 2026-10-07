package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ReportTemplatePermissionBoundaryTest {
    @Test void staleCachedGrantCannotAuthorizeDownloadRetryOrConfigurationHistory() {
        var actor=new UserAccount();actor.setId(UUID.randomUUID());actor.setStatus(UserStatus.Active);
        var fresh=mock(EffectivePermissionService.class);when(fresh.getEffectivePermissionCodes(actor)).thenReturn(Set.of());
        var cached=mock(PermissionEvaluationService.class);when(cached.hasPermission(eq(actor),anyString())).thenReturn(true);
        var jdbc=mock(JdbcTemplate.class);var storage=mock(FileStorageService.class);var audit=mock(AuditTrailService.class);
        var templates=new ReportTemplateService(jdbc,new ObjectMapper(),fresh,audit,List.of(new DocumentReportMetadataProvider()));
        var platform=new ReportPlatformService(jdbc,new ObjectMapper(),cached,mock(DocumentRecordRepository.class),mock(UserAccountRepository.class),mock(DocumentAuthorizationService.class),storage,audit);platform.configureTemplates(templates);
        assertThrows(SecurityException.class,()->platform.download(actor,UUID.randomUUID(),UUID.randomUUID()));
        assertThrows(SecurityException.class,()->platform.retryRun(actor,UUID.randomUUID()));
        assertThrows(SecurityException.class,()->platform.configurationHistory(actor,"DOCUMENT_STATUS"));
        verifyNoInteractions(jdbc,storage,audit);
    }
}
