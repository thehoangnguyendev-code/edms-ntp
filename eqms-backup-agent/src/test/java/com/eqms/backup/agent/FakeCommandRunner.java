package com.eqms.backup.agent;

import com.eqms.backup.agent.exec.CommandRunner;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;

/**
 * Stands in for pg_dump and gpg so the logic around them can be tested anywhere. It writes recognisable bytes, hashes them like
 * the real runner does, and can be told to fail. The real tools are exercised by the end-to-end run against the stack.
 */
final class FakeCommandRunner implements CommandRunner {

    static final String SUBKEY_ID = "5F0007F5CAC7143E";
    static final String SUBKEY_FPR = "5F0007F5CAC7143EFCE0D12B9E084A71AF15D574";
    static final String KEY_ID = "ABCDEF0123456789";
    static final String FINGERPRINT = "0123456789ABCDEF0123456789ABCDEF" + KEY_ID.substring(0, 8) + "ABCDEF01"; // 40 hex chars

    boolean dumpFails;
    boolean packetsLookEncrypted = true;
    boolean keyMissing;
    /** Recent gpg versions write an AEAD packet instead of the classic "encrypted data" packet. */
    boolean aead;
    int pipelines;

    @Override
    public Result run(Command command, long timeoutSeconds) {
        String joined = String.join(" ", command.argv());
        if (joined.contains("--import")) {
            return keyMissing ? new Result(2, "", "no valid OpenPGP data found") : new Result(0, "", "");
        }
        if (joined.contains("--list-keys")) {
            // like real gpg output: a signing primary key, then an encryption subkey that messages are actually addressed to
            return keyMissing ? new Result(0, "", "") : new Result(0,
                    "pub:-:255:22:" + FINGERPRINT.substring(FINGERPRINT.length() - 16) + ":1791447191:::-:::scESC:::::ed25519:::0:\n"
                            + "fpr:::::::::" + FINGERPRINT + ":\n"
                            + "sub:-:255:18:" + SUBKEY_ID + ":1791447191::::::e:::::cv25519::\n"
                            + "fpr:::::::::" + SUBKEY_FPR + ":\n", "");
        }
        if (joined.contains("--list-packets")) {
            String out = packetsLookEncrypted
                    ? ":pubkey enc packet: version 3, algo 18, keyid " + SUBKEY_ID + "\n"
                    + (aead ? ":aead encrypted packet: cipher=9 aead=2 cb=16\n" : ":encrypted data packet:\n")
                    : ":literal data packet:\n";
            return new Result(0, out, "");
        }
        return new Result(0, "", "");
    }

    @Override
    public HashResult hashOutput(Command command, long timeoutSeconds) {
        return new HashResult(0, "", 0, "");
    }

    boolean encryptFails;
    int streams;

    /** Fake "encryption": a recognisable prefix followed by the plain bytes, so a test can see what was stored. */
    @Override
    public StreamResult encryptStream(java.io.InputStream input, Command command, Path out, long timeoutSeconds) throws IOException {
        streams++;
        byte[] plain = input.readAllBytes();
        if (encryptFails) return new StreamResult(2, "", 0, "", 0, "gpg: encryption failed");
        byte[] cipher = ("FAKE-ENC|".getBytes(StandardCharsets.UTF_8));
        byte[] all = new byte[cipher.length + plain.length];
        System.arraycopy(cipher, 0, all, 0, cipher.length);
        System.arraycopy(plain, 0, all, cipher.length, plain.length);
        Files.write(out, all, StandardOpenOption.CREATE_NEW);
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            String plainSha = HexFormat.of().formatHex(md.digest(plain));
            return new StreamResult(0, plainSha, plain.length, HexFormat.of().formatHex(md.digest(all)), all.length, "");
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    @Override
    public PipelineResult pipelineToFile(List<Command> commands, Path out, long timeoutSeconds) throws IOException {
        pipelines++;
        if (dumpFails) {
            return new PipelineResult(List.of(1, 0), "", 0, "pg_dump: error: connection refused");
        }
        String snapshot = commands.get(0).argv().stream().filter(a -> a.startsWith("--snapshot=")).findFirst().orElse("--snapshot=none");
        byte[] bytes = ("FAKE-ENCRYPTED-DUMP|" + snapshot + "|" + "x".repeat(2000)).getBytes(StandardCharsets.UTF_8);
        Files.write(out, bytes, StandardOpenOption.CREATE_NEW);
        try {
            return new PipelineResult(List.of(0, 0), HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)), bytes.length, "");
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
