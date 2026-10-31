package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.publishing.PublishingWorkspaceRequest;
import com.eqms.entity.PublishingWorkspaceJob;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UsedSignatureTokenRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Opt-in real PostgreSQL tests in a disposable schema, never application records. */
@EnabledIfEnvironmentVariable(named="EQMS_ASYNC_TEST_DB",matches=".+")
class PublishingCommandDatabaseTest {
    JdbcTemplate jdbc, bootstrap;
    DriverManagerDataSource ds;
    String schema;
    UUID revisionId=UUID.randomUUID(), templateId=UUID.randomUUID(), nonce=UUID.randomUUID();
    UserAccount actor;
    PublishingWorkspaceJobService jobs;
    SignatureTokenConsumptionService signatures;
    PermissionEvaluationService permissions;
    RevisionService revisions;
    PublishingWorkspaceService workspace;
    CurrentUserService users;
    PublishingCommandService service;

    @BeforeEach void setup() throws Exception {
        String url=System.getenv("EQMS_ASYNC_TEST_DB");
        String password=System.getenv("EQMS_ASYNC_TEST_PASSWORD");
        bootstrap=new JdbcTemplate(new DriverManagerDataSource(url,"postgres",password));
        schema="async_test_"+UUID.randomUUID().toString().replace("-","");
        bootstrap.execute("create schema "+schema);
        ds=new DriverManagerDataSource(url+"?currentSchema="+schema,"postgres",password);
        jdbc=new JdbcTemplate(ds);
        jdbc.execute("create table app_users(id uuid primary key)");
        jdbc.execute("create table documents(id uuid primary key,lock_version bigint default 0,opened_by_user_id uuid,updated_at timestamptz)");
        jdbc.execute("create table document_revisions(id uuid primary key,document_id uuid,source_file_checksum text,source_storage_version_id text,lock_version bigint default 0,opened_by_user_id uuid,updated_at timestamptz)");
        jdbc.execute("create table revision_workflow_participants(id uuid primary key,revision_id uuid,participant_type text)");
        jdbc.execute("create table document_relations(id uuid primary key,source_document_id uuid,target_document_id uuid)");
        jdbc.execute("create table used_signature_tokens(token_id uuid primary key, user_id uuid, used_at timestamptz default now())");
        jdbc.execute(Files.readString(Path.of("src/main/resources/db/migration/V137__create_publishing_workspace_jobs.sql")));
        jdbc.execute(Files.readString(Path.of("src/main/resources/db/migration/V706__durable_publish_confirmations.sql")));
        jdbc.execute(Files.readString(Path.of("src/main/resources/db/migration/V707__publish_confirmation_actor_context.sql")));
        jdbc.execute(Files.readString(Path.of("src/main/resources/db/migration/V709__immutable_publishing_commands.sql")));
        jdbc.execute("create table publishing_templates(id uuid primary key, template_name text)");
        jdbc.execute("create table publishing_template_components(id uuid primary key, template_id uuid, body text)");
        jdbc.execute("create table publishing_template_placeholder_styles(id uuid primary key, template_id uuid, style text)");
        jdbc.execute("create table electronic_signature_settings(id text primary key, style text)");
        jdbc.execute("create table revision_publishing_metadata(id uuid primary key,revision_id uuid,publishing_template_id uuid,checksum text)");
        jdbc.execute("create table published_results(job_id uuid primary key)");
        actor=new UserAccount(); actor.setId(UUID.randomUUID()); actor.setStatus(UserStatus.Active);
        jdbc.update("insert into app_users values(?)",actor.getId());
        jdbc.update("insert into documents(id) values(?)",revisionId);
        jdbc.update("insert into document_revisions(id,document_id) values(?,?)",revisionId,revisionId);
        jdbc.update("insert into publishing_templates values(?,'original')",templateId);
        jdbc.update("insert into revision_publishing_metadata values(?,?,?,'preview-sha')",UUID.randomUUID(),revisionId,templateId);
        jobs=mock(PublishingWorkspaceJobService.class); signatures=mock(SignatureTokenConsumptionService.class);
        permissions=mock(PermissionEvaluationService.class); revisions=mock(RevisionService.class);
        workspace=mock(PublishingWorkspaceService.class); users=mock(CurrentUserService.class);
        when(users.requireCurrentUser(actor.getId())).thenReturn(actor);
        when(permissions.hasPermission(actor,"documents.revision.publish")).thenReturn(true);
        when(revisions.capturePublishConfirmationBundle(revisionId,actor)).thenReturn(Map.of(revisionId,"version-1:sha"));
        when(signatures.requireAndConsume(anyString(),eq(actor))).thenAnswer(call -> {
            jdbc.update("insert into used_signature_tokens(token_id,user_id) values(?,?)",nonce,actor.getId());
            return nonce;
        });
        when(jobs.createPublishJob(eq(revisionId),eq(actor.getId()),any())).thenAnswer(call -> {
            var job=new PublishingWorkspaceJob(); job.setId(UUID.randomUUID()); job.setRevisionId(revisionId); job.setRequestedBy(actor); job.setStatus("QUEUED");
            jdbc.update("insert into publishing_workspace_jobs(id,revision_id,requested_by_user_id,status,created_at,updated_at) values(?,?,?,'QUEUED',now(),now())",job.getId(),revisionId,actor.getId());
            return job;
        });
        doAnswer(call -> { jdbc.update("update publishing_workspace_jobs set status='PROCESSING' where id=?",(UUID)call.getArgument(0)); return null; }).when(jobs).markProcessing(any(),anyString());
        doAnswer(call -> { jdbc.update("update publishing_workspace_jobs set status='COMPLETED' where id=?",(UUID)call.getArgument(0)); return null; }).when(jobs).markCompleted(any(),anyString());
        service=freshService();
    }

