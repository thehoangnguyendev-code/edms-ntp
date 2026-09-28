package com.eqms;

import com.eqms.service.DocumentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Regression: DocumentService.getFilters() previously had no @Transactional, and loads
 * UserAccount entities for the Author filter list. UserAccount.avatar is @Lob-mapped, which
 * Hibernate streams via Postgres's Large Object API -- that requires a real (non-autocommit)
 * transaction, so every call failed with "Large Objects may not be used in auto-commit mode"
 * (surfaced to the frontend as every filter dropdown silently falling back to "All"). This test
 * exercises the real DB connection (not mocked) since the failure is a JDBC/transaction-mode
 * behavior that a unit test with mocked repositories cannot reproduce.
 */
@SpringBootTest
class DocumentFiltersIntegrationTest {

    @Autowired
    private DocumentService documentService;

    @Test
    void getFilters_doesNotThrow_andReturnsAuthors() {
        var response = assertDoesNotThrow(() -> documentService.getFilters());
        assertNotNull(response);
        assertNotNull(response.authors());
    }
}
