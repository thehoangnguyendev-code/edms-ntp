package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.controller.BackupRestoreController;
import com.eqms.dto.dictionary.BusinessUnitDictionaryResponse;
import com.eqms.dto.dictionary.DepartmentDictionaryResponse;
import com.eqms.dto.dictionary.EducationDegreeLevelDictionaryResponse;
import com.eqms.dto.dictionary.PositionDictionaryResponse;
import com.eqms.dto.dictionary.RetentionPolicyDictionaryResponse;
import com.eqms.dto.dictionary.SchoolDictionaryResponse;
import com.eqms.dto.dictionary.StorageLocationDictionaryResponse;
import com.eqms.dto.document.ControlledCopyListItemResponse;
import com.eqms.dto.document.DocumentListItemResponse;
import com.eqms.dto.document.RevisionListItemResponse;
import com.eqms.dto.navigation.NavigationItemResponse;
import com.eqms.dto.notification.NotificationResponse;
import com.eqms.dto.search.GlobalSearchResponse;
import com.eqms.dto.search.GlobalSearchResponse.Group;
import com.eqms.dto.search.GlobalSearchResponse.Item;
import com.eqms.dto.settings.AccessProfileResponse;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PermissionSetResponse;
import com.eqms.dto.user.UserManagementResponse;
import com.eqms.entity.UserAccount;
import com.eqms.service.report.ReportTemplateService;
import com.eqms.service.training.TrainingActivityService;
import com.eqms.service.training.TrainingAssessmentLibraryService;
import com.eqms.service.training.TrainingJobAssignmentService;
import com.eqms.service.training.TrainingMatrixService;
import com.eqms.util.DateTimeFormatUtils;
import com.eqms.service.training.TrainingRequirementService;
import com.eqms.util.DisplayLabels;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.concurrent.DelegatingSecurityContextExecutorService;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

/**
 * One search box for everything a person may open. Nothing is searched here by its own rules: every kind of record is asked from the service that already
 * answers its list screen (with that screen's own permission and visibility rules: the current user, department or participant scope), and a kind
 * is asked at all only when the menu the server builds for this person has the page of that list. The records are therefore exactly those the person could find
 * by typing the same words in the filter of the list; this class adds no rule of access and keeps no copy of any record.
 *
 * <p>The kinds are asked in parallel (the signed-in person travels with each task), each with a time limit. A kind that is late or fails is reported as
 * unavailable and does not hold back the others.
 *
 * <p>The code of a record (document number, training number, employee code...) comes first: each list is asked for a wider window of matches than is shown,
 * and the records whose code equals the words, then starts with them, then contains them are put ahead of the rest.
 */
@Service
public class GlobalSearchService {

    private static final Logger log = LoggerFactory.getLogger(GlobalSearchService.class);

    static final int MIN_QUERY_LENGTH = 2;
    static final int MAX_QUERY_LENGTH = 100;
    /** How many results of a kind are shown. */
    static final int PER_GROUP = 5;
    /** How many matches of a kind are asked for, so that the ones whose code matches best can be put first. */
    static final int CANDIDATES = 15;
    /** The report template list accepts only its own page sizes (10, 20, 50, 100). */
    static final int TEMPLATE_CANDIDATES = 20;
    static final long GROUP_TIMEOUT_MS = 2500;

    private final NavigationService navigationService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final DocumentService documentService;
    private final RevisionService revisionService;
    private final ControlledCopyService controlledCopyService;
    private final UncontrolledCopyService uncontrolledCopyService;
    private final UserManagementService userManagementService;
    private final TrainingActivityService trainingActivityService;
    private final TrainingRequirementService trainingRequirementService;
    private final TrainingMatrixService trainingMatrixService;
    private final TrainingAssessmentLibraryService trainingAssessmentLibraryService;
    private final TrainingJobAssignmentService trainingJobAssignmentService;
    private final ReportPlatformService reportPlatformService;
    private final ReportTemplateService reportTemplateService;
    private final PermissionSetService permissionSetService;
    private final AccessProfileService accessProfileService;
    private final NotificationService notificationService;
    private final DictionaryManagementService dictionaryService;
    private final EducationManagementService educationService;
    private final BackupRestoreController backupController;

    private final ExecutorService executor;

