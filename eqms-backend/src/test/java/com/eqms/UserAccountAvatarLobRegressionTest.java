package com.eqms;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Root-cause regression for TBR-DOC-015: UserAccount.avatar was @Lob-mapped over a plain Postgres
 * `text` column. @Lob forces Hibernate to read it as a JDBC CLOB, which PgJDBC streams via the
 * Large Object API -- that throws "Large Objects may not be used in auto-commit mode" for any
 * read of a UserAccount outside an active (non-autocommit) transaction. @Lob has been removed;
 * these tests confirm (1) the original crash is gone, reproduced with a bare, non-transactional
 * repository call exactly as it failed before, and (2) removing @Lob did not change read/write
 * behavior for a large avatar value (no silent truncation).
 */
@SpringBootTest
class UserAccountAvatarLobRegressionTest {

    @Autowired
    private UserAccountRepository userAccountRepository;

    @Autowired
    private EntityManager entityManager;

    /**
     * No @Transactional on this test method -- deliberately reproduces the exact failure
     * conditions from the original bug report (a bare repository call outside any transaction,
     * connection in autocommit mode).
     */
    @Test
    void findAllByStatus_outsideAnyTransaction_doesNotThrow() {
        assertDoesNotThrow(() -> userAccountRepository.findAllByStatus(UserStatus.Active));
    }

    /**
     * @Transactional here rolls the mutation back automatically after the test -- verifies a large
     * avatar value (simulating a base64-encoded image, well past typical VARCHAR-length assumptions)
     * round-trips unchanged now that it's a plain VARCHAR/LONGVARCHAR mapping instead of a CLOB.
     */
    @Test
    @Transactional
    void avatar_largeValue_roundTripsUnchanged() {
        UserAccount admin = userAccountRepository.findByUsername("admin").orElseThrow();
        String largeAvatar = "data:image/png;base64," + "A".repeat(200_000);

        admin.setAvatar(largeAvatar);
        userAccountRepository.saveAndFlush(admin);
        entityManager.clear();

        UserAccount reloaded = userAccountRepository.findByUsername("admin").orElseThrow();
        assertEquals(largeAvatar, reloaded.getAvatar());
    }
}
