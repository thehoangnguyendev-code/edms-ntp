package com.eqms.service;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.dto.dashboard.DashboardActivityPointResponse;
import com.eqms.dto.dashboard.DashboardAdminStatsResponse;
import com.eqms.dto.dashboard.DashboardMyTaskResponse;
import com.eqms.dto.dashboard.DashboardRecentActivityResponse;
import com.eqms.dto.dashboard.DashboardSummaryResponse;
import com.eqms.entity.AuditLog;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserStatus;
import com.eqms.repository.AuditLogRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.UserAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@Transactional(readOnly = true)
public class DashboardService {

    private static final Set<String> MY_TASK_STATUSES = Set.of("PENDING_REVIEW", "PENDING_APPROVAL");
    private static final Set<String> MY_TASK_PARTICIPANT_TYPES = Set.of("REVIEWER", "APPROVER");

    private final DocumentRecordRepository documentRepo;
    private final DocumentRevisionRepository revisionRepo;
    private final AuditLogRepository auditLogRepo;
    private final UserAccountRepository userRepo;

    public DashboardService(
            DocumentRecordRepository documentRepo,
            DocumentRevisionRepository revisionRepo,
            AuditLogRepository auditLogRepo,
            UserAccountRepository userRepo
    ) {
        this.documentRepo = documentRepo;
        this.revisionRepo = revisionRepo;
        this.auditLogRepo = auditLogRepo;
        this.userRepo = userRepo;
    }

    public DashboardSummaryResponse getSummary(AuthenticatedUser currentUser) {
        long totalEffective = documentRepo.countByStatus_Code("EFFECTIVE");
        long total = documentRepo.count();
        long pendingReview = revisionRepo.countByStatus_Code("PENDING_REVIEW");
        long pendingApproval = revisionRepo.countByStatus_Code("PENDING_APPROVAL");
        long pendingTraining = revisionRepo.countByStatus_Code("PENDING_TRAINING");
        long myTasks = revisionRepo.findMyPendingTasks(
                currentUser.userId(), MY_TASK_STATUSES, MY_TASK_PARTICIPANT_TYPES
        ).size();
        return new DashboardSummaryResponse(totalEffective, pendingReview, pendingApproval, pendingTraining, myTasks, total);
    }

    public List<DashboardActivityPointResponse> getDocumentActivity(String period) {
        List<Object[]> rows = switch (period) {
            case "quarter" -> documentRepo.countDocumentsGroupedByQuarter();
            case "year" -> documentRepo.countDocumentsGroupedByYear();
            default -> documentRepo.countDocumentsGroupedByMonth();
        };
        return rows.stream()
                .map(r -> new DashboardActivityPointResponse(
                        String.valueOf(r[0]),
                        ((Number) r[1]).longValue()
                ))
                .toList();
    }

    public List<DashboardMyTaskResponse> getMyTasks(AuthenticatedUser currentUser) {
        return revisionRepo.findMyPendingTasks(
                        currentUser.userId(), MY_TASK_STATUSES, MY_TASK_PARTICIPANT_TYPES
                ).stream()
                .limit(20)
                .map(this::toMyTaskResponse)
                .toList();
    }

    public DashboardAdminStatsResponse getAdminStats() {
        long totalUsers = userRepo.count();
        long activeUsers = userRepo.countByStatus(UserStatus.Active);
        long inactiveUsers = totalUsers - activeUsers;
        long totalDocuments = documentRepo.count();

        Map<String, Long> documentsByStatus = Map.of(
                "EFFECTIVE", documentRepo.countByStatus_Code("EFFECTIVE"),
                "DRAFT", documentRepo.countByStatus_Code("DRAFT"),
                "OBSOLETE", documentRepo.countByStatus_Code("OBSOLETE"),
                "CANCELLED", documentRepo.countByStatus_Code("CANCELLED")
        );

        Map<String, Long> revisionsByStatus = Map.of(
                "PENDING_REVIEW", revisionRepo.countByStatus_Code("PENDING_REVIEW"),
                "PENDING_APPROVAL", revisionRepo.countByStatus_Code("PENDING_APPROVAL"),
                "PENDING_TRAINING", revisionRepo.countByStatus_Code("PENDING_TRAINING"),
                "READY_FOR_PUBLISHING", revisionRepo.countByStatus_Code("READY_FOR_PUBLISHING")
        );

        long auditEvents = auditLogRepo.countEventsLast30Days();
        List<DashboardActivityPointResponse> auditByDay = auditLogRepo.countAuditEventsGroupedByDay()
                .stream()
                .map(r -> new DashboardActivityPointResponse(String.valueOf(r[0]), ((Number) r[1]).longValue()))
                .toList();

        return new DashboardAdminStatsResponse(
                totalUsers, activeUsers, inactiveUsers,
                totalDocuments, documentsByStatus, revisionsByStatus,
                auditEvents, auditByDay
        );
    }

    public List<DashboardRecentActivityResponse> getRecentActivity() {
        return auditLogRepo.findRecentSystemActivity().stream()
                .map(this::toRecentActivityResponse)
                .toList();
    }

    private DashboardMyTaskResponse toMyTaskResponse(DocumentRevisionRecord r) {
        String taskType = "PENDING_REVIEW".equals(r.getStatus().getCode()) ? "REVIEW" : "APPROVAL";
        return new DashboardMyTaskResponse(
                r.getId(),
                r.getDocument().getId(),
                r.getDocumentNumber(),
                r.getDocumentName(),
                r.getRevisionNumber(),
                r.getStatus().getCode(),
                taskType,
                r.getCreatedAt()
        );
    }

    private DashboardRecentActivityResponse toRecentActivityResponse(AuditLog a) {
        return new DashboardRecentActivityResponse(
                a.getId(),
                a.getEntityType(),
                a.getEntityName(),
                a.getEntityCode(),
                a.getAction(),
                a.getActionType(),
                a.getUserFullName(),
                a.getFromStatus(),
                a.getToStatus(),
                a.getEventTime()
        );
    }
}
