package com.eqms.backup.agent.exec;

import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Component
public class ProcessCommandRunner implements CommandRunner {

    private static final int STDERR_TAIL_BYTES = 4_000;

    @Override
    public Result run(Command command, long timeoutSeconds) throws IOException, InterruptedException {
        ProcessBuilder builder = builder(command);
        Path err = Files.createTempFile("agent-cmd-", ".err");
        try {
            builder.redirectError(err.toFile());
            Process process = builder.start();
            process.getOutputStream().close();
            byte[] stdout = process.getInputStream().readAllBytes();
            if (!process.waitFor(timeoutSeconds, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                return new Result(-1, "", "timed out after " + timeoutSeconds + "s");
            }
            return new Result(process.exitValue(), new String(stdout, StandardCharsets.UTF_8), tail(err));
        } finally {
            Files.deleteIfExists(err);
        }
    }

    @Override
    public PipelineResult pipelineToFile(List<Command> commands, Path out, long timeoutSeconds) throws IOException, InterruptedException {
        List<ProcessBuilder> builders = new ArrayList<>();
        List<Path> errors = new ArrayList<>();
        for (Command command : commands) {
            ProcessBuilder b = builder(command);
            Path err = Files.createTempFile("agent-pipe-", ".err");
            errors.add(err);
            b.redirectError(err.toFile());
            builders.add(b);
        }
        MessageDigest digest = newDigest();
        long bytes = 0;
        try {
            List<Process> processes = ProcessBuilder.startPipeline(builders);
            Process last = processes.get(processes.size() - 1);
            try (InputStream in = last.getInputStream();
                 OutputStream file = Files.newOutputStream(out, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
                byte[] buffer = new byte[1 << 16];
                int read;
                while ((read = in.read(buffer)) >= 0) {
                    file.write(buffer, 0, read);
                    digest.update(buffer, 0, read);
                    bytes += read;
                }
            }
            List<Integer> codes = new ArrayList<>();
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(timeoutSeconds);
            for (Process p : processes) {
                long left = Math.max(1, TimeUnit.NANOSECONDS.toSeconds(deadline - System.nanoTime()));
                if (!p.waitFor(left, TimeUnit.SECONDS)) {
                    p.destroyForcibly();
                    codes.add(-1);
                } else {
                    codes.add(p.exitValue());
                }
            }
            StringBuilder tails = new StringBuilder();
            for (Path e : errors) {
                String t = tail(e);
                if (!t.isBlank()) tails.append(t).append('\n');
            }
            return new PipelineResult(codes, HexFormat.of().formatHex(digest.digest()), bytes, tails.toString().trim());
        } finally {
            for (Path e : errors) Files.deleteIfExists(e);
        }
    }

    @Override
    public StreamResult encryptStream(InputStream input, Command command, Path out, long timeoutSeconds) throws IOException, InterruptedException {
        ProcessBuilder b = builder(command);
        Path err = Files.createTempFile("agent-stream-", ".err");
        b.redirectError(err.toFile());
        MessageDigest plain = newDigest();
        MessageDigest cipher = newDigest();
        long[] plainBytes = {0};
        IOException[] feedError = {null};
        try {
            Process process = b.start();
            Thread feeder = new Thread(() -> {
                try (OutputStream stdin = process.getOutputStream()) {
                    byte[] buffer = new byte[1 << 16];
                    int read;
                    while ((read = input.read(buffer)) >= 0) {
                        plain.update(buffer, 0, read);
                        plainBytes[0] += read;
                        stdin.write(buffer, 0, read);
                    }
                } catch (IOException e) {
                    feedError[0] = e;
                    process.destroyForcibly();
                }
            }, "agent-stream-feeder");
            feeder.start();
            long cipherBytes = 0;
            try (InputStream in = process.getInputStream();
                 OutputStream file = Files.newOutputStream(out, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
                byte[] buffer = new byte[1 << 16];
                int read;
                while ((read = in.read(buffer)) >= 0) {
                    file.write(buffer, 0, read);
                    cipher.update(buffer, 0, read);
                    cipherBytes += read;
                }
            }
            feeder.join(TimeUnit.SECONDS.toMillis(timeoutSeconds));
            int code;
            if (!process.waitFor(timeoutSeconds, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                code = -1;
            } else {
                code = process.exitValue();
            }
            if (feedError[0] != null) throw feedError[0];
            return new StreamResult(code, HexFormat.of().formatHex(plain.digest()), plainBytes[0], HexFormat.of().formatHex(cipher.digest()), cipherBytes, tail(err));
        } finally {
            Files.deleteIfExists(err);
        }
    }

    @Override
    public HashResult hashOutput(Command command, long timeoutSeconds) throws IOException, InterruptedException {
        ProcessBuilder b = builder(command);
        Path err = Files.createTempFile("agent-hash-", ".err");
        b.redirectError(err.toFile());
        try {
            Process process = b.start();
            process.getOutputStream().close();
            MessageDigest digest = newDigest();
            long bytes = 0;
            try (InputStream in = process.getInputStream()) {
                byte[] buffer = new byte[1 << 16];
                int read;
                while ((read = in.read(buffer)) >= 0) {
                    digest.update(buffer, 0, read);
                    bytes += read;
                }
            }
            int code;
            if (!process.waitFor(timeoutSeconds, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                code = -1;
            } else {
                code = process.exitValue();
            }
            return new HashResult(code, HexFormat.of().formatHex(digest.digest()), bytes, tail(err));
        } finally {
            Files.deleteIfExists(err);
        }
    }

    private static ProcessBuilder builder(Command command) {
        ProcessBuilder b = new ProcessBuilder(command.argv());
        b.environment().putAll(command.env());
        return b;
    }

    private static String tail(Path file) throws IOException {
        byte[] all = Files.readAllBytes(file);
        int from = Math.max(0, all.length - STDERR_TAIL_BYTES);
        return new String(all, from, all.length - from, StandardCharsets.UTF_8).trim();
    }

    private static MessageDigest newDigest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
