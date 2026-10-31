package com.eqms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@EnabledIfEnvironmentVariable(named="EQMS_ASYNC_TEST_DB",matches=".+")
class NotificationEmailOutboxDatabaseTest {
    JdbcTemplate jdbc,bootstrap;
    TransactionTemplate tx;
    String schema;
    EmailNotificationService email;
    NotificationEmailOutbox outbox;

    @BeforeEach void setup() throws Exception {
        String url=System.getenv("EQMS_ASYNC_TEST_DB"), password=System.getenv("EQMS_ASYNC_TEST_PASSWORD");
        bootstrap=new JdbcTemplate(new DriverManagerDataSource(url,"postgres",password));
        schema="email_test_"+UUID.randomUUID().toString().replace("-","");
        bootstrap.execute("create schema "+schema);
        var ds=new DriverManagerDataSource(url+"?currentSchema="+schema,"postgres",password);
        jdbc=new JdbcTemplate(ds); tx=new TransactionTemplate(new DataSourceTransactionManager(ds));
        jdbc.execute(Files.readString(Path.of("src/main/resources/db/migration/V708__notification_email_outbox.sql")));
        jdbc.execute("create table notification_event_definitions(code text,is_mandatory boolean)");
        jdbc.execute(Files.readString(Path.of("src/main/resources/db/migration/V710__mandatory_email_outbox_priority.sql")));
        jdbc.execute(Files.readString(Path.of("src/main/resources/db/migration/V715__encrypted_notification_email_outbox.sql")));
        email=mock(EmailNotificationService.class); outbox=new NotificationEmailOutbox(jdbc,new ObjectMapper(),email);
        outbox.configureCipher(new NotificationEmailCipher(Base64.getEncoder().encodeToString(new byte[32]),new ObjectMapper()));
    }
    @AfterEach void cleanup(){bootstrap.execute("drop schema "+schema+" cascade");}
    void enqueue(){outbox.enqueue("recipient@example.test","Subject","Body","event.test","Documents",Map.of("recipientName","Recipient"));}

    @Test void credentialMailIsEncryptedAtRestAndTamperedRecipientCannotReceiveIt() {
        outbox.enqueue("recipient@example.test","Private subject","Password fixture-password","event.test","Documents",Map.of("previewPassword","fixture-password"));
        String stored=jdbc.queryForObject("select subject||body||payload::text from notification_email_outbox",String.class);
        assertFalse(stored.contains("fixture-password"));assertFalse(stored.contains("Private subject"));
        jdbc.update("update notification_email_outbox set recipient_email='changed@example.test'");
        assertTrue(outbox.deliverOne());
        verify(email,never()).sendRenderedEmailWithTracking(anyString(),anyString(),anyString(),anyString(),anyString(),anyMap());
        assertEquals("UNKNOWN",jdbc.queryForObject("select status from notification_email_outbox",String.class));
    }

    @Test void existingUnencryptedEmailRemainsDeliverableDuringRollout() {
        jdbc.update("insert into notification_email_outbox(id,recipient_email,subject,body,event_code,event_domain,payload) values(?,'legacy@example.test','Old subject','Old body','legacy.event','Documents','{}')",UUID.randomUUID());
        when(email.sendRenderedEmailWithTracking(anyString(),anyString(),anyString(),anyString(),anyString(),anyMap())).thenReturn(true);
        assertTrue(outbox.deliverOne());
        verify(email).sendRenderedEmailWithTracking(eq("legacy@example.test"),eq("Old subject"),eq("Old body"),eq("legacy.event"),eq("Documents"),eq(Map.of()));
    }

    @Test void rollbackDoesNotSendOrLeaveAnEmailForTheWorker() {
        assertThrows(IllegalStateException.class,()->tx.executeWithoutResult(status->{enqueue();throw new IllegalStateException("business rollback");}));
        assertFalse(outbox.deliverOne()); verifyNoInteractions(email);
    }

    @Test void committedNotificationIsSentOutsideBusinessTransactionAndOnlyOnce() {
        tx.executeWithoutResult(status->enqueue()); verifyNoInteractions(email);
        when(email.sendRenderedEmailWithTracking(anyString(),anyString(),anyString(),anyString(),anyString(),anyMap()))
                .thenAnswer(call->{assertFalse(TransactionSynchronizationManager.isActualTransactionActive());return true;});
        assertTrue(outbox.deliverOne()); assertFalse(outbox.deliverOne());
        assertEquals("SENT",jdbc.queryForObject("select status from notification_email_outbox",String.class));
        verify(email,times(1)).sendRenderedEmailWithTracking(anyString(),anyString(),anyString(),anyString(),anyString(),anyMap());
    }

    @Test void competingWorkersCannotClaimTheSameEmail() throws Exception {
        enqueue(); var entered=new CountDownLatch(1);var finish=new CountDownLatch(1);
        when(email.sendRenderedEmailWithTracking(anyString(),anyString(),anyString(),anyString(),anyString(),anyMap()))
                .thenAnswer(call->{entered.countDown();assertTrue(finish.await(5,TimeUnit.SECONDS));return true;});
        try(var pool=Executors.newFixedThreadPool(2)) {
            var first=pool.submit(outbox::deliverOne);
            try {
                assertTrue(entered.await(5,TimeUnit.SECONDS));
                assertFalse(pool.submit(outbox::deliverOne).get(3,TimeUnit.SECONDS));
            } finally{finish.countDown();}
            assertTrue(first.get(5,TimeUnit.SECONDS));
        }
        verify(email,times(1)).sendRenderedEmailWithTracking(anyString(),anyString(),anyString(),anyString(),anyString(),anyMap());
    }

    @Test void interruptedExternalSendIsNotAutomaticallyReplayed() {
        enqueue();
        jdbc.update("update notification_email_outbox set status='SENDING',claimed_at=now()-interval '20 minutes',claim_id=?",UUID.randomUUID());
        assertEquals(1,outbox.flagInterruptedDeliveries());
        assertEquals("UNKNOWN",jdbc.queryForObject("select status from notification_email_outbox",String.class));
        assertFalse(outbox.deliverOne());
        verify(email).recordUncertainDelivery(eq("recipient@example.test"),eq("event.test"),eq("Documents"),anyMap());
        verify(email,never()).sendRenderedEmailWithTracking(anyString(),anyString(),anyString(),anyString(),anyString(),anyMap());
    }

    @Test void deliveryCannotAccidentallyRunInsideARequestTransaction() {
        enqueue();
        assertThrows(IllegalStateException.class,()->tx.executeWithoutResult(status->outbox.deliverOne()));
        assertEquals("PENDING",jdbc.queryForObject("select status from notification_email_outbox",String.class));
    }

    @Test void mandatoryEventDoesNotWaitBehindTheOptionalBacklog() {
        enqueue();
        outbox.enqueue("recipient@example.test","Alert","Important","event.mandatory","Documents",Map.of(),true);
        when(email.sendRenderedEmailWithTracking(anyString(),anyString(),anyString(),anyString(),anyString(),anyMap())).thenReturn(true);
        assertTrue(outbox.deliverOne());
        verify(email).sendRenderedEmailWithTracking(anyString(),eq("Alert"),anyString(),eq("event.mandatory"),anyString(),anyMap());
    }
}
