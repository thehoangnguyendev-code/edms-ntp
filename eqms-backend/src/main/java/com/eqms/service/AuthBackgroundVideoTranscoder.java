package com.eqms.service;

import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

/** Converts administrator-supplied login backgrounds without exposing media tools to a shell. */
@Component
public class AuthBackgroundVideoTranscoder {
    private static final long MAX_INPUT_BYTES = 30L * 1024 * 1024;
    private static final long MAX_OUTPUT_BYTES = 8L * 1024 * 1024;

    public byte[] transcode(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty() || file.getSize() > MAX_INPUT_BYTES) {
            throw new IllegalArgumentException("Video must be between 1 byte and 30 MB");
        }
        Path dir = Files.createTempDirectory("eqms-auth-video-");
        Path input = dir.resolve("input"), output = dir.resolve("output.mp4"), probe = dir.resolve("probe.txt");
        try {
            try (var stream = file.getInputStream()) { Files.copy(stream, input); }
            byte[] header = new byte[12];
            try (var stream = Files.newInputStream(input)) {
                if (stream.readNBytes(header, 0, header.length) != header.length) throw new IllegalArgumentException("Unsupported or invalid video file");
            }
            String format = detectFormat(header);
            // Disable MOV external data references; no untrusted file chooses a protocol or demuxer.
            String[] inputOptions = "mov".equals(format) ? new String[]{"-f", format, "-enable_drefs", "0"} : new String[]{"-f", format};
            var probeCommand = new java.util.ArrayList<>(java.util.List.of("ffprobe", "-v", "error", "-protocol_whitelist", "file,pipe"));
            probeCommand.addAll(java.util.List.of(inputOptions));
            probeCommand.addAll(java.util.List.of("-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", input.toString()));
            run(probe, 20, probeCommand.toArray(String[]::new));
            double duration;
            try { duration = Double.parseDouble(Files.readString(probe).trim()); }
            catch (NumberFormatException ex) { throw new IllegalArgumentException("Cannot determine video duration", ex); }
            if (!Double.isFinite(duration) || duration <= 0 || duration > 15.0) throw new IllegalArgumentException("Video duration must not exceed 15 seconds");
            var encodeCommand = new java.util.ArrayList<>(java.util.List.of("ffmpeg", "-nostdin", "-v", "error", "-protocol_whitelist", "file,pipe"));
            encodeCommand.addAll(java.util.List.of(inputOptions));
            encodeCommand.addAll(java.util.List.of("-i", input.toString(), "-map", "0:v:0", "-an", "-sn", "-dn", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-threads", "2", "-y", output.toString()));
            run(dir.resolve("encode.log"), 120, encodeCommand.toArray(String[]::new));
            if (!Files.isRegularFile(output) || Files.size(output) == 0 || Files.size(output) > MAX_OUTPUT_BYTES) throw new IllegalArgumentException("Optimized video exceeds 8 MB; choose a shorter or smaller source");
            return Files.readAllBytes(output);
        } finally {
            try (var files = Files.list(dir)) { for (Path path : files.toList()) Files.deleteIfExists(path); }
            Files.deleteIfExists(dir);
        }
    }

    static String detectFormat(byte[] header) {
        if (header == null || header.length < 12) throw new IllegalArgumentException("Unsupported or invalid video file");
        if (header[4] == 'f' && header[5] == 't' && header[6] == 'y' && header[7] == 'p') return "mov";
        if ((header[0] & 255) == 0x1a && (header[1] & 255) == 0x45 && (header[2] & 255) == 0xdf && (header[3] & 255) == 0xa3) return "matroska";
        if (header[0] == 'R' && header[1] == 'I' && header[2] == 'F' && header[3] == 'F' && header[8] == 'A' && header[9] == 'V' && header[10] == 'I' && header[11] == ' ') return "avi";
        if (header[0] == 'F' && header[1] == 'L' && header[2] == 'V' && header[3] == 1) return "flv";
        if (header[0] == 'O' && header[1] == 'g' && header[2] == 'g' && header[3] == 'S') return "ogg";
        if (header[0] == 0x30 && header[1] == 0x26 && (header[2] & 255) == 0xb2 && header[3] == 0x75) return "asf";
        if (header[0] == 0 && header[1] == 0 && header[2] == 1 && (header[3] & 255) == 0xba) return "mpeg";
        if (header[0] == 0x47 || (header[0] == 0 && header[1] == 0 && header[2] == 0 && header[3] == 0 && header[4] == 0x47)) return "mpegts";
        throw new IllegalArgumentException("Video must be MP4, MOV, M4V, 3GP, WebM, MKV, AVI, WMV, FLV, MPG, TS or OGV");
    }

    private static void run(Path log, long seconds, String... command) throws IOException {
        Process process = new ProcessBuilder(command).redirectErrorStream(true).redirectOutput(log.toFile()).start();
        try {
            if (!process.waitFor(seconds, TimeUnit.SECONDS)) { process.destroyForcibly(); throw new IOException("Video processing timed out"); }
            if (process.exitValue() != 0) throw new IllegalArgumentException("Unsupported or invalid video file");
        } catch (InterruptedException ex) {
            process.destroyForcibly();
            Thread.currentThread().interrupt();
            throw new IOException("Video processing interrupted", ex);
        }
    }
}
