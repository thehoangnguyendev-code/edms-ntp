package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.repository.*;
import com.eqms.service.report.ReportArtifactPublisher;
import com.eqms.service.report.ReportTemplateService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** REPORT-RUN-AUDIT-2026-11-16: the Audit Trail tab of a run is open to whoever may open the run, and what the system did to the run is in it. */
class ReportRunAuditTest {
    JdbcTemplate jdbc=mock(JdbcTemplate.class);
    PermissionEvaluationService permissions=mock(PermissionEvaluationService.class);
    ReportTemplateService templates=mock(ReportTemplateService.class);
    AuditTrailService audit=mock(AuditTrailService.class);
    UserAccount actor=new UserAccount();UUID runId=UUID.randomUUID();
    ReportPlatformService service=new ReportPlatformService(jdbc,new ObjectMapper(),permissions,mock(DocumentRecordRepository.class),mock(UserAccountRepository.class),mock(DocumentAuthorizationService.class),mock(FileStorageService.class),audit);

    @BeforeEach void setup(){
        actor.setId(UUID.randomUUID());service.configureTemplates(templates);
        when(permissions.hasPermission(actor,"reports.run.view_own")).thenReturn(true);
    }
    private void requester(UUID id){when(jdbc.queryForList(anyString(),eq(runId))).thenReturn(List.of(Map.of("requester_user_id",id)));}

    @Test void theRequesterOfARunMayReadItsAuditTrail(){ requester(actor.getId()); assertTrue(service.canViewRunAudit(actor,runId)); }
    @Test void anotherPersonMayNotUnlessTheyMaySeeEveryRun(){
        requester(UUID.randomUUID());
        assertFalse(service.canViewRunAudit(actor,runId));
        when(permissions.hasPermission(actor,"reports.run.view_all")).thenReturn(true);
        assertTrue(service.canViewRunAudit(actor,runId));
    }
    @Test void aRunThatDoesNotExistAndAPersonWithoutThePermissionAreRefused(){
        when(jdbc.queryForList(anyString(),eq(runId))).thenReturn(List.of());
        when(permissions.hasPermission(actor,"reports.run.view_all")).thenReturn(true);
        assertFalse(service.canViewRunAudit(actor,runId));
        requester(actor.getId());
        doThrow(new SecurityException("no")).when(templates).require(eq(actor),eq("reports.run.view_own"),eq("report.module.view"));
        assertFalse(service.canViewRunAudit(actor,runId));
    }

    private ReportArtifactPublisher publisher(String status,int attempt){
        when(jdbc.queryForMap(anyString(),any(Object.class))).thenReturn(Map.of("status",status,"attempt_count",attempt,"requester_user_id",UUID.randomUUID(),"definition_code","RPT.0008","leased",true));
        var publisher=new ReportArtifactPublisher(jdbc,templates,mock(UserAccountRepository.class));
        ReflectionTestUtils.setField(publisher,"audit",audit);
        return publisher;
    }
    @Test void aCompletedRunIsRecordedAsDoneBySystemWithTheFileAndItsHash() throws Exception {
        publisher("PROCESSING",1).publish(runId,1,UUID.randomUUID(),"RPT.0008",new ObjectMapper().readTree("{}"),"PDF","RPT.0008-RUN-000007.pdf",mock(FileStorageService.StorageWriteResult.class),"application/pdf",2048,"c".repeat(64),null);
        verify(audit).logSystem(eq("REPORT_RUN"),eq("RPT.0008"),eq(runId),eq("REPORT_RUN_COMPLETED"),eq("PROCESSING"),eq("COMPLETED"),argThat(text->text.contains("RPT.0008-RUN-000007.pdf")&&text.contains("c".repeat(64))));
    }
    @Test void aFailureSaysWhyAndWhetherAnotherAttemptFollows(){
        publisher("PROCESSING",1).fail(runId,1,new IllegalStateException("storage unavailable"));
        verify(audit).logSystem(eq("REPORT_RUN"),eq("RPT.0008"),eq(runId),eq("REPORT_RUN_RETRY_SCHEDULED"),eq("PROCESSING"),eq("RETRY_SCHEDULED"),argThat(text->text.contains("REPORT_GENERATION_FAILED")&&text.contains("Next attempt in")));
        clearInvocations(audit);
        publisher("PROCESSING",3).fail(runId,3,new IllegalStateException("storage unavailable"));
        verify(audit).logSystem(eq("REPORT_RUN"),eq("RPT.0008"),eq(runId),eq("REPORT_RUN_FAILED"),eq("PROCESSING"),eq("FAILED"),argThat(text->text.contains("No further attempt")));
    }
    @Test void aWorkerThatLostItsLeaseWritesNothing(){
        when(jdbc.queryForMap(anyString(),any(Object.class))).thenReturn(Map.of("status","PROCESSING","attempt_count",2,"definition_code","RPT.0008","leased",true));
        var publisher=new ReportArtifactPublisher(jdbc,templates,mock(UserAccountRepository.class));ReflectionTestUtils.setField(publisher,"audit",audit);
        publisher.fail(runId,1,new IllegalStateException("late"));
        verifyNoInteractions(audit);
    }
}
