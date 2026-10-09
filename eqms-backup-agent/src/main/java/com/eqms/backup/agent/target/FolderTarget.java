package com.eqms.backup.agent.target;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.stream.Stream;

/** A folder on a disk, a mounted share or a USB drive. */
public class FolderTarget implements BackupTarget {

    private final String code;
    private final Path root;
    private final boolean immutable;

    public FolderTarget(String code, Path root, boolean immutable) {
        this.code = code;
        this.root = root.toAbsolutePath().normalize();
        this.immutable = immutable;
    }

    @Override public String code() { return code; }
    @Override public String kind() { return "FOLDER"; }
    @Override public boolean immutable() { return immutable; }
    @Override public String describe(String key) { return resolve(key).toString(); }

    private Path resolve(String key) {
        Path path = root.resolve(key).normalize();
        if (!path.startsWith(root)) throw new IllegalArgumentException("The key leaves the target: " + key);
        return path;
    }

    @Override
    public void put(String key, Path file) throws IOException {
        Path destination = resolve(key);
        Files.createDirectories(destination.getParent());
        Path partial = destination.resolveSibling(destination.getFileName() + ".partial");
        Files.copy(file, partial, StandardCopyOption.REPLACE_EXISTING);
        Files.move(partial, destination, StandardCopyOption.REPLACE_EXISTING);
    }

    @Override
    public void get(String key, Path destination) throws IOException {
        Files.copy(resolve(key), destination, StandardCopyOption.REPLACE_EXISTING);
    }

    @Override
    public boolean exists(String key) {
        return Files.isRegularFile(resolve(key));
    }

    @Override
    public boolean tryDelete(String key) throws IOException {
        try {
            return Files.deleteIfExists(resolve(key));
        } catch (java.nio.file.AccessDeniedException e) {
            return false;
        }
    }

    @Override
    public List<String> list(String prefix) throws IOException {
        Path base = resolve(prefix);
        if (!Files.isDirectory(base)) return List.of();
        try (Stream<Path> walk = Files.walk(base)) {
            return walk.filter(Files::isRegularFile).map(p -> root.relativize(p).toString().replace('\\', '/')).sorted().toList();
        }
    }
}