    PublishingCommandService freshService() {
        var target=new PublishingCommandService(jdbc,new ObjectMapper(),jobs,signatures,mock(UsedSignatureTokenRepository.class),users,permissions,revisions,workspace,mock(EntityManager.class),mock(AuditTrailService.class));
        var proxy=new ProxyFactory(target); proxy.setProxyTargetClass(true);
        proxy.addAdvice(new TransactionInterceptor(new DataSourceTransactionManager(ds),new AnnotationTransactionAttributeSource()));
        return (PublishingCommandService)proxy.getProxy();
    }

    PublishingWorkspaceRequest request() {
        return new PublishingWorkspaceRequest(templateId.toString(),"PORTRAIT","Publish checked content","raw-secret-signature-jwt",
                null,null,null,null,null,null,null,null,null,null,null,null,null,"Publish checked content");
    }
    String status(UUID id) { return jdbc.queryForObject("select status from publishing_workspace_jobs where id=?",String.class,id); }
    @AfterEach void clean() { if(bootstrap!=null)bootstrap.execute("drop schema "+schema+" cascade"); }

    @Test void restartUsesPersistedConfirmationWithoutJwtAndCannotApplyTwice() {
        var job=service.acceptPublish(revisionId,actor.getId(),request());
        String payload=jdbc.queryForObject("select payload::text from publishing_job_commands where job_id=?",String.class,job.getId());
        assertFalse(payload.contains("signatureToken")); assertFalse(payload.contains("raw-secret"));
        var restarted=freshService();
        assertTrue(restarted.execute(job.getId(),actor.getId()));
        assertEquals("COMPLETED",status(job.getId()));
        assertFalse(restarted.execute(job.getId(),actor.getId()));
        verify(workspace,times(1)).completeConfirmedPublish(eq(revisionId),any(),eq(actor.getId()),any());
        verify(signatures,times(1)).requireAndConsume(anyString(),eq(actor));
    }

    @Test void failedAttemptRollsBackBusinessAndJobSoRestartCanContinueSameConfirmation() {
        var job=service.acceptPublish(revisionId,actor.getId(),request());
        when(workspace.completeConfirmedPublish(any(),any(),any(),any())).thenAnswer(call -> {
            jdbc.update("insert into published_results values(?)",job.getId());
            throw new IllegalStateException("simulated worker crash");
        });
        assertThrows(IllegalStateException.class,()->service.execute(job.getId(),actor.getId()));
        assertEquals("QUEUED",status(job.getId()));
        assertEquals(0,jdbc.queryForObject("select count(*) from published_results",Integer.class));
        assertEquals(1,jdbc.queryForObject("select count(*) from used_signature_tokens",Integer.class));
        doReturn(null).when(workspace).completeConfirmedPublish(any(),any(),any(),any());
        assertTrue(freshService().execute(job.getId(),actor.getId()));
    }

    @Test void changedTemplateRejectsTheOldConfirmation() {
        var job=service.acceptPublish(revisionId,actor.getId(),request());
        jdbc.update("update publishing_templates set template_name='changed' where id=?",templateId);
        assertThrows(IllegalStateException.class,()->service.execute(job.getId(),actor.getId()));
        verifyNoInteractions(workspace);
    }

