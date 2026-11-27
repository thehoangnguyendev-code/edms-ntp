package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.notification.NotificationResponse;
import com.eqms.dto.user.*;
import com.eqms.entity.UserAccount;
import com.eqms.security.AdministrativeOperationCatalog;
import com.eqms.service.*;
import com.eqms.service.export.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import java.io.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class TableExcelExportControllerTest {
    CurrentUserService current=mock(CurrentUserService.class);
    AuditTrailService audit=mock(AuditTrailService.class);
    DocumentService documents=mock(DocumentService.class);
    RevisionService revisions=mock(RevisionService.class);
    ControlledCopyService copies=mock(ControlledCopyService.class);
    UserManagementService users=mock(UserManagementService.class);
    NotificationService notifications=mock(NotificationService.class);
    AccessProfileService profiles=mock(AccessProfileService.class);
    PermissionSetService sets=mock(PermissionSetService.class);
    PermissionEvaluationService permissions=mock(PermissionEvaluationService.class);
    TableExcelExportController controller;
    @BeforeEach void setup() {
        UserAccount actor=new UserAccount(); actor.setId(UUID.randomUUID());
        when(current.requireCurrentUser()).thenReturn(actor);
        var manager=mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        var entityManager=mock(jakarta.persistence.EntityManager.class);
        var session=mock(org.hibernate.Session.class);
        when(entityManager.unwrap(org.hibernate.Session.class)).thenReturn(session);
        when(session.getHibernateFlushMode()).thenReturn(org.hibernate.FlushMode.AUTO);
        controller=new TableExcelExportController(new TableExcelExportService(current,audit,manager,entityManager),documents,revisions,copies,users,notifications,profiles,sets,audit,current,permissions,mock(com.eqms.repository.UserAccountRepository.class),mock(com.eqms.service.export.BackupTableExportSource.class));
    }
    @Test void notificationsExportEveryPageAndForwardTheWholeQueryNotClientPagination() throws Exception {
        var row=mock(NotificationResponse.class);
        when(row.title()).thenReturn("Thông báo");
        when(notifications.list(eq("personal"),eq("term"),isNull(),eq("Document Control"),isNull(),eq("unread"),isNull(),isNull(),isNull(),eq("2026-11-01"),isNull(),eq("createdAt"),eq("asc"),eq(1),eq(500),isNull()))
                .thenReturn(new PageResponse<>(Collections.nCopies(500,row),new PaginationResponse(1,500,501,2)));
        when(notifications.list(eq("personal"),eq("term"),isNull(),eq("Document Control"),isNull(),eq("unread"),isNull(),isNull(),isNull(),eq("2026-11-01"),isNull(),eq("createdAt"),eq("asc"),eq(2),eq(500),isNull()))
                .thenReturn(new PageResponse<>(List.of(row),new PaginationResponse(2,500,501,2)));
        var result=controller.export("notifications",Map.of("scope","personal","search","term","module","Document Control","status","unread","dateFrom","2026-11-01","sortDirection","asc","page","9","limit","10"));
        var output=new ByteArrayOutputStream(); result.getBody().writeTo(output);
        try(var book=new XSSFWorkbook(new ByteArrayInputStream(output.toByteArray()))) {
            assertThat(book.getSheetAt(0).getLastRowNum()).isEqualTo(501);
            assertThat(book.getSheetAt(0).getRow(501).getCell(1).getStringCellValue()).isEqualTo("Thông báo");
        }
        verify(notifications,times(2)).list(anyString(),anyString(),isNull(),anyString(),isNull(),anyString(),isNull(),isNull(),isNull(),anyString(),isNull(),anyString(),anyString(),anyInt(),eq(500),isNull());
    }
    @Test void usersCannotBeExportedWithoutTheSameViewPermissionAsTheRegister() {
        assertThatThrownBy(()->controller.export("users",Map.of())).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(users,audit);
    }
    @Test void accessProfileQueryDenialIsPropagatedWithoutAudit() {
        when(profiles.listProfiles(anyInt(),anyInt(),any(),any(),any(),any(),any(),any(),any(),anyString(),anyString()))
                .thenThrow(new org.springframework.security.access.AccessDeniedException("denied"));
        assertThatThrownBy(()->controller.exportAdministration("access-profiles",Map.of())).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(audit);
    }
    @Test void missingBulkAuditSignatureCannotFallBackToAnUnsignedTableExport() throws Exception {
        doThrow(new IllegalArgumentException("Electronic signature is required")).when(audit).writeExport(any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),anyString(),anyString(),any(),isNull(),any());
        assertThatThrownBy(()->controller.export("audit-trail",Map.of())).hasMessageContaining("Electronic signature is required");
        verify(audit,never()).logAs(any(),anyString(),anyString(),any(),anyString(),any(),any(),anyString());
    }
    @Test void administrationNetworkGateDoesNotBlockNormalOperationalExports() {
        assertThat(AdministrativeOperationCatalog.isReviewedAdministrativeMethod(TableExcelExportController.class,"exportAdministration")).isTrue();
        assertThat(AdministrativeOperationCatalog.isReviewedAdministrativeMethod(TableExcelExportController.class,"export")).isFalse();
    }
    @Test void rejectsUnknownDatasetsRatherThanSelectingArbitraryData() {
        assertThatThrownBy(()->controller.export("credentials",Map.of())).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(documents,revisions,copies,users,notifications,profiles,sets,audit);
    }
}
