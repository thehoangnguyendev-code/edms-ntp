package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.service.UserUiPreferenceService;
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

/** The signed-in user's own interface preferences. They are personal, so there is no admin override and no user id in the URL. */
@RestController
@RequestMapping("/user-ui-preferences")
public class UserUiPreferenceController {

    private final CurrentUserService currentUserService;
    private final UserUiPreferenceService service;
    private final ObjectMapper objectMapper;

    public UserUiPreferenceController(CurrentUserService currentUserService,
                                      UserUiPreferenceService service,
                                      ObjectMapper objectMapper) {
        this.currentUserService = currentUserService;
        this.service = service;
        this.objectMapper = objectMapper;
    }

    /** The saved value, or an empty object when the user has not changed this preference. */
    @GetMapping("/{key}")
    public ResponseEntity<JsonNode> get(@PathVariable String key) {
        UserAccount user = currentUserService.requireCurrentUser();
        return ResponseEntity.ok(service.find(user.getId(), key).orElseGet(objectMapper::createObjectNode));
    }

    @PutMapping("/{key}")
    public ResponseEntity<JsonNode> save(@PathVariable String key, @RequestBody JsonNode value) {
        UserAccount user = currentUserService.requireCurrentUser();
        return ResponseEntity.ok(service.save(user.getId(), key, value));
    }

    @DeleteMapping("/{key}")
    public ResponseEntity<Void> reset(@PathVariable String key) {
        UserAccount user = currentUserService.requireCurrentUser();
        service.reset(user.getId(), key);
        return ResponseEntity.noContent().build();
    }
}
