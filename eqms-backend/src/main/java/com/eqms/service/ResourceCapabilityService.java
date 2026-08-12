package com.eqms.service;

import com.eqms.dto.security.ControlledCopyActionCapabilitiesResponse;
import com.eqms.dto.security.ResourceActionCapabilityResponse;
import com.eqms.dto.security.ResourceCapabilitiesResponse;
import com.eqms.dto.security.RevisionActionCapabilitiesResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Adapter registry for the shared capability API. It delegates to the current domain evaluators
 * so this endpoint is not a second authorization engine.
 */
@Service
public class ResourceCapabilityService {
    private final RevisionActionCapabilityService revisionCapabilities;
    private final ControlledCopyAuthorizationService controlledCopyCapabilities;
    private final DocumentParticipantEligibilityService documentEligibility;
    private final DocumentMasterActionCapabilityService documentMasterCapabilities;

    public ResourceCapabilityService(
            RevisionActionCapabilityService revisionCapabilities,
            ControlledCopyAuthorizationService controlledCopyCapabilities,
            DocumentParticipantEligibilityService documentEligibility,
            DocumentMasterActionCapabilityService documentMasterCapabilities
    ) {
        this.revisionCapabilities = revisionCapabilities;
        this.controlledCopyCapabilities = controlledCopyCapabilities;
        this.documentEligibility = documentEligibility;
        this.documentMasterCapabilities = documentMasterCapabilities;
    }

    @Transactional(readOnly = true)
    public ResourceCapabilitiesResponse getCapabilities(String resourceType, String resourceId) {
        String normalized = normalize(resourceType);
        return switch (normalized) {
            case "DOCUMENT_MASTER" -> documentMasterCapabilities.getCapabilities(uuid(resourceId));
            case "DOCUMENT_REVISION" -> fromRevision(revisionCapabilities.getCapabilities(uuid(resourceId)));
            case "CONTROLLED_COPY" -> fromControlledCopy(controlledCopyCapabilities.getCopyCapabilities(uuid(resourceId)), normalized, resourceId);
            case "CONTROLLED_COPY_BATCH" -> fromControlledCopy(controlledCopyCapabilities.getBatchCapabilities(uuid(resourceId)), normalized, resourceId);
            default -> throw new IllegalArgumentException("Unsupported resource type: " + resourceType);
        };
    }

    /**
     * Eligible-participant lookup, dispatched the same way as {@link #getCapabilities}.
     * Only DOCUMENT_REVISION has a reviewer/approver eligibility lookup today; add a
     * resource-specific case here when another module needs one, not in a controller.
     */
    @Transactional(readOnly = true)
    public com.eqms.dto.user.PageResponse<com.eqms.dto.security.EligibleParticipantResponse> getEligibleParticipants(
            String resourceType, String resourceId, String participantType, String search, int page, int limit
    ) {
        String normalized = normalize(resourceType);
        return switch (normalized) {
            case "DOCUMENT_REVISION" -> documentEligibility.eligible(uuid(resourceId), participantType, search, page, limit);
            default -> throw new IllegalArgumentException("Unsupported resource type: " + resourceType);
        };
    }

    private ResourceCapabilitiesResponse fromRevision(RevisionActionCapabilitiesResponse source) {
        Map<String, ResourceActionCapabilityResponse> actions = new LinkedHashMap<>();
        source.actions().forEach((code, decision) -> actions.put(code,
                new ResourceActionCapabilityResponse(decision.allowed(), decision.reasonCode(), decision.message(),
                        decision.requiredPermissionCode(), isSignedWorkflowAction(code))));
        return new ResourceCapabilitiesResponse("DOCUMENT_REVISION", source.revisionId().toString(), source.revisionStatus(),
                source.generatedAt(), actions);
    }

    private ResourceCapabilitiesResponse fromControlledCopy(
            ControlledCopyActionCapabilitiesResponse source, String resourceType, String resourceId
    ) {
        Map<String, ResourceActionCapabilityResponse> actions = new LinkedHashMap<>();
        source.actions().forEach((code, decision) -> actions.put(code,
                new ResourceActionCapabilityResponse(decision.allowed(), decision.reasonCode(), decision.message(),
                        decision.requiredPermissionCode(), isSignedControlledCopyAction(code))));
        String state = "CONTROLLED_COPY_BATCH".equals(resourceType) ? source.batchStatus() : source.copyStatus();
        return new ResourceCapabilitiesResponse(resourceType, resourceId, state, source.generatedAt(), actions);
    }

    private static String normalize(String resourceType) {
        if (resourceType == null || resourceType.isBlank()) throw new IllegalArgumentException("resourceType is required");
        return resourceType.trim().toUpperCase(Locale.ROOT).replace('-', '_');
    }

    private static UUID uuid(String value) {
        try { return UUID.fromString(value); }
        catch (IllegalArgumentException ex) { throw new IllegalArgumentException("resourceId must be a UUID"); }
    }

    // The existing domain mutation endpoints remain responsible for validating the signature.
    private static boolean isSignedWorkflowAction(String action) {
        return switch (action) {
            case "completeAuthoring", "submitForReview", "completeReview", "rejectReview",
                    "completeApproval", "rejectApproval", "completeTraining", "publish", "cancel", "upgradeRevision" -> true;
            default -> false;
        };
    }

    private static boolean isSignedControlledCopyAction(String action) {
        return switch (action) {
            case "distributeCopy", "recallCopy", "reportLostDamaged", "replaceLostDamaged", "expireCopy",
                    "cancelRequest", "distributeBatch", "recallBatch", "cancelBatch" -> true;
            default -> false;
        };
    }
}
