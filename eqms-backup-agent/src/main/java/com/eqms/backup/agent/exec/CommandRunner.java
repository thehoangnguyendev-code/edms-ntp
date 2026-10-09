package com.eqms.backup.agent.exec;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

/** Runs external tools (pg_dump, gpg). An interface so the logic around them can be tested without the tools. */
public interface CommandRunner {

    record Command(List<String> argv, Map<String, String> env) {
    }

    record Result(int exitCode, String stdout, String stderrTail) {
        public boolean ok() {
            return exitCode == 0;
        }
    }

    /** Result of {@code a | b | c > file}: the bytes of the last command's output are written to {@code out} and hashed as they pass. */
    record PipelineResult(List<Integer> exitCodes, String sha256, long bytes, String stderrTail) {
        public boolean ok() {
            return exitCodes.stream().allMatch(code -> code == 0);
        }
    }

    /** Result of feeding a stream through one command (encryption) into a file; both sides are hashed as the bytes pass. */
    record StreamResult(int exitCode, String plainSha256, long plainBytes, String cipherSha256, long cipherBytes, String stderrTail) {
        public boolean ok() {
            return exitCode == 0;
        }
    }

    Result run(Command command, long timeoutSeconds) throws IOException, InterruptedException;

    PipelineResult pipelineToFile(List<Command> commands, Path out, long timeoutSeconds) throws IOException, InterruptedException;

    /** Feeds {@code input} to the command and writes its output to {@code out} (which must not exist). */
    StreamResult encryptStream(InputStream input, Command command, Path out, long timeoutSeconds) throws IOException, InterruptedException;
}
