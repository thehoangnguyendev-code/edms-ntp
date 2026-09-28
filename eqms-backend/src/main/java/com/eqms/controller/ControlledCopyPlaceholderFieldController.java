package com.eqms.controller;

import com.eqms.dto.controlledcopypolicy.ControlledCopyPlaceholderFieldRequest;
import com.eqms.dto.controlledcopypolicy.ControlledCopyPlaceholderFieldResponse;
import com.eqms.service.ControlledCopyPlaceholderFieldService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/documents/administration/controlled-copies-policy/placeholder-fields")
public class ControlledCopyPlaceholderFieldController {

    private final ControlledCopyPlaceholderFieldService service;

    public ControlledCopyPlaceholderFieldController(ControlledCopyPlaceholderFieldService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<ControlledCopyPlaceholderFieldResponse>> list() {
        return ResponseEntity.ok(service.list());
    }

    /** Placeholder keys the server fills in for every controlled copy; a custom field can never use one. */
    @GetMapping("/reserved-keys")
    public ResponseEntity<List<String>> reservedKeys() {
        return ResponseEntity.ok(com.eqms.service.ControlledCopyPlaceholderValueBuilder.RESERVED_KEYS.stream()
                .filter(key -> !key.startsWith("__")).sorted().toList());
    }

    @PostMapping
    public ResponseEntity<ControlledCopyPlaceholderFieldResponse> create(@RequestBody ControlledCopyPlaceholderFieldRequest request) {
        return ResponseEntity.ok(service.create(request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, @RequestBody(required = false) ControlledCopyPlaceholderFieldRequest request) {
        service.delete(id, request);
        return ResponseEntity.noContent().build();
    }
}
