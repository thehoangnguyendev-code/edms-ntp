package com.eqms;

import com.eqms.dto.dashboard.DashboardDocumentTypeCountResponse;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.service.DashboardService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The dashboard's "Effective Documents by Type" breakdown must reconcile with the Effective Documents
 * figure the same dashboard already shows, and its JPQL has to run against the real mapping.
 */
@SpringBootTest
@Transactional
class DashboardEffectiveDocumentsByTypeIntegrationTest {

    @Autowired private DashboardService dashboardService;
    @Autowired private DocumentRecordRepository documentRepository;

    @Test
    void rowsAddUpToTheEffectiveDocumentCountAndAreOrderedLargestFirst() {
        List<DashboardDocumentTypeCountResponse> rows = dashboardService.getEffectiveDocumentsByType();

        assertThat(rows.stream().mapToLong(DashboardDocumentTypeCountResponse::documents).sum())
                .isEqualTo(documentRepository.countByStatus_Code("ACTIVE"));
        assertThat(rows).extracting(DashboardDocumentTypeCountResponse::documents).isSortedAccordingTo(java.util.Comparator.reverseOrder());
        assertThat(rows).allSatisfy(row -> {
            assertThat(row.documents()).isPositive();
            assertThat(row.typeId()).isNotNull();
            assertThat(row.name()).isNotBlank();
        });
        assertThat(rows).extracting(DashboardDocumentTypeCountResponse::typeId).doesNotHaveDuplicates();
    }
}
