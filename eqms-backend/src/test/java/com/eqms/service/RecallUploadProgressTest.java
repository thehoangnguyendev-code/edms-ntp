package com.eqms.service;

import java.util.UUID;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** The progress of a Recall by Scan upload: what the server reports is what the screen can read, for that user only, and it never goes backwards. */
class RecallUploadProgressTest {

    private final RecallUploadProgress progress = new RecallUploadProgress();
    private final UUID dco = UUID.randomUUID();

    @Test
    void theStepsReportedAreTheOnesReadBackAndNeverGoBack() {
        var reporter = progress.reporter(dco, "upload-0001-abcd");

        reporter.report("VIRUS_SCAN", "Scanning for viruses...", 15);
        reporter.report("STORING", "Storing the file...", 55);
        reporter.report("CHECKING", "Late report", 5);

        assertThat(progress.snapshot(dco, "upload-0001-abcd")).isEqualTo(new RecallUploadProgress.Snapshot("STORING", "Storing the file...", 55));
    }

    @Test
    void anotherUserCannotReadItAndAnUnknownOrBadIdReadsNothing() {
        progress.reporter(dco, "upload-0002-abcd").report("READING_CODE", "Reading the QR code...", 70);

        assertThat(progress.snapshot(UUID.randomUUID(), "upload-0002-abcd")).isNull();
        assertThat(progress.snapshot(dco, "upload-9999-zzzz")).isNull();
        assertThat(progress.snapshot(dco, "../etc/passwd")).isNull();
    }

    @Test
    void withoutAnIdNothingIsKeptAndReportingIsHarmless() {
        progress.reporter(dco, null).report("STORING", "x", 50);
        progress.reporter(dco, "bad id!").report("STORING", "x", 50);

        assertThat(progress.snapshot(dco, null)).isNull();
    }
}
