package com.eqms.backup.agent;

import com.eqms.backup.agent.config.AgentProperties;
import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.restore.ProductionRestoreService;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** A production restore must refuse to start until it is deliberately configured. Nothing here touches a database. */
class ProductionRestoreServiceConfigTest {

    private ProductionRestoreService service(AgentProperties p) {
        return new ProductionRestoreService(null, null, null, null, null, null, null, null, p);
    }

    @Test
    void refusesOnAProcessThatIsNotTheRestoreWorker() {
        assertThatThrownBy(() -> service(new AgentProperties()).run("BK-1", "qa", "SIG"))
                .isInstanceOf(ExportException.class).hasMessageContaining("not the restore worker");
    }

    @Test
    void refusesWithoutTheSwapRoleAndWithoutTheFileAccount() {
        AgentProperties p = new AgentProperties();
        p.getRestore().setEnabled(true);
        assertThatThrownBy(() -> service(p).run("BK-1", "qa", "SIG")).isInstanceOf(ExportException.class).hasMessageContaining("swaps the database");
        p.getRestore().getSwap().setUser("u");
        p.getRestore().getSwap().setPassword("p");
        p.getRestore().getSwap().setLiveDatabase("eqms-database");
        assertThatThrownBy(() -> service(p).run("BK-1", "qa", "SIG")).isInstanceOf(ExportException.class).hasMessageContaining("adds files");
    }
}
