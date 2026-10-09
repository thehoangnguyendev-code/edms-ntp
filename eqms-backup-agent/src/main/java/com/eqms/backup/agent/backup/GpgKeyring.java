package com.eqms.backup.agent.backup;

import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.exec.CommandRunner;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Map;

/**
 * The agent's OpenPGP keyring holds the <b>public</b> key only. It can encrypt a backup but cannot decrypt one, so a stolen
 * agent cannot read the backups (SDS section 8). Decryption needs the private key, which the key custodians hold.
 */
@Component
public class GpgKeyring {

    private static final Logger log = LoggerFactory.getLogger(GpgKeyring.class);

    private final AgentProperties properties;
    private final CommandRunner runner;
    private volatile String fingerprint;
    private volatile String longKeyId;
    private volatile java.util.List<String> encryptionKeyIds = java.util.List.of();

    public GpgKeyring(AgentProperties properties, CommandRunner runner) {
        this.properties = properties;
        this.runner = runner;
    }

    /** Imports the public key and returns its fingerprint. Fails if the key is missing: a backup must never be written unencrypted. */
    public synchronized String fingerprint() {
        if (fingerprint != null) {
            return fingerprint;
        }
        try {
            Path keyFile = properties.getCrypto().getPublicKeyFile();
            if (!Files.isReadable(keyFile)) {
                throw new IllegalStateException("The backup public key is not available");
            }
            Path home = Path.of(properties.getCrypto().getGpgHome());
            Files.createDirectories(home);
            try {
                Files.setPosixFilePermissions(home, PosixFilePermissions.fromString("rwx------"));
            } catch (UnsupportedOperationException ignored) {
                // not a POSIX file system (developer machine); the container sets the mode
            }
            CommandRunner.Result imported = runner.run(gpg("--batch", "--import", keyFile.toString()), 60);
            if (!imported.ok()) {
                throw new IllegalStateException("The backup public key could not be imported: " + imported.stderrTail());
            }
            CommandRunner.Result listed = runner.run(gpg("--batch", "--list-keys", "--with-colons", "--fingerprint"), 60);
            if (!listed.ok()) {
                throw new IllegalStateException("The backup keyring could not be read");
            }
            String fpr = null;
            java.util.List<String> encIds = new java.util.ArrayList<>();
            for (String line : listed.stdout().split("\\R")) {
                String[] f = line.split(":", -1);
                if (line.startsWith("fpr:") && fpr == null) {
                    fpr = f[9];
                } else if ((line.startsWith("pub:") || line.startsWith("sub:")) && f.length > 11 && f[11].contains("e")) {
                    // A message is addressed to the key that can encrypt, usually a subkey of the key named in the policy.
                    // Lower case 'e' means this very key can encrypt; upper case 'E' only says some subkey can.
                    encIds.add(f[4].toUpperCase());
                }
            }
            if (fpr == null) {
                throw new IllegalStateException("The backup keyring holds no key");
            }
            if (encIds.isEmpty()) {
                throw new IllegalStateException("The backup key cannot encrypt");
            }
            this.encryptionKeyIds = java.util.List.copyOf(encIds);
            this.fingerprint = fpr;
            this.longKeyId = fpr.substring(fpr.length() - 16);
            log.info("Backup encryption key loaded: {}", longKeyId);
            return fpr;
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new IllegalStateException("The backup keyring could not be prepared", e);
        }
    }

    /** Ids of the keys a message can be addressed to; the packet of an encrypted file must name one of them. */
    public java.util.List<String> encryptionKeyIds() {
        fingerprint();
        return encryptionKeyIds;
    }

    public String keyId() {
        fingerprint();
        return longKeyId;
    }

    public CommandRunner.Command encryptCommand() {
        return gpg("--batch", "--yes", "--trust-model", "always", "--encrypt", "--recipient", fingerprint(), "--cipher-algo", "AES256", "-z", "0", "--output", "-");
    }

    public CommandRunner.Command listPacketsCommand(Path file) {
        return gpg("--batch", "--list-packets", file.toString());
    }

    private CommandRunner.Command gpg(String... args) {
        java.util.List<String> argv = new java.util.ArrayList<>();
        argv.add(properties.getTools().getGpg());
        argv.add("--homedir");
        argv.add(properties.getCrypto().getGpgHome());
        argv.addAll(java.util.List.of(args));
        return new CommandRunner.Command(argv, Map.of());
    }
}
