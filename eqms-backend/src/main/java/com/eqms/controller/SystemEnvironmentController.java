package com.eqms.controller;

import com.eqms.config.DeploymentEnvironment;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Tells the user interface which environment it is talking to, so the screen can always show it. Public, like branding:
 * the login page needs it before anyone has signed in. It exposes the environment name only.
 */
@RestController
@RequestMapping("/system/environment")
public class SystemEnvironmentController {

    private final DeploymentEnvironment environment;

    public SystemEnvironmentController(@Value("${app.environment:DEV}") String environment) {
        this.environment = DeploymentEnvironment.parse(environment);
    }

    @GetMapping
    public ResponseEntity<Map<String, String>> get() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("environment", environment.name()));
    }
}
