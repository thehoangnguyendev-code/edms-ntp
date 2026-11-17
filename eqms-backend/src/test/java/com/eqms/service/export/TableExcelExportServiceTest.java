package com.eqms.service.export;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.*;
import org.springframework.transaction.support.SimpleTransactionStatus;
import java.io.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class TableExcelExportServiceTest {
    CurrentUserService users=mock(CurrentUserService.class);
    AuditTrailService audit=mock(AuditTrailService.class);
    PlatformTransactionManager manager=mock(PlatformTransactionManager.class);
    UserAccount actor=new UserAccount();
    jakarta.persistence.EntityManager entityManager=mock(jakarta.persistence.EntityManager.class);
    org.hibernate.Session session=mock(org.hibernate.Session.class);
    TableExcelExportService exports;
    @BeforeEach void setup() {
        actor.setId(UUID.randomUUID());
        when(users.requireCurrentUser()).thenReturn(actor);
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(entityManager.unwrap(org.hibernate.Session.class)).thenReturn(session);
        when(session.getHibernateFlushMode()).thenReturn(org.hibernate.FlushMode.AUTO);
        exports=new TableExcelExportService(users,audit,manager,entityManager);
    }
    @Test void commitsMandatoryAuditWithCountChecksumAndRedactedCriteriaBeforeResponseIsReadable() throws Exception {
        var response=exports.generate("All_Document",Map.of("search","SOP","signatureToken","DO_NOT_LOG","page","7"),w->{w.headers("Document");w.row("SOP.10411");});
        try {
            assertThat(response.getHeaders().getContentType().toString()).isEqualTo(TableExcelExportService.MIME);
            assertThat(response.getHeaders().getContentDisposition().getFilename()).matches("All_Document_\\d{8}_\\d{4}\\.xlsx");
            assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
            var comment=ArgumentCaptor.forClass(String.class);
            verify(audit).logAs(eq(actor),eq("DOCUMENT"),matches("All_Document_\\d{8}_\\d{4}\\.xlsx"),any(UUID.class),eq("EXPORT"),isNull(),isNull(),comment.capture());
            assertThat(comment.getValue()).contains("records=1","SHA-256=","search=SOP").doesNotContain("DO_NOT_LOG","signatureToken","page=");
            verify(manager).commit(any());
            var order=inOrder(session,audit);
            order.verify(session).setHibernateFlushMode(org.hibernate.FlushMode.AUTO);
            order.verify(audit).logAs(eq(actor),eq("DOCUMENT"),anyString(),any(UUID.class),eq("EXPORT"),isNull(),isNull(),anyString());
            var output=new ByteArrayOutputStream();
            response.getBody().writeTo(output);
            assertThat(output.size()).isGreaterThan(100);
            assertThat(comment.getValue()).contains("SHA-256=" + HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(output.toByteArray())));
        } finally { /* Streaming callback owns the temporary file. */ }
    }
    @Test void bulkAuditSignaturePathNeverEntersReadOnlyExtractionScope() throws Exception {
        var response=exports.generate("Audit_Trail",Map.of(),w->{w.headers("Event");w.row("VIEW");});
        response.getBody().writeTo(OutputStream.nullOutputStream());
        verifyNoInteractions(entityManager,session);
        verify(manager).commit(any());
    }
    @Test void auditFailureRollsBackAndNeverReturnsAFile() {
        doThrow(new IllegalStateException("audit unavailable")).when(audit).logAs(any(),anyString(),anyString(),any(UUID.class),anyString(),isNull(),isNull(),anyString());
        assertThatThrownBy(()->exports.generate("Users",Map.of(),w->{w.headers("Name");w.row("Example");}))
                .isInstanceOf(IllegalStateException.class).hasMessage("audit unavailable");
        verify(manager).rollback(any());
        verify(manager,never()).commit(any());
    }
    @Test void deniedQueryRollsBackWithoutAuditOrFile() {
        assertThatThrownBy(()->exports.generate("Users",Map.of(),w->{throw new org.springframework.security.access.AccessDeniedException("denied");}))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(audit);
        verify(manager).rollback(any());
    }
    @Test void concurrentGenerationIsBoundedAndDoesNotQueueUnlimitedDatabaseSnapshots() throws Exception {
        var entered=new java.util.concurrent.CountDownLatch(2);
        var release=new java.util.concurrent.CountDownLatch(1);
        try(var executor=java.util.concurrent.Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<org.springframework.http.ResponseEntity<org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody>> job=()->exports.generate("Users",Map.of(),w->{
                w.headers("Name"); w.row("Example"); entered.countDown();
                try { if(!release.await(10,java.util.concurrent.TimeUnit.SECONDS)) throw new IOException("timeout"); }
                catch(InterruptedException e) { Thread.currentThread().interrupt(); throw new IOException(e); }
            });
            var first=executor.submit(job); var second=executor.submit(job);
            try {
                assertThat(entered.await(5,java.util.concurrent.TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(()->exports.generate("Users",Map.of(),w->{w.headers("Name");}))
                        .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
                        .hasMessageContaining("429");
            } finally { release.countDown(); }
            first.get(10,java.util.concurrent.TimeUnit.SECONDS).getBody().writeTo(OutputStream.nullOutputStream());
            second.get(10,java.util.concurrent.TimeUnit.SECONDS).getBody().writeTo(OutputStream.nullOutputStream());
        }
    }
}
