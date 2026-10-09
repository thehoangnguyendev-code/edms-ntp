package com.eqms.service;

import com.eqms.entity.SystemAnnouncement;
import com.eqms.repository.SystemAnnouncementRepository;
import com.eqms.repository.SystemAnnouncementSpecifications;
import com.eqms.repository.SystemAnnouncementSpecifications.Criteria;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.TestPropertySource;

import java.net.InetSocketAddress;
import java.net.Socket;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Runs the announcement list query and every whitelisted sort expression against the real PostgreSQL of the dev stack (they are
 * appended to the query text at run time, so a mock cannot prove them). Skipped when the database is not reachable. Flyway is off
 * so the schema is never touched, and the transaction rolls back, so no row is left behind. Test rows carry the title prefix
 * "ZZTEST" and every query searches for it, so real announcements never interfere.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = {
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=none",
        // explicit, so the test does not depend on what another test class left in the shared JVM
        "spring.datasource.url=${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5432/eqms-database}",
        "spring.datasource.username=${SPRING_DATASOURCE_USERNAME:eqms}",
        "spring.datasource.password=${SPRING_DATASOURCE_PASSWORD:eqms}",
        "spring.datasource.driver-class-name=org.postgresql.Driver"
})
class SystemAnnouncementRepositoryDbTest {

    private static final Instant WIDEST_FROM = Instant.parse("1970-01-01T00:00:00Z");
    private static final Instant WIDEST_TO = Instant.parse("2999-12-31T23:59:59Z");

    @Autowired
    private SystemAnnouncementRepository repository;
    private final Instant now = Instant.now();

