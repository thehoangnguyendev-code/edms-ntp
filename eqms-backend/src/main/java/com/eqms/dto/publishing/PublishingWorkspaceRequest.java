package com.eqms.dto.publishing;

public record PublishingWorkspaceRequest(
        String publishingTemplateId,
        String selectedLayout,
        String changeSummary,
        String signatureToken,
        Integer coverSourcePageFrom,
        Integer coverSourcePageTo,
        Integer bodySourcePageFrom,
        Integer bodySourcePageTo,
        Integer headerPageFrom,
        Integer headerPageTo,
        Integer footerPageFrom,
        Integer footerPageTo,
        Integer watermarkPageFrom,
        Integer watermarkPageTo,
        Boolean enableCover,
        Boolean enableHeader,
        Boolean enableFooter,
        String reason
) {}
