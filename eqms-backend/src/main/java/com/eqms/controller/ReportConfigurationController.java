package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.ReportPlatformService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

/** Admin-facing, controlled report metadata configuration. No query authoring endpoint exists by design. */
@RestController
@RequestMapping("/settings/report-configuration")
public class ReportConfigurationController {
    private final ReportPlatformService reports; private final CurrentUserService currentUser;
    public ReportConfigurationController(ReportPlatformService reports, CurrentUserService currentUser){this.reports=reports;this.currentUser=currentUser;}
    @GetMapping("/definitions") public ResponseEntity<?> list(){return ResponseEntity.ok(reports.configuration(currentUser.requireCurrentUser()));}
    @GetMapping("/definitions/{code}") public ResponseEntity<?> get(@PathVariable String code){return ResponseEntity.ok(reports.configurationDetail(currentUser.requireCurrentUser(),code));}
    @PatchMapping("/definitions/{code}") public ResponseEntity<?> update(@PathVariable String code,@RequestBody Map<String,Object> request){reports.updateConfiguration(currentUser.requireCurrentUser(),code,request);return ResponseEntity.noContent().build();}
    @PatchMapping("/definitions/{code}/fields") public ResponseEntity<?> updateFields(@PathVariable String code,@RequestBody Map<String,Object> request){reports.updateFields(currentUser.requireCurrentUser(),code,request);return ResponseEntity.noContent().build();}
    @GetMapping("/definitions/{code}/history") public ResponseEntity<?> history(@PathVariable String code){return ResponseEntity.ok(reports.configurationHistory(currentUser.requireCurrentUser(),code));}
}
