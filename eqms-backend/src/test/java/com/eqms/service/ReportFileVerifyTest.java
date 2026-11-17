package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.repository.*;
import com.eqms.service.report.ReportPresentationRenderer;
import com.eqms.service.report.ReportLayout;
import com.eqms.service.report.ReportTemplateService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** REPORT-FILE-VERIFY-2026-11-16 and REPORT-FILE-STATUS-2026-11-16: a file held outside EQMS can be checked against the stored file, and a workbook says what it is. */
class ReportFileVerifyTest {
    /** SHA-256 of the three bytes "abc". */
    static final String ABC="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    JdbcTemplate jdbc=mock(JdbcTemplate.class);
    PermissionEvaluationService permissions=mock(PermissionEvaluationService.class);
    ReportTemplateService templates=mock(ReportTemplateService.class);
    AuditTrailService audit=mock(AuditTrailService.class);
    UserAccount actor=new UserAccount();UUID runId=UUID.randomUUID(),artifactId=UUID.randomUUID();
    ReportPlatformService service=new ReportPlatformService(jdbc,new ObjectMapper(),permissions,mock(DocumentRecordRepository.class),mock(UserAccountRepository.class),mock(DocumentAuthorizationService.class),mock(FileStorageService.class),audit);
    Map<String,Object> artifact;

    @BeforeEach void setup(){
        actor.setId(UUID.randomUUID());service.configureTemplates(templates);
        when(permissions.hasPermission(actor,"reports.artifact.download")).thenReturn(true);
        artifact=new HashMap<>(Map.of("generated_filename","RPT.0008-RUN-000007.xlsx","mime_type","x","object_key","stored/report","sha256",ABC,"requester_user_id",actor.getId(),"definition_code","REGISTER","authorization_snapshot","{\"protocol\":\"METADATA_V1\"}"));
        when(jdbc.queryForMap(anyString(),eq(artifactId),eq(runId))).thenReturn(artifact);
        when(jdbc.queryForObject(anyString(),eq(Long.class),eq(artifactId))).thenReturn(3L);
    }
    static ByteArrayInputStream bytes(String text){return new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8));}

    @Test void theStoredFileMatchesAndIsRecordedAsVerified(){
        var result=service.verifyArtifactFile(actor,runId,artifactId,bytes("abc"),"copy.xlsx");
        assertTrue(result.match());assertEquals(ABC,result.uploadedSha256());assertEquals(3,result.uploadedSize());assertEquals(3,result.storedSize());
        verify(audit).logAs(eq(actor),eq("REPORT_ARTIFACT"),eq("RPT.0008-RUN-000007.xlsx"),eq(artifactId),eq("REPORT_ARTIFACT_VERIFIED"),isNull(),isNull(),anyString(), any());
    }
    @Test void aFileWithOneChangedByteDoesNotMatchAndIsRecordedUnderItsOwnEvent(){
        var result=service.verifyArtifactFile(actor,runId,artifactId,bytes("abd"),"edited.xlsx");
        assertFalse(result.match());assertNotEquals(ABC,result.uploadedSha256());assertEquals(ABC,result.storedSha256());
        verify(audit).logAs(eq(actor),eq("REPORT_ARTIFACT"),anyString(),eq(artifactId),eq("REPORT_ARTIFACT_VERIFY_MISMATCH"),isNull(),isNull(),contains("NOT the stored file"), any());
    }
    @Test void aPersonWhoMayNotDownloadTheFileCannotLearnAnythingAboutIt(){
        artifact.put("requester_user_id",UUID.randomUUID());
        assertThrows(SecurityException.class,()->service.verifyArtifactFile(actor,runId,artifactId,bytes("abc"),"x"));verifyNoInteractions(audit);
        artifact.put("requester_user_id",actor.getId());when(permissions.hasPermission(actor,"reports.artifact.download")).thenReturn(false);
        assertThrows(RuntimeException.class,()->service.verifyArtifactFile(actor,runId,artifactId,bytes("abc"),"x"));verifyNoInteractions(audit);
    }
    @Test void aFileWhoseRunScopeHasChangedOrWhichExpiredIsRefused(){
        doThrow(new SecurityException("scope changed")).when(templates).reauthorize(eq(actor),eq("REGISTER"),any());
        assertThrows(SecurityException.class,()->service.verifyArtifactFile(actor,runId,artifactId,bytes("abc"),"x"));
        when(jdbc.queryForMap(anyString(),eq(artifactId),eq(runId))).thenThrow(new org.springframework.dao.EmptyResultDataAccessException(1));
        var expired=assertThrows(IllegalStateException.class,()->service.verifyArtifactFile(actor,runId,artifactId,bytes("abc"),"x"));
        assertEquals("REPORT_ARTIFACT_EXPIRED",expired.getMessage());verifyNoInteractions(audit);
    }
    @Test void anEmptyOrUnreadableUploadIsRefusedAndNotRecorded(){
        var empty=assertThrows(IllegalArgumentException.class,()->service.verifyArtifactFile(actor,runId,artifactId,bytes(""),"empty.csv"));
        assertEquals("REPORT_VERIFY_FILE_EMPTY",empty.getMessage());
        var broken=new java.io.InputStream(){@Override public int read() throws java.io.IOException{throw new java.io.IOException("connection reset");}};
        assertEquals("REPORT_VERIFY_FILE_UNREADABLE",assertThrows(IllegalArgumentException.class,()->service.verifyArtifactFile(actor,runId,artifactId,broken,"x")).getMessage());
        verifyNoInteractions(audit);
    }
    @Test void aControlCharacterInTheUploadedNameDoesNotReachTheAuditText(){
        service.verifyArtifactFile(actor,runId,artifactId,bytes("abc"),"a\nforged line.xlsx");
        verify(audit).logAs(any(),any(),any(),any(),any(),any(),any(),argThat(text->!String.valueOf(text).contains("\n")), any());
    }

    @Test void theInformationSheetOfAWorkbookNamesTheRunAndSaysItIsADataCopy() throws Exception {
        var values=Map.of("report.title","T","report.code","RPT.0008","template.version","1.0.0","report.executor","Admin","report.generatedAt","2026-11-16 10:00:00",
                "report.asOfAt","2026-11-16 10:00:00","template.name","T","report.runId","RUN-000007","report.gmpNotice","");
        byte[] book=ReportPresentationRenderer.render("XLSX",List.of(List.of("Name"),List.of("SOP.1")),ReportLayout.defaults(),values);
        try(var workbook=new org.apache.poi.xssf.usermodel.XSSFWorkbook(new ByteArrayInputStream(book))){
            var sheet=workbook.getSheet("Report information");var shown=new HashMap<String,String>();
            for(var row:sheet)if(row.getCell(1)!=null)shown.put(row.getCell(0).getStringCellValue(),row.getCell(1).getStringCellValue());
            assertEquals("RUN-000007",shown.get("Run"));assertEquals(ReportPresentationRenderer.DATA_COPY_NOTICE,shown.get("Status of this file"));
            assertTrue(shown.get("Status of this file").contains("Verify File"));
        }
    }
}
