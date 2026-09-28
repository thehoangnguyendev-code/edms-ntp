package com.eqms.dto.dictionary;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record SchoolDictionaryRequest(
        @NotBlank String name,
        String abbreviation,
        @NotBlank String type,
        String ownership,
        Boolean isActive,
        String entityKind,
        Boolean isIndependentInstitution,
        String institutionType,
        String institutionTypeLabel,
        String presenceType,
        String operationalStatus,
        String verifiedAsOf,
        String verificationStatus,
        String governingBody,
        String governingBodyType,
        String governingBodyVerificationStatus,
        String nationalEducationRegulator,
        String governanceModel,
        String directGoverningMinistry,
        String countryOfOriginName,
        String countryOfOriginIso2,
        String hostInVietnam,
        String parentOrPartner,
        String supervisingAuthority,
        String ultimateGoverningBody,
        String ownershipVerificationStatus,
        String statusNote,
        List<String> governingBodySourceUrls
) {
}
