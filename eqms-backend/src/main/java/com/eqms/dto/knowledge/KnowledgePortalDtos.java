package com.eqms.dto.knowledge;

import com.eqms.dto.document.KnowledgeBaseDocumentResponse;

import java.util.List;
import java.util.UUID;

public final class KnowledgePortalDtos {

    private KnowledgePortalDtos() {}

    public record HierarchyOption(UUID id, String name, boolean isDefault) {}

    /**
     * @param sizeBytes      size of the current revision's file, when one is recorded
     * @param myLastOpenedAt when the signed-in user last opened this document from the portal (ISO-8601 instant), or null
     */
    public record PortalDocument(KnowledgeBaseDocumentResponse document, long views, long helpfulVotes,
                                 boolean featured, Boolean myFeedback, Long sizeBytes, String myLastOpenedAt) {}

    /** One line of the search box's drop-down: a document the user may open in the Knowledge Base. */
    public record DocumentSuggestion(String id, String documentNumber, String documentName, String revisionNumber,
                                     String documentType, String department) {}

    /** How a folder of the explorer is drawn: the colour a Business Unit or a Department was given (null: automatic) and the short form of its name. `id` is the key the folder carries. */
    public record FolderStyle(String id, String name, String abbreviation, String color) {}

    /** The icon of a Document Type in the explorer: the type's name (what a document carries), its Short Code, and the icon the Document Type was given. */
    public record DocumentTypeIcon(String name, String shortCode, String iconLabel, String iconColor) {}

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
            /** One page of the documents in this folder. */
            List<PortalDocument> documents,
            /** All documents in this folder, across pages. */
            int totalDocuments,
            int page,
            int limit
    ) {}

    public record DeterminatorInfo(String field, String label) {}

    public record FeedbackRequest(Boolean helpful) {}

    public record SubscriptionRequest(String fieldCode, String valueKey) {}
}
