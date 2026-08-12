package com.eqms.controller;

import com.eqms.dto.security.*;
import com.eqms.service.EffectiveAccessDiagnosisService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/security/effective-access")
public class EffectiveAccessDiagnosisController {
    private final EffectiveAccessDiagnosisService service;
    public EffectiveAccessDiagnosisController(EffectiveAccessDiagnosisService service) { this.service = service; }
    @PostMapping("/diagnose") public ResponseEntity<EffectiveAccessDiagnosisResponse> diagnose(@RequestBody EffectiveAccessDiagnosisRequest request) { return ResponseEntity.ok(service.diagnose(request)); }
}
