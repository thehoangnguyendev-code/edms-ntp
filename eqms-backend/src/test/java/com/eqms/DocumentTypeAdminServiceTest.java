package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.dictionary.DocumentSubTypeDictionaryRequest;
import com.eqms.dto.dictionary.DocumentTypeDictionaryRequest;
import com.eqms.entity.DocumentSubType;
import com.eqms.entity.DocumentType;
import com.eqms.entity.ReviewRequirement;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentNameFormatRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentSubTypeRepository;
import com.eqms.repository.DocumentTypeRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.DocumentComponentResolver;
import com.eqms.service.DocumentTypeAdminService;
import com.eqms.service.PermissionEvaluationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Integrity rules of Document Type / Sub-Type administration (what other Document Control features rely on). */
@ExtendWith(MockitoExtension.class)
class DocumentTypeAdminServiceTest {

    @Mock DocumentTypeRepository typeRepository;
    @Mock DocumentSubTypeRepository subTypeRepository;
    @Mock DocumentRecordRepository documentRepository;
    @Mock DocumentNameFormatRepository formatRepository;
    @Mock DocumentComponentResolver componentResolver;
    @Mock AuditTrailService auditTrailService;
    @Mock CurrentUserService currentUserService;
    @Mock PermissionEvaluationService permissionEvaluationService;

    private DocumentTypeAdminService service;

    @BeforeEach
    void setUp() {
        service = new DocumentTypeAdminService(typeRepository, subTypeRepository, documentRepository, formatRepository,
                componentResolver, auditTrailService, currentUserService, permissionEvaluationService);
        lenient().when(currentUserService.requireCurrentUser()).thenReturn(new UserAccount());
        lenient().when(permissionEvaluationService.hasAnyPermission(any(), any(String[].class))).thenReturn(true);
    }

    private static DocumentTypeDictionaryRequest typeRequest(String name, String shortCode) {
        return new DocumentTypeDictionaryRequest(name, shortCode, 0, null, true, null);
    }

    @Test
    void newShortCode_withDotOrSpace_isRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.createDocumentType(typeRequest("Type A", "A.B")));
        assertThrows(IllegalArgumentException.class, () -> service.createDocumentType(typeRequest("Type A", "A B")));
        verify(typeRepository, never()).save(any());
    }

    @Test
    void overlongName_isRejectedBeforeReachingTheDatabase() {
        assertThrows(IllegalArgumentException.class,
                () -> service.createDocumentType(typeRequest("N".repeat(121), "OKC")));
        verify(typeRepository, never()).save(any());
    }

    @Test
    void usedSubType_cannotBeMovedToAnotherDocumentType() {
        UUID subTypeId = UUID.randomUUID();
        DocumentType from = new DocumentType();
        from.setId(UUID.randomUUID());
        from.setActive(true);
        DocumentType to = new DocumentType();
        to.setId(UUID.randomUUID());
        to.setActive(true);
        DocumentSubType subType = new DocumentSubType();
        subType.setName("Proc");
        subType.setDocumentType(from);
        subType.setReviewRequirement(ReviewRequirement.REQUIRED);
        when(subTypeRepository.findById(subTypeId)).thenReturn(Optional.of(subType));
        when(typeRepository.findById(to.getId())).thenReturn(Optional.of(to));
        when(subTypeRepository.findByDocumentType_IdAndNameIgnoreCase(any(), anyString())).thenReturn(Optional.empty());
        when(documentRepository.existsBySubTypeId(subTypeId)).thenReturn(true);

        assertThrows(IllegalArgumentException.class, () -> service.updateDocumentSubType(subTypeId,
                new DocumentSubTypeDictionaryRequest("Proc", to.getId().toString(), null, "REQUIRED", true)));
    }

    @Test
    void activeSubType_underInactiveDocumentType_isRejected() {
        DocumentType inactive = new DocumentType();
        inactive.setId(UUID.randomUUID());
        inactive.setActive(false);
        when(typeRepository.findById(inactive.getId())).thenReturn(Optional.of(inactive));
        when(subTypeRepository.findByDocumentType_IdAndNameIgnoreCase(any(), anyString())).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> service.createDocumentSubType(
                new DocumentSubTypeDictionaryRequest("Proc", inactive.getId().toString(), null, "REQUIRED", true)));
        verify(subTypeRepository, never()).save(any());
    }
}
