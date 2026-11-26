package com.eqms.service;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;

class NavigationTaskCountCacheTest {
    private final AtomicLong now = new AtomicLong();
    private final NavigationTaskCountCache cache = new NavigationTaskCountCache(now::get);
    private final AtomicInteger counted = new AtomicInteger();
    private final UUID person = UUID.randomUUID();

    private int read(UUID user) {
        return cache.get(user, counted::incrementAndGet);
    }

    @Test
    void keeps_the_counts_of_a_person_for_a_few_seconds_only() {
        assertThat(read(person)).isEqualTo(1);
        now.addAndGet(NavigationTaskCountCache.KEEP.toNanos() - 1);
        assertThat(read(person)).isEqualTo(1);
        now.addAndGet(1);
        assertThat(read(person)).isEqualTo(2);
    }

    @Test
    void never_gives_one_person_the_counts_of_another() {
        assertThat(read(person)).isEqualTo(1);
        assertThat(read(UUID.randomUUID())).isEqualTo(2);
    }

    @Test
    void a_request_that_can_change_something_throws_the_counts_away_and_a_read_does_not() throws Exception {
        read(person);
        cache.doFilter(new MockHttpServletRequest("GET", "/api/training/activities"), new MockHttpServletResponse(), new MockFilterChain());
        assertThat(read(person)).isEqualTo(1);

        cache.doFilter(new MockHttpServletRequest("POST", "/api/training/activities/1/approve"), new MockHttpServletResponse(), new MockFilterChain());
        assertThat(read(person)).isEqualTo(2);
    }

    @Test
    void keeps_nothing_while_a_change_is_running_so_an_answer_that_arrives_early_cannot_be_stale() throws Exception {
        cache.doFilter(new MockHttpServletRequest("POST", "/api/documents"), new MockHttpServletResponse(), (request, response) -> {
            assertThat(read(person)).isEqualTo(1);
            assertThat(read(person)).isEqualTo(2);
        });
        assertThat(read(person)).isEqualTo(3);
        assertThat(read(person)).isEqualTo(3);
    }

    @Test
    void does_not_keep_counts_that_were_made_while_something_changed() {
        int first = cache.get(person, () -> {
            cache.clear();
            return counted.incrementAndGet();
        });
        assertThat(first).isEqualTo(1);
        assertThat(read(person)).isEqualTo(2);
    }
}
