package com.eqms.controller;

import com.eqms.dto.esignature.ElectronicSignatureRecordResponse;
import com.eqms.service.ElectronicSignatureService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping
public class SharedSignatureController {

    private final ElectronicSignatureService electronicSignatureService;

    public SharedSignatureController(ElectronicSignatureService electronicSignatureService) {
        this.electronicSignatureService = electronicSignatureService;
    }

    @GetMapping("/shared/{module}/{entityId}/signatures")
    public ResponseEntity<List<ElectronicSignatureRecordResponse>> getSharedSignatures(
            @PathVariable String module,
            @PathVariable UUID entityId
    ) {
        return ResponseEntity.ok(electronicSignatureService.getEntitySignatures(module, entityId));
    }
}
