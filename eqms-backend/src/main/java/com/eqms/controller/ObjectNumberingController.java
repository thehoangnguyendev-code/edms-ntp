package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.ObjectNumberService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** System Administration > Object Numbering (AUDIT-OBJECT-REGISTRY-2026-11-17): the format of the numbers given to records. */
@RestController
@RequestMapping("/object-numbering")
public class ObjectNumberingController {
    private final ObjectNumberService numbers;
    private final CurrentUserService users;

    public ObjectNumberingController(ObjectNumberService numbers, CurrentUserService users) {
        this.numbers = numbers;
        this.users = users;
    }

    @GetMapping
    public ResponseEntity<?> list() {
        return ResponseEntity.ok(numbers.list(users.requireCurrentUser()));
    }

    @PostMapping("/{kind}/preview")
    public ResponseEntity<?> preview(@PathVariable String kind, @RequestBody ObjectNumberService.FormatWrite request) {
        return ResponseEntity.ok(numbers.preview(users.requireCurrentUser(), kind, request));
    }

    @PutMapping("/{kind}")
    public ResponseEntity<?> update(@PathVariable String kind, @RequestBody ObjectNumberService.FormatWrite request) {
        return ResponseEntity.ok(numbers.update(users.requireCurrentUser(), kind, request));
    }
}
