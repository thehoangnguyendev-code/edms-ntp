package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.document.KnowledgeBaseDocumentResponse;
import com.eqms.dto.knowledge.KnowledgePortalDtos.BrowseResult;
import com.eqms.dto.knowledge.KnowledgePortalDtos.Crumb;
import com.eqms.dto.knowledge.KnowledgePortalDtos.Folder;
import com.eqms.dto.knowledge.KnowledgePortalDtos.HierarchyOption;
import com.eqms.dto.knowledge.KnowledgePortalDtos.KnowledgeBaseCard;
import com.eqms.dto.knowledge.KnowledgePortalDtos.PortalDocument;
import com.eqms.dto.knowledge.KnowledgePortalDtos.PortalOverview;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.KnowledgeCategoryHierarchy;
import com.eqms.entity.KnowledgeCategoryLevel;
import com.eqms.entity.UserAccount;
import com.eqms.enums.KnowledgeField;
import com.eqms.repository.KnowledgeCategoryHierarchyRepository;
import com.eqms.service.DocumentService.KnowledgeEntry;
import com.eqms.util.DateTimeFormatUtils;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * The Knowledge portal: Knowledge Bases are the values of the selected hierarchy's determinator field,
 * the tree inside a Knowledge Base follows its ordered levels, and only Effective documents the user is
 * allowed to see are ever listed (visibility comes from {@link DocumentService#visibleKnowledgeEntries()}).
 */
@Service
public class KnowledgePortalService {

    static final String NO_VALUE_KEY = "__none__";
    private static final String MANAGE = "documents.admin.knowledge_categories.manage";

    private final DocumentService documentService;
    private final KnowledgeCategoryHierarchyRepository hierarchyRepository;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final AuditTrailService auditTrailService;
    private final JdbcTemplate jdbc;
    private final SystemConfigurationService systemConfigurationService;
    private final KnowledgeComponentService componentService;

    public KnowledgePortalService(
            DocumentService documentService,
            KnowledgeCategoryHierarchyRepository hierarchyRepository,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService,
            AuditTrailService auditTrailService,
            JdbcTemplate jdbc,
            SystemConfigurationService systemConfigurationService,
            KnowledgeComponentService componentService
    ) {
        this.documentService = documentService;
        this.hierarchyRepository = hierarchyRepository;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.auditTrailService = auditTrailService;
        this.jdbc = jdbc;
        this.systemConfigurationService = systemConfigurationService;
        this.componentService = componentService;
    }

    // ---- overview -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public PortalOverview overview(UUID hierarchyId) {
        UserAccount user = currentUserService.requireCurrentUser();
        List<KnowledgeCategoryHierarchy> active = hierarchyRepository.findAllByActiveTrueOrderByNameAsc();
        KnowledgeCategoryHierarchy selected = pickHierarchy(active, hierarchyId);
        List<HierarchyOption> options = active.stream()
                .map(h -> new HierarchyOption(h.getId(), h.getName(), h.isDefaultHierarchy())).toList();
        if (selected == null) {
            return new PortalOverview(options, null, null, null, null, List.of(), 0, 0, List.of(), List.of(), List.of(), List.of());
        }
        KnowledgeField determinator = field(selected.getDeterminatorField());
        List<KnowledgeEntry> entries = documentService.visibleKnowledgeEntries();
        Set<String> subscribed = subscribedKeys(user, determinator);

        Map<String, int[]> counts = new LinkedHashMap<>();
        Map<String, String> labels = new HashMap<>();
        for (KnowledgeEntry entry : entries) {
            KnowledgeField.Value value = determinator.valueOf(entry.document());
            String key = value == null ? NO_VALUE_KEY : value.key();
            labels.putIfAbsent(key, value == null ? "(Not set)" : value.label());
            counts.computeIfAbsent(key, k -> new int[1])[0]++;
        }
        List<KnowledgeBaseCard> cards = counts.entrySet().stream()
                .map(e -> new KnowledgeBaseCard(e.getKey(), labels.get(e.getKey()), e.getValue()[0], subscribed.contains(e.getKey())))
                .sorted(Comparator.comparing(KnowledgeBaseCard::label, String.CASE_INSENSITIVE_ORDER))
                .toList();

        Map<UUID, KnowledgeEntry> byId = entries.stream().collect(Collectors.toMap(e -> e.document().getId(), e -> e, (a, b) -> a));
        Map<UUID, long[]> stats = stats(byId.keySet(), user);
        return new PortalOverview(options, selected.getId(), selected.getName(), selected.getDeterminatorField(), componentService.nameOf(determinator.name()),
                selected.getLevels().stream().map(l -> componentService.nameOf(l.getFieldCode())).toList(),
                entries.size(), cards.size(), cards,
                top(byId, stats, s -> s[2] == 1, Comparator.comparingLong(PortalDocument::views).reversed()),
                top(byId, stats, s -> s[0] > 0, Comparator.comparingLong(PortalDocument::views).reversed()),
                top(byId, stats, s -> s[1] > 0, Comparator.comparingLong(PortalDocument::helpfulVotes).reversed()));
    }

    /** Which document field decides the Knowledge Base under the default hierarchy (any signed-in user). */
    @Transactional(readOnly = true)
    public com.eqms.dto.knowledge.KnowledgePortalDtos.DeterminatorInfo defaultDeterminator() {
        currentUserService.requireCurrentUser();
        return hierarchyRepository.findByDefaultHierarchyTrue()
                .flatMap(h -> KnowledgeField.parse(h.getDeterminatorField()))
                .map(f -> new com.eqms.dto.knowledge.KnowledgePortalDtos.DeterminatorInfo(f.name(), componentService.nameOf(f.name())))
                .orElse(new com.eqms.dto.knowledge.KnowledgePortalDtos.DeterminatorInfo(null, null));
    }

    // ---- browse ---------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public BrowseResult browse(UUID hierarchyId, String kb, List<String> path) {
        UserAccount user = currentUserService.requireCurrentUser();
        KnowledgeCategoryHierarchy hierarchy = pickHierarchy(hierarchyRepository.findAllByActiveTrueOrderByNameAsc(), hierarchyId);
        if (hierarchy == null || !StringUtils.hasText(kb)) {
            return new BrowseResult(List.of(), null, List.of(), List.of());
        }
        List<KnowledgeCategoryLevel> levels = hierarchy.getLevels();
        List<String> chosen = path == null ? List.of() : path.stream().filter(StringUtils::hasText).toList();
        if (chosen.size() > levels.size()) {
            chosen = chosen.subList(0, levels.size());
        }
        KnowledgeField determinator = field(hierarchy.getDeterminatorField());

        List<KnowledgeEntry> matching = new ArrayList<>();
        for (KnowledgeEntry entry : documentService.visibleKnowledgeEntries()) {
            if (!matches(determinator, entry.document(), kb)) continue;
            boolean ok = true;
            for (int i = 0; i < chosen.size() && ok; i++) {
                ok = matches(field(levels.get(i).getFieldCode()), entry.document(), chosen.get(i));
            }
            if (ok) matching.add(entry);
        }

        List<Crumb> crumbs = new ArrayList<>();
        crumbs.add(new Crumb(componentService.nameOf(determinator.name()), kb, labelFor(determinator, matching, kb)));
        for (int i = 0; i < chosen.size(); i++) {
            KnowledgeField f = field(levels.get(i).getFieldCode());
            crumbs.add(new Crumb(componentService.nameOf(f.name()), chosen.get(i), labelFor(f, matching, chosen.get(i))));
        }

        if (chosen.size() < levels.size()) {
            KnowledgeField next = field(levels.get(chosen.size()).getFieldCode());
            Map<String, int[]> counts = new LinkedHashMap<>();
            Map<String, String> labels = new HashMap<>();
            for (KnowledgeEntry entry : matching) {
                KnowledgeField.Value value = next.valueOf(entry.document());
                String key = value == null ? NO_VALUE_KEY : value.key();
                labels.putIfAbsent(key, value == null ? "(Not set)" : value.label());
                counts.computeIfAbsent(key, k -> new int[1])[0]++;
            }
            List<Folder> folders = counts.entrySet().stream()
                    .map(e -> new Folder(e.getKey(), labels.get(e.getKey()), e.getValue()[0]))
                    .sorted(Comparator.comparing(Folder::label, String.CASE_INSENSITIVE_ORDER)).toList();
            return new BrowseResult(crumbs, componentService.nameOf(next.name()), folders, List.of());
        }

        Map<UUID, KnowledgeEntry> byId = matching.stream().collect(Collectors.toMap(e -> e.document().getId(), e -> e, (a, b) -> a));
        Map<UUID, long[]> stats = stats(byId.keySet(), user);
        List<PortalDocument> documents = matching.stream()
                .sorted(Comparator.comparing((KnowledgeEntry e) -> Objects.toString(e.document().getDocumentName(), ""), String.CASE_INSENSITIVE_ORDER))
                .map(e -> portalDocument(e, stats.get(e.document().getId())))
                .toList();
        return new BrowseResult(crumbs, null, List.of(), documents);
    }

    // ---- search ---------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<PortalDocument> search(String query) {
        UserAccount user = currentUserService.requireCurrentUser();
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        if (q.length() < 3) {
            throw new IllegalArgumentException("Enter at least 3 characters to search");
        }
        List<KnowledgeEntry> hits = documentService.visibleKnowledgeEntries().stream()
                .filter(e -> Objects.toString(e.document().getDocumentNumber(), "").toLowerCase(Locale.ROOT).contains(q)
                        || Objects.toString(e.document().getDocumentName(), "").toLowerCase(Locale.ROOT).contains(q))
                .limit(50).toList();
        Map<UUID, long[]> stats = stats(hits.stream().map(e -> e.document().getId()).collect(Collectors.toSet()), user);
        return hits.stream().map(e -> portalDocument(e, stats.get(e.document().getId()))).toList();
    }

    // ---- engagement -----------------------------------------------------------------------

    /** Records that the current user opened a document from the portal (drives "Most Viewed"). */
    @Transactional
    public void recordView(UUID documentId) {
        UserAccount user = currentUserService.requireCurrentUser();
        requireVisible(documentId);
        jdbc.update("insert into knowledge_document_views (document_id, user_id) values (?, ?)", documentId, user.getId());
    }

    @Transactional
    public void giveFeedback(UUID documentId, boolean helpful) {
        UserAccount user = currentUserService.requireCurrentUser();
        requireVisible(documentId);
        jdbc.update("""
                insert into knowledge_document_feedback (document_id, user_id, helpful, updated_at) values (?, ?, ?, now())
                on conflict (document_id, user_id) do update set helpful = excluded.helpful, updated_at = now()
                """, documentId, user.getId(), helpful);
    }

    @Transactional
    public void setFeatured(UUID documentId, boolean featured) {
        UserAccount user = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(user, MANAGE)) {
            throw new AccessDeniedException("Knowledge management permission required to feature a document");
        }
        DocumentRecord document = requireVisible(documentId);
        int changed = featured
                ? jdbc.update("insert into knowledge_featured_documents (document_id, featured_by) values (?, ?) on conflict do nothing",
                        documentId, user.getId())
                : jdbc.update("delete from knowledge_featured_documents where document_id = ?", documentId);
        if (changed > 0) {
            auditTrailService.logAs(user, "DOCUMENT", document.getDocumentName(), document.getId(),
                    featured ? "KNOWLEDGE_DOCUMENT_FEATURED" : "KNOWLEDGE_DOCUMENT_UNFEATURED", null, null,
                    (featured ? "Featured " : "Removed from Featured: ") + document.getDocumentNumber() + " in the Knowledge portal",
                    List.of(new AuditTrailChangeResponse("Featured", featured ? "No" : "Yes", featured ? "Yes" : "No")));
        }
    }

    @Transactional
    public void subscribe(String fieldCode, String valueKey, boolean subscribe) {
        UserAccount user = currentUserService.requireCurrentUser();
        KnowledgeField field = KnowledgeField.parse(fieldCode).orElseThrow(() -> new IllegalArgumentException("Unknown field"));
        if (!StringUtils.hasText(valueKey)) {
            throw new IllegalArgumentException("A Knowledge Base is required");
        }
        if (subscribe) {
            jdbc.update("insert into knowledge_subscriptions (user_id, field_code, value_key) values (?, ?, ?) on conflict do nothing",
                    user.getId(), field.name(), valueKey);
        } else {
            jdbc.update("delete from knowledge_subscriptions where user_id = ? and field_code = ? and value_key = ?",
                    user.getId(), field.name(), valueKey);
        }
    }

    /** Users subscribed to the Knowledge Base a document belongs to, under any active hierarchy. */
    @Transactional(readOnly = true)
    public List<UUID> subscribersOf(DocumentRecord document) {
        Set<UUID> ids = new java.util.LinkedHashSet<>();
        for (KnowledgeCategoryHierarchy hierarchy : hierarchyRepository.findAllByActiveTrueOrderByNameAsc()) {
            KnowledgeField field = field(hierarchy.getDeterminatorField());
            KnowledgeField.Value value = field.valueOf(document);
            if (value == null) continue;
            ids.addAll(jdbc.queryForList("select user_id from knowledge_subscriptions where field_code = ? and value_key = ?",
                    UUID.class, field.name(), value.key()));
        }
        return new ArrayList<>(ids);
    }

    // ---- helpers --------------------------------------------------------------------------

    private DocumentRecord requireVisible(UUID documentId) {
        return documentService.visibleKnowledgeEntries().stream()
                .map(KnowledgeEntry::document)
                .filter(d -> d.getId().equals(documentId))
                .findFirst()
                .orElseThrow(() -> new AccessDeniedException("This document is not available in the Knowledge portal"));
    }

    private KnowledgeCategoryHierarchy pickHierarchy(List<KnowledgeCategoryHierarchy> active, UUID requested) {
        if (requested != null) {
            KnowledgeCategoryHierarchy hit = active.stream().filter(h -> h.getId().equals(requested)).findFirst().orElse(null);
            if (hit != null) return hit;
        }
        return active.stream().filter(KnowledgeCategoryHierarchy::isDefaultHierarchy).findFirst()
                .orElse(active.isEmpty() ? null : active.get(0));
    }

    private Set<String> subscribedKeys(UserAccount user, KnowledgeField field) {
        return Set.copyOf(jdbc.queryForList("select value_key from knowledge_subscriptions where user_id = ? and field_code = ?",
                String.class, user.getId(), field.name()));
    }

    /** id -> [views in the last 30 days, helpful votes, featured (0/1), my feedback (-1 none, 0 not helpful, 1 helpful)] */
    private Map<UUID, long[]> stats(Set<UUID> ids, UserAccount user) {
        Map<UUID, long[]> result = new HashMap<>();
        ids.forEach(id -> result.put(id, new long[]{0, 0, 0, -1}));
        if (ids.isEmpty()) return result;
        Instant since = Instant.now().minus(systemConfigurationService.getKnowledgePortalViewsWindowDays(), ChronoUnit.DAYS);
        jdbc.query("select document_id, count(*) c from knowledge_document_views where viewed_at >= ? group by document_id",
                rs -> { long[] s = result.get(UUID.fromString(rs.getString(1))); if (s != null) s[0] = rs.getLong(2); },
                java.sql.Timestamp.from(since));
        jdbc.query("select document_id, count(*) c from knowledge_document_feedback where helpful group by document_id",
                rs -> { long[] s = result.get(UUID.fromString(rs.getString(1))); if (s != null) s[1] = rs.getLong(2); });
        jdbc.query("select document_id from knowledge_featured_documents",
                rs -> { long[] s = result.get(UUID.fromString(rs.getString(1))); if (s != null) s[2] = 1; });
        jdbc.query("select document_id, helpful from knowledge_document_feedback where user_id = ?",
                rs -> { long[] s = result.get(UUID.fromString(rs.getString(1))); if (s != null) s[3] = rs.getBoolean(2) ? 1 : 0; },
                user.getId());
        return result;
    }

    private List<PortalDocument> top(Map<UUID, KnowledgeEntry> byId, Map<UUID, long[]> stats,
                                     java.util.function.Predicate<long[]> filter, Comparator<PortalDocument> order) {
        return byId.values().stream()
                .filter(e -> filter.test(stats.get(e.document().getId())))
                .map(e -> portalDocument(e, stats.get(e.document().getId())))
                .sorted(order.thenComparing(d -> Objects.toString(d.document().documentName(), ""), String.CASE_INSENSITIVE_ORDER))
                .limit(systemConfigurationService.getKnowledgePortalTopCount()).toList();
    }

    private PortalDocument portalDocument(KnowledgeEntry entry, long[] s) {
        long[] stat = s == null ? new long[]{0, 0, 0, -1} : s;
        Boolean mine = stat[3] < 0 ? null : stat[3] == 1;
        return new PortalDocument(toDocument(entry), stat[0], stat[1], stat[2] == 1, mine);
    }

    private KnowledgeBaseDocumentResponse toDocument(KnowledgeEntry entry) {
        DocumentRecord document = entry.document();
        var revision = entry.revision();
        return new KnowledgeBaseDocumentResponse(
                document.getId().toString(), document.getDocumentNumber(), document.getDocumentName(),
                revision.getRevisionNumber(), revision.getStatus() == null ? null : revision.getStatus().getLabel(),
                document.getStatus() == null ? null : document.getStatus().getLabel(),
                document.getDocumentType() == null ? null : document.getDocumentType().getName(),
                document.getBusinessUnit() == null ? null : document.getBusinessUnit().getName(),
                document.getDepartment() == null ? null : document.getDepartment().getName(),
                document.getOpenedBy() == null ? null : document.getOpenedBy().getFullName(),
                DateTimeFormatUtils.formatDateTime(revision.getCreatedAt()),
                DateTimeFormatUtils.formatDate(document.getEffectiveDate()),
                DateTimeFormatUtils.formatDate(document.getValidUntil()),
                document.isHasRelatedDocuments(), document.isHasCorrelatedDocuments(), document.isTemplate());
    }

    private static boolean matches(KnowledgeField field, DocumentRecord document, String key) {
        KnowledgeField.Value value = field.valueOf(document);
        return NO_VALUE_KEY.equals(key) ? value == null : value != null && value.key().equals(key);
    }

    private static String labelFor(KnowledgeField field, List<KnowledgeEntry> entries, String key) {
        if (NO_VALUE_KEY.equals(key)) return "(Not set)";
        return entries.stream().map(e -> field.valueOf(e.document())).filter(Objects::nonNull)
                .filter(v -> v.key().equals(key)).map(KnowledgeField.Value::label).findFirst().orElse(key);
    }

    private static KnowledgeField field(String code) {
        return KnowledgeField.parse(code).orElseThrow(() -> new IllegalStateException("Unknown knowledge field: " + code));
    }
}
