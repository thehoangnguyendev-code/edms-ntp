package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.controlledcopypolicy.ControlledCopyMarkingPreviewResponse;
import com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking;
import com.eqms.dto.controlledcopypolicy.MarkingPlacementRule;
import com.eqms.dto.uncontrolledcopypolicy.UncontrolledCopyMarkingPreviewRequest;
import com.eqms.entity.UncontrolledCopyPolicySetting;
import com.eqms.repository.UncontrolledCopyPolicySettingRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ControlledCopyMarkingPreviewService;
import com.eqms.service.ControlledCopyPdfMarkingService;
import com.eqms.service.ControlledCopyPolicyService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SecurityChangeSignatureService;
import com.eqms.service.UncontrolledCopyMarkingPreviewService;
import com.eqms.service.UncontrolledCopyPolicyService;
import com.eqms.service.UncontrolledCopyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Server-rendered Uncontrolled Copy marking preview: draft config is validated with the Controlled Copy rules, the
 * watermark is forced on, the SAME line-building as real generation is used, and the shared engine/base/renderer is reused.
 */
@ExtendWith(MockitoExtension.class)
class UncontrolledCopyMarkingPreviewServiceTest {

    @Mock private UncontrolledCopyPolicySettingRepository policyRepository;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private CurrentUserService currentUserService;
    @Mock private SecurityChangeSignatureService securityChangeSignatureService;
    @Mock private AuditTrailService auditTrailService;
    @Mock private ControlledCopyPdfMarkingService markingService;
    @Mock private ControlledCopyMarkingPreviewService basePreviewService;

    private UncontrolledCopyPolicyService policyService;
    private UncontrolledCopyMarkingPreviewService service;

    @BeforeEach
    void setUp() {
        // validatedStatusMarking is pure (uses none of the collaborators), so a real instance is used for it.
        ControlledCopyPolicyService controlledPolicy = new ControlledCopyPolicyService(
                null, null, null, null, null, null, null, null, null);
        policyService = new UncontrolledCopyPolicyService(policyRepository, permissionEvaluationService,
                currentUserService, securityChangeSignatureService, auditTrailService, controlledPolicy, null);
        service = new UncontrolledCopyMarkingPreviewService(policyService, markingService, basePreviewService);
        lenient().when(policyRepository.findById(UncontrolledCopyPolicySetting.DEFAULT_ID))
                .thenReturn(Optional.of(new UncontrolledCopyPolicySetting()));
    }

    private static ControlledCopyStatusMarking draft(Boolean watermarkEnabled, List<MarkingPlacementRule> placements) {
        return new ControlledCopyStatusMarking(watermarkEnabled, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, placements, null, null, null);
    }

    @Test
    void preview_forcesWatermark_usesGenerationLines_andSharedRenderer() {
        byte[] basePdf = {1};
        byte[] markedPdf = {2};
        var base = new ControlledCopyMarkingPreviewService.CachedBase(basePdf, null, 0L);
        when(basePreviewService.baseDocument("tpl", "landscape")).thenReturn(base);
        when(markingService.applyStatusMarkingWithLayout(eq(basePdf), any(), anyList(), anyList(), anyList()))
                .thenReturn(new ControlledCopyPdfMarkingService.Marked(markedPdf, List.of()));
        var expected = new ControlledCopyMarkingPreviewResponse("png", 1, 1, List.of(), List.of(), null);
        when(basePreviewService.response(eq(markedPdf), eq(base), eq(1), eq(List.of()), anyList())).thenReturn(expected);

        List<MarkingPlacementRule> placements = List.of(new MarkingPlacementRule("OTHERS", 0.1, 0.2, 20, null, null, null, null));
        ControlledCopyMarkingPreviewResponse response = service.preview(new UncontrolledCopyMarkingPreviewRequest(
                "tpl", "landscape", "BODY", draft(false, placements)));

        assertSame(expected, response);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> watermark = ArgumentCaptor.forClass(List.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> stamp = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<ControlledCopyStatusMarking> config = ArgumentCaptor.forClass(ControlledCopyStatusMarking.class);
        verify(markingService).applyStatusMarkingWithLayout(eq(basePdf), config.capture(), watermark.capture(), stamp.capture(), anyList());
        assertTrue(config.getValue().watermarkEnabled(), "watermark is mandatory even if the draft disables it");
        assertEquals("ALL", config.getValue().watermarkPages());
        assertEquals(placements, config.getValue().placements(), "draft drag-and-drop placements reach the engine");
        assertEquals(UncontrolledCopyService.MANDATORY_WATERMARK_TEXT, watermark.getValue().get(0));
        assertTrue(stamp.getValue().contains("UC.SOP.10110.001"));
    }

    @Test
    void preview_rejectsInvalidPlacement_beforeRendering() {
        List<MarkingPlacementRule> bad = List.of(new MarkingPlacementRule("OTHERS", 1.5, 0.2, 20, null, null, null, null));

        assertThrows(IllegalArgumentException.class, () -> service.preview(
                new UncontrolledCopyMarkingPreviewRequest(null, "portrait", "COVER", draft(null, bad))));
        verifyNoInteractions(markingService, basePreviewService);
    }

    @Test
    void draftMarking_withNullRequest_returnsStoredDefaults_validated() {
        ControlledCopyStatusMarking m = policyService.draftMarking(null);
        assertTrue(m.watermarkEnabled());
        assertEquals("UNCONTROLLED COPY", m.stampText());
    }
}
