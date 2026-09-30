package com.eqms.service;

import com.eqms.dto.controlledcopypolicy.ControlledCopyMarkingPreviewResponse;
import com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking;
import com.eqms.dto.uncontrolledcopypolicy.UncontrolledCopyMarkingPreviewRequest;
import com.eqms.util.DateTimeFormatUtils;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * Server-rendered preview of the Uncontrolled Copies Policy's DRAFT watermark/stamp, mirroring
 * {@link ControlledCopyMarkingPreviewService}: the same Publishing Template base pages (and cache), the same PDF engine
 * ({@link ControlledCopyPdfMarkingService#applyStatusMarkingWithLayout}) and the same line-building as real generation
 * ({@link UncontrolledCopyService#markingPlan}), on sample data. Nothing is stored.
 *
 * <p>Marks are reported under the "Status" layer (an uncontrolled copy carries exactly one watermark and at most one stamp,
 * drawn in one status-marking pass), which is the layer the shared frontend preview pane lets the administrator drag.</p>
 */
@Service
public class UncontrolledCopyMarkingPreviewService {

    static final String SAMPLE_COPY_NUMBER = "UC.SOP.10110.001";
    static final String SAMPLE_RECIPIENT = "Nguyen Van A";

    private final UncontrolledCopyPolicyService policyService;
    private final ControlledCopyPdfMarkingService markingService;
    private final ControlledCopyMarkingPreviewService basePreviewService;

    public UncontrolledCopyMarkingPreviewService(
            UncontrolledCopyPolicyService policyService,
            ControlledCopyPdfMarkingService markingService,
            ControlledCopyMarkingPreviewService basePreviewService
    ) {
        this.policyService = policyService;
        this.markingService = markingService;
        this.basePreviewService = basePreviewService;
    }

    public ControlledCopyMarkingPreviewResponse preview(UncontrolledCopyMarkingPreviewRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Preview request is required");
        }
        boolean bodyPage = "BODY".equalsIgnoreCase(request.pageKind());
        String layout = "landscape".equalsIgnoreCase(request.layout()) ? "landscape" : "portrait";

        ControlledCopyStatusMarking draft = policyService.draftMarking(request.marking());
        ControlledCopyMarkingPreviewService.CachedBase base = basePreviewService.baseDocument(request.templateId(), layout);

        UncontrolledCopyService.MarkingPlan plan = UncontrolledCopyService.markingPlan(
                draft, SAMPLE_COPY_NUMBER, SAMPLE_RECIPIENT, DateTimeFormatUtils.formatDateTime(Instant.now()));
        ControlledCopyPdfMarkingService.Marked marked = markingService.applyStatusMarkingWithLayout(
                base.pdf(), plan.config(), plan.watermarkLines(), plan.stampLines(), List.of());

        return basePreviewService.response(marked.pdf(), base, bodyPage ? 1 : 0, List.of(), marked.placements());
    }
}
