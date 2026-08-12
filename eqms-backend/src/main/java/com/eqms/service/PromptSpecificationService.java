package com.eqms.service;

import com.eqms.dto.CreatePromptGenerationRunRequest;
import com.eqms.dto.CreatePromptSpecificationRequest;
import com.eqms.dto.GeneratedArtifactResponse;
import com.eqms.dto.PromptGenerationRunResponse;
import com.eqms.dto.PromptSpecificationResponse;
import com.eqms.dto.PromptSpecificationSummaryResponse;
import com.eqms.entity.GeneratedArtifact;
import com.eqms.entity.PromptGenerationRun;
import com.eqms.entity.PromptGenerationRunStatus;
import com.eqms.entity.PromptSpecification;
import com.eqms.entity.PromptSpecificationStatus;
import com.eqms.repository.GeneratedArtifactRepository;
import com.eqms.repository.PromptGenerationRunRepository;
import com.eqms.repository.PromptSpecificationRepository;
import com.eqms.util.DateTimeFormatUtils;
import org.springframework.util.StringUtils;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class PromptSpecificationService {

    private static final String ACTION_PROMPT_SPECIFICATION_CREATED = "PROMPT_SPECIFICATION_CREATED";
    private static final String ACTION_PROMPT_GENERATION_QUEUED = "PROMPT_GENERATION_QUEUED";

    private final PromptSpecificationRepository promptSpecificationRepository;
    private final PromptGenerationRunRepository promptGenerationRunRepository;
    private final GeneratedArtifactRepository generatedArtifactRepository;
    private final AuditTrailService auditTrailService;

    public PromptSpecificationService(
            PromptSpecificationRepository promptSpecificationRepository,
            PromptGenerationRunRepository promptGenerationRunRepository,
            GeneratedArtifactRepository generatedArtifactRepository,
            AuditTrailService auditTrailService
    ) {
        this.promptSpecificationRepository = promptSpecificationRepository;
        this.promptGenerationRunRepository = promptGenerationRunRepository;
        this.generatedArtifactRepository = generatedArtifactRepository;
        this.auditTrailService = auditTrailService;
    }

    @Transactional
    public PromptSpecificationResponse create(CreatePromptSpecificationRequest request) {
        PromptSpecification specification = new PromptSpecification();
        specification.setModuleName(request.moduleName());
        specification.setPromptTitle(request.promptTitle());
        specification.setPromptText(request.promptText());
        specification.setSpecPayload(request.specPayload());
        specification.setStatus(PromptSpecificationStatus.DRAFT);

        PromptSpecification saved = promptSpecificationRepository.save(specification);
        auditTrailService.logSafely("PROMPT_SPECIFICATION", describeSpecification(saved), saved.getId(), ACTION_PROMPT_SPECIFICATION_CREATED, null, null,
                buildComment("Prompt specification created", saved.getModuleName(), saved.getPromptTitle()));
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<PromptSpecificationSummaryResponse> list() {
        return promptSpecificationRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toSummaryResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PromptSpecificationResponse getById(UUID id) {
        PromptSpecification specification = promptSpecificationRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Prompt specification not found: " + id));
        return toResponse(specification);
    }

    @Transactional
    public PromptGenerationRunResponse createRun(UUID specificationId, CreatePromptGenerationRunRequest request) {
        PromptSpecification specification = promptSpecificationRepository.findById(specificationId)
                .orElseThrow(() -> new EntityNotFoundException("Prompt specification not found: " + specificationId));

        PromptGenerationRun run = new PromptGenerationRun();
        run.setPromptSpecification(specification);
        run.setTargetFrontendPath(request.targetFrontendPath());
        run.setTargetBackendPath(request.targetBackendPath());
        run.setTargetDatabasePath(request.targetDatabasePath());
        run.setNotes(request.notes());
        run.setStatus(PromptGenerationRunStatus.QUEUED.name());

        PromptGenerationRun savedRun = promptGenerationRunRepository.save(run);
        auditTrailService.logSafely("PROMPT_GENERATION_RUN", describeRun(savedRun), savedRun.getId(), ACTION_PROMPT_GENERATION_QUEUED, null, null,
                buildComment("Prompt generation queued", specification.getModuleName(), specification.getPromptTitle(), request.notes()));
        return toRunResponse(savedRun);
    }

    private PromptSpecificationResponse toResponse(PromptSpecification specification) {
        return new PromptSpecificationResponse(
                specification.getId(),
                specification.getModuleName(),
                specification.getPromptTitle(),
                specification.getPromptText(),
                specification.getSpecPayload(),
                specification.getStatus().name(),
                DateTimeFormatUtils.formatDateTime(specification.getCreatedAt()),
                DateTimeFormatUtils.formatDateTime(specification.getUpdatedAt()),
                specification.getGenerationRuns()
                        .stream()
                        .map(this::toRunResponse)
                        .toList()
        );
    }

    private PromptSpecificationSummaryResponse toSummaryResponse(PromptSpecification specification) {
        return new PromptSpecificationSummaryResponse(
                specification.getId(),
                specification.getModuleName(),
                specification.getPromptTitle(),
                specification.getStatus().name(),
                DateTimeFormatUtils.formatDateTime(specification.getCreatedAt()),
                DateTimeFormatUtils.formatDateTime(specification.getUpdatedAt()),
                specification.getGenerationRuns().size()
        );
    }

    private PromptGenerationRunResponse toRunResponse(PromptGenerationRun run) {
        return new PromptGenerationRunResponse(
                run.getId(),
                run.getStatus(),
                run.getTargetFrontendPath(),
                run.getTargetBackendPath(),
                run.getTargetDatabasePath(),
                DateTimeFormatUtils.formatDateTime(run.getGeneratedAt()),
                run.getNotes(),
                run.getArtifacts().stream().map(this::toArtifactResponse).toList()
        );
    }

    private GeneratedArtifactResponse toArtifactResponse(GeneratedArtifact artifact) {
        return new GeneratedArtifactResponse(
                artifact.getId(),
                artifact.getArtifactType(),
                artifact.getFilePath(),
                artifact.getContentHash(),
                DateTimeFormatUtils.formatDateTime(artifact.getCreatedAt())
        );
    }

    private String describeSpecification(PromptSpecification specification) {
        if (specification == null) {
            return null;
        }
        return joinParts(specification.getModuleName(), specification.getPromptTitle());
    }

    private String describeRun(PromptGenerationRun run) {
        if (run == null || run.getPromptSpecification() == null) {
            return null;
        }
        return joinParts(run.getPromptSpecification().getModuleName(), run.getPromptSpecification().getPromptTitle());
    }

    private String buildComment(String prefix, String... parts) {
        return prefix + (StringUtils.hasText(joinParts(parts)) ? ": " + joinParts(parts) : "");
    }

    private String joinParts(String... parts) {
        if (parts == null || parts.length == 0) {
            return null;
        }
        StringBuilder builder = new StringBuilder();
        for (String part : parts) {
            if (!StringUtils.hasText(part)) {
                continue;
            }
            if (builder.length() > 0) {
                builder.append(" - ");
            }
            builder.append(part.trim());
        }
        return builder.length() == 0 ? null : builder.toString();
    }
}
