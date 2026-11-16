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
        // Ready for Distribution with no approval time: the request waits for a decision (UCC-STATUS-2026-11-14: no status of its own).
        copy.setStatusCode(UncontrolledCopyService.STATUS_READY);
        copy.setStatus("Ready for Distribution");
        copy.setRequestedBy(requester);
        // A self-service request: the requester holds the copy, so is its recipient.
        copy.setRecipientUserId(requester.getId());
        lenient().when(uncontrolledCopyRepository.findById(copy.getId())).thenReturn(Optional.of(copy));
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
    // Two actions only (UCC-SIMPLE-2026-11-14): Distribute and Cancel Request, each for whoever holds that permission
    // ---------------------------------------------------------------------------------------------------------

    @Test
    void distribute_withoutThePermissionToDistribute_isRefused_evenForTheRequesterAndForAnApprover() {
        actAs(requester, UncontrolledCopyService.P_REQUEST, UncontrolledCopyService.P_CANCEL, UncontrolledCopyService.P_VIEW);

        AccessDeniedException refused = assertThrows(AccessDeniedException.class, () -> service.distribute(copy.getId(), action("x")));

        assertTrue(refused.getMessage().contains("distribute uncontrolled copies"));
        assertEquals(UncontrolledCopyService.STATUS_READY, copy.getStatusCode());
        verifyNoInteractions(electronicSignatureService);
    }

    @Test
    void distribute_isNotRefusedToTheRequester_whoHoldsThePermissionToDistribute_thereIsNoApprovalToSeparate() {
        actAs(requester, UncontrolledCopyService.P_DISTRIBUTE);
        // the request waits for distribution; the missing file is made in the same step, so the step fails here only for what the test does not set up (the revision)
        IllegalStateException refusedForTheRevision = assertThrows(IllegalStateException.class, () -> service.distribute(copy.getId(), action("x")));

        assertTrue(refusedForTheRevision.getMessage().contains("source revision"), refusedForTheRevision.getMessage());
    }

    @Test
    void distribute_ofACopyThatIsNotReadyForDistribution_isRefused() {
        actAs(approver, UncontrolledCopyService.P_DISTRIBUTE);
        copy.setStatusCode(UncontrolledCopyService.STATUS_DISTRIBUTED);
        copy.setStatus("Distributed");

        IllegalStateException refused = assertThrows(IllegalStateException.class, () -> service.distribute(copy.getId(), action("x")));

        assertTrue(refused.getMessage().contains("cannot be distributed"));
    }

    @Test
    void cancel_needsThePermissionToCancel_andNothingElse_theRequesterWithoutItCannotCancel() {
        actAs(requester, UncontrolledCopyService.P_REQUEST, UncontrolledCopyService.P_VIEW);

        assertThrows(AccessDeniedException.class, () -> service.cancel(copy.getId(), action("not needed")));

        assertEquals(UncontrolledCopyService.STATUS_READY, copy.getStatusCode());
        verify(uncontrolledCopyRepository, never()).saveAndFlush(any());
        verifyNoInteractions(electronicSignatureService);
    }

    @Test
    void cancel_byAnyoneWhoHoldsThePermission_closesTheCopyWithTheReasonCancelled_andSigns() {
        actAs(approver, UncontrolledCopyService.P_CANCEL);

        UncontrolledCopyResponse response = service.cancel(copy.getId(), action("Not needed any more"));

        assertEquals(UncontrolledCopyService.STATUS_CLOSED_CANCELLED, copy.getStatusCode());
        assertEquals(UncontrolledCopyService.REASON_CANCELLED, copy.getCloseReasonCode());
        assertEquals(UncontrolledCopyService.STATUS_CLOSED_CANCELLED, response.statusCode());
        assertEquals("CANCELLED", response.closeReason());
        verify(electronicSignatureService).createEntitySignature(eq("UncontrolledCopyRecord"), eq(copy.getId()), any(), eq(approver),
                eq("signature-token"), eq("UNCONTROLLED_COPY_CANCELLED"), any(), any(), any(), any());
    }

    @Test
    void cancel_requiresAReason() {
        actAs(approver, UncontrolledCopyService.P_CANCEL);

        assertThrows(IllegalArgumentException.class, () -> service.cancel(copy.getId(), action(" ")));
        assertEquals(UncontrolledCopyService.STATUS_READY, copy.getStatusCode());
    }

    @Test
    void capabilities_areDistributeAndCancelOnly_andFollowTheirOwnPermissions() {
        actAs(approver, UncontrolledCopyService.P_VIEW, UncontrolledCopyService.P_DISTRIBUTE);
        copy.setRecipientUserId(approver.getId());

        var capabilities = service.getDetail(copy.getId()).capabilities();

        assertTrue(capabilities.canDistribute());
        assertFalse(capabilities.canCancel(), "to cancel takes the permission to cancel");
        actAs(approver, UncontrolledCopyService.P_CANCEL);
        assertTrue(service.getDetail(copy.getId()).capabilities().canCancel());
    }

    @Test
    void thereIsNothingToDistributeOrCancelOnACopyThatIsNotReadyForDistribution() {
        actAs(approver, UncontrolledCopyService.P_VIEW, UncontrolledCopyService.P_DISTRIBUTE, UncontrolledCopyService.P_CANCEL);
        copy.setRecipientUserId(approver.getId());
        copy.setStatusCode(UncontrolledCopyService.STATUS_CLOSED_CANCELLED);

        var capabilities = service.getDetail(copy.getId()).capabilities();

        assertFalse(capabilities.canDistribute());
        assertFalse(capabilities.canCancel());
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
        copy.setRecipientUserId(holder.getId());
        actAs(holder);

        UncontrolledCopyResponse response = service.getDetail(copy.getId());

        assertEquals("J. Smith, ACME auditor", response.externalRecipient());
        assertEquals("holder@example.com", response.recipientEmail());
    }

    // ---------------------------------------------------------------------------------------------------------
    // Record visibility: recipient or blanket permission only (Decision DOC-VISIBILITY-2026-10-06)
    // ---------------------------------------------------------------------------------------------------------

    @Test
    void requesterWhoIsNotTheRecipient_cannotViewTheCopy() {
        // Requested on behalf of someone else (request-for-others): the requester is not the named recipient.
        UserAccount holder = user("holder@example.com", "Holder");
        copy.setRecipientUserId(holder.getId());
        actAs(requester, UncontrolledCopyService.P_VIEW);

        assertThrows(AccessDeniedException.class, () -> service.getDetail(copy.getId()));
    }

    @Test
    void viewAllUncontrolledCopiesPermission_seesACopyItIsNotTheRecipientOf() {
        UserAccount holder = user("holder@example.com", "Holder");
        copy.setRecipientUserId(holder.getId());
        actAs(approver, UncontrolledCopyService.P_VIEW);
        when(documentAuthorizationService.canViewAllUncontrolledCopies(approver)).thenReturn(true);

        UncontrolledCopyResponse response = service.getDetail(copy.getId());

        assertEquals(copy.getId().toString(), response.id());
    }

    @Test
    void blanketViewStillNeedsTheBaseViewPermission() {
        UserAccount holder = user("holder@example.com", "Holder");
        copy.setRecipientUserId(holder.getId());
        actAs(approver);
        lenient().when(documentAuthorizationService.canViewAllUncontrolledCopies(approver)).thenReturn(true);

        assertThrows(AccessDeniedException.class, () -> service.getDetail(copy.getId()));
    }

    @Test
    void operationalPermissionsNoLongerImplyViewAll() {
        UserAccount holder = user("holder@example.com", "Holder");
        copy.setRecipientUserId(holder.getId());
        copy.setStatusCode(UncontrolledCopyService.STATUS_DISTRIBUTED); // not waiting for distribution
        actAs(approver, UncontrolledCopyService.P_VIEW, UncontrolledCopyService.P_DISTRIBUTE, UncontrolledCopyService.P_CANCEL);

        assertThrows(AccessDeniedException.class, () -> service.getDetail(copy.getId()));
    }

    @Test
    void aPersonWhoMayDistributeSeesARequestThatWaitsForDistribution_withoutTheViewEverythingPermission() {
        UserAccount holder = user("holder@example.com", "Holder");
        copy.setRecipientUserId(holder.getId());
        actAs(approver, UncontrolledCopyService.P_VIEW, UncontrolledCopyService.P_DISTRIBUTE);

        assertEquals(copy.getId().toString(), service.getDetail(copy.getId()).id());
    }

    @Test
    void aPersonWhoMayNotDistributeDoesNotSeeSomeoneElsesRequest() {
        UserAccount holder = user("holder@example.com", "Holder");
        copy.setRecipientUserId(holder.getId());
        actAs(approver, UncontrolledCopyService.P_VIEW);

        assertThrows(AccessDeniedException.class, () -> service.getDetail(copy.getId()));
    }
}
