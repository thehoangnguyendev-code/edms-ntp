package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.esignature.ElectronicSignatureRecordResponse;
import com.eqms.dto.esignature.ElectronicSignatureSettingsRequest;
import com.eqms.dto.esignature.ElectronicSignatureSettingsResponse;
import com.eqms.dto.esignature.ElectronicSignatureTimestampPreviewRequest;
import com.eqms.dto.esignature.ElectronicSignatureTimestampPreviewResponse;
import com.eqms.dto.esignature.ElectronicSignatureMeaningResponse;
import com.eqms.service.ElectronicSignaturePdfPreviewService;
import com.eqms.service.ElectronicSignatureService;
import com.eqms.service.PermissionEvaluationService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping
public class ElectronicSignatureSettingsController {

    private final ElectronicSignatureService electronicSignatureService;
    private final ElectronicSignaturePdfPreviewService pdfPreviewService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;

    public ElectronicSignatureSettingsController(
            ElectronicSignatureService electronicSignatureService,
            ElectronicSignaturePdfPreviewService pdfPreviewService,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService
    ) {
        this.electronicSignatureService = electronicSignatureService;
        this.pdfPreviewService = pdfPreviewService;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    @GetMapping("/settings/electronic-signature")
    public ResponseEntity<ElectronicSignatureSettingsResponse> getSettings() {
        requireAdminView();
        return ResponseEntity.ok(electronicSignatureService.getSettings());
    }

    @PutMapping("/settings/electronic-signature")
    public ResponseEntity<ElectronicSignatureSettingsResponse> saveSettings(@RequestBody ElectronicSignatureSettingsRequest request) {
        requireAdminManage();
        return ResponseEntity.ok(electronicSignatureService.saveSettings(request));
    }

    @GetMapping("/electronic-signature/meanings/{code}")
    public ResponseEntity<ElectronicSignatureMeaningResponse> getMeaningPolicy(@PathVariable String code) {
        // Meaning policies contain no credentials or secrets; they are exposed to
        // authenticated users so the signing dialog matches server validation.
        currentUserService.requireCurrentUser();
        ElectronicSignatureMeaningResponse policy = electronicSignatureService.getMeaningPolicy(code);
        return policy == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(policy);
    }

    @PostMapping("/settings/electronic-signature/timestamp-preview")
    public ResponseEntity<ElectronicSignatureTimestampPreviewResponse> previewTimestamp(@RequestBody ElectronicSignatureTimestampPreviewRequest request) {
        requireAdminView();
        return ResponseEntity.ok(new ElectronicSignatureTimestampPreviewResponse(electronicSignatureService.previewTimestamp(
                request == null ? null : request.signatureTimestampFormat(),
                request == null ? null : request.signatureTimezone())));
    }

    @GetMapping("/settings/electronic-signature/pdf-preview")
    public ResponseEntity<byte[]> generatePdfPreview() throws Exception {
        requireAdminView();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfPreviewService.generatePdfPreview());
    }

    @GetMapping("/revisions/{id}/electronic-signatures")
    public ResponseEntity<List<ElectronicSignatureRecordResponse>> getRevisionElectronicSignatures(@PathVariable UUID id) {
        requireRevisionViewAccess();
        return ResponseEntity.ok(electronicSignatureService.getRevisionSignatures(id));
    }

    private void requireRevisionViewAccess() {
        var user = currentUserService.requireCurrentUser();
        boolean allowed = permissionEvaluationService.hasAnyPermission(user,
                "documents.module.view", "documents.document.view", "documents.admin.view",
                "documents.revision.review", "documents.revision.approve");
        if (!allowed) throw new AccessDeniedException("Current user is not allowed to view revision signatures");
    }

    private void requireAdminView() {
        var user = currentUserService.requireCurrentUser();
        boolean allowed = permissionEvaluationService.hasPermission(user, "settings.configuration.view")
                || permissionEvaluationService.hasPermission(user, "settings.configuration.manage")
                || permissionEvaluationService.isSuperAdmin(user);
        if (!allowed) {
            throw new AccessDeniedException("Current user is not allowed to configure electronic signatures");
        }
    }

    private void requireAdminManage() {
        var user = currentUserService.requireCurrentUser();
        boolean allowed = permissionEvaluationService.hasPermission(user, "settings.configuration.manage")
                || permissionEvaluationService.isSuperAdmin(user);
        if (!allowed) throw new AccessDeniedException("Current user is not allowed to configure electronic signatures");
    }
}
