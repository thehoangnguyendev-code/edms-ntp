package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingActivityService;
import com.eqms.service.training.TrainingAssessmentLibraryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** The library of Training Assessments (APD.0009) and the choice of one by a training activity. */
@RestController
@RequestMapping("/training")
public class TrainingAssessmentLibraryController {
    private final TrainingAssessmentLibraryService library;
    private final TrainingActivityService activities;
    private final CurrentUserService users;

    public TrainingAssessmentLibraryController(TrainingAssessmentLibraryService library, TrainingActivityService activities, CurrentUserService users) {
        this.library = library;
        this.activities = activities;
        this.users = users;
    }

    @GetMapping("/assessments")
    public ResponseEntity<?> page(@RequestParam(required = false) String search, @RequestParam(required = false) String status, @RequestParam(required = false) String kind,
                                  @RequestParam(required = false) String sortBy, @RequestParam(defaultValue = "desc") String sortDirection, @RequestParam(defaultValue = "1") int page,
                                  @RequestParam(defaultValue = "10") int limit, @RequestParam java.util.Map<String, String> filters) {
        return ResponseEntity.ok(library.page(users.requireCurrentUser(), search, status, kind, sortBy, sortDirection, page, limit, filters));
    }

    /** The revisions of the assessment, as the revisions of a document are listed on its detail. */
    @GetMapping("/assessments/{id}/revisions")
    public ResponseEntity<?> revisions(@PathVariable UUID id, @RequestParam(required = false) String search, @RequestParam(required = false) String sortBy,
                                       @RequestParam(defaultValue = "desc") String sortDirection, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(library.revisions(users.requireCurrentUser(), id, search, sortBy, sortDirection, page, limit));
    }

    @GetMapping("/assessments/approved")
    public ResponseEntity<?> approved(@RequestParam(required = false) String search, @RequestParam(required = false) String kind) {
        return ResponseEntity.ok(library.approved(users.requireCurrentUser(), search, kind));
    }

    @PostMapping("/assessments/preview")
    public ResponseEntity<byte[]> preview(@RequestBody TrainingAssessmentLibraryService.PreviewRequest request) {
        byte[] pdf = library.preview(users.requireCurrentUser(), request);
        return ResponseEntity.ok().contentType(org.springframework.http.MediaType.APPLICATION_PDF).cacheControl(org.springframework.http.CacheControl.noStore()).body(pdf);
    }

    @GetMapping("/assessments/{id}")
    public ResponseEntity<?> get(@PathVariable UUID id) { return ResponseEntity.ok(library.get(users.requireCurrentUser(), id)); }

    @PostMapping("/assessments")
    public ResponseEntity<?> create(@RequestBody TrainingAssessmentLibraryService.SaveRequest request) { return ResponseEntity.ok(library.create(users.requireCurrentUser(), request)); }

    @PutMapping("/assessments/{id}")
    public ResponseEntity<?> update(@PathVariable UUID id, @RequestBody TrainingAssessmentLibraryService.SaveRequest request) { return ResponseEntity.ok(library.update(users.requireCurrentUser(), id, request)); }

    @PostMapping("/assessments/{id}/delete")
    public ResponseEntity<?> delete(@PathVariable UUID id, @RequestBody TrainingAssessmentLibraryService.ReasonRequest request) { return ResponseEntity.ok(library.delete(users.requireCurrentUser(), id, request)); }

    @PostMapping("/assessments/{id}/submit")
    public ResponseEntity<?> submit(@PathVariable UUID id) { return ResponseEntity.ok(library.submit(users.requireCurrentUser(), id)); }

    @PostMapping("/assessments/{id}/return")
    public ResponseEntity<?> returnToDraft(@PathVariable UUID id, @RequestBody TrainingAssessmentLibraryService.ReasonRequest request) { return ResponseEntity.ok(library.returnToDraft(users.requireCurrentUser(), id, request)); }

    @PostMapping("/assessments/{id}/approve")
    public ResponseEntity<?> approve(@PathVariable UUID id, @RequestBody TrainingAssessmentLibraryService.ApproveRequest request) { return ResponseEntity.ok(library.approve(users.requireCurrentUser(), id, request)); }

    @PostMapping("/assessments/{id}/upgrade-revision")
    public ResponseEntity<?> upgradeRevision(@PathVariable UUID id) { return ResponseEntity.ok(library.upgradeRevision(users.requireCurrentUser(), id)); }

    @PutMapping("/activities/{id}/assessment")
    public ResponseEntity<?> choose(@PathVariable UUID id, @RequestBody TrainingAssessmentLibraryService.ChooseRequest request) {
        var actor = users.requireCurrentUser();
        library.choose(actor, id, request);
        return ResponseEntity.ok(activities.get(actor, id));
    }

    @PostMapping("/activities/{id}/assessment/remove")
    public ResponseEntity<?> clear(@PathVariable UUID id) {
        var actor = users.requireCurrentUser();
        library.clear(actor, id);
        return ResponseEntity.ok(activities.get(actor, id));
    }
}
