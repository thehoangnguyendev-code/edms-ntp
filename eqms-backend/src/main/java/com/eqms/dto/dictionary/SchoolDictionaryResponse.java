package com.eqms.dto.dictionary;

import java.util.UUID;
import java.util.List;

public record SchoolDictionaryResponse(
        UUID id,
        String name,
        String abbreviation,
        String type,
        String ownership,
        boolean isActive,
        String createdDate,
        String modifiedDate,
        String catalogId,
        String slug,
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
