package com.eqms.service;

import com.eqms.entity.*;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@EnabledIfEnvironmentVariable(named="EQMS_ASYNC_TEST_DB",matches=".+")
class ControlledCopyWorkerFencingDatabaseTest {
    JdbcTemplate jdbc,bootstrap;
    String schema;
    UUID actorId=UUID.randomUUID(),docId=UUID.randomUUID(),revisionId=UUID.randomUUID(),batchId=UUID.randomUUID(),copyId=UUID.randomUUID(),jobId=UUID.randomUUID(),itemId=UUID.randomUUID();
    ControlledCopyDistributionWorkerStore store;
    ControlledCopyService processing;
    ControlledCopyAuthorizationService authorization;
    ControlledCopyRecord copy;
    UserAccount actor;
    NotificationEmailOutbox outbox;

    @BeforeEach void setup() throws Exception {
        String url=System.getenv("EQMS_ASYNC_TEST_DB"),password=System.getenv("EQMS_ASYNC_TEST_PASSWORD");
        bootstrap=new JdbcTemplate(new DriverManagerDataSource(url,"postgres",password));
        schema="fence_test_"+UUID.randomUUID().toString().replace("-","");bootstrap.execute("create schema "+schema);
        var ds=new DriverManagerDataSource(url+"?currentSchema="+schema,"postgres",password);jdbc=new JdbcTemplate(ds);
        jdbc.execute("create table app_users(id uuid primary key)");jdbc.execute("create table documents(id uuid primary key)");
        jdbc.execute("create table document_revisions(id uuid primary key)");jdbc.execute("create table controlled_copy_distribution_batches(id uuid primary key)");
        jdbc.execute("create table controlled_copies(id uuid primary key,document_id uuid,revision_id uuid,finalized boolean default false)");
        jdbc.execute(Files.readString(Path.of("src/main/resources/db/migration/V242__create_controlled_copy_distribution_jobs.sql")));
        jdbc.execute("alter table controlled_copy_distribution_jobs add column action_type text default 'DISTRIBUTE'");
        jdbc.execute(Files.readString(Path.of("src/main/resources/db/migration/V714__controlled_copy_distribution_worker_fencing.sql")));
        jdbc.execute(Files.readString(Path.of("src/main/resources/db/migration/V708__notification_email_outbox.sql")));
        jdbc.execute("create table notification_event_definitions(code text,is_mandatory boolean)");
        jdbc.execute(Files.readString(Path.of("src/main/resources/db/migration/V710__mandatory_email_outbox_priority.sql")));
        jdbc.execute(Files.readString(Path.of("src/main/resources/db/migration/V715__encrypted_notification_email_outbox.sql")));
        jdbc.update("insert into app_users values(?)",actorId);jdbc.update("insert into documents values(?)",docId);
        jdbc.update("insert into document_revisions values(?)",revisionId);jdbc.update("insert into controlled_copy_distribution_batches values(?)",batchId);
        jdbc.update("insert into controlled_copies(id,document_id,revision_id) values(?,?,?)",copyId,docId,revisionId);
        jdbc.update("insert into controlled_copy_distribution_jobs(id,batch_id,requested_by_user_id,status,total_items) values(?,?,?,'PENDING',1)",jobId,batchId,actorId);
        jdbc.update("insert into controlled_copy_distribution_job_items(id,job_id,controlled_copy_id,status) values(?,?,?,'PENDING')",itemId,jobId,copyId);
        var document=new DocumentRecord();document.setId(docId);var documentStatus=new DocumentStatusDefinition();documentStatus.setCode("ACTIVE");document.setStatus(documentStatus);
        var revision=new DocumentRevisionRecord();revision.setId(revisionId);var revisionStatus=new RevisionStatusDefinition();revisionStatus.setCode("EFFECTIVE");revision.setStatus(revisionStatus);revision.setDocument(document);
        var batch=new ControlledCopyDistributionBatch();batch.setId(batchId);batch.setDocument(document);batch.setRevision(revision);
        copy=new ControlledCopyRecord();copy.setId(copyId);copy.setDocument(document);copy.setRevision(revision);copy.setDistributionBatch(batch);copy.setStatusCode("DISTRIBUTED");
        actor=new UserAccount();actor.setId(actorId);actor.setStatus(UserStatus.Active);
        var copies=mock(ControlledCopyRepository.class);when(copies.findById(copyId)).thenReturn(Optional.of(copy));
        var users=mock(UserAccountRepository.class);when(users.findById(actorId)).thenReturn(Optional.of(actor));
        authorization=mock(ControlledCopyAuthorizationService.class);processing=mock(ControlledCopyService.class);
        when(processing.finalizeDistributedCopy(copyId,actorId)).thenReturn(ControlledCopyFinalizationOutcome.SUCCESS);
        var target=new ControlledCopyDistributionWorkerStore(jdbc,copies,users,authorization,processing,mock(AuditTrailService.class));
        var factory=new ProxyFactory(target);factory.setProxyTargetClass(true);
        factory.addAdvice(new TransactionInterceptor(new DataSourceTransactionManager(ds),new AnnotationTransactionAttributeSource()));
        store=(ControlledCopyDistributionWorkerStore)factory.getProxy();
        outbox=new NotificationEmailOutbox(jdbc,new ObjectMapper(),mock(EmailNotificationService.class));
        outbox.configureCipher(new NotificationEmailCipher(Base64.getEncoder().encodeToString(new byte[32]),new ObjectMapper()));
    }
    @AfterEach void cleanup(){bootstrap.execute("drop schema "+schema+" cascade");}
    String itemStatus(){return jdbc.queryForObject("select status from controlled_copy_distribution_job_items where id=?",String.class,itemId);}
    void expire(){jdbc.update("update controlled_copy_distribution_jobs set worker_lease_until=clock_timestamp()-interval '1 second' where id=?",jobId);}

