package com.eqms;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.repository.AuditLogRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.DashboardService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock DocumentRecordRepository documentRepository;
    @Mock DocumentRevisionRepository revisionRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock UserAccountRepository userRepository;

    @Test
    void summary_countsActiveDocumentMastersAsEffectiveDocuments() {
        when(documentRepository.countByStatus_Code("ACTIVE")).thenReturn(7L);
        when(documentRepository.count()).thenReturn(10L);
        when(revisionRepository.countByStatus_Code("PENDING_REVIEW")).thenReturn(1L);
        when(revisionRepository.countByStatus_Code("PENDING_APPROVAL")).thenReturn(2L);
        when(revisionRepository.countByStatus_Code("PENDING_TRAINING")).thenReturn(3L);
        when(revisionRepository.findMyPendingTasks(eq(UUID.fromString("00000000-0000-0000-0000-000000000001")), anySet(), anySet()))
                .thenReturn(List.of());

        DashboardService service = service();
        var summary = service.getSummary(new AuthenticatedUser(
                UUID.fromString("00000000-0000-0000-0000-000000000001"), UUID.randomUUID(), "user", "USER", Set.of()
        ));

        assertThat(summary.totalEffectiveDocuments()).isEqualTo(7L);
        verify(documentRepository).countByStatus_Code("ACTIVE");
    }

    @Test
    void effectiveDocumentsByType_countsActiveDocumentMastersPerTypeInRepositoryOrder() {
        UUID sop = UUID.fromString("00000000-0000-0000-0000-0000000000a1");
        UUID wi = UUID.fromString("00000000-0000-0000-0000-0000000000a2");
        when(documentRepository.countDocumentsGroupedByTypeForStatus("ACTIVE")).thenReturn(List.of(
                new Object[]{sop, "SOP", "Standard Operating Procedure", 12L},
                new Object[]{wi, "WI", "Work Instruction", 5L}
        ));

        var rows = service().getEffectiveDocumentsByType();

        assertThat(rows).extracting("typeId", "shortCode", "name", "documents").containsExactly(
                org.assertj.core.groups.Tuple.tuple(sop, "SOP", "Standard Operating Procedure", 12L),
                org.assertj.core.groups.Tuple.tuple(wi, "WI", "Work Instruction", 5L)
        );
        assertThat(rows.stream().mapToLong(r -> r.documents()).sum()).isEqualTo(17L);
        verify(documentRepository).countDocumentsGroupedByTypeForStatus("ACTIVE");
    }

    @Test
    void effectiveDocumentsByType_isEmptyWhenNoDocumentIsEffective() {
        when(documentRepository.countDocumentsGroupedByTypeForStatus("ACTIVE")).thenReturn(List.of());

        assertThat(service().getEffectiveDocumentsByType()).isEmpty();
    }

    private DashboardService service() {
        return new DashboardService(documentRepository, revisionRepository, auditLogRepository, userRepository);
    }

    @Test void pendingWorkSearchIsBoundToCurrentUserAndLimitedAfterRepositoryFiltering() {
        UUID actor = UUID.randomUUID();
        var principal = new AuthenticatedUser(actor, UUID.randomUUID(), "user", "USER", Set.of());
        when(revisionRepository.findMyPendingTasksMatching(eq(actor), anySet(), anySet(), eq("literal!%!_!!"), org.mockito.ArgumentMatchers.any(org.springframework.data.domain.Pageable.class))).thenReturn(List.of());
        assertThat(service().getMyTasks(principal, "literal%_!")).isEmpty();
        var page = org.mockito.ArgumentCaptor.forClass(org.springframework.data.domain.Pageable.class);
        verify(revisionRepository).findMyPendingTasksMatching(eq(actor), anySet(), anySet(), eq("literal!%!_!!"), page.capture());
        assertThat(page.getValue().getPageSize()).isEqualTo(20);
        assertThat(page.getValue().getPageNumber()).isZero();
    }
}
