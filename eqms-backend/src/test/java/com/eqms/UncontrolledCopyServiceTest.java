package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyActionRequest;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyResponse;
import com.eqms.entity.UncontrolledCopyRecord;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.UncontrolledCopyDistributionJobItemRepository;
import com.eqms.repository.UncontrolledCopyDistributionJobRepository;
import com.eqms.repository.UncontrolledCopyRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ControlledCopyPdfMarkingService;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.ElectronicSignatureService;
import com.eqms.service.EmailNotificationService;
import com.eqms.service.FileStorageService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SodConstraintService;
import com.eqms.service.SystemActorProvider;
import com.eqms.service.UncontrolledCopyPolicyService;
import com.eqms.service.UncontrolledCopyService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.access.AccessDeniedException;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Focused rules for {@link UncontrolledCopyService}:
 * <ul>
 *   <li>Segregation of Duties -- while the system SoD constraint (request vs approve_request) is active, the
 *       requester can neither approve nor reject their own request, and the server-evaluated capabilities do not
 *       offer those actions to them. When an administrator deactivates the constraint, self-decision is allowed.</li>
 *   <li>Recipient access is keyed on the snapshot's system userId only -- never on a matching e-mail address.</li>
 * </ul>
 * Not full coverage of the service.
 */
@ExtendWith(MockitoExtension.class)
class UncontrolledCopyServiceTest {

    @Mock private UncontrolledCopyRepository uncontrolledCopyRepository;
    @Mock private UncontrolledCopyDistributionJobRepository jobRepository;
    @Mock private UncontrolledCopyDistributionJobItemRepository jobItemRepository;
    @Mock private DocumentRecordRepository documentRecordRepository;
    @Mock private DocumentRevisionRepository documentRevisionRepository;
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private CurrentUserService currentUserService;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private DocumentAuthorizationService documentAuthorizationService;
    @Mock private AuditTrailService auditTrailService;
    @Mock private ElectronicSignatureService electronicSignatureService;
    @Mock private FileStorageService fileStorageService;
    @Mock private ControlledCopyPdfMarkingService pdfMarkingService;
    @Mock private UncontrolledCopyPolicyService policyService;
    @Mock private EmailNotificationService emailNotificationService;
    @Mock private SystemActorProvider systemActorProvider;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private SodConstraintService sodConstraintService;

    @InjectMocks
    private UncontrolledCopyService service;

    private UserAccount requester;
    private UserAccount approver;
    private UncontrolledCopyRecord copy;

    @BeforeEach
    void setUp() {
        requester = user("requester@example.com", "Requester");
        approver = user("approver@example.com", "Approver");
        copy = new UncontrolledCopyRecord();
        copy.setId(UUID.randomUUID());
        copy.setUncontrolledCopyNumber("UC-SOP-001-001");
        copy.setStatusCode(UncontrolledCopyService.STATUS_REQUESTED);
        copy.setStatus("Requested");
        copy.setRequestedBy(requester);
        when(uncontrolledCopyRepository.findById(copy.getId())).thenReturn(Optional.of(copy));
        // Seeded default (V502): the self-decision SoD constraint is active. lenient: not every test reaches it.
        lenient().when(sodConstraintService.isActiveConstraint(
                UncontrolledCopyService.P_REQUEST, UncontrolledCopyService.P_APPROVE)).thenReturn(true);
    }

    private void deactivateSelfDecisionConstraint() {
        lenient().when(sodConstraintService.isActiveConstraint(
                UncontrolledCopyService.P_REQUEST, UncontrolledCopyService.P_APPROVE)).thenReturn(false);
    }

    private static UserAccount user(String email, String name) {
        UserAccount account = new UserAccount();
        account.setId(UUID.randomUUID());
        account.setEmail(email);
        account.setFullName(name);
        return account;
    }

    private void actAs(UserAccount actor, String... permissions) {
        when(currentUserService.requireCurrentUser()).thenReturn(actor);
        // lenient: the service also asks about other permission codes (unstubbed -> false), which strict stubbing
        // would otherwise report as an argument mismatch.
        for (String permission : permissions) {
            lenient().when(permissionEvaluationService.hasPermission(actor, permission)).thenReturn(true);
        }
    }

    private static UncontrolledCopyActionRequest action(String reason) {
        return new UncontrolledCopyActionRequest(reason, "signature-token");
    }

    // ---------------------------------------------------------------------------------------------------------
    // Segregation of Duties
    // ---------------------------------------------------------------------------------------------------------

    @Test
    void approveRequest_byRequester_isRejected_andNothingIsSignedOrSaved() {
        actAs(requester, UncontrolledCopyService.P_APPROVE);

        AccessDeniedException ex = assertThrows(AccessDeniedException.class,
                () -> service.approveRequest(copy.getId(), action("ok")));

        assertEquals("You cannot approve your own uncontrolled copy request.", ex.getMessage());
        assertEquals(UncontrolledCopyService.STATUS_REQUESTED, copy.getStatusCode());
        assertNull(copy.getApprovedBy());
        verify(uncontrolledCopyRepository, never()).saveAndFlush(any());
        verifyNoInteractions(electronicSignatureService, auditTrailService);
    }

