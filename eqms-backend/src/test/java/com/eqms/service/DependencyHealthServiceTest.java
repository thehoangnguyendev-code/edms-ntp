package com.eqms.service;

import com.eqms.dto.system.DependencyStatus;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BooleanSupplier;

import static org.assertj.core.api.Assertions.assertThat;

/** The "service not available" warning: which services are asked, what is reported when one is down, slow or broken, and that the question is not asked again at every screen. */
class DependencyHealthServiceTest {
    /** A clock the test moves by hand. */
    private static final class Moving extends Clock {
        Instant now = Instant.parse("2026-11-18T08:00:00Z");
        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    private static DependencyHealthService.Probe probe(String code, BooleanSupplier answer) {
        return new DependencyHealthService.Probe(code, code + " name", code + " impact", () -> Optional.of(answer));
    }

    private static DependencyStatus of(List<DependencyStatus> all, String code) {
        return all.stream().filter(s -> s.code().equals(code)).findFirst().orElseThrow();
    }

    @Test
    void aServiceThatAnswersIsUpAndOneThatDoesNotIsDownWithWhatStopsWorking() {
        DependencyHealthService service = new DependencyHealthService(List.of(probe("A", () -> true), probe("B", () -> false)), new Moving(), 15000, 500);

        List<DependencyStatus> all = service.check();

        assertThat(of(all, "A").status()).isEqualTo("UP");
        assertThat(of(all, "B").status()).isEqualTo("DOWN");
        assertThat(of(all, "B").impact()).isEqualTo("B impact");
        assertThat(of(all, "B").name()).isEqualTo("B name");
    }

    @Test
    void aServiceSwitchedOffInThisInstallationIsNotListed() {
        DependencyHealthService.Probe off = new DependencyHealthService.Probe("OFF", "Off", "nothing", Optional::empty);
        DependencyHealthService service = new DependencyHealthService(List.of(off, probe("ON", () -> true)), new Moving(), 15000, 500);

        assertThat(service.check()).extracting(DependencyStatus::code).containsExactly("ON");
    }

    @Test
    void aQuestionThatThrowsIsADownServiceNotAnError() {
        DependencyHealthService service = new DependencyHealthService(List.of(probe("BROKEN", () -> { throw new IllegalStateException("boom"); })), new Moving(), 15000, 500);

        assertThat(of(service.check(), "BROKEN").status()).isEqualTo("DOWN");
    }

    @Test
    void aServiceThatDoesNotAnswerInTimeIsDownAndDoesNotHoldTheOthers() {
        BooleanSupplier hangs = () -> {
            try {
                Thread.sleep(5000);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
            }
            return true;
        };
        DependencyHealthService service = new DependencyHealthService(List.of(probe("SLOW", hangs), probe("FAST", () -> true)), new Moving(), 15000, 200);
        long started = System.nanoTime();

        List<DependencyStatus> all = service.check();

        assertThat((System.nanoTime() - started) / 1_000_000).isLessThan(3000);
        assertThat(of(all, "SLOW").status()).isEqualTo("DOWN");
        assertThat(of(all, "FAST").status()).isEqualTo("UP");
    }

    @Test
    void theAnswerIsKeptForAWhileSoManyScreensCostOneRoundOfQuestionsAndThenAsksAgain() {
        AtomicInteger asked = new AtomicInteger();
        Moving clock = new Moving();
        DependencyHealthService service = new DependencyHealthService(List.of(probe("A", () -> { asked.incrementAndGet(); return true; })), clock, 15000, 500);

        service.check();
        service.check();
        clock.now = clock.now.plusSeconds(10);
        service.check();
        assertThat(asked.get()).isEqualTo(1);

        clock.now = clock.now.plusSeconds(6); // 16 s since the first question
        service.check();
        assertThat(asked.get()).isEqualTo(2);
    }

    @Test
    void aServiceThatCameBackIsReportedUpAtTheNextRound() {
        AtomicInteger calls = new AtomicInteger();
        Moving clock = new Moving();
        DependencyHealthService service = new DependencyHealthService(List.of(probe("A", () -> calls.incrementAndGet() > 1)), clock, 1000, 500);

        assertThat(of(service.check(), "A").status()).isEqualTo("DOWN");
        clock.now = clock.now.plusSeconds(2);
        assertThat(of(service.check(), "A").status()).isEqualTo("UP");
    }
}
