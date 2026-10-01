package com.eqms.controller;

import com.eqms.dto.executedrecord.FormSettingsRequest;
import com.eqms.dto.executedrecord.FormSettingsResponse;
import com.eqms.service.FormSettingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class FormSettingsController {

    private final FormSettingsService formSettingsService;

    public FormSettingsController(FormSettingsService formSettingsService) {
        this.formSettingsService = formSettingsService;
    }

    @GetMapping("/documents/{documentId}/form-settings")
    public ResponseEntity<FormSettingsResponse> get(@PathVariable UUID documentId) {
        return ResponseEntity.ok(formSettingsService.getForDocument(documentId));
    }

    @PutMapping("/documents/{documentId}/form-settings")
    public ResponseEntity<FormSettingsResponse> update(@PathVariable UUID documentId, @RequestBody FormSettingsRequest request) {
        return ResponseEntity.ok(formSettingsService.update(documentId, request));
    }
}
