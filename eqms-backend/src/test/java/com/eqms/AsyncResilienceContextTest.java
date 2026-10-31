package com.eqms;

import com.eqms.service.PublishingCommandRecovery;
import com.eqms.service.NotificationEmailOutboxWorker;
import com.eqms.service.ReportJobWorker;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/** Explicit disposable-DB opt-in. Never inherits the application's development DB URL. */
@EnabledIfEnvironmentVariable(named="EQMS_ASYNC_CONTEXT_TEST",matches="true")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.MOCK)
@DirtiesContext
class AsyncResilienceContextTest {
    // The pre-existing demo notification runner assumes example users exist in the DB.
    // This test validates application wiring/migrations, not demo records.
    @org.springframework.boot.test.mock.mockito.MockBean
    com.eqms.bootstrap.NotificationBootstrap demoNotifications;
    @DynamicPropertySource static void isolatedDatabase(DynamicPropertyRegistry registry) {
        String url=System.getenv("EQMS_ASYNC_TEST_DB");
        if(url==null||!url.contains(":55439/async_test"))throw new IllegalStateException("Disposable async test database is required");
        registry.add("spring.datasource.url",()->url);
        registry.add("spring.datasource.username",()->"postgres");
        registry.add("spring.datasource.password",()->System.getenv("EQMS_ASYNC_TEST_PASSWORD"));
        registry.add("app.notifications.outbox-encryption-key",()->java.util.Base64.getEncoder().encodeToString(new byte[32]));
        registry.add("app.scheduler-lock.redis.enabled",()->"true");
    }
    @Autowired PublishingCommandRecovery publishing;
    @Autowired NotificationEmailOutboxWorker email;
    @Autowired ReportJobWorker reports;

    @Test void workersAndTheirDependenciesStartAfterAllMigrations() {
        assertNotNull(publishing);assertNotNull(email);assertNotNull(reports);
    }
}