    @BeforeEach
    void seed() {
        boolean reachable;
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress("localhost", 5432), 1000);
            reachable = true;
        } catch (Exception ex) {
            reachable = false;
        }
        assumeTrue(reachable, "PostgreSQL is not reachable on localhost:5432; start the dev stack to run this check");
        //              title                     severity    start (h from now)  end (h from now)  enabled  created by
        save("ZZTEST Alpha maintenance", "CRITICAL", -2, 2, true, "Zed Admin");     // ACTIVE
        save("ZZTEST beta release", "INFO", 24, 48, true, "Amy Admin");             // SCHEDULED
        save("ZZTEST Gamma notice", "WARNING", -48, -24, true, "Bob Admin");        // EXPIRED
        save("ZZTEST delta parked", "WARNING", -1, 5, false, "Amy Admin");          // DISABLED
        save("ZZTEST 100% done_ok", "INFO", -3, 3, true, "Cy Admin");               // ACTIVE
    }

    private void save(String title, String severity, long startHours, long endHours, boolean enabled, String createdBy) {
        SystemAnnouncement a = new SystemAnnouncement();
        a.setTitle(title);
        a.setMessage("Message of " + title);
        a.setSeverity(severity);
        a.setStartsAt(now.plus(Duration.ofHours(startHours)));
        a.setEndsAt(now.plus(Duration.ofHours(endHours)));
        a.setEnabled(enabled);
        a.setCreatedBy(createdBy);
        a.setUpdatedBy(createdBy);
        repository.saveAndFlush(a);
    }

    private org.springframework.data.domain.Page<SystemAnnouncement> page(String term, String state, String severity, Instant startsFrom, Instant startsTo,
                                                                          String sortBy, String direction, int pageNumber, int size) {
        return repository.findAll(SystemAnnouncementSpecifications.search(new Criteria(SystemAnnouncementService.likePattern(term), state, severity,
                startsFrom, startsTo, WIDEST_FROM, WIDEST_TO, now, sortBy, !"desc".equals(direction))), PageRequest.of(pageNumber, size));
    }

    private List<String> titles(String term, String state, String severity, Instant startsFrom, Instant startsTo, String sortBy, String direction) {
        return page(term, state, severity, startsFrom, startsTo, sortBy, direction, 0, 50)
                .getContent().stream().map(a -> a.getTitle().replace("ZZTEST ", "")).toList();
    }

    private List<String> sorted(String sortBy, String direction) {
        return titles("zztest", "ALL", "ALL", WIDEST_FROM, WIDEST_TO, sortBy, direction);
    }

    // ---- every sort expression runs on PostgreSQL and orders as intended ---------------------------------------------

    @Test
    void sortsByTitleIgnoringCase() {
        assertEquals(List.of("100% done_ok", "Alpha maintenance", "beta release", "delta parked", "Gamma notice"), sorted("title", "asc"));
        assertEquals(List.of("Gamma notice", "delta parked", "beta release", "Alpha maintenance", "100% done_ok"), sorted("title", "desc"));
    }

    @Test
    void sortsBySeverityMostSevereFirstWhenAscending() {
        List<String> asc = sorted("severity", "asc");
        assertEquals("Alpha maintenance", asc.get(0)); // CRITICAL
        assertEquals(Set.of("Gamma notice", "delta parked"), Set.copyOf(asc.subList(1, 3))); // WARNING (ties are broken by id)
        assertEquals(Set.of("100% done_ok", "beta release"), Set.copyOf(asc.subList(3, 5))); // INFO
        assertEquals("Alpha maintenance", sorted("severity", "desc").get(4));
    }

    @Test
    void sortsByStateActiveScheduledDisabledExpired() {
        List<String> asc = sorted("state", "asc");
        assertEquals(Set.of("Alpha maintenance", "100% done_ok"), Set.copyOf(asc.subList(0, 2))); // ACTIVE
        assertEquals("beta release", asc.get(2));   // SCHEDULED
        assertEquals("delta parked", asc.get(3));   // DISABLED
        assertEquals("Gamma notice", asc.get(4));   // EXPIRED
        assertEquals("Gamma notice", sorted("state", "desc").get(0));
    }

    @Test
    void sortsByTimes() {
        assertEquals("Gamma notice", sorted("startsAt", "asc").get(0));
        assertEquals("beta release", sorted("startsAt", "desc").get(0));
        assertEquals("Gamma notice", sorted("endsAt", "asc").get(0));
        assertEquals("beta release", sorted("endsAt", "desc").get(0));
    }

    @Test
    void sortsByWhoCreatedAndWhoUpdated() {
        assertEquals("Alpha maintenance", sorted("createdBy", "desc").get(0)); // Zed
        assertEquals(Set.of("beta release", "delta parked"), Set.copyOf(sorted("createdBy", "asc").subList(0, 2))); // Amy x2
        assertEquals("Alpha maintenance", sorted("updatedBy", "desc").get(0));
        assertEquals(5, sorted("updatedAt", "asc").size()); // coalesce(updatedAt, createdAt) runs
        assertEquals(5, sorted("updatedAt", "desc").size());
    }

    @Test
    void anUnknownSortKeyStillRuns() {
        assertEquals(5, sorted("title) desc, (select 1", "asc").size()); // falls back to the start time; nothing is executed
    }

    // ---- search ---------------------------------------------------------------------------------------------------

    @Test
    void searchesTitleMessageAndWhoCreatedIt() {
        assertEquals(List.of("beta release"), titles("zztest beta", "ALL", "ALL", WIDEST_FROM, WIDEST_TO, "title", "asc"));
        assertEquals(List.of("Gamma notice"), titles("message of zztest gamma", "ALL", "ALL", WIDEST_FROM, WIDEST_TO, "title", "asc"));
        assertEquals(List.of("Alpha maintenance"), titles("zed admin", "ALL", "ALL", WIDEST_FROM, WIDEST_TO, "title", "asc"));
        assertEquals(0, titles("zztest nothing-like-this", "ALL", "ALL", WIDEST_FROM, WIDEST_TO, "title", "asc").size());
    }

    @Test
    void aPercentOrUnderscoreInTheSearchIsLiteral() {
        assertEquals(List.of("100% done_ok"), titles("100%", "ALL", "ALL", WIDEST_FROM, WIDEST_TO, "title", "asc"));
        assertEquals(List.of("100% done_ok"), titles("done_ok", "ALL", "ALL", WIDEST_FROM, WIDEST_TO, "title", "asc"));
        assertEquals(0, titles("done_ox", "ALL", "ALL", WIDEST_FROM, WIDEST_TO, "title", "asc").size(), "an underscore is not 'any character'");
        assertEquals(0, titles("zztest %notice", "ALL", "ALL", WIDEST_FROM, WIDEST_TO, "title", "asc").size(), "a percent is not 'anything'");
    }

    // ---- filters --------------------------------------------------------------------------------------------------

    @Test
    void filtersByState() {
        assertEquals(List.of("100% done_ok", "Alpha maintenance"), titles("zztest", "ACTIVE", "ALL", WIDEST_FROM, WIDEST_TO, "title", "asc"));
        assertEquals(List.of("beta release"), titles("zztest", "SCHEDULED", "ALL", WIDEST_FROM, WIDEST_TO, "title", "asc"));
        assertEquals(List.of("Gamma notice"), titles("zztest", "EXPIRED", "ALL", WIDEST_FROM, WIDEST_TO, "title", "asc"));
        assertEquals(List.of("delta parked"), titles("zztest", "DISABLED", "ALL", WIDEST_FROM, WIDEST_TO, "title", "asc"));
    }

    @Test
    void filtersBySeverity() {
        assertEquals(List.of("Alpha maintenance"), titles("zztest", "ALL", "CRITICAL", WIDEST_FROM, WIDEST_TO, "title", "asc"));
        assertEquals(List.of("delta parked", "Gamma notice"), titles("zztest", "ALL", "WARNING", WIDEST_FROM, WIDEST_TO, "title", "asc"));
        assertEquals(List.of("100% done_ok", "beta release"), titles("zztest", "ALL", "INFO", WIDEST_FROM, WIDEST_TO, "title", "asc"));
    }

    @Test
    void filtersByTheStartTimeRange() {
        // from 10 hours ago to 10 hours ahead: the ones that started within it (not the expired 48h-ago one, not the 24h-ahead one)
        Instant from = now.minus(Duration.ofHours(10));
        Instant to = now.plus(Duration.ofHours(10));
        assertEquals(List.of("100% done_ok", "Alpha maintenance", "delta parked"), titles("zztest", "ALL", "ALL", from, to, "title", "asc"));
    }

    @Test
    void combinesFiltersAndPagesOnTheServer() {
        assertEquals(List.of("delta parked"), titles("zztest", "DISABLED", "WARNING", WIDEST_FROM, WIDEST_TO, "title", "asc"));
        var page = page("zztest", "ALL", "ALL", WIDEST_FROM, WIDEST_TO, "title", "asc", 1, 2);
        assertEquals(5, page.getTotalElements());
        assertEquals(3, page.getTotalPages());
        assertEquals(2, page.getContent().size());
        assertEquals("ZZTEST beta release", page.getContent().get(0).getTitle());
    }
}
