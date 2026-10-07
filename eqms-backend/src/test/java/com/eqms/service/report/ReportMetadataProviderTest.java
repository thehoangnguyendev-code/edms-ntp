package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.AuditTrailService;
import com.eqms.service.EffectivePermissionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ReportMetadataProviderTest {
    final DocumentReportMetadataProvider provider=new DocumentReportMetadataProvider();
    UserAccount actor() { var actor=new UserAccount(); actor.setId(UUID.randomUUID()); actor.setStatus(UserStatus.Active); return actor; }
    @Test void denyMissingScope() { assertThrows(SecurityException.class,()->provider.query(actor(),List.of(),Map.of())); }
    @Test void denyMissingDepartment() { assertThrows(SecurityException.class,()->provider.query(actor(),List.of("DEPARTMENT"),Map.of())); }
    @Test void denyUnknownScope() { assertThrows(SecurityException.class,()->provider.query(actor(),List.of("GLOBAL"),Map.of())); }
    @Test void rejectUnknownFilter() { assertThrows(IllegalArgumentException.class,()->provider.query(actor(),List.of("SYSTEM"),Map.of("sql","select *"))); }
    @Test void rejectReversedDates() { assertThrows(IllegalArgumentException.class,()->provider.query(actor(),List.of("SYSTEM"),Map.of("createdFrom","2026-10-02","createdTo","2026-10-01"))); }
    @Test void rejectOversizedDateRange() { assertThrows(IllegalArgumentException.class,()->provider.query(actor(),List.of("SYSTEM"),Map.of("createdFrom","2020-01-01","createdTo","2026-10-01"))); }
    @Test void rejectInvalidDate() { assertThrows(IllegalArgumentException.class,()->provider.query(actor(),List.of("SYSTEM"),Map.of("effectiveFrom","not-a-date"))); }
    @Test void departmentUsesActorNotPayload() {
        var actor=actor();actor.setDepartment("QA"); var query=provider.query(actor,List.of("DEPARTMENT"),Map.of("department","another-id"));
        assertEquals(List.of("QA","another-id"),query.arguments()); assertTrue(query.fromWhere().contains("dep.name=?"));
    }
    @Test void escapeSearchAndParameterizeLookup() {
        var query=provider.query(actor(),List.of("SYSTEM"),Map.of("search","%_\\","status","x' OR true--"));
        assertEquals(List.of("%\\%\\_\\\\%","%\\%\\_\\\\%","x' OR true--"),query.arguments()); assertFalse(query.fromWhere().contains("OR true"));
    }
    @Test void personalIncludesOnlyOwnAndWorkflowRelations() {
        var actor=actor(); var query=provider.query(actor,List.of("PERSONAL"),Map.of());
        assertEquals(List.of(actor.getId(),actor.getId(),actor.getId()),query.arguments());
        assertTrue(query.fromWhere().contains("revision_workflow_participants")); assertFalse(query.fromWhere().contains("where (true"));
    }
    @Test void permissionsAreFreshAndInactiveAccountDenied() {
        var permissions=mock(EffectivePermissionService.class); var actor=actor();
        var service=new ReportTemplateService(mock(JdbcTemplate.class),new ObjectMapper(),permissions,mock(AuditTrailService.class),List.of(provider));
        when(permissions.getEffectivePermissionCodes(actor)).thenReturn(Set.of("reports.run.create"),Set.of());
        service.require(actor,"reports.run.create"); assertThrows(SecurityException.class,()->service.require(actor,"reports.run.create"));
        actor.setStatus(UserStatus.Inactive); assertThrows(SecurityException.class,()->service.require(actor,"reports.run.create"));
    }
}
