package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.auth.TokenService;
import com.eqms.dto.user.DocumentAdministrationRequest;
import com.eqms.entity.DocumentWorkflowSetting;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserAccount;
import com.eqms.repository.*;
import com.eqms.service.*;
import com.eqms.service.authorization.AuthorizationEngineService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The Document Revision Integrity rules decide who may review and approve a revision, so changing them is a signed action.
 * Before this change the screen asked for a signature but the server never checked it (found 2026-11-19).
 */
@ExtendWith(MockitoExtension.class)
class UserManagementServiceDocumentRulesSignatureTest {

    @Mock private UserAccountRepository userRepository;
    @Mock private UserEducationRepository educationRepository;
    @Mock private UserCertificationRepository certificationRepository;
    @Mock private BusinessUnitRepository businessUnitRepository;
    @Mock private DepartmentRepository departmentRepository;
    @Mock private PositionRepository positionRepository;
    @Mock private UserLanguageRepository userLanguageRepository;
    @Mock private RoleDefinitionRepository roleRepository;
    @Mock private PermissionRepository permissionRepository;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private DocumentWorkflowSettingRepository documentWorkflowSettingRepository;
    @Mock private AuthSessionRepository sessionRepository;
    @Mock private AuthAuditService auditService;
    @Mock private CurrentUserService currentUserService;
    @Mock private TokenService tokenService;
    @Mock private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    @Mock private AuditTrailService auditTrailService;
    @Mock private SystemConfigurationService systemConfigurationService;
    @Mock private FileStorageService fileStorageService;
    @Mock private AuthorizationEngineService authorizationEngineService;
    @Mock private NotificationDispatcher notificationDispatcher;
    @Mock private EmailService emailService;
    @Mock private WorkflowActionPolicyRepository workflowActionPolicyRepository;
    @Mock private LifecycleStatePolicyRepository lifecycleStatePolicyRepository;
    @Mock private UserAccessProfileRepository userAccessProfileRepository;
    @Mock private SodConstraintService sodConstraintService;
    @Mock private SecurityChangeSignatureService securityChangeSignatureService;
    @Mock private HttpServletRequest httpRequest;

    private UserManagementService service;
    private UserAccount actor;
    private DocumentWorkflowSetting setting;

    @BeforeEach
    void setUp() {
        service = new UserManagementService(
                userRepository, educationRepository, certificationRepository, businessUnitRepository,
                departmentRepository, positionRepository, userLanguageRepository, roleRepository,
                permissionRepository, permissionEvaluationService,
                documentWorkflowSettingRepository, sessionRepository,
                auditService, currentUserService, tokenService, passwordEncoder, auditTrailService,
                systemConfigurationService, fileStorageService,
                authorizationEngineService, notificationDispatcher, emailService,
                workflowActionPolicyRepository, lifecycleStatePolicyRepository,
                userAccessProfileRepository, sodConstraintService);
        ReflectionTestUtils.setField(service, "securityChangeSignatureService", securityChangeSignatureService);
        actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        setting = new DocumentWorkflowSetting();
        when(currentUserService.requireCurrentUser()).thenReturn(actor);
    }

    private static DocumentAdministrationRequest everythingOn(String token) {
        return new DocumentAdministrationRequest(true, true, true, true, true, true, "tighten the rules", token);
    }

    @Test
    void anUnsignedSaveIsRefusedAndChangesNothing() {
        org.mockito.Mockito.doThrow(new AccessDeniedException("Electronic signature is required for this security change"))
                .when(securityChangeSignatureService).requireValidToken(actor, null);

        assertThrows(AccessDeniedException.class, () -> service.updateDocumentAdministration(everythingOn(null), httpRequest));

        assertFalse(setting.isAuthorCannotBeReviewerOrApprover(), "the rule must stay as it was");
        verify(documentWorkflowSettingRepository, never()).findFirstByOrderByIdAsc();
        verify(securityChangeSignatureService, never()).record(any(), any(), anyString(), anyString(), any(), anyString(), any(), any(), any());
        verify(auditTrailService, never()).logAs(any(), anyString(), anyString(), any(), anyString(), any(), any(), any(), any(), any());
    }

    @Test
    void aSignatureOfAnotherPersonIsRefusedAndChangesNothing() {
        org.mockito.Mockito.doThrow(new AccessDeniedException("Electronic signature does not belong to the current user"))
                .when(securityChangeSignatureService).requireValidToken(actor, "someone-elses-token");

        assertThrows(AccessDeniedException.class, () -> service.updateDocumentAdministration(everythingOn("someone-elses-token"), httpRequest));

        verify(documentWorkflowSettingRepository, never()).findFirstByOrderByIdAsc();
        verify(auditTrailService, never()).logAs(any(), anyString(), anyString(), any(), anyString(), any(), any(), any(), any(), any());
    }

    @Test
    void aSignedSaveChangesTheRulesRecordsTheSignatureAndLinksItToTheAuditEntry() {
        when(documentWorkflowSettingRepository.findFirstByOrderByIdAsc()).thenReturn(Optional.of(setting));
        ElectronicSignature signature = org.mockito.Mockito.mock(ElectronicSignature.class);
        UUID signatureId = UUID.randomUUID();
        when(signature.getId()).thenReturn(signatureId);
        when(securityChangeSignatureService.record(eq(actor), eq("good-token"),
                eq(SecurityChangeSignatureService.MEANING_SOD_RULE_CHANGE), eq("DOCUMENT_WORKFLOW_SETTING"), any(), anyString(), eq("tighten the rules"), any(), any()))
                .thenReturn(signature);

        service.updateDocumentAdministration(everythingOn("good-token"), httpRequest);

        verify(securityChangeSignatureService).requireValidToken(actor, "good-token");
        assertTrue(setting.isAuthorCannotBeReviewerOrApprover());
        assertTrue(setting.isReviewerAndApproverDifferentDepartments());
        verify(auditTrailService).logAs(eq(actor), eq("SYSTEM_CONFIGURATION"), eq("Document Workflow Settings"), any(),
                eq("DOCUMENT_ADMINISTRATION_UPDATED"), any(), any(), anyString(), any(), eq(signatureId));
    }
}
