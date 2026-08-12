package com.eqms.controller;

import com.eqms.dto.user.UserAuthorizationSummaryResponse;
import com.eqms.service.UserAuthorizationSummaryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/settings/users")
public class UserAuthorizationSummaryController {
    private final UserAuthorizationSummaryService service;

    public UserAuthorizationSummaryController(UserAuthorizationSummaryService service) {
        this.service = service;
    }

    @GetMapping("/{id}/authorization-summary")
    public UserAuthorizationSummaryResponse getSummary(@PathVariable UUID id) {
        return service.getSummary(id);
    }
}
