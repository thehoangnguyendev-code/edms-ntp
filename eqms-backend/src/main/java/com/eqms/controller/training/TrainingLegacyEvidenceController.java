package com.eqms.controller.training;

import com.eqms.entity.UserAccount;
import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingLegacyEvidenceService;
import com.eqms.service.training.TrainingLegacyEvidenceService.*;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.UUID;

/** Training evidence of documents imported from paper. */
@RestController
@RequestMapping("/training/legacy-evidence")
public class TrainingLegacyEvidenceController {
    private final TrainingLegacyEvidenceService evidence;
    private final CurrentUserService users;
    private final com.eqms.service.training.TrainingPreviewMarking marking;

    public TrainingLegacyEvidenceController(TrainingLegacyEvidenceService evidence, CurrentUserService users, com.eqms.service.training.TrainingPreviewMarking marking) {
        this.evidence = evidence;
        this.users = users;
        this.marking = marking;
    }

    @GetMapping
    public ResponseEntity<?> queue(@RequestParam(required = false) String status, @RequestParam(required = false) String search,
                                   @RequestParam(required = false) String sortBy, @RequestParam(required = false) String sortDirection,
                                  @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit,
                                  @RequestParam Map<String, String> filters) {
        return ResponseEntity.ok(evidence.queue(users.requireCurrentUser(), status, search, sortBy, sortDirection, page, limit, filters));
    }

    /** What the import form needs to know about a paper Training Number: new, shared with another document, evidence already filed. */
    @GetMapping("/number-info")
    public ResponseEntity<?> numberInfo(@RequestParam String number) {
        return ResponseEntity.ok(evidence.numberInfo(users.requireCurrentUser(), number));
    }

    /** The persons named with the evidence of a historical activity (the tab "Persons Trained" of the activity). */
    @GetMapping("/activities/{activityId}/people")
    public ResponseEntity<?> people(@PathVariable UUID activityId, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(evidence.people(users.requireCurrentUser(), activityId, page, limit));
    }

    @PostMapping(value = "/revisions/{revisionId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> submit(@PathVariable UUID revisionId, @RequestPart(value = "file", required = false) MultipartFile file,
                                    @RequestPart(value = "signatureToken", required = false) String signatureToken,
                                    @RequestParam(defaultValue = "false") boolean notEvidenced, @RequestParam(required = false) String reason,
                                    @RequestParam(required = false) java.util.List<UUID> traineeIds) {
        return ResponseEntity.ok(evidence.submit(users.requireCurrentUser(), revisionId, file, notEvidenced, reason, traineeIds == null ? java.util.List.of() : traineeIds, signatureToken));
    }

    /** {@code inline=true} is the view in the page (audited as a view); otherwise the file is downloaded under the name it was uploaded with. */
    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable UUID id, @RequestParam(defaultValue = "false") boolean inline) {
        UserAccount viewer = users.requireCurrentUser();
        Map<String, Object> file = inline ? evidence.view(viewer, id) : evidence.download(viewer, id);
        byte[] body = (byte[]) file.get("bytes");
        // a view in the page carries the watermark of the preview settings; the file that is downloaded is the scan as it was filed
        if (inline && String.valueOf(file.get("contentType")).toLowerCase(java.util.Locale.ROOT).contains("pdf")) body = marking.mark(body, viewer);
        ContentDisposition disposition = (inline ? ContentDisposition.inline() : ContentDisposition.attachment()).filename((String) file.get("name"), java.nio.charset.StandardCharsets.UTF_8).build();
        return ResponseEntity.ok().contentType(MediaType.parseMediaType((String) file.get("contentType"))).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString()).body(body);
    }
}
