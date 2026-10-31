package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.repository.*;
import com.eqms.service.report.ReportTemplateService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import java.io.IOException;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ReportDownloadScopeTest {
    JdbcTemplate jdbc=mock(JdbcTemplate.class);
    PermissionEvaluationService permissions=mock(PermissionEvaluationService.class);
    ReportTemplateService templates=mock(ReportTemplateService.class);
    VerifiedDownloadService downloads=mock(VerifiedDownloadService.class);
    AuditTrailService audit=mock(AuditTrailService.class);
    UserAccount actor=new UserAccount();UUID runId=UUID.randomUUID(),artifactId=UUID.randomUUID();
    ReportPlatformService service=new ReportPlatformService(jdbc,new ObjectMapper(),permissions,mock(DocumentRecordRepository.class),mock(UserAccountRepository.class),mock(DocumentAuthorizationService.class),mock(FileStorageService.class),audit);
    Map<String,Object> artifact;
    @BeforeEach void setup(){
        actor.setId(UUID.randomUUID());service.configureTemplates(templates);service.configureVerifiedDownloads(downloads);
        when(permissions.hasPermission(actor,"reports.artifact.download")).thenReturn(true);
        artifact=new HashMap<>(Map.of("generated_filename","Report.pdf","mime_type","application/pdf","object_key","stored/report","sha256","a".repeat(64),"requester_user_id",actor.getId(),"definition_code","REGISTER","authorization_snapshot","{\"protocol\":\"METADATA_V1\"}"));
        when(jdbc.queryForMap(anyString(),eq(artifactId),eq(runId))).thenReturn(artifact);
    }
    @Test void anotherUsersArtifactIsDeniedBeforeStorageIsRead(){
        artifact.put("requester_user_id",UUID.randomUUID());
        assertThrows(SecurityException.class,()->service.prepareDownload(actor,runId,artifactId));verifyNoInteractions(downloads);
    }
    @Test void changedScopeAndExpiredArtifactAreDeniedBeforeStorageIsRead(){
        doThrow(new SecurityException("scope changed")).when(templates).reauthorize(eq(actor),eq("REGISTER"),any());
        assertThrows(SecurityException.class,()->service.prepareDownload(actor,runId,artifactId));verifyNoInteractions(downloads);
        when(jdbc.queryForMap(anyString(),eq(artifactId),eq(runId))).thenThrow(new org.springframework.dao.EmptyResultDataAccessException(1));
        assertThrows(org.springframework.dao.EmptyResultDataAccessException.class,()->service.prepareDownload(actor,runId,artifactId));verifyNoInteractions(downloads);
    }
    @Test void successfulPreparationAuditsOnlyAfterVerificationAndAuditFailureClosesFile()throws Exception {
        var file=mock(VerifiedDownloadService.Prepared.class);when(downloads.prepare("stored/report","a".repeat(64))).thenReturn(file);
        var prepared=service.prepareDownload(actor,runId,artifactId);assertSame(file,prepared.file());
        var order=inOrder(templates,downloads,audit);
        order.verify(templates).require(actor,"reports.artifact.download","report.module.export");
        order.verify(templates).reauthorize(eq(actor),eq("REGISTER"),any());
        order.verify(downloads).prepare("stored/report","a".repeat(64));
        order.verify(audit).logAs(eq(actor),eq("REPORT_ARTIFACT"),eq("Report.pdf"),eq(artifactId),eq("REPORT_ARTIFACT_DOWNLOADED"),isNull(),isNull(),anyString());
        doThrow(new IllegalStateException("audit unavailable")).when(audit).logAs(any(),any(),any(),any(),any(),any(),any(),any());
        assertThrows(IllegalStateException.class,()->service.prepareDownload(actor,runId,artifactId));verify(file).close();
    }
    @Test void failedChecksumDoesNotRecordASuccessfulDownload()throws Exception {
        when(downloads.prepare(anyString(),anyString())).thenThrow(new IOException("checksum mismatch"));
        assertThrows(IllegalStateException.class,()->service.prepareDownload(actor,runId,artifactId));verifyNoInteractions(audit);
    }
}