    @Test
    void rejectRequest_byRequester_isRejected_andNothingIsSignedOrSaved() {
        actAs(requester, UncontrolledCopyService.P_REJECT);

        AccessDeniedException ex = assertThrows(AccessDeniedException.class,
                () -> service.rejectRequest(copy.getId(), action("no")));

        assertTrue(ex.getMessage().startsWith("You cannot reject your own uncontrolled copy request."));
        assertEquals(UncontrolledCopyService.STATUS_REQUESTED, copy.getStatusCode());
        verify(uncontrolledCopyRepository, never()).saveAndFlush(any());
        verifyNoInteractions(electronicSignatureService, auditTrailService);
    }

    @Test
    void approveRequest_byAnotherUser_approves_andSigns() {
        actAs(approver, UncontrolledCopyService.P_APPROVE);

        UncontrolledCopyResponse response = service.approveRequest(copy.getId(), action("Looks fine"));

        assertEquals(UncontrolledCopyService.STATUS_APPROVED, copy.getStatusCode());
        assertSame(approver, copy.getApprovedBy());
        assertEquals(UncontrolledCopyService.STATUS_APPROVED, response.statusCode());
        verify(uncontrolledCopyRepository).saveAndFlush(copy);
        verify(electronicSignatureService).createEntitySignature(eq("UncontrolledCopyRecord"), eq(copy.getId()), any(), eq(approver),
                eq("signature-token"), eq("UNCONTROLLED_COPY_APPROVED"), any(), any(), any(), any());
    }

    @Test
    void capabilities_neverOfferApproveOrReject_toTheRequester() {
        actAs(requester, UncontrolledCopyService.P_APPROVE, UncontrolledCopyService.P_REJECT);

        UncontrolledCopyResponse response = service.getDetail(copy.getId());

        assertFalse(response.capabilities().canApprove());
        assertFalse(response.capabilities().canReject());
    }

    @Test
    void approveRequest_byRequester_isAllowed_whenSodConstraintIsInactive() {
        deactivateSelfDecisionConstraint();
        actAs(requester, UncontrolledCopyService.P_APPROVE);

        UncontrolledCopyResponse response = service.approveRequest(copy.getId(), action("Self-approved"));

        assertEquals(UncontrolledCopyService.STATUS_APPROVED, copy.getStatusCode());
        assertSame(requester, copy.getApprovedBy());
        assertEquals(UncontrolledCopyService.STATUS_APPROVED, response.statusCode());
        verify(sodConstraintService, atLeastOnce()).isActiveConstraint(
                UncontrolledCopyService.P_REQUEST, UncontrolledCopyService.P_APPROVE);
        verify(electronicSignatureService).createEntitySignature(eq("UncontrolledCopyRecord"), eq(copy.getId()), any(), eq(requester),
                eq("signature-token"), eq("UNCONTROLLED_COPY_APPROVED"), any(), any(), any(), any());
    }

    @Test
    void rejectRequest_byRequester_isAllowed_whenSodConstraintIsInactive() {
        deactivateSelfDecisionConstraint();
        actAs(requester, UncontrolledCopyService.P_REJECT);

        service.rejectRequest(copy.getId(), action("Not needed any more"));

        assertEquals(UncontrolledCopyService.STATUS_REJECTED, copy.getStatusCode());
        assertSame(requester, copy.getRejectedBy());
        verify(uncontrolledCopyRepository).saveAndFlush(copy);
    }

    @Test
    void capabilities_offerApproveAndReject_toTheRequester_whenSodConstraintIsInactive() {
        deactivateSelfDecisionConstraint();
        actAs(requester, UncontrolledCopyService.P_APPROVE, UncontrolledCopyService.P_REJECT);

        UncontrolledCopyResponse response = service.getDetail(copy.getId());

        assertTrue(response.capabilities().canApprove());
        assertTrue(response.capabilities().canReject());
    }

    @Test
    void approveRequest_byAnotherUser_doesNotDependOnSodConstraint() {
        actAs(approver, UncontrolledCopyService.P_APPROVE);

        service.approveRequest(copy.getId(), action("ok"));

        verify(sodConstraintService, never()).isActiveConstraint(anyString(), anyString());
    }

    // ---------------------------------------------------------------------------------------------------------
    // Recipient identity: system userId only, never an e-mail match
    // ---------------------------------------------------------------------------------------------------------

    @Test
    void recipientAccess_isNotGrantedByMatchingEmail() {
        // A legacy/free-text snapshot with only an e-mail: an account that happens to share it gets nothing.
        UserAccount sameEmail = user("outsider@example.com", "Someone Else");
        ObjectNode snapshot = new ObjectMapper().createObjectNode()
                .put("type", "EXTERNAL")
                .put("name", "outsider@example.com")
                .put("email", "outsider@example.com");
        copy.setRecipientSnapshot(snapshot);
        actAs(sameEmail);

        assertThrows(AccessDeniedException.class, () -> service.getDetail(copy.getId()));
    }

    @Test
    void recipientAccess_isGrantedToTheExactRecipientUserId() {
        UserAccount holder = user("holder@example.com", "Holder");
        ObjectNode snapshot = new ObjectMapper().createObjectNode()
                .put("type", "EXTERNAL_HANDOVER")
                .put("userId", holder.getId().toString())
                .put("name", "Holder")
                .put("email", "holder@example.com")
                .put("externalRecipient", "J. Smith, ACME auditor");
        copy.setRecipientSnapshot(snapshot);
        actAs(holder);

        UncontrolledCopyResponse response = service.getDetail(copy.getId());

        assertEquals("J. Smith, ACME auditor", response.externalRecipient());
        assertEquals("holder@example.com", response.recipientEmail());
    }
}
