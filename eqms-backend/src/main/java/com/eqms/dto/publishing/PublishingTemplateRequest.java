package com.eqms.dto.publishing;

import jakarta.validation.constraints.NotBlank;

public record PublishingTemplateRequest(
        @NotBlank String templateName,
        String documentType,
        String description,
        String status,
        String publishingMode,
        String coverOrientation,
        String bodyOrientation,
        Boolean enableHeader,
        Boolean enableFooter,
        Boolean showLogo,
        Boolean showQrCode,
        Boolean showBarcode,
        Boolean showConfidentiality,
        Boolean showElectronicSignatureInformation,
        String watermarkMode,
        String logoFileName,
        Integer coverSourcePageFrom,
        Integer coverSourcePageTo,
        Integer bodySourcePageFrom,
        Integer bodySourcePageTo,
        Integer headerPageFrom,
        Integer headerPageTo,
        Integer footerPageFrom,
        Integer footerPageTo,
        Integer watermarkPageFrom,
        Integer watermarkPageTo
) {}
