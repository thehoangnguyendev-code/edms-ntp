package com.eqms.backup.agent;

import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.target.BackupTarget;
import com.eqms.backup.agent.target.FolderTarget;
import com.eqms.backup.agent.target.TargetRegistry;
import com.eqms.backup.agent.target.TargetTester;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TargetsTest {

    @TempDir
    Path dir;

    private AgentProperties.Extra folder(String code, Path path) {
        AgentProperties.Extra extra = new AgentProperties.Extra();
        extra.setCode(code);
        extra.setKind("FOLDER");
        extra.setPath(path);
        return extra;
    }

    private AgentProperties props(AgentProperties.Extra... extras) {
        AgentProperties properties = new AgentProperties();
        properties.getTargets().setT1(dir.resolve("t1"));
        for (AgentProperties.Extra e : extras) properties.getTargets().getExtra().put(e.getCode(), e);
        return properties;
    }

    @Test
    void folderTargetWritesReadsAndListsByRelativeKey() throws IOException {
        FolderTarget target = new FolderTarget("T2", dir.resolve("t2"), false);
        Path source = Files.writeString(dir.resolve("a.txt"), "hello");
        target.put("DEV/2026/10/BK-1/a.txt", source);
        assertThat(target.exists("DEV/2026/10/BK-1/a.txt")).isTrue();
        assertThat(target.list("DEV/2026")).containsExactly("DEV/2026/10/BK-1/a.txt");
        Path back = dir.resolve("back.txt");
        target.get("DEV/2026/10/BK-1/a.txt", back);
        assertThat(Files.readString(back)).isEqualTo("hello");
        assertThat(target.tryDelete("DEV/2026/10/BK-1/a.txt")).isTrue();
    }

    @Test
    void folderTargetRefusesKeysThatLeaveItsRoot() throws IOException {
        FolderTarget target = new FolderTarget("T2", dir.resolve("t2"), false);
        Path source = Files.writeString(dir.resolve("a.txt"), "x");
        assertThatThrownBy(() -> target.put("../escape.txt", source)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void targetTestPassesForAWritableFolderAndLeavesNoProbeBehind() throws IOException {
        FolderTarget target = new FolderTarget("T2", dir.resolve("t2"), false);
        TargetTester.Result result = new TargetTester().test(target);
        assertThat(result.ok()).isTrue();
        assertThat(result.steps()).extracting(TargetTester.Step::name).containsExactly("write", "read-back", "cleanup");
        assertThat(target.list("_probe")).isEmpty();
    }

    @Test
    void targetTestFailsAnImmutableTargetThatAllowsDeletes() {
        FolderTarget target = new FolderTarget("T3", dir.resolve("t3"), true);
        TargetTester.Result result = new TargetTester().test(target);
        assertThat(result.ok()).isFalse();
        assertThat(result.steps()).anyMatch(step -> step.name().equals("delete-refused") && !step.ok());
    }

    @Test
    void targetTestFailsWhenTheTargetCannotBeWritten() throws IOException {
        Path file = Files.writeString(dir.resolve("not-a-folder"), "x");
        TargetTester.Result result = new TargetTester().test(new FolderTarget("T2", file.resolve("sub"), false));
        assertThat(result.ok()).isFalse();
    }

    @Test
    void registryBuildsConfiguredTargetsInOrder() {
        TargetRegistry registry = new TargetRegistry(props(folder("t2", dir.resolve("a")), folder("T3", dir.resolve("b"))));
        assertThat(registry.all()).extracting(BackupTarget::code).containsExactly("T2", "T3");
    }

    @Test
    void registryRejectsABadCodeADuplicateAndTheSameFolderAsT1() {
        assertThatThrownBy(() -> new TargetRegistry(props(folder("T1", dir.resolve("a"))))).hasMessageContaining("T2 to T9");
        AgentProperties twice = props(folder("T2", dir.resolve("a")));
        twice.getTargets().getExtra().put("t2", folder("t2", dir.resolve("b")));
        assertThatThrownBy(() -> new TargetRegistry(twice)).hasMessageContaining("twice");
        assertThatThrownBy(() -> new TargetRegistry(props(folder("T2", dir.resolve("t1"))))).hasMessageContaining("same folder as T1");
    }

    @Test
    void registryRefusesALiveEqmsBucket() {
        AgentProperties.Extra s3 = new AgentProperties.Extra();
        s3.setCode("T3");
        s3.setKind("S3");
        s3.setEndpoint("http://localhost:9000");
        s3.setBucket("eqms-gmp-records");
        assertThatThrownBy(() -> new TargetRegistry(props(s3))).hasMessageContaining("live bucket");
    }

    @Test
    void registryRejectsAnUnknownKindAndAnS3TargetWithoutABucket() {
        AgentProperties.Extra odd = folder("T2", dir.resolve("a"));
        odd.setKind("TAPE");
        assertThatThrownBy(() -> new TargetRegistry(props(odd))).hasMessageContaining("unknown kind");
        AgentProperties.Extra s3 = new AgentProperties.Extra();
        s3.setCode("T3");
        s3.setKind("S3");
        assertThatThrownBy(() -> new TargetRegistry(props(s3))).hasMessageContaining("endpoint and a bucket");
    }
}