    @Test void changedBundleAndRevokedPermissionCannotUseStoredConfirmation() {
        var job=service.acceptPublish(revisionId,actor.getId(),request());
        when(revisions.capturePublishConfirmationBundle(revisionId,actor)).thenReturn(Map.of(revisionId,"version-2:sha"));
        assertThrows(IllegalStateException.class,()->service.execute(job.getId(),actor.getId()));
        when(permissions.hasPermission(actor,"documents.revision.publish")).thenReturn(false);
        assertThrows(org.springframework.security.access.AccessDeniedException.class,()->service.execute(job.getId(),actor.getId()));
        verifyNoInteractions(workspace);
    }

    @Test void twoWorkersCannotExecuteTheSameCommandConcurrently() throws Exception {
        var job=service.acceptPublish(revisionId,actor.getId(),request());
        var entered=new CountDownLatch(1); var finish=new CountDownLatch(1);
        when(workspace.completeConfirmedPublish(any(),any(),any(),any())).thenAnswer(call -> {
            entered.countDown(); assertTrue(finish.await(5,TimeUnit.SECONDS)); return null;
        });
        try(var pool=Executors.newFixedThreadPool(2)) {
            var first=pool.submit(()->service.execute(job.getId(),actor.getId()));
            try {
                assertTrue(entered.await(5,TimeUnit.SECONDS));
                assertFalse(pool.submit(()->freshService().execute(job.getId(),actor.getId())).get(3,TimeUnit.SECONDS));
            } finally { finish.countDown(); }
            assertTrue(first.get(5,TimeUnit.SECONDS));
        }
        verify(workspace,times(1)).completeConfirmedPublish(any(),any(),any(),any());
    }

    @Test void wrongActorAndInactiveActorAreRejected() {
        var job=service.acceptPublish(revisionId,actor.getId(),request());
        assertThrows(org.springframework.security.access.AccessDeniedException.class,()->service.execute(job.getId(),UUID.randomUUID()));
        actor.setStatus(UserStatus.Inactive);
        assertThrows(org.springframework.security.access.AccessDeniedException.class,()->service.execute(job.getId(),actor.getId()));
        verifyNoInteractions(workspace);
    }

    @Test void unsignedPreviewSurvivesRestartWithoutAcquiringSignatureAuthority() {
        var job=jobs.createPublishJob(revisionId,actor.getId(),request()); // Fixture creates a queued row only.
        new PublishingCommandStore(jdbc,new ObjectMapper(),mock(EntityManager.class)).savePreview(job,request());
        assertTrue(freshService().execute(job.getId(),actor.getId()));
        assertEquals("COMPLETED",status(job.getId()));
        verify(workspace).generatePreview(eq(revisionId),any(),eq(actor));
        verify(workspace,never()).completeConfirmedPublish(any(),any(),any(),any());
        verifyNoInteractions(signatures);
    }

    @Test void viewingTheDocumentDoesNotInvalidateTheConfirmedContent() {
        var job=service.acceptPublish(revisionId,actor.getId(),request());
        jdbc.update("update document_revisions set lock_version=lock_version+1,opened_by_user_id=?,updated_at=now() where id=?",UUID.randomUUID(),revisionId);
        jdbc.update("update documents set lock_version=lock_version+1,opened_by_user_id=?,updated_at=now() where id=?",UUID.randomUUID(),revisionId);
        assertTrue(service.execute(job.getId(),actor.getId()));
    }

    @Test void storedConfirmationCannotBeRewrittenOrDeleted() {
        var job=service.acceptPublish(revisionId,actor.getId(),request());
        assertThrows(org.springframework.dao.DataAccessException.class,()->jdbc.update("update publishing_job_commands set payload='{}'::jsonb where job_id=?",job.getId()));
        assertThrows(org.springframework.dao.DataAccessException.class,()->jdbc.update("delete from publishing_job_commands where job_id=?",job.getId()));
    }

    @Test void changingSignatureLayoutInvalidatesTheConfirmation() {
        var job=service.acceptPublish(revisionId,actor.getId(),request());
        jdbc.update("insert into publishing_template_placeholder_styles values(?,?,'changed signature layout')",UUID.randomUUID(),templateId);
        assertThrows(IllegalStateException.class,()->service.execute(job.getId(),actor.getId()));
        verifyNoInteractions(workspace);
    }

    @Test void changingDocumentRelationsInvalidatesTheConfirmation() {
        var job=service.acceptPublish(revisionId,actor.getId(),request());
        UUID related=UUID.randomUUID();jdbc.update("insert into documents(id) values(?)",related);
        jdbc.update("insert into document_relations values(?,?,?)",UUID.randomUUID(),revisionId,related);
        assertThrows(IllegalStateException.class,()->service.execute(job.getId(),actor.getId()));
        verifyNoInteractions(workspace);
    }
}
