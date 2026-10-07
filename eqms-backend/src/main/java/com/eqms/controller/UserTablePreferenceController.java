package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.service.UserTablePreferenceService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The signed-in user's own table layouts. A layout is personal, so there is no admin override. */
@RestController
@RequestMapping("/user-table-preferences")
public class UserTablePreferenceController {

    private final CurrentUserService currentUserService;
    private final UserTablePreferenceService service;
    private final ObjectMapper objectMapper;

    public UserTablePreferenceController(CurrentUserService currentUserService,
                                         UserTablePreferenceService service,
                                         ObjectMapper objectMapper) {
        this.currentUserService = currentUserService;
        this.service = service;
        this.objectMapper = objectMapper;
    }

    /** Returns the saved layout, or an empty array when the user has not customised this table. */
    @GetMapping("/{tableKey}")
    public ResponseEntity<JsonNode> get(@PathVariable String tableKey) {
        UserAccount user = currentUserService.requireCurrentUser();
        return ResponseEntity.ok(service.find(user.getId(), tableKey).orElseGet(objectMapper::createArrayNode));
    }

    @PutMapping("/{tableKey}")
    public ResponseEntity<JsonNode> save(@PathVariable String tableKey, @RequestBody JsonNode preferences) {
        UserAccount user = currentUserService.requireCurrentUser();
        return ResponseEntity.ok(service.save(user.getId(), tableKey, preferences));
    }

    @DeleteMapping("/{tableKey}")
    public ResponseEntity<Void> reset(@PathVariable String tableKey) {
        UserAccount user = currentUserService.requireCurrentUser();
        service.reset(user.getId(), tableKey);
        return ResponseEntity.noContent().build();
    }
}
