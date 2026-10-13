package com.eqms.backup.agent.restore;

import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.exec.CommandRunner;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * The private OpenPGP key ring, available only to the restore worker. It is copied into a throw-away folder for each run (gpg
 * wants to write lock files) and the copy is removed afterwards. The source is never written to.
 */
@Component
public class RestoreKeyring {

    private final AgentProperties properties;
    private final CommandRunner runner;

    public RestoreKeyring(AgentProperties properties, CommandRunner runner) {
        this.properties = properties;
        this.runner = runner;
    }

    /** A key ring ready for one run; close it to delete the copy. */
    public final class Session implements AutoCloseable {
        private final Path home;

        private Session(Path home) {
            this.home = home;
        }

        public CommandRunner.Command decrypt(Path file) {
            return gpg(home, "--batch", "--decrypt", file.toString());
        }

        /** Key ids (long, upper case) of the secret keys and subkeys in the ring. */
        public List<String> secretKeyIds() throws IOException, InterruptedException {
            CommandRunner.Result listed = runner.run(gpg(home, "--batch", "--list-secret-keys", "--with-colons"), 60);
            List<String> ids = new ArrayList<>();
            for (String line : listed.stdout().split("\\R")) {
                String[] f = line.split(":", -1);
                if ((line.startsWith("sec:") || line.startsWith("ssb:")) && f.length > 4) ids.add(f[4].toUpperCase());
            }
            return ids;
        }

        @Override
        public void close() {
            deleteTree(home);
        }
    }

    public boolean configured() {
        return properties.getRestore().isEnabled() && Files.isDirectory(properties.getRestore().getGnupgHome());
    }

    public Session open() throws IOException {
        Path source = properties.getRestore().getGnupgHome();
        if (!properties.getRestore().isEnabled() || !Files.isDirectory(source)) {
            throw new IOException("The restore key ring is not available on this process");
        }
        Path home = Files.createTempDirectory("restore-gnupg-");
        try {
            Files.setPosixFilePermissions(home, PosixFilePermissions.fromString("rwx------"));
        } catch (UnsupportedOperationException ignored) {
            // not a POSIX file system (developer machine)
        }
        Files.walkFileTree(source, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
                Files.createDirectories(home.resolve(source.relativize(dir).toString()));
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                String name = file.getFileName().toString();
                // sockets and lock files belong to a running gpg-agent of the source; they are not copied
                if (name.startsWith("S.") || name.endsWith(".lock") || name.equals("gpg.conf~")) return FileVisitResult.CONTINUE;
                Files.copy(file, home.resolve(source.relativize(file).toString()), StandardCopyOption.REPLACE_EXISTING);
                return FileVisitResult.CONTINUE;
            }
        });
        return new Session(home);
    }

    private CommandRunner.Command gpg(Path home, String... args) {
        List<String> argv = new ArrayList<>();
        argv.add(properties.getTools().getGpg());
        argv.add("--homedir");
        argv.add(home.toString());
        argv.addAll(List.of(args));
        return new CommandRunner.Command(argv, Map.of());
    }

    private static void deleteTree(Path root) {
        try {
            Files.walkFileTree(root, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    Files.deleteIfExists(file);
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
                    Files.deleteIfExists(dir);
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException ignored) {
            // a leftover temporary folder holds a copy of the key ring; the container's tmpfs is wiped on restart
        }
    }
}
