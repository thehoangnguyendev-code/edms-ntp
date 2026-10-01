package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.executedrecord.EformSignerAssignmentResponse;
import com.eqms.dto.executedrecord.UpdateEformSignerAssignmentsRequest;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.EformSignerAssignment;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.EformSignerAssignmentRepository;
import com.eqms.repository.UserAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Discovering and assigning the sequential signer chain for ONE electronic Controlled Copy
 * distribution (see the approved plan "Form / eForm -- Phase 2b"). Configured by the DCO on a
 * dedicated screen at the Controlled Copy's "Ready for Distribution" step, before clicking
 * Distribute -- {@code ControlledCopyService#distribute} refuses to proceed for an ELECTRONIC copy
 * until every scanned role has an assignment. Replaces V517's per-Form standing role list: a
 * Form's Controlled Copy goes to different people on different occasions, so this is decided per
 * occasion, not fixed once.
 */
@Service
public class EformSignerAssignmentService {

    private static final String STATUS_READY_FOR_DISTRIBUTION = "READY_FOR_DISTRIBUTION";

    private final EformSignerAssignmentRepository repository;
    private final ControlledCopyRepository controlledCopyRepository;
    private final DocumentRevisionRepository documentRevisionRepository;
    private final UserAccountRepository userAccountRepository;
    private final CurrentUserService currentUserService;
    private final ControlledCopyAuthorizationService controlledCopyAuthorizationService;
    private final DocumentAuthorizationService documentAuthorizationService;
    private final AuditTrailService auditTrailService;
    private final FileStorageService fileStorageService;
    private final EformFieldScanService eformFieldScanService;

    public EformSignerAssignmentService(
            EformSignerAssignmentRepository repository,
            ControlledCopyRepository controlledCopyRepository,
            DocumentRevisionRepository documentRevisionRepository,
            UserAccountRepository userAccountRepository,
            CurrentUserService currentUserService,
            ControlledCopyAuthorizationService controlledCopyAuthorizationService,
            DocumentAuthorizationService documentAuthorizationService,
            AuditTrailService auditTrailService,
            FileStorageService fileStorageService,
            EformFieldScanService eformFieldScanService
    ) {
        this.repository = repository;
        this.controlledCopyRepository = controlledCopyRepository;
        this.documentRevisionRepository = documentRevisionRepository;
        this.userAccountRepository = userAccountRepository;
        this.currentUserService = currentUserService;
        this.controlledCopyAuthorizationService = controlledCopyAuthorizationService;
        this.documentAuthorizationService = documentAuthorizationService;
        this.auditTrailService = auditTrailService;
        this.fileStorageService = fileStorageService;
        this.eformFieldScanService = eformFieldScanService;
    }

    /** Scans the Form's committed fillable template for OnlyOffice Role names -- the signer roles
     *  the DCO needs to assign a person + order to for this copy. */
    @Transactional(readOnly = true)
    public List<String> scanRoleNames(UUID controlledCopyId) {
        ControlledCopyRecord copy = requireElectronicCopy(controlledCopyId);
        DocumentRevisionRecord effective = documentRevisionRepository
                .findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(copy.getDocument().getId(), "EFFECTIVE")
                .orElseThrow(() -> new IllegalStateException("This Form has no Effective revision."));
        if (!StringUtils.hasText(effective.getFillableTemplateStorageObjectKey())) {
            throw new IllegalStateException("Ask an Author to design this Form's fields first.");
        }
        try (InputStream templateFile = fileStorageService.openStoredFile(effective.getFillableTemplateStorageObjectKey())) {
            return eformFieldScanService.scanRoleNames(templateFile.readAllBytes());
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to read this Form's fillable template to scan for signer roles.", ex);
        }
    }

    @Transactional(readOnly = true)
    public List<EformSignerAssignmentResponse> list(UUID controlledCopyId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyRecord copy = requireControlledCopy(controlledCopyId);
        documentAuthorizationService.requireCanViewDocument(currentUser, copy.getDocument());
        return repository.findAllByControlledCopy_IdOrderBySequenceAsc(controlledCopyId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public List<EformSignerAssignmentResponse> update(UUID controlledCopyId, UpdateEformSignerAssignmentsRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyRecord copy = requireElectronicCopy(controlledCopyId);
        // Same permission/status gate as the Distribute action itself -- assigning signers is
        // part of that same workflow step, just configured before the final click.
        controlledCopyAuthorizationService.requireDistributeControlledCopy(currentUser, copy);
        if (!STATUS_READY_FOR_DISTRIBUTION.equalsIgnoreCase(copy.getStatusCode())) {
            throw new IllegalStateException("Signers can only be assigned while this copy is Ready for Distribution.");
        }

        List<EformSignerAssignment> existing = repository.findAllByControlledCopy_IdOrderBySequenceAsc(controlledCopyId);
        String from = describe(existing);

        List<UpdateEformSignerAssignmentsRequest.Item> items = request.assignments() == null ? List.of() : request.assignments();
        for (UpdateEformSignerAssignmentsRequest.Item item : items) {
            if (!StringUtils.hasText(item.roleName()) || !StringUtils.hasText(item.assignedUserId())) {
                throw new IllegalArgumentException("Each role assignment needs a role name and an assigned user");
            }
            if (item.sequence() < 1) {
                throw new IllegalArgumentException("Signing order must be 1 or higher");
            }
        }
        long distinctRoles = items.stream().map(i -> i.roleName().trim()).distinct().count();
        if (distinctRoles != items.size()) {
            throw new IllegalArgumentException("Each role may only be assigned once");
        }
        long distinctSequences = items.stream().map(UpdateEformSignerAssignmentsRequest.Item::sequence).distinct().count();
        if (distinctSequences != items.size()) {
            throw new IllegalArgumentException("Each role must have its own distinct position in the signing order");
        }

        repository.deleteAll(existing);
        repository.flush();

        List<EformSignerAssignment> saved = new ArrayList<>();
        for (UpdateEformSignerAssignmentsRequest.Item item : items) {
            UserAccount assignedUser = userAccountRepository.findById(parseUuid(item.assignedUserId()))
                    .orElseThrow(() -> new IllegalArgumentException("Assigned user not found: " + item.assignedUserId()));
            EformSignerAssignment assignment = new EformSignerAssignment();
            assignment.setId(UUID.randomUUID());
            assignment.setControlledCopy(copy);
            assignment.setRoleName(item.roleName().trim());
            assignment.setAssignedUser(assignedUser);
            assignment.setSequence(item.sequence());
            saved.add(repository.save(assignment));
        }
        saved.sort((a, b) -> Integer.compare(a.getSequence(), b.getSequence()));

        String to = describe(saved);
        auditTrailService.logAs(currentUser, "EFORM_SIGNER_ASSIGNMENT", copy.getControlledCopyNumber(), copy.getId(),
                "UPDATE", from, to, null, List.of(), null);

        return saved.stream().map(this::toResponse).toList();
    }

    /** Used by {@code ControlledCopyService#distribute} -- refuses an ELECTRONIC distribution
     *  unless every scanned Role has an assignment. */
    @Transactional(readOnly = true)
    public void requireFullyAssignedOrThrow(UUID controlledCopyId) {
        List<String> scanned = scanRoleNames(controlledCopyId);
        if (scanned.isEmpty()) {
            return;
        }
        List<EformSignerAssignment> assigned = repository.findAllByControlledCopy_IdOrderBySequenceAsc(controlledCopyId);
        List<String> missing = scanned.stream()
                .filter(role -> assigned.stream().noneMatch(a -> a.getRoleName().equalsIgnoreCase(role)))
                .toList();
        if (!missing.isEmpty()) {
            throw new IllegalStateException("Assign a signer for every role before distributing: " + String.join(", ", missing));
        }
    }

    private EformSignerAssignmentResponse toResponse(EformSignerAssignment assignment) {
        return new EformSignerAssignmentResponse(
                assignment.getRoleName(),
                assignment.getAssignedUser().getId().toString(),
                assignment.getAssignedUser().getFullName(),
                assignment.getSequence());
    }

    private String describe(List<EformSignerAssignment> assignments) {
        if (assignments.isEmpty()) {
            return "none";
        }
        return assignments.stream()
                .map(a -> a.getSequence() + ":" + a.getRoleName() + "=" + a.getAssignedUser().getFullName())
                .reduce((a, b) -> a + ", " + b)
                .orElse("none");
    }

    private UUID parseUuid(String value) {
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid user id: " + value);
        }
    }

    private ControlledCopyRecord requireControlledCopy(UUID controlledCopyId) {
        if (controlledCopyId == null) {
            throw new IllegalArgumentException("Controlled Copy not found");
        }
        return controlledCopyRepository.findById(controlledCopyId)
                .orElseThrow(() -> new IllegalArgumentException("Controlled Copy not found"));
    }

    private ControlledCopyRecord requireElectronicCopy(UUID controlledCopyId) {
        ControlledCopyRecord copy = requireControlledCopy(controlledCopyId);
        if (!"ELECTRONIC".equals(copy.getDeliveryMode())) {
            throw new IllegalStateException("This Controlled Copy is not an electronic distribution.");
        }
        return copy;
    }
}
