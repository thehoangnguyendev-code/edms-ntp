package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.AuditTrailService;
import com.eqms.service.EffectivePermissionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import java.nio.file.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Real PostgreSQL, isolated schema; never writes application records. Explicit opt-in. */
@EnabledIfEnvironmentVariable(named="EQMS_REPORT_TEST_DB",matches=".+")
class ReportTemplateDatabaseTest {
    JdbcTemplate jdbc, bootstrap;
    com.zaxxer.hikari.HikariDataSource testPool;
    ReportTemplateService service;
    AuditTrailService audit;
    UserAccount actor;
    UUID role=UUID.randomUUID();
    String schema;
    ObjectMapper json=new ObjectMapper();
    @BeforeEach void setup() throws Exception {
        String url=System.getenv("EQMS_REPORT_TEST_DB"),user=System.getenv("EQMS_REPORT_TEST_USER"),password=System.getenv("EQMS_REPORT_TEST_PASSWORD");
        bootstrap=new JdbcTemplate(new DriverManagerDataSource(url,user,password));
        schema="report_test_"+UUID.randomUUID().toString().replace("-","");
        bootstrap.execute("create schema "+schema);
        testPool=new com.zaxxer.hikari.HikariDataSource();testPool.setJdbcUrl(url+"?currentSchema="+schema);testPool.setUsername(user);testPool.setPassword(password);testPool.setMaximumPoolSize(2);testPool.setMinimumIdle(0);
        var ds=testPool;jdbc=new JdbcTemplate(ds);
        jdbc.execute("create table app_users(id uuid primary key)");
        jdbc.execute("create table roles(id uuid primary key,name text,code text,is_active boolean)");
        jdbc.execute("create table retention_policies(id uuid primary key,name text,retention_days integer,is_active boolean)");
        jdbc.execute("insert into retention_policies values('11111111-1111-1111-1111-111111111201','7 Years + Current',2922,true)");
        jdbc.execute("create table permissions(id uuid primary key,code text unique,name text,category text,module_key text,group_key text,description text,display_order integer,requires_audit boolean)");
        for(String migration:List.of("V359__create_report_platform.sql","V360__complete_report_schedule_contract.sql","V361__add_report_artifact_retention_controls.sql","V392__add_requested_format_to_report_runs.sql","V530__report_template_metadata_scopes.sql","V531__report_artifact_publication_journal.sql","V532__report_layout_templates.sql","V534__report_analytics_layout.sql","V535__report_word_components.sql")) {
            jdbc.execute(Files.readString(Path.of("src/main/resources/db/migration",migration)));
        }
        jdbc.execute(Files.readString(Path.of("src/main/resources/db/migration/V536__report_template_soft_delete.sql")));
        jdbc.execute("create table user_access_profiles(user_id uuid,access_profile_id uuid)");
        jdbc.execute("create table documents(id uuid primary key,document_number text,document_name text,status_code text,document_type_id uuid,business_unit_id uuid,department_id uuid,author_user_id uuid,effective_date date,created_at timestamptz)");
        jdbc.execute("create table document_statuses(code text,label text);create table departments(id uuid,name text);create table business_units(id uuid,name text);create table document_types(id uuid,name text)");
        jdbc.execute("create table document_workflow_participants(document_id uuid,user_id uuid);create table document_revisions(id uuid,document_id uuid);create table revision_workflow_participants(revision_id uuid,user_id uuid)");
        actor=new UserAccount();actor.setId(UUID.randomUUID());actor.setStatus(UserStatus.Active);actor.setDepartment("QA");actor.setBusinessUnit("NTP");
        jdbc.update("insert into app_users values(?)",actor.getId());jdbc.update("insert into roles values(?,'QA role','QA',true)",role);jdbc.update("insert into user_access_profiles values(?,?)",actor.getId(),role);
        UUID qa=UUID.randomUUID(),qc=UUID.randomUUID(),ntp=UUID.randomUUID(),other=UUID.randomUUID(),type=UUID.randomUUID();
        jdbc.update("insert into departments values(?,'QA'),(?,'QC')",qa,qc);jdbc.update("insert into business_units values(?,'NTP'),(?,'OTHER')",ntp,other);jdbc.update("insert into document_types values(?,'Forms')",type);jdbc.execute("insert into document_statuses values('ACTIVE','Active')");
        for(int i=1;i<=13;i++)jdbc.update("insert into documents values(?,?,?,'ACTIVE',?,?,?,?,date '2026-10-01',timestamptz '2026-10-01 00:00:00+00')",
                UUID.randomUUID(),String.format("FORM-%03d",i),"Yêu cầu "+i,type,i==13?other:ntp,i==13?qc:qa,i==1?actor.getId():UUID.randomUUID());
        var permissions=mock(EffectivePermissionService.class);when(permissions.getEffectivePermissionCodes(actor)).thenReturn(Set.of("reports.run.create","reports.catalog.view","reports.definition.manage","reports.definition.view","reports.artifact.download","reports.run.view_own","reports.schedule.manage","reports.schedule.view"));
        audit=mock(AuditTrailService.class);
        var target=new ReportTemplateService(jdbc,json,permissions,audit,List.of(new DocumentReportMetadataProvider()));
        ProxyFactory factory=new ProxyFactory(target);factory.setProxyTargetClass(true);
        factory.addAdvice(new TransactionInterceptor(new DataSourceTransactionManager(ds),new AnnotationTransactionAttributeSource()));
        service=(ReportTemplateService)factory.getProxy();
        service.save(actor,"QA_REGISTER",request(null,"SYSTEM"),true);
    }
    @AfterEach void cleanup() {
        if(testPool!=null)testPool.close();
        if(bootstrap!=null&&schema!=null&&schema.matches("report_test_[a-f0-9]{32}"))bootstrap.execute("drop schema "+schema+" cascade");
    }
    ReportTemplateService.TemplateWrite request(Integer version,String scope) {
        return new ReportTemplateService.TemplateWrite(version,"DOCUMENT_STATUS","QA Register","Test",true,List.of("PDF","CSV","XLSX"),
                List.of(new ReportTemplateService.FieldWrite("documentNumber",true,true,true),new ReportTemplateService.FieldWrite("documentName",true,true,true),new ReportTemplateService.FieldWrite("status",true,true,false),new ReportTemplateService.FieldWrite("department",true,false,false),new ReportTemplateService.FieldWrite("businessUnit",true,false,false)),
                List.of(new ReportTemplateService.RoleScope(role,scope)),"Test configuration");
    }
    ReportTemplateService.Criteria criteria() {return new ReportTemplateService.Criteria(1,List.of("documentNumber","documentName"),Map.of(),"documentNumber","desc");}
    @Test void softDeletePreservesHistoryAndArtifactScopeButBlocksFutureUse() {
        var snapshot=service.snapshot(actor,"QA_REGISTER",criteria());
        ((com.fasterxml.jackson.databind.node.ObjectNode)snapshot).putArray("sourceDocumentIds").add(jdbc.queryForObject("select id::text from documents where document_number='FORM-001'",String.class));
        assertThrows(IllegalArgumentException.class,()->service.delete(actor,"QA_REGISTER",1," "));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.delete(actor,"QA_REGISTER",2,"Remove"));
        service.delete(actor,"QA_REGISTER",1,"Retire unused template");
        assertEquals(0,((List<?>)service.catalog(actor,"",1,"displayName","asc").get("data")).size());
        assertEquals(0,((List<?>)service.adminCatalog(actor,"QA_REGISTER",1,"displayName","asc").get("data")).size());
        assertEquals(2,jdbc.queryForObject("select count(*) from report_definition_versions",Integer.class));
        assertEquals(1,jdbc.queryForObject("select count(*) from report_template_role_scopes",Integer.class));
        assertNotNull(service.definition("QA_REGISTER").get("deletedAt"));
        assertThrows(SecurityException.class,()->service.snapshot(actor,"QA_REGISTER",criteria()));
        assertThrows(SecurityException.class,()->service.options(actor,"QA_REGISTER","department",""));
        assertThrows(SecurityException.class,()->service.render(actor,"QA_REGISTER",snapshot,1,10,true));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.save(actor,"QA_REGISTER",request(2,"SYSTEM"),false));
        assertDoesNotThrow(()->service.reauthorize(actor,"QA_REGISTER",snapshot));
        jdbc.update("delete from user_access_profiles");
        assertThrows(SecurityException.class,()->service.reauthorize(actor,"QA_REGISTER",snapshot));
    }
    @Test void deleteAuditFailureRollsBackAndInactiveActorIsDenied() {
        actor.setStatus(UserStatus.Inactive);
        assertThrows(SecurityException.class,()->service.delete(actor,"QA_REGISTER",1,"Remove"));
        actor.setStatus(UserStatus.Active);
        doThrow(new IllegalStateException("audit unavailable")).when(audit).logAs(eq(actor),anyString(),anyString(),any(),eq("REPORT_TEMPLATE_DELETED"),any(),any(),anyString());
        assertThrows(IllegalStateException.class,()->service.delete(actor,"QA_REGISTER",1,"Remove"));
        assertNull(service.definition("QA_REGISTER").get("deletedAt"));
        assertEquals(1,service.definition("QA_REGISTER").get("definitionVersion"));
        assertEquals(1,jdbc.queryForObject("select count(*) from report_definition_versions",Integer.class));
    }
    @Test void catalogFiltersAndSourcesAreServerScoped() {
        assertEquals(1L,((Map<?,?>)service.adminCatalog(actor,"QA_REGISTER",1,"updatedAt","desc",Map.of("status","ACTIVE","format","PDF","orientation","LANDSCAPE","sourceCode","DOCUMENT_STATUS")).get("pagination")).get("total"));
        assertEquals(0L,((Map<?,?>)service.adminCatalog(actor,"",1,"displayName","asc",Map.of("status","DISABLED")).get("pagination")).get("total"));
        assertThrows(IllegalArgumentException.class,()->service.catalog(actor,"",1,"displayName","asc",Map.of("format","PDF';drop table documents")));
        assertThrows(IllegalArgumentException.class,()->service.catalog(actor,"",1,"displayName","asc",Map.of("untrusted","SQL")));
        assertEquals(1,((List<?>)service.catalog(actor,"",1,"displayName","asc").get("sources")).size());
        jdbc.update("delete from user_access_profiles");
        assertEquals(0,((List<?>)service.catalog(actor,"",1,"displayName","asc").get("sources")).size());
    }
    @Test void sourceAdvertisesOnlyServerDeclaredDateFields() {
        var source=service.sources(actor).get(0);
        assertEquals(List.of("createdAt","effectiveDate"),source.get("dateFields"));
    }
    @Test void wordUploadIsImmutableAndAuditFailureRollsBack() throws Exception {
        var target=new ReportWordService(jdbc,json,audit,mock(com.eqms.service.PublishingOpenXmlTemplateRenderService.class),mock(com.eqms.service.OnlyOfficeDocumentEditService.class));
        ProxyFactory factory=new ProxyFactory(target);factory.setProxyTargetClass(true);
        factory.addAdvice(new TransactionInterceptor(new DataSourceTransactionManager(jdbc.getDataSource()),new AnnotationTransactionAttributeSource()));
        var words=(ReportWordService)factory.getProxy();
        var ref=words.upload(actor,"header","test.docx",ReportWordServiceTest.docx("{{report.title}}"));
        assertEquals(List.of("report.title","report.executor"),ref.placeholders());
        assertThrows(org.springframework.dao.DataAccessException.class,()->jdbc.update("update report_word_components set file_name='changed.docx' where id=?",ref.id()));
        assertThrows(org.springframework.dao.DataAccessException.class,()->jdbc.update("delete from report_word_components where id=?",ref.id()));
        doThrow(new IllegalStateException("AUDIT_UNAVAILABLE")).when(audit).logAs(eq(actor),eq("REPORT_TEMPLATE"),anyString(),any(UUID.class),eq("REPORT_WORD_COMPONENT_UPLOADED"),isNull(),isNull(),anyString());
        assertThrows(IllegalStateException.class,()->words.upload(actor,"footer","test.docx",ReportWordServiceTest.docx("{{report.title}}")));
        assertEquals(1,jdbc.queryForObject("select count(*) from report_word_components",Integer.class));
    }
    @Test void serverCountPaginationSortAndFilteredPreview() {
        var first=service.preview(actor,"QA_REGISTER",criteria(),1);assertEquals(13L,((Map<?,?>)first.get("pagination")).get("total"));
        var rows=(List<List<String>>)first.get("rows");assertEquals(11,rows.size());assertEquals("FORM-013",rows.get(1).get(0));
        var second=(List<List<String>>)service.preview(actor,"QA_REGISTER",criteria(),2).get("rows");assertEquals(4,second.size());
        var filtered=service.preview(actor,"QA_REGISTER",new ReportTemplateService.Criteria(1,null,Map.of("search","FORM-001"),"documentNumber","asc"),1);
        assertEquals(1L,((Map<?,?>)filtered.get("pagination")).get("total"));
    }
    @Test void allFourScopesAndRevocationUseCurrentAssignment() {
        var snapshot=service.snapshot(actor,"QA_REGISTER",criteria());
        assertEquals(13,service.render(actor,"QA_REGISTER",snapshot,1,10000,true).total());
        jdbc.update("update report_template_role_scopes set scope_code='DEPARTMENT'");assertEquals(12,service.render(actor,"QA_REGISTER",snapshot,1,10000,true).total());
        jdbc.update("update report_template_role_scopes set scope_code='BUSINESS_UNIT'");assertEquals(12,service.render(actor,"QA_REGISTER",snapshot,1,10000,true).total());
        jdbc.update("update report_template_role_scopes set scope_code='PERSONAL'");assertEquals(1,service.render(actor,"QA_REGISTER",snapshot,1,10000,true).total());
        ((com.fasterxml.jackson.databind.node.ObjectNode)snapshot).putArray("sourceDocumentIds").add(jdbc.queryForObject("select id::text from documents where document_number='FORM-013'",String.class));
        assertThrows(SecurityException.class,()->service.reauthorize(actor,"QA_REGISTER",snapshot));
        jdbc.update("update roles set is_active=false");assertThrows(SecurityException.class,()->service.render(actor,"QA_REGISTER",snapshot,1,10000,true));
    }
    @Test void staleVersionRequiredFieldsAndSqlSortAreRejected() {
        service.save(actor,"QA_REGISTER",request(1,"SYSTEM"),false);
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.save(actor,"QA_REGISTER",request(1,"SYSTEM"),false));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.preview(actor,"QA_REGISTER",criteria(),1));
        assertThrows(IllegalArgumentException.class,()->service.snapshot(actor,"QA_REGISTER",new ReportTemplateService.Criteria(2,List.of("status"),Map.of(),"documentNumber","asc")));
        assertThrows(IllegalArgumentException.class,()->service.snapshot(actor,"QA_REGISTER",new ReportTemplateService.Criteria(2,null,Map.of(),"id;drop table documents","asc")));
    }
    @Test void auditFailureRollsBackConfigurationAndVersionTogether() {
        doThrow(new IllegalStateException("audit unavailable")).when(audit).logAs(eq(actor),anyString(),anyString(),any(),anyString(),any(),any(),anyString());
        assertThrows(IllegalStateException.class,()->service.save(actor,"QA_REGISTER",request(1,"DEPARTMENT"),false));
        assertEquals(1,jdbc.queryForObject("select definition_version from report_definitions where code='QA_REGISTER'",Integer.class));
        assertEquals("SYSTEM",jdbc.queryForObject("select scope_code from report_template_role_scopes",String.class));
        assertEquals(1,jdbc.queryForObject("select count(*) from report_definition_versions",Integer.class));
    }
    @Test void catalogHidesUnassignedRolesAndOptionsAreScoped() {
        assertEquals(1,((List<?>)service.catalog(actor,"",1,"displayName","asc").get("data")).size());
        assertFalse(json.valueToTree(service.catalog(actor,"",1,"displayName","asc").get("data")).toString().contains("roleScopes"));
        jdbc.update("update report_template_role_scopes set scope_code='DEPARTMENT'");
        assertEquals(1,service.options(actor,"QA_REGISTER","department","").size());
        jdbc.update("delete from user_access_profiles");
        assertEquals(0,((List<?>)service.catalog(actor,"",1,"displayName","asc").get("data")).size());
        assertThrows(SecurityException.class,()->service.preview(actor,"QA_REGISTER",criteria(),1));
    }
    @Test void hiddenColumnCannotBeProbedWithLookupOrFilter() {
        assertThrows(SecurityException.class,()->service.options(actor,"QA_REGISTER","documentType",""));
        assertThrows(SecurityException.class,()->service.snapshot(actor,"QA_REGISTER",new ReportTemplateService.Criteria(1,null,Map.of("documentType","a"),"documentNumber","asc")));
    }
    com.eqms.service.ReportPlatformService platform() {
        var permission=mock(com.eqms.service.PermissionEvaluationService.class);when(permission.hasPermission(eq(actor),anyString())).thenReturn(true);
        var target=new com.eqms.service.ReportPlatformService(jdbc,json,permission,mock(com.eqms.repository.DocumentRecordRepository.class),mock(com.eqms.repository.UserAccountRepository.class),mock(com.eqms.service.DocumentAuthorizationService.class),mock(com.eqms.service.FileStorageService.class),audit);
        target.configureTemplates(service);
        ProxyFactory factory=new ProxyFactory(target);factory.setProxyTargetClass(true);
        factory.addAdvice(new TransactionInterceptor(new DataSourceTransactionManager(jdbc.getDataSource()),new AnnotationTransactionAttributeSource()));
        return (com.eqms.service.ReportPlatformService)factory.getProxy();
    }
    @Test void queueDefaultFieldsIdempotentReplayAndConflict() {
        var platform=platform();var request=new com.eqms.service.ReportPlatformService.RunRequest("QA_REGISTER","CSV",null,null,null);
        UUID id=platform.queueRun(actor,request,"same-key");assertEquals(id,platform.queueRun(actor,request,"same-key"));
        assertEquals(1,jdbc.queryForObject("select count(*) from report_runs",Integer.class));
        assertEquals(1,jdbc.queryForObject("select count(*) from report_run_events",Integer.class));
        assertTrue(jdbc.queryForObject("select selected_fields::text from report_runs",String.class).startsWith("["));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->platform.queueRun(actor,new com.eqms.service.ReportPlatformService.RunRequest("QA_REGISTER","PDF",null,null,null),"same-key"));
    }
    record WorkerFixture(com.eqms.service.ReportPlatformService platform,com.eqms.service.FileStorageService storage,Map<String,byte[]> files,ReportArtifactPublisher publisher) {}
    WorkerFixture workerFixture() throws Exception {
        var users=mock(com.eqms.repository.UserAccountRepository.class);when(users.findById(actor.getId())).thenReturn(Optional.of(actor));
        var permission=mock(com.eqms.service.PermissionEvaluationService.class);when(permission.hasPermission(eq(actor),anyString())).thenReturn(true);
        var storage=mock(com.eqms.service.FileStorageService.class);Map<String,byte[]> files=new HashMap<>();
        when(storage.storeReportArtifact(anyString(),any(java.io.InputStream.class),anyString())).thenAnswer(invocation->{
            String key=invocation.getArgument(0);byte[] bytes=((java.io.InputStream)invocation.getArgument(1)).readAllBytes();files.put(key,bytes);
            String hash=HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes));
            return new com.eqms.service.FileStorageService.StorageWriteResult(null,key,"MINIO","test",key,"v1",hash);
        });
        when(storage.readReportArtifact(anyString(),anyString())).thenAnswer(invocation->files.get((String)invocation.getArgument(1)));
        var publisherTarget=new ReportArtifactPublisher(jdbc,service,users);ProxyFactory pf=new ProxyFactory(publisherTarget);pf.setProxyTargetClass(true);
        pf.addAdvice(new TransactionInterceptor(new DataSourceTransactionManager(jdbc.getDataSource()),new AnnotationTransactionAttributeSource()));
        var publisher=(ReportArtifactPublisher)pf.getProxy();
        var target=new com.eqms.service.ReportPlatformService(jdbc,json,permission,mock(com.eqms.repository.DocumentRecordRepository.class),users,mock(com.eqms.service.DocumentAuthorizationService.class),storage,audit);
        target.configureTemplates(service);target.configurePublisher(publisher);
        ProxyFactory factory=new ProxyFactory(target);factory.setProxyTargetClass(true);
        factory.addAdvice(new TransactionInterceptor(new DataSourceTransactionManager(jdbc.getDataSource()),new AnnotationTransactionAttributeSource()));
        return new WorkerFixture((com.eqms.service.ReportPlatformService)factory.getProxy(),storage,files,publisher);
    }
    @Test void workerPublishesAllFormatsAndDownloadRechecksScopeAndChecksum() throws Exception {
        var fixture=workerFixture();
        for(String format:List.of("CSV","PDF","XLSX")) {
            UUID run=fixture.platform().queueRun(actor,new com.eqms.service.ReportPlatformService.RunRequest("QA_REGISTER",format,null,null,null),"worker-"+format);
            assertTrue(fixture.platform().processOneQueuedRun());
            assertEquals("COMPLETED",jdbc.queryForObject("select status from report_runs where id=?",String.class,run));
            UUID artifact=jdbc.queryForObject("select id from report_artifacts where run_id=?",UUID.class,run);
            var download=fixture.platform().download(actor,run,artifact);assertTrue(download.bytes().length>100);assertTrue(download.filename().endsWith("."+format.toLowerCase()));
            if(format.equals("PDF"))try(var pdf=org.apache.pdfbox.Loader.loadPDF(download.bytes())) {assertTrue(new org.apache.pdfbox.text.PDFTextStripper().getText(pdf).contains("Yêu cầu 13"));}
            if(format.equals("XLSX"))try(var workbook=new org.apache.poi.xssf.usermodel.XSSFWorkbook(new java.io.ByteArrayInputStream(download.bytes()))) {assertEquals(14,workbook.getSheet("Report").getPhysicalNumberOfRows());assertNotNull(workbook.getSheet("Report information"));}
            assertEquals("PUBLISHED",jdbc.queryForObject("select status from report_artifact_publication_journal where artifact_id=?",String.class,artifact));
            String key=jdbc.queryForObject("select object_key from report_artifacts where id=?",String.class,artifact);byte[] original=fixture.files().get(key);fixture.files().put(key,new byte[]{1,2,3});
            assertThrows(IllegalStateException.class,()->fixture.platform().download(actor,run,artifact));fixture.files().put(key,original);
            jdbc.update("update report_template_role_scopes set scope_code='DEPARTMENT'");assertThrows(SecurityException.class,()->fixture.platform().download(actor,run,artifact));
            jdbc.update("update report_template_role_scopes set scope_code='SYSTEM'");
        }
        assertFalse(fixture.platform().processOneQueuedRun());
    }
    @Test void revokedQueuedRunFailsPermanentlyWithoutCreatingFile() throws Exception {
        var fixture=workerFixture();UUID run=fixture.platform().queueRun(actor,new com.eqms.service.ReportPlatformService.RunRequest("QA_REGISTER","CSV",null,null,null),"revoke");
        jdbc.update("delete from user_access_profiles");assertTrue(fixture.platform().processOneQueuedRun());
        assertEquals("FAILED",jdbc.queryForObject("select status from report_runs where id=?",String.class,run));
        assertEquals("REPORT_AUTHORIZATION_CHANGED",jdbc.queryForObject("select reason_code from report_runs where id=?",String.class,run));
        assertTrue(fixture.files().isEmpty());assertEquals(0,jdbc.queryForObject("select count(*) from report_artifacts",Integer.class));
    }
    @Test void transientStorageFailureRetriesAndStaleFailureCannotOverwriteCompletion() throws Exception {
        var fixture=workerFixture();UUID run=fixture.platform().queueRun(actor,new com.eqms.service.ReportPlatformService.RunRequest("QA_REGISTER","CSV",null,null,null),"storage-failure");
        doThrow(new IllegalStateException("private storage detail")).when(fixture.storage()).storeReportArtifact(anyString(),any(java.io.InputStream.class),anyString());
        assertTrue(fixture.platform().processOneQueuedRun());assertEquals("RETRY_SCHEDULED",jdbc.queryForObject("select status from report_runs where id=?",String.class,run));
        assertFalse(jdbc.queryForObject("select error_message from report_runs where id=?",String.class,run).contains("private"));
        assertEquals(1,jdbc.queryForObject("select count(*) from report_artifact_publication_journal where status='PENDING'",Integer.class));
        jdbc.update("update report_runs set status='PROCESSING',attempt_count=2,lease_until=now()+interval '10 minutes' where id=?",run);
        fixture.publisher().fail(run,1,new SecurityException());assertEquals("PROCESSING",jdbc.queryForObject("select status from report_runs where id=?",String.class,run));
        fixture.publisher().fail(run,2,new SecurityException());assertEquals("FAILED",jdbc.queryForObject("select status from report_runs where id=?",String.class,run));
    }
    @Test void csvNeutralizesSpreadsheetFormulaInjection() throws Exception {
        jdbc.update("update documents set document_name='   =HYPERLINK(\"https://invalid.example\")' where document_number='FORM-001'");
        var fixture=workerFixture();UUID run=fixture.platform().queueRun(actor,new com.eqms.service.ReportPlatformService.RunRequest("QA_REGISTER","CSV",null,null,null),"csv-formula");
        fixture.platform().processOneQueuedRun();UUID artifact=jdbc.queryForObject("select id from report_artifacts where run_id=?",UUID.class,run);
        String csv=new String(fixture.platform().download(actor,run,artifact).bytes(),java.nio.charset.StandardCharsets.UTF_8);assertTrue(csv.contains("\"'   =HYPERLINK"));
    }
    @Test void retryAuditFailureRollsBackStatusAndEvent() {
        var platform=platform();UUID run=platform.queueRun(actor,new com.eqms.service.ReportPlatformService.RunRequest("QA_REGISTER","CSV",null,null,null),"retry-audit");
        jdbc.update("update report_runs set status='FAILED' where id=?",run);
        doThrow(new IllegalStateException("audit unavailable")).when(audit).logAs(eq(actor),anyString(),anyString(),any(),eq("REPORT_RUN_RETRY_REQUESTED"),any(),any(),anyString());
        assertThrows(IllegalStateException.class,()->platform.retryRun(actor,run));
        assertEquals("FAILED",jdbc.queryForObject("select status from report_runs where id=?",String.class,run));
        assertEquals(0,jdbc.queryForObject("select count(*) from report_run_events where event_type='RETRY_REQUESTED'",Integer.class));
    }
    @Test void removedOutputFormatFailsBeforeWritingAnArtifact() throws Exception {
        var fixture=workerFixture();UUID run=fixture.platform().queueRun(actor,new com.eqms.service.ReportPlatformService.RunRequest("QA_REGISTER","CSV",null,null,null),"format-policy");
        jdbc.update("update report_definitions set allowed_formats='[\"PDF\"]'::jsonb where code='QA_REGISTER'");
        fixture.platform().processOneQueuedRun();assertEquals("FAILED",jdbc.queryForObject("select status from report_runs where id=?",String.class,run));
        assertEquals("REPORT_INVALID_CRITERIA",jdbc.queryForObject("select reason_code from report_runs where id=?",String.class,run));assertTrue(fixture.files().isEmpty());
    }
    @Test void layoutIsPinnedAndRejectedLayoutCannotPartiallySave() {
        var snapshot=service.snapshot(actor,"QA_REGISTER",criteria());
        var before=request(1,"SYSTEM");
        var changed=new ReportLayout(true,"NEW COVER","",true,true,"Header","Footer",true,true,"TEST",true,"DRAFT");
        service.save(actor,"QA_REGISTER",new ReportTemplateService.TemplateWrite(before.version(),before.sourceCode(),before.displayName(),before.description(),before.active(),before.formats(),before.fields(),before.roleScopes(),before.reason(),changed),false);
        assertEquals("{{report.title}}",snapshot.path("definition").path("layout").path("coverTitle").asText());
        assertEquals("NEW COVER",json.valueToTree(service.definition("QA_REGISTER")).path("layout").path("coverTitle").asText());
        var invalid=new ReportLayout(true,"{{user.password}}","",true,true,"","",true,false,"",false,"");
        assertThrows(IllegalArgumentException.class,()->service.save(actor,"QA_REGISTER",new ReportTemplateService.TemplateWrite(2,before.sourceCode(),"Must not save",before.description(),true,before.formats(),before.fields(),before.roleScopes(),before.reason(),invalid),false));
        assertEquals(2,service.definition("QA_REGISTER").get("definitionVersion"));assertEquals("QA Register",service.definition("QA_REGISTER").get("displayName"));
    }
    @Test void sampleSetupGrantsOnlyAdministratorAndIsRepeatable() throws Exception {
        UUID adminRole=UUID.randomUUID();jdbc.update("insert into roles values(?,'Administrator','ADMINISTRATOR',true)",adminRole);
        var migration=Files.readString(Path.of("src/main/resources/db/migration/V533__report_test_templates.sql"));jdbc.execute(migration);jdbc.execute(migration);
        assertEquals(3,jdbc.queryForObject("select count(*) from report_template_role_scopes where definition_code like 'TEST_%' and role_id=? and scope_code='SYSTEM'",Integer.class,adminRole));
        assertEquals(0,jdbc.queryForObject("select count(*) from report_template_role_scopes where definition_code like 'TEST_%' and role_id<>?",Integer.class,adminRole));
        assertEquals(3,jdbc.queryForObject("select count(*) from report_definition_versions where definition_code like 'TEST_%'",Integer.class));
        assertEquals(13,jdbc.queryForObject("select count(*) from documents",Integer.class));
    }
    @Test void livePdfUsesTheFullCurrentScopeWithoutCreatingHistory() throws Exception {
        var write=request(1,"SYSTEM");var defaults=ReportLayout.defaults();
        var layout=new ReportLayout(true,"{{report.title}}","TEST",true,true,defaults.header(),defaults.footer(),true,false,"",false,"",null,null,null,List.of(new ReportLayout.Chart("Status","BAR","status","COUNT")));
        service.save(actor,"QA_REGISTER",new ReportTemplateService.TemplateWrite(1,write.sourceCode(),write.displayName(),write.description(),true,write.formats(),write.fields(),write.roleScopes(),write.reason(),layout),false);
        var criteria=new ReportTemplateService.Criteria(2,List.of("documentNumber","documentName","status"),Map.of(),"documentNumber","asc");
        try(var pdf=org.apache.pdfbox.Loader.loadPDF(service.previewPdf(actor,"QA_REGISTER",criteria,"My live report"))){assertTrue(pdf.getNumberOfPages()>=3);assertTrue(new org.apache.pdfbox.text.PDFTextStripper().getText(pdf).contains("FORM-013"));}
        assertEquals(0,jdbc.queryForObject("select count(*) from report_runs",Integer.class));assertEquals(0,jdbc.queryForObject("select count(*) from report_artifacts",Integer.class));
        jdbc.update("update report_template_role_scopes set scope_code='PERSONAL'");
        try(var pdf=org.apache.pdfbox.Loader.loadPDF(service.previewPdf(actor,"QA_REGISTER",criteria,"Personal report"))){String text=new org.apache.pdfbox.text.PDFTextStripper().getText(pdf);assertTrue(text.contains("FORM-001"));assertFalse(text.contains("FORM-013"));}
        jdbc.update("delete from user_access_profiles");assertThrows(SecurityException.class,()->service.previewPdf(actor,"QA_REGISTER",criteria,"Denied"));
    }
    @Test void workerPinsTitleAndChartsAndHistoryDoesNotLeakInternalSnapshot() throws Exception {
        var write=request(1,"SYSTEM");var layout=new ReportLayout(true,"{{report.title}}","TEST",true,true,"{{report.title}}","TEST",true,false,"",false,"",null,null,null,List.of(new ReportLayout.Chart("Status","PIE","status","COUNT")));
        service.save(actor,"QA_REGISTER",new ReportTemplateService.TemplateWrite(1,write.sourceCode(),write.displayName(),write.description(),true,write.formats(),write.fields(),write.roleScopes(),write.reason(),layout),false);
        var fixture=workerFixture();UUID run=fixture.platform().queueRun(actor,new com.eqms.service.ReportPlatformService.RunRequest("QA_REGISTER","PDF",Map.of("reportTitle","Pinned TEST title"),null,null),"analytics-pinned");
        service.save(actor,"QA_REGISTER",request(2,"SYSTEM"),false);
        fixture.platform().processOneQueuedRun();var snapshot=json.readTree(jdbc.queryForObject("select authorization_snapshot::text from report_runs where id=?",String.class,run));
        assertEquals("Pinned TEST title",snapshot.path("reportTitle").asText());assertEquals(13,snapshot.path("charts").get(0).path("total").asInt());assertEquals(13,snapshot.path("charts").get(0).path("points").get(0).path("count").asInt());
        assertFalse(fixture.platform().runDetail(actor,run).containsKey("authorizationSnapshot"));
        assertEquals(1L,((Map<?,?>)fixture.platform().runs(actor,"Pinned TEST",1,10,"queuedAt","desc").get("pagination")).get("total"));
    }
    @Test void scheduleSearchVersionConflictAndAuditRollbackAreServerOwned() throws Exception {
        var platform=platform();UUID id=platform.createSchedule(actor,new com.eqms.service.ReportPlatformService.ScheduleRequest("TEST Schedule","QA_REGISTER","0 0 8 * * *","PDF",Map.of(),null,List.of()));
        var users=mock(com.eqms.repository.UserAccountRepository.class);when(users.findById(actor.getId())).thenReturn(Optional.of(actor));
        var permissions=mock(com.eqms.service.PermissionEvaluationService.class);when(permissions.hasPermission(eq(actor),anyString())).thenReturn(true);
        var target=new ReportScheduleAdministrationService(jdbc,service,permissions,users,audit,json);var factory=new ProxyFactory(target);factory.setProxyTargetClass(true);factory.addAdvice(new TransactionInterceptor(new DataSourceTransactionManager(jdbc.getDataSource()),new AnnotationTransactionAttributeSource()));
        var schedules=(ReportScheduleAdministrationService)factory.getProxy();
        assertEquals(1L,((Map<?,?>)schedules.list(actor,"TEST","ACTIVE",1,"name","asc").get("pagination")).get("total"));
        assertEquals(0L,((Map<?,?>)schedules.list(actor,"No match","",1,"name","asc").get("pagination")).get("total"));
        assertThrows(IllegalArgumentException.class,()->schedules.list(actor,"","",1,"name;drop table documents","asc"));
        var value=new com.eqms.service.ReportPlatformService.ScheduleRequest("TEST Updated","QA_REGISTER","0 0 9 * * *","PDF",Map.of(),null,List.of());
        schedules.update(actor,id,new ReportScheduleAdministrationService.Update(1,value,"Approved test edit"));assertEquals(2,schedules.detail(actor,id).get("version"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->schedules.update(actor,id,new ReportScheduleAdministrationService.Update(1,value,"Stale edit")));
        doThrow(new IllegalStateException("Audit unavailable")).when(audit).logAs(eq(actor),anyString(),anyString(),any(),eq("REPORT_SCHEDULE_UPDATED"),any(),any(),anyString());
        assertThrows(IllegalStateException.class,()->schedules.update(actor,id,new ReportScheduleAdministrationService.Update(2,value,"Rollback test")));assertEquals(2,schedules.detail(actor,id).get("version"));
        assertEquals(13,jdbc.queryForObject("select count(*) from documents",Integer.class));
    }
    @Test void publicationIsFencedAndRollsBackAfterEventFailure() {
        var platform=platform();UUID run=platform.queueRun(actor,new com.eqms.service.ReportPlatformService.RunRequest("QA_REGISTER","CSV",null,null,null),"publish");
        jdbc.update("update report_runs set status='PROCESSING',attempt_count=2,lease_until=now()+interval '10 minutes' where id=?",run);
        var users=mock(com.eqms.repository.UserAccountRepository.class);when(users.findById(actor.getId())).thenReturn(Optional.of(actor));
        var target=new ReportArtifactPublisher(jdbc,service,users);ProxyFactory factory=new ProxyFactory(target);factory.setProxyTargetClass(true);
        factory.addAdvice(new TransactionInterceptor(new DataSourceTransactionManager(jdbc.getDataSource()),new AnnotationTransactionAttributeSource()));
        var publisher=(ReportArtifactPublisher)factory.getProxy();
        var snapshot=service.snapshot(actor,"QA_REGISTER",criteria());((com.fasterxml.jackson.databind.node.ObjectNode)snapshot).putArray("sourceDocumentIds");
        UUID artifact=UUID.randomUUID();String hash="0".repeat(64);
        var stored=new com.eqms.service.FileStorageService.StorageWriteResult(null,"reports/test.csv","MINIO","test","reports/test.csv","v1",hash);
        assertThrows(IllegalStateException.class,()->publisher.publish(run,1,artifact,"QA_REGISTER",snapshot,"CSV","test.csv",stored,"text/csv",10,hash,null));
        assertEquals(0,jdbc.queryForObject("select count(*) from report_artifacts",Integer.class));
        jdbc.execute("create function fail_event() returns trigger language plpgsql as 'begin raise exception ''event unavailable''; end';create trigger fail_completed before insert on report_run_events for each row execute function fail_event()");
        assertThrows(Exception.class,()->publisher.publish(run,2,artifact,"QA_REGISTER",snapshot,"CSV","test.csv",stored,"text/csv",10,hash,null));
        assertEquals(0,jdbc.queryForObject("select count(*) from report_artifacts",Integer.class));
        assertEquals("PROCESSING",jdbc.queryForObject("select status from report_runs where id=?",String.class,run));
    }
}
