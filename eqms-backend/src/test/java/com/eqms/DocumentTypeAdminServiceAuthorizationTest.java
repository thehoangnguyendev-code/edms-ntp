package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.dictionary.DocumentSubTypeDictionaryRequest;
import com.eqms.dto.dictionary.DocumentTypeDictionaryRequest;
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
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Document Types / Sub-Types administration (Document Control module's "Document Administration"
 * area) -- moved out of {@code DictionaryManagementServiceAuthorizationTest} together with the
 * underlying service logic (see {@link DocumentTypeAdminService}). Gated by their own
 * {@code documents.admin.document_types.*} permission pair, split out of the old catch-all
 * {@code documents.admin.*} family so an Access Profile can delegate this screen without also
 * granting Publishing Templates, Controlled Copies Policy, etc.
 *
 * The unpaginated "give me the full active list" reads back ordinary document-creation dropdowns,
 * not the Document Administration admin screen, so they carry no permission gate at all.
 */
@ExtendWith(MockitoExtension.class)
class DocumentTypeAdminServiceAuthorizationTest {

    @Mock private DocumentTypeRepository documentTypeRepository;
    @Mock private DocumentSubTypeRepository documentSubTypeRepository;
    @Mock private DocumentRecordRepository documentRecordRepository;
    @Mock private DocumentNameFormatRepository documentNameFormatRepository;
    @Mock private DocumentComponentResolver documentComponentResolver;
    @Mock private AuditTrailService auditTrailService;
    @Mock private CurrentUserService currentUserService;
    @Mock private PermissionEvaluationService permissionEvaluationService;

    @InjectMocks
    private DocumentTypeAdminService service;

    private UserAccount actor;

    @BeforeEach
    void setUp() {
        actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        // lenient: the unpaginated "no permission gate" reads never call requireCurrentUser().
        lenient().when(currentUserService.requireCurrentUser()).thenReturn(actor);
    }

    private void denyManage() {
        when(permissionEvaluationService.hasAnyPermission(actor, "documents.admin.document_types.manage", "settings.configuration.manage"))
                .thenReturn(false);
    }

    @Test
    void listDocumentTypes_hasNoPermissionGate_alwaysAllowed() {
        when(documentTypeRepository.findAllByOrderByNameAsc()).thenReturn(List.of());
        when(documentRecordRepository.findMaxDocumentSequencesByPrefix()).thenReturn(List.of());
        assertDoesNotThrow(() -> service.listDocumentTypes());
        verify(documentTypeRepository).findAllByOrderByNameAsc();
        verifyNoInteractions(permissionEvaluationService);
    }

    @Test
    void listDocumentSubTypes_hasNoPermissionGate_alwaysAllowed() {
        when(documentSubTypeRepository.findAllByOrderByNameAsc()).thenReturn(List.of());
        assertDoesNotThrow(() -> service.listDocumentSubTypes());
        verify(documentSubTypeRepository).findAllByOrderByNameAsc();
        verifyNoInteractions(permissionEvaluationService);
    }

    @Test
    void createDocumentType_withoutManage_isDenied() {
        denyManage();
        assertThrows(AccessDeniedException.class, () ->
                service.createDocumentType(new DocumentTypeDictionaryRequest("SOP", "SOP", 0, null, true, null)));
        verifyNoInteractions(documentTypeRepository);
    }

    @Test
    void updateDocumentType_withoutManage_isDenied() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () ->
                service.updateDocumentType(id, new DocumentTypeDictionaryRequest("SOP", "SOP", 0, null, true, null)));
        verifyNoInteractions(documentTypeRepository);
    }

    @Test
    void createDocumentSubType_withoutManage_isDenied() {
        denyManage();
        assertThrows(AccessDeniedException.class, () ->
                service.createDocumentSubType(new DocumentSubTypeDictionaryRequest("Sub", UUID.randomUUID().toString(), null, true)));
        verifyNoInteractions(documentTypeRepository, documentSubTypeRepository);
    }

    @Test
    void updateDocumentSubType_withoutManage_isDenied() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () ->
                service.updateDocumentSubType(id, new DocumentSubTypeDictionaryRequest("Sub", UUID.randomUUID().toString(), null, true)));
        verifyNoInteractions(documentSubTypeRepository);
    }
}
