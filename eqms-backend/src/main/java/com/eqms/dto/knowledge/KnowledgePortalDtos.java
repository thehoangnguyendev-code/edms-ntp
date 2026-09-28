package com.eqms.dto.knowledge;

import com.eqms.dto.document.KnowledgeBaseDocumentResponse;

import java.util.List;
import java.util.UUID;

public final class KnowledgePortalDtos {

    private KnowledgePortalDtos() {}

    public record HierarchyOption(UUID id, String name, boolean isDefault) {}

    public record PortalDocument(KnowledgeBaseDocumentResponse document, long views, long helpfulVotes,
                                 boolean featured, Boolean myFeedback) {}

    public record KnowledgeBaseCard(String key, String label, int documentCount, boolean subscribed) {}

    public record PortalOverview(
            List<HierarchyOption> hierarchies,
            UUID selectedHierarchyId,
            String selectedHierarchyName,
            String determinatorField,
            String determinatorLabel,
            List<String> levelLabels,
            int totalDocuments,
            int totalKnowledgeBases,
            List<KnowledgeBaseCard> knowledgeBases,
            List<PortalDocument> featured,
            List<PortalDocument> mostViewed,
            List<PortalDocument> mostUseful
    ) {}

    public record Crumb(String fieldLabel, String key, String label) {}

    public record Folder(String key, String label, int documentCount) {}

    public record BrowseResult(
            List<Crumb> path,
            String nextFieldLabel,
            List<Folder> folders,
            List<PortalDocument> documents
    ) {}

    public record DeterminatorInfo(String field, String label) {}

    public record FeedbackRequest(Boolean helpful) {}

    public record SubscriptionRequest(String fieldCode, String valueKey) {}
}
