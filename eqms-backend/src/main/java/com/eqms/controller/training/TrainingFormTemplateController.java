package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingFormTemplateService;
import org.springframework.http.*;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.UUID;

/** The Word templates of the assessment forms kept in Training Administration. */
@RestController
@RequestMapping("/training/form-templates")
public class TrainingFormTemplateController {
    private final TrainingFormTemplateService templates;
    private final CurrentUserService users;

    public TrainingFormTemplateController(TrainingFormTemplateService templates, CurrentUserService users) {
        this.templates = templates;
        this.users = users;
    }

    @GetMapping
    public ResponseEntity<?> page(@RequestParam(required = false) String search, @RequestParam(required = false) String status, @RequestParam(required = false) String sortBy,
                                  @RequestParam(defaultValue = "desc") String sortDirection, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(templates.page(users.requireCurrentUser(), search, status, sortBy, sortDirection, page, limit));
    }

    @GetMapping("/current")
    public ResponseEntity<?> current() { return ResponseEntity.ok(Map.of("data", templates.current(users.requireCurrentUser()))); }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> upload(@RequestPart("file") MultipartFile file, @RequestParam String code, @RequestParam String title, @RequestParam String versionLabel,
                                    @RequestParam(required = false) String remark) {
        return ResponseEntity.ok(templates.upload(users.requireCurrentUser(), file, code, title, versionLabel, remark));
    }

    @PostMapping("/{id}/enable")
    public ResponseEntity<?> enable(@PathVariable UUID id, @RequestBody TrainingFormTemplateService.EnableRequest request) { return ResponseEntity.ok(templates.enable(users.requireCurrentUser(), id, request)); }

    @PostMapping("/{id}/disable")
    public ResponseEntity<?> disable(@PathVariable UUID id, @RequestBody TrainingFormTemplateService.DisableRequest request) { return ResponseEntity.ok(templates.disable(users.requireCurrentUser(), id, request)); }

    @GetMapping("/{id}/view-config")
    public ResponseEntity<?> viewConfig(@PathVariable UUID id) { return ResponseEntity.ok(templates.viewConfig(users.requireCurrentUser(), id)); }

    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable UUID id) {
        Map<String, Object> file = templates.download(users.requireCurrentUser(), id);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(String.valueOf(file.get("contentType")))).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename((String) file.get("name")).build().toString()).body((byte[]) file.get("bytes"));
    }
}