    public GlobalSearchService(
            NavigationService navigationService,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService,
            DocumentService documentService,
            RevisionService revisionService,
            ControlledCopyService controlledCopyService,
            UncontrolledCopyService uncontrolledCopyService,
            UserManagementService userManagementService,
            TrainingActivityService trainingActivityService,
            TrainingRequirementService trainingRequirementService,
            TrainingMatrixService trainingMatrixService,
            TrainingAssessmentLibraryService trainingAssessmentLibraryService,
            TrainingJobAssignmentService trainingJobAssignmentService,
            ReportPlatformService reportPlatformService,
            ReportTemplateService reportTemplateService,
            PermissionSetService permissionSetService,
            AccessProfileService accessProfileService,
            NotificationService notificationService,
            DictionaryManagementService dictionaryService,
            EducationManagementService educationService,
            BackupRestoreController backupController) {
        this.navigationService = navigationService;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.documentService = documentService;
        this.revisionService = revisionService;
        this.controlledCopyService = controlledCopyService;
        this.uncontrolledCopyService = uncontrolledCopyService;
        this.userManagementService = userManagementService;
        this.trainingActivityService = trainingActivityService;
        this.trainingRequirementService = trainingRequirementService;
        this.trainingMatrixService = trainingMatrixService;
        this.trainingAssessmentLibraryService = trainingAssessmentLibraryService;
        this.trainingJobAssignmentService = trainingJobAssignmentService;
        this.reportPlatformService = reportPlatformService;
        this.reportTemplateService = reportTemplateService;
        this.permissionSetService = permissionSetService;
        this.accessProfileService = accessProfileService;
        this.notificationService = notificationService;
        this.dictionaryService = dictionaryService;
        this.educationService = educationService;
        this.backupController = backupController;
        AtomicInteger number = new AtomicInteger();
        // Bounded on purpose: a burst of searches waits in a short queue and then is refused (the kind is shown as unavailable); it never starves the database pool.
        this.executor = new DelegatingSecurityContextExecutorService(new ThreadPoolExecutor(
                4, 8, 30, TimeUnit.SECONDS, new ArrayBlockingQueue<>(48),
                runnable -> {
                    Thread thread = new Thread(runnable, "global-search-" + number.incrementAndGet());
                    thread.setDaemon(true);
                    return thread;
                },
                new ThreadPoolExecutor.AbortPolicy()));
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    /** What one kind of record found: a few items and how many there are in all. */
    private record Found(List<Item> items, long total) {
    }

    /**
     * A kind of record, the page of the menu that proves the person reaches it, and how to ask for it. {@code listOnly} kinds have no screen of their own per
     * record (a dictionary entry, a matrix): a result opens the list screen, whose address is the one of that page of the menu.
     */
    private record Source(String key, String label, String menuId, boolean listOnly, Supplier<Found> query) {
    }

    public GlobalSearchResponse search(String rawQuery) {
        String query = rawQuery == null ? "" : rawQuery.trim();
        if (query.length() < MIN_QUERY_LENGTH || query.length() > MAX_QUERY_LENGTH) {
            return new GlobalSearchResponse(query, List.of());
        }

        // Resolved on the request thread, the same way the menu itself is: the signed-in person and what they hold.
        UserAccount user = currentUserService.requireCurrentUser();
        Set<String> permissions = permissionEvaluationService.getPermissionCodes(user);
        Set<String> reachablePages = new HashSet<>();
        Map<String, String> pagePaths = new HashMap<>();
        collectMenu(navigationService.getNavigation(user, permissions), reachablePages, pagePaths);

        List<Group> groups = new ArrayList<>();
        List<Item> pages = navigationService.searchNavigation(query, user, permissions).stream()
                .limit(PER_GROUP)
                .map(page -> new Item(page.id(), null, page.label(), page.fullPath(), null, page.path()))
                .toList();
        if (!pages.isEmpty()) {
            groups.add(new Group("pages", "Pages", pages, pages.size(), false));
        }

        List<Source> asked = new ArrayList<>();
        List<Future<Found>> futures = new ArrayList<>();
        for (Source source : sources(query)) {
            if (source.menuId() != null && !reachablePages.contains(source.menuId())) {
                continue;
            }
            asked.add(source);
            try {
                futures.add(executor.submit(source.query()::get));
            } catch (RejectedExecutionException busy) {
                futures.add(null);
            }
        }

        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(GROUP_TIMEOUT_MS);
        for (int i = 0; i < asked.size(); i++) {
            Source source = asked.get(i);
            Future<Found> future = futures.get(i);
            if (future == null) {
                groups.add(new Group(source.key(), source.label(), List.of(), 0, true));
                continue;
            }
            try {
                Found found = future.get(Math.max(1, deadline - System.nanoTime()), TimeUnit.NANOSECONDS);
                if (!found.items().isEmpty()) {
                    String listPath = source.listOnly() ? pagePaths.get(source.menuId()) : null;
                    List<Item> items = listPath == null ? found.items()
                            : found.items().stream().map(item -> new Item(item.id(), item.code(), item.title(), item.subtitle(), item.badge(), listPath)).toList();
                    groups.add(new Group(source.key(), source.label(), items, found.total(), false));
                }
            } catch (TimeoutException late) {
                future.cancel(true);
                groups.add(new Group(source.key(), source.label(), List.of(), 0, true));
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                future.cancel(true);
                groups.add(new Group(source.key(), source.label(), List.of(), 0, true));
            } catch (ExecutionException failed) {
                // A person who may not read this kind of record simply has no such group; anything else is a failure of this kind only.
                if (!(failed.getCause() instanceof AccessDeniedException)) {
                    log.warn("Global search of {} failed: {}", source.key(), failed.getCause() == null ? failed.getMessage() : failed.getCause().toString());
                    groups.add(new Group(source.key(), source.label(), List.of(), 0, true));
                }
            }
        }
        return new GlobalSearchResponse(query, groups);
    }

    /** The kinds, in the order they are shown. A kind with no page of the menu (the notifications of the person) is always asked: its service lists nobody else's. */
    private List<Source> sources(String q) {
        return List.of(
                new Source("documents", "Documents", "doc-all", false, () -> documents(q)),
                new Source("revisions", "Revisions", "rev-all", false, () -> revisions(q)),
                new Source("controlled-copies", "Controlled Copies", "cc-all", false, () -> controlledCopies(q)),
                new Source("uncontrolled-copies", "Uncontrolled Copies", "uc-all", false, () -> uncontrolledCopies(q)),
                new Source("training", "Training Activities", "training-activities", false, () -> training(q)),
                new Source("training-requirements", "Training Requirements", "training-requirements", false, () -> trainingRequirements(q)),
                new Source("training-matrices", "Training Matrices", "training-matrices", true, () -> trainingMatrices(q)),
                new Source("training-assessments", "Training Assessments", "training-assessments", false, () -> trainingAssessments(q)),
                new Source("training-job-assignments", "Job Assignments", "training-job-assignments", false, () -> trainingJobAssignments(q)),
                new Source("users", "Users", "sec-user-management", false, () -> users(q)),
                new Source("access-profiles", "Access Profiles", "sec-access-profiles", false, () -> accessProfiles(q)),
                new Source("permission-sets", "Permission Sets", "sec-permission-sets", false, () -> permissionSets(q)),
                new Source("report-templates", "Report Templates", "report-templates", false, () -> reportTemplates(q)),
                new Source("report-runs", "Report Runs", "report-history", false, () -> reportRuns(q)),
                new Source("backups", "Backups", "backup-backups", false, () -> backups(q)),
                new Source("business-units", "Business Units", "dict-business-units", true, () -> businessUnits(q)),
                new Source("departments", "Departments", "dict-departments", true, () -> departments(q)),
                new Source("positions", "Positions", "dict-positions", true, () -> positions(q)),
                new Source("storage-locations", "Storage Locations", "dict-storage-locations", true, () -> storageLocations(q)),
                new Source("retention-policies", "Retention Policies", "dict-retention-policies", true, () -> retentionPolicies(q)),
                new Source("degree-levels", "Degree Levels", "education-degree-levels", true, () -> degreeLevels(q)),
                new Source("schools", "Schools", "education-schools", true, () -> schools(q)),
                new Source("notifications", "Notifications", null, false, () -> notifications(q)));
    }

    private static void collectMenu(List<NavigationItemResponse> items, Set<String> ids, Map<String, String> paths) {
        if (items == null) return;
        for (NavigationItemResponse item : items) {
            ids.add(item.id());
            if (item.path() != null) paths.put(item.id(), item.path());
            collectMenu(item.children(), ids, paths);
        }
    }

    // ---- Document Control

    private Found documents(String q) {
        PageResponse<DocumentListItemResponse> page = documentService.listDocuments(
                "all", q, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
                "created", "desc", 1, CANDIDATES);
        return found(page.data().stream().map(d -> new Item(d.id(), d.documentNumber(), d.documentName(), null, d.status(), null)).toList(), page.pagination().total(), q);
    }

    private Found revisions(String q) {
        PageResponse<RevisionListItemResponse> page = revisionService.listRevisions(
                q, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
                false, false, "revisionName", "asc", 1, CANDIDATES);
        return found(page.data().stream()
                .map(r -> new Item(r.id(), label(r.documentNumber(), r.revisionNumber() == null ? null : "Rev " + r.revisionNumber()),
                        r.revisionName() != null ? r.revisionName() : r.documentName(), null, r.status(), null)).toList(), page.pagination().total(), q);
    }

    private Found controlledCopies(String q) {
        PageResponse<ControlledCopyListItemResponse> page = controlledCopyService.list(
                1, CANDIDATES, q, null, null, null, null, null, null, null, null, null, null, null, null, "created", "desc");
        return found(page.data().stream()
                .map(c -> new Item(c.id(), c.controlledCopyNumber(), c.documentDisplayLabel() != null ? c.documentDisplayLabel() : c.name(), null, DisplayLabels.status(c.status()), null)).toList(),
                page.pagination().total(), q);
    }

    private Found uncontrolledCopies(String q) {
        PageResponse<UncontrolledCopyResponse> page = uncontrolledCopyService.list(
                1, CANDIDATES, q, null, null, null, null, null, null, null, null, "created", "desc");
        return found(page.data().stream()
                .map(c -> new Item(c.id(), c.uncontrolledCopyNumber(), label(c.documentNumber(), c.documentTitle()), null, c.status(), null)).toList(),
                page.pagination().total(), q);
    }

    // ---- Training Management

    private Found training(String q) {
        Map<String, Object> page = trainingActivityService.list(currentUserService.requireCurrentUser(), q, null, null, null, null, null, false, "createdAt", "desc", 1, CANDIDATES);
        return found(rowsOf(page).stream()
                .map(r -> new Item(str(r, "id"), str(r, "trainingNumber"), first(str(r, "trainingTopics"), str(r, "documentNumber")), str(r, "departmentName"), str(r, "status"), null)).toList(),
                totalOf(page), q);
    }

    private Found trainingRequirements(String q) {
        Map<String, Object> page = trainingRequirementService.list(currentUserService.requireCurrentUser(), null, null, q, null, null, 1, CANDIDATES);
        return found(rowsOf(page).stream()
                .map(r -> new Item(str(r, "id"), str(r, "requestNo"), first(str(r, "departmentName"), "Training requirement"), str(r, "year"), str(r, "status"), null)).toList(),
                totalOf(page), q);
    }

    private Found trainingMatrices(String q) {
        Map<String, Object> page = trainingMatrixService.matrices(currentUserService.requireCurrentUser(), q, null, null, null, 1, CANDIDATES);
        return found(rowsOf(page).stream()
                .map(r -> new Item(str(r, "id"), str(r, "code"), first(str(r, "departmentName"), "Training matrix"), null, DisplayLabels.status(str(r, "state")), null)).toList(),
                totalOf(page), q);
    }

    private Found trainingAssessments(String q) {
        Map<String, Object> page = trainingAssessmentLibraryService.page(currentUserService.requireCurrentUser(), q, null, null, null, "desc", 1, CANDIDATES);
        return found(rowsOf(page).stream()
                .map(r -> new Item(str(r, "id"), str(r, "code"), str(r, "name"), null, str(r, "status"), null)).toList(),
                totalOf(page), q);
    }

    private Found trainingJobAssignments(String q) {
        Map<String, Object> page = trainingJobAssignmentService.list(currentUserService.requireCurrentUser(), q, null, null, null, 1, CANDIDATES);
        return found(rowsOf(page).stream()
                .map(r -> new Item(str(r, "id"), str(r, "issueNo"), str(r, "fullName"), label(str(r, "employeeCode"), str(r, "positionName")), str(r, "status"), null)).toList(),
                totalOf(page), q);
    }

    // ---- Security & Authorization

    /** The same fields the User Management list shows for a row: no e-mail and no phone number in the answer. */
    private Found users(String q) {
        PageResponse<UserManagementResponse> page = userManagementService.getUsers(
                1, CANDIDATES, q, null, null, null, null, null, null, null, null, null, null, null, null, "employeeCode", "asc", false, null, null);
        return found(page.data().stream()
                .map(u -> new Item(u.id(), u.employeeCode(), u.fullName(), u.department(), u.status(), null)).toList(), page.pagination().total(), q);
    }

    private Found accessProfiles(String q) {
        Page<AccessProfileResponse> page = accessProfileService.listProfiles(0, CANDIDATES, q, null, null, null, null, null, null, "name", "asc");
        return found(page.getContent().stream()
                .map(p -> new Item(String.valueOf(p.id()), p.code(), p.name(), null, p.active() ? "Active" : "Inactive", null)).toList(), page.getTotalElements(), q);
    }

    private Found permissionSets(String q) {
        PageResponse<PermissionSetResponse> page = permissionSetService.listPaged(1, CANDIDATES, q, null, null, null, null, "name", "asc");
        return found(page.data().stream()
                .map(p -> new Item(String.valueOf(p.id()), p.code(), p.name(), null, p.active() ? "Active" : "Inactive", null)).toList(), page.pagination().total(), q);
    }

    // ---- Reports

    private Found reportTemplates(String q) {
        Map<String, Object> page = reportTemplateService.catalog(currentUserService.requireCurrentUser(), q, 1, "displayName", "asc", Map.of("limit", String.valueOf(TEMPLATE_CANDIDATES)));
        return found(rowsOf(page).stream()
                .map(r -> new Item(str(r, "code"), str(r, "code"), first(str(r, "displayName"), str(r, "name")), null, null, null)).toList(), totalOf(page), q);
    }

    private Found reportRuns(String q) {
        Map<String, Object> page = reportPlatformService.runs(currentUserService.requireCurrentUser(), q, null, null, null, null, null, null, null, 1, CANDIDATES, "queuedAt", "desc");
        return found(rowsOf(page).stream()
                .map(r -> new Item(str(r, "id"), str(r, "definitionCode"), first(str(r, "reportTitle"), str(r, "definitionCode")), null, str(r, "status"), null)).toList(), totalOf(page), q);
    }

    // ---- Backup & Restore

    /** Asked from the controller of the Backup History screen itself, so the permission and the answer of the backup agent are exactly that screen's. */
    private Found backups(String q) {
        ResponseEntity<JsonNode> answer = backupController.list(q, null, null, null, null, null, null, null, "startedAt", "desc", 1, CANDIDATES, null, null);
        JsonNode body = answer.getBody();
        List<Item> items = new ArrayList<>();
        if (body != null && body.path("data").isArray()) {
            for (JsonNode backup : body.path("data")) {
                String id = backup.path("id").asText(null);
                if (id == null) continue;
                items.add(new Item(id, id, "Backup", startedAt(backup.path("startedAt").asText(null)), backup.path("status").asText(null), null));
            }
        }
        long total = body == null ? items.size() : body.path("pagination").path("total").asLong(items.size());
        return found(items, total, q);
    }

    // ---- Application Settings: the dictionaries (a result opens the list of its dictionary)

    private Found businessUnits(String q) {
        PageResponse<BusinessUnitDictionaryResponse> page = dictionaryService.listBusinessUnitsPage(q, null, null, null, 1, CANDIDATES, "name", "asc");
        return found(page.data().stream().map(b -> new Item(String.valueOf(b.id()), b.abbreviation(), b.name(), null, b.isActive() ? "Active" : "Inactive", null)).toList(), page.pagination().total(), q);
    }

    private Found departments(String q) {
        PageResponse<DepartmentDictionaryResponse> page = dictionaryService.listDepartmentsPage(q, null, null, null, null, 1, CANDIDATES, "name", "asc");
        return found(page.data().stream().map(d -> new Item(String.valueOf(d.id()), d.abbreviation(), d.name(), d.businessUnit(), d.isActive() ? "Active" : "Inactive", null)).toList(), page.pagination().total(), q);
    }

    private Found positions(String q) {
        PageResponse<PositionDictionaryResponse> page = dictionaryService.listPositionsPage(q, null, null, null, null, null, 1, CANDIDATES, "name", "asc");
        return found(page.data().stream().map(p -> new Item(String.valueOf(p.id()), null, p.name(), label(p.businessUnit(), p.department()), p.isActive() ? "Active" : "Inactive", null)).toList(), page.pagination().total(), q);
    }

    private Found storageLocations(String q) {
        PageResponse<StorageLocationDictionaryResponse> page = dictionaryService.listStorageLocationsPage(q, null, null, null, 1, CANDIDATES, "name", "asc");
        return found(page.data().stream().map(s -> new Item(String.valueOf(s.id()), null, s.name(), null, s.isActive() ? "Active" : "Inactive", null)).toList(), page.pagination().total(), q);
    }

    private Found retentionPolicies(String q) {
        PageResponse<RetentionPolicyDictionaryResponse> page = dictionaryService.listRetentionPoliciesPage(q, null, null, null, 1, CANDIDATES, "name", "asc");
        return found(page.data().stream().map(r -> new Item(String.valueOf(r.id()), null, r.name(), r.retentionDays() == null ? null : r.retentionDays() + " days", r.isActive() ? "Active" : "Inactive", null)).toList(), page.pagination().total(), q);
    }

    private Found degreeLevels(String q) {
        PageResponse<EducationDegreeLevelDictionaryResponse> page = educationService.listDegreeLevelsPage(q, null, null, null, 1, CANDIDATES, "name", "asc");
        return found(page.data().stream().map(d -> new Item(String.valueOf(d.id()), null, d.name(), null, d.isActive() ? "Active" : "Inactive", null)).toList(), page.pagination().total(), q);
    }

    private Found schools(String q) {
        PageResponse<SchoolDictionaryResponse> page = educationService.listSchoolsPage(q, null, null, null, null, null, null, null, null, 1, CANDIDATES, "name", "asc");
        return found(page.data().stream().map(s -> new Item(String.valueOf(s.id()), null, s.name(), null, s.isActive() ? "Active" : "Inactive", null)).toList(), page.pagination().total(), q);
    }

    // ---- The notifications of the person

    private Found notifications(String q) {
        PageResponse<NotificationResponse> page = notificationService.list("all", q, null, null, null, null, null, null, null, null, null, "createdAt", "desc", 1, CANDIDATES);
        return found(page.data().stream()
                .map(n -> new Item(String.valueOf(n.id()), n.relatedItem() == null ? null : n.relatedItem().documentNumber(), n.title(), n.description(), null, n.actionUrl())).toList(),
                page.pagination().total(), q);
    }

    // ---- helpers

    private static Found found(List<Item> candidates, long total, String query) {
        return new Found(rank(candidates, query), total);
    }

    /** The code first: a record whose code equals the words comes before one whose code starts with them, then one that contains them, then the rest (stable inside each). */
    static List<Item> rank(List<Item> items, String query) {
        String needle = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        return items.stream().sorted(Comparator.comparingInt((Item item) -> codeScore(item.code(), needle))).limit(PER_GROUP).toList();
    }

    private static int codeScore(String code, String needle) {
        if (code == null || needle.isEmpty()) return 3;
        String value = code.toLowerCase(Locale.ROOT);
        if (value.equals(needle)) return 0;
        if (value.startsWith(needle)) return 1;
        return value.contains(needle) ? 2 : 3;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> rowsOf(Map<String, Object> page) {
        Object data = page == null ? null : page.get("data");
        return data instanceof List<?> list ? (List<Map<String, Object>>) list : List.of();
    }

    private static long totalOf(Map<String, Object> page) {
        Object pagination = page == null ? null : page.get("pagination");
        if (pagination instanceof Map<?, ?> map && map.get("total") instanceof Number total) return total.longValue();
        return rowsOf(page).size();
    }

    private static String str(Map<String, Object> row, String key) {
        Object value = row.get(key);
        return value == null || String.valueOf(value).isBlank() ? null : String.valueOf(value);
    }

    /** The time a person reads (dd/MM/yyyy HH:mm:ss, UTC+7), never the instant as the agent writes it. */
    private static String startedAt(String instant) {
        if (instant == null || instant.isBlank()) return null;
        try {
            return DateTimeFormatUtils.formatDateTime(Instant.parse(instant));
        } catch (RuntimeException unreadable) {
            return null;
        }
    }

    private static String first(String a, String b) {
        return a != null && !a.isBlank() ? a : b;
    }

    private static String label(String first, String second) {
        boolean a = first != null && !first.isBlank();
        boolean b = second != null && !second.isBlank();
        return a && b ? first + " · " + second : a ? first : b ? second : null;
    }
}