    @Test void onlyOneClaimWinsAndAnExpiredWorkerCannotRestoreOrComplete() {
        var old=store.claim(jobId,actorId,false);assertNotNull(old);assertNull(store.claim(jobId,actorId,false));
        assertEquals(itemId,store.nextItem(old));expire();var replacement=store.claim(jobId,actorId,false);assertNotNull(replacement);
        assertThrows(ControlledCopyDistributionWorkerStore.LostClaim.class,()->store.failItem(old,itemId,"stale"));
        assertThrows(ControlledCopyDistributionWorkerStore.LostClaim.class,()->store.complete(old));
        verify(processing,never()).markDistributedCopyProcessingFailed(any(),any(),any());
        assertEquals(itemId,store.nextItem(replacement));store.processItem(replacement,itemId);store.complete(replacement);
        assertEquals("SUCCESS",itemStatus());
    }

    @Test void crashRollsBackCopyResultItemAndQueuedCredentialsTogetherThenRecoveryContinues() {
        var claim=store.claim(jobId,actorId,false);store.nextItem(claim);
        when(processing.finalizeDistributedCopy(copyId,actorId)).thenAnswer(call->{
            assertTrue(ControlledCopyDeliveryScope.active());
            jdbc.update("update controlled_copies set finalized=true where id=?",copyId);
            outbox.enqueue("recipient@example.test","Delivery","Link and test credential","controlled_copy.distributed","Documents",Map.of(),true);
            throw new IllegalStateException("simulated crash before commit");
        });
        assertThrows(IllegalStateException.class,()->store.processItem(claim,itemId));
        assertFalse(jdbc.queryForObject("select finalized from controlled_copies where id=?",Boolean.class,copyId));
        assertEquals(0,jdbc.queryForObject("select count(*) from notification_email_outbox",Integer.class));
        assertEquals("PROCESSING",itemStatus());assertFalse(ControlledCopyDeliveryScope.active());
        expire();var recovered=store.claim(jobId,actorId,false);
        doReturn(ControlledCopyFinalizationOutcome.SUCCESS).when(processing).finalizeDistributedCopy(copyId,actorId);
        store.nextItem(recovered);store.processItem(recovered,itemId);store.complete(recovered);
        assertEquals("SUCCESS",itemStatus());
    }

    @Test void leaseCannotBeStolenWhileACopyTransactionHoldsTheFence() throws Exception {
        var claim=store.claim(jobId,actorId,false);store.nextItem(claim);
        var entered=new CountDownLatch(1);var finish=new CountDownLatch(1);
        when(processing.finalizeDistributedCopy(copyId,actorId)).thenAnswer(call->{expire();entered.countDown();assertTrue(finish.await(5,TimeUnit.SECONDS));return ControlledCopyFinalizationOutcome.SUCCESS;});
        try(var threads=Executors.newFixedThreadPool(2)) {
            var first=threads.submit(()->store.processItem(claim,itemId));
            try {assertTrue(entered.await(5,TimeUnit.SECONDS));assertNull(threads.submit(()->store.claim(jobId,actorId,false)).get(3,TimeUnit.SECONDS));}
            finally{finish.countDown();}
            assertEquals(ControlledCopyFinalizationOutcome.SUCCESS,first.get(5,TimeUnit.SECONDS));
        }
    }

    @Test void terminalParentIsSkippedWithoutRenderingOrRestoringTheChild() {
        var claim=store.claim(jobId,actorId,false);store.nextItem(claim);copy.getRevision().getStatus().setCode("OBSOLETED");
        assertEquals(ControlledCopyFinalizationOutcome.SKIPPED_TERMINAL,store.processItem(claim,itemId));
        assertTrue(store.complete(claim).progress().errors());assertEquals("SKIPPED",itemStatus());verifyNoInteractions(processing);
    }

    @Test void revokedScopeOrInactiveActorCannotFinalizeOrRestore() {
        var claim=store.claim(jobId,actorId,false);store.nextItem(claim);actor.setStatus(UserStatus.Inactive);
        assertThrows(org.springframework.security.access.AccessDeniedException.class,()->store.processItem(claim,itemId));
        store.failItem(claim,itemId,"actor inactive");assertEquals("FAILED",itemStatus());
        verifyNoInteractions(processing);
    }

    @Test void manualRetryDoesNotReprocessSuccessfulItemsOrResendTheBatchZip() {
        var claim=store.claim(jobId,actorId,false);store.nextItem(claim);store.failItem(claim,itemId,"test failure");store.complete(claim);
        var retry=store.claim(jobId,actorId,true);assertNotNull(retry);assertFalse(retry.notifyZip());
        store.nextItem(retry);store.processItem(retry,itemId);assertTrue(store.complete(retry).succeededCopies().isEmpty());
        assertEquals(2,jdbc.queryForObject("select attempts from controlled_copy_distribution_job_items where id=?",Integer.class,itemId));
    }

    @Test void legacyProcessingRowsAreNotAutomaticallyAdopted() {
        jdbc.update("update controlled_copy_distribution_jobs set status='PROCESSING' where id=?",jobId);
        assertTrue(store.recoverable().isEmpty());assertNull(store.claim(jobId,actorId,false));
        assertEquals("PROCESSING",jdbc.queryForObject("select status from controlled_copy_distribution_jobs where id=?",String.class,jobId));
    }
}
