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
        String reason,
        /** Publish this revision although a Related Document has not reached Ready for Publishing; that document is left untouched. */
        Boolean forcePublishRelated
) {
    public PublishingWorkspaceRequest(String publishingTemplateId, String selectedLayout, String changeSummary, String signatureToken,
            Integer coverSourcePageFrom, Integer coverSourcePageTo, Integer bodySourcePageFrom, Integer bodySourcePageTo,
            Integer headerPageFrom, Integer headerPageTo, Integer footerPageFrom, Integer footerPageTo,
            Integer watermarkPageFrom, Integer watermarkPageTo, Boolean enableCover, Boolean enableHeader, Boolean enableFooter, String reason) {
        this(publishingTemplateId, selectedLayout, changeSummary, signatureToken, coverSourcePageFrom, coverSourcePageTo, bodySourcePageFrom,
                bodySourcePageTo, headerPageFrom, headerPageTo, footerPageFrom, footerPageTo, watermarkPageFrom, watermarkPageTo,
                enableCover, enableHeader, enableFooter, reason, null);
    }
}
