package com.eqms.controller;

import com.eqms.util.DateTimeFormatUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/health")
public class HealthController {

    @GetMapping
    public Map<String, Object> health() {
        return Map.of(
                "status", "UP",
                "service", "eqms-backend",
                "timestamp", DateTimeFormatUtils.formatDateTime(Instant.now())
        );
    }
}
