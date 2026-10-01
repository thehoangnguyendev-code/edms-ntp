package com.eqms;

import com.eqms.repository.CalendarEventRepository;
import com.eqms.repository.CalendarSourceRepository;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.hibernate.SessionFactory;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistry;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.junit.jupiter.api.*;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.data.jpa.repository.Query;
import java.time.*;
import java.util.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Validate the actual repository HQL against all mapped entities without connecting to a database. */
class CalendarQueryMappingTest {
    private static StandardServiceRegistry registry;
    private static SessionFactory factory;
    private EntityManager parser;
    @BeforeAll static void mappings() throws Exception {
        registry = new StandardServiceRegistryBuilder()
                .applySetting("hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect")
                .applySetting("hibernate.boot.allow_jdbc_metadata_access", false)
                .applySetting("hibernate.hbm2ddl.auto", "none").build();
        MetadataSources metadata = new MetadataSources(registry);
        var scan = new ClassPathScanningCandidateComponentProvider(false);
        scan.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
        for (var bean : scan.findCandidateComponents("com.eqms.entity")) metadata.addAnnotatedClass(Class.forName(bean.getBeanClassName()));
        factory = metadata.buildMetadata().buildSessionFactory();
    }
    @BeforeEach void parser() { parser = factory.createEntityManager(); }
    @AfterEach void closeParser() { parser.close(); }
    @AfterAll static void closeMappings() {
        if (factory != null) factory.close();
        if (registry != null) StandardServiceRegistryBuilder.destroy(registry);
    }
    @Test @SuppressWarnings({"rawtypes", "unchecked"}) void sourceQueriesUseRealMappedFields() {
        EntityManager manager = mock(EntityManager.class);
        when(manager.createQuery(anyString(), any(Class.class))).thenAnswer(call -> {
            // Hibernate parses the exact HQL supplied by the repository. No query is executed.
            parser.createQuery(call.getArgument(0, String.class), call.getArgument(1, Class.class));
            TypedQuery result = mock(TypedQuery.class);
            when(result.setParameter(anyString(), any())).thenReturn(result);
            when(result.getResultList()).thenReturn(List.of());
            return result;
        });
        var repository = new CalendarSourceRepository(manager);
        repository.documents(LocalDate.of(2026,10,1), LocalDate.of(2026,11,1));
        repository.revisions(LocalDate.of(2026,10,1), LocalDate.of(2026,11,1));
        repository.notifications(UUID.randomUUID(), Instant.now(), Instant.now().plusSeconds(3600));
        verify(manager, times(3)).createQuery(anyString(), any(Class.class));
    }
    @Test void personalRangeQueryUsesMappedOwnerAndDates() throws Exception {
        var method = CalendarEventRepository.class.getMethod("findInRange", UUID.class, LocalDateTime.class, LocalDateTime.class);
        parser.createQuery(method.getAnnotation(Query.class).value());
    }
}
