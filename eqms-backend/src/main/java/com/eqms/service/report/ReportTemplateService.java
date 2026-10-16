package com.eqms.service.report;

import com.eqms.dto.security.ResourceActionCapabilityResponse;
import com.eqms.dto.security.ResourceCapabilitiesResponse;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.entity.ElectronicSignature;
import com.eqms.service.AuditTrailService;
import com.eqms.service.EffectivePermissionService;
import com.eqms.service.SecurityChangeSignatureService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.stream.Stream;

/** Template configuration and metadata queries. Content authorization is deliberately untouched. */
@Service
public class ReportTemplateService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final EffectivePermissionService permissions;
    private final AuditTrailService audit;
    private final Map<String, ReportMetadataProvider> providers;
    private ReportWordService words;
    @org.springframework.beans.factory.annotation.Autowired
    public void configureWords(ReportWordService words) { this.words=words; }

    private SecurityChangeSignatureService signatures;
    /** REPORT-DEFINITION-SIGNATURE-2026-10-14: meaning of the signature on a change that alters report results or access (V579). */
    public static final String MEANING_DEFINITION_CHANGE = "REPORT_DEFINITION_CHANGE";
    /** Seeded by V582 (renamed from REPORT_GMP_APPROVAL). */
    public static final String MEANING_TEMPLATE_APPROVAL = "REPORT_TEMPLATE_APPROVAL";
    /** Seeded by V583: a version returned to draft. */
    public static final String MEANING_TEMPLATE_REJECTION = "REPORT_TEMPLATE_REJECTION";
    @org.springframework.beans.factory.annotation.Autowired
    public void configureSignatures(SecurityChangeSignatureService signatures) { this.signatures = signatures; }
    private ReportTemplateNumberService numbers;
    private ReportTemplateRevisionService revisions;
    @org.springframework.beans.factory.annotation.Autowired
    public void configureRevisions(ReportTemplateRevisionService revisions) { this.revisions = revisions; }
    @org.springframework.beans.factory.annotation.Autowired
    public void configureNumbers(ReportTemplateNumberService numbers) { this.numbers = numbers; }
    private ReportTypeService types;
    @org.springframework.beans.factory.annotation.Autowired
    public void configureTypes(ReportTypeService types) { this.types = types; }
    /** A Report Type that is disabled, or that the person has no permission for, cannot start or change a template or a run. */
    private void requireTypeUsable(UserAccount actor, String sourceCode) {
        if (types == null) return;
        types.requireUsable(sourceCode);
        if (!types.mayUse(actor, sourceCode)) throw new SecurityException("REPORT_SCOPE_DENIED");
    }
    private ReportPropertiesService properties;
    @org.springframework.beans.factory.annotation.Autowired
    public void configureProperties(ReportPropertiesService properties) { this.properties = properties; }

    /** The most rows a report file may hold: a setting of Report Properties (10,000 until an administrator changes it). */
    public int maxRows() { return properties == null ? ReportPropertiesService.DEFAULT_MAX_ROWS : properties.maxRows(); }
    /** The most people a scheduled report may be sent to (Report Properties). */
    public int maxScheduleRecipients() { return properties == null ? ReportPropertiesService.DEFAULT_MAX_SCHEDULE_RECIPIENTS : properties.maxScheduleRecipients(); }
    /** Minutes before a schedule is tried again after a temporary failure (Report Properties). */
    public int scheduleRetryMinutes() { return properties == null ? ReportPropertiesService.DEFAULT_SCHEDULE_RETRY_MINUTES : properties.scheduleRetryMinutes(); }
    /** The most source records a stored report may list, whatever the present setting; a setting that is lowered later must not make an old report undownloadable. */
    private static final int ROW_CEILING = 100_000;

    public ReportTemplateService(JdbcTemplate jdbc, ObjectMapper json, EffectivePermissionService permissions,
                                 AuditTrailService audit, List<ReportMetadataProvider> providers) {
        this.jdbc = jdbc; this.json = json; this.permissions = permissions; this.audit = audit;
        Map<String, ReportMetadataProvider> registry = new LinkedHashMap<>();
        for (var provider : providers) if (registry.put(provider.code(), provider) != null) throw new IllegalStateException("Duplicate report provider");
        this.providers = Map.copyOf(registry);
    }

    public void require(UserAccount actor, String... codes) {
        if (actor == null || actor.getId() == null || actor.getStatus() != UserStatus.Active) throw new SecurityException("REPORT_SCOPE_DENIED");
        Set<String> actual = permissions.getEffectivePermissionCodes(actor);
        if (Arrays.stream(codes).noneMatch(actual::contains)) throw new SecurityException("REPORT_SCOPE_DENIED");
    }

    public Map<String, Object> catalog(UserAccount actor, String search, int page, String sortBy, String direction) {
        return catalog(actor,search,page,sortBy,direction,Map.of());
    }

    public Map<String,Object> catalog(UserAccount actor,String search,int page,String sortBy,String direction,Map<String,String> filters) {
        return filteredCatalog(actor,search,page,sortBy,direction,filters,false);
    }

    private Map<String,Object> filteredCatalog(UserAccount actor,String search,int page,String sortBy,String direction,Map<String,String> filters,boolean admin) {
        if(admin) require(actor,"reports.definition.view","settings.configuration.view");
        else require(actor,"reports.catalog.view","report.module.view");
        String order=switch(sortBy==null?"displayName":sortBy) {
            case "displayName"->"d.display_name"; case "code"->"d.code"; case "category"->"d.category";
            case "sourceCode"->"d.source_code"; case "definitionVersion"->"d.definition_version";
            case "revision"->"(select rv.revision from report_template_revisions rv where rv.definition_code=d.code and rv.status='EFFECTIVE')";
            case "active"->"d.active"; case "updatedAt"->"d.updated_at"; case "createdAt"->"d.created_at";
            default->throw new IllegalArgumentException("REPORT_SORT_NOT_ALLOWED");
        };
        String term=search==null?"":search.trim();
        if(term.length()>200||!Set.of("asc","desc").contains(direction))throw new IllegalArgumentException("REPORT_SORT_NOT_ALLOWED");
        String pattern="%"+term.replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%";
        StringBuilder where=new StringBuilder(" from report_definitions d where d.source_code is not null and d.deleted_at is null and (d.display_name ilike ? or d.code ilike ? or d.description ilike ?)");
        List<Object> args=new ArrayList<>(List.of(pattern,pattern,pattern));
        // Records per page: chosen by the user from a fixed set, applied here (the screen only passes the choice).
        int pageSize;
        try { pageSize=Integer.parseInt(filters.getOrDefault("limit","10").isBlank()?"10":filters.getOrDefault("limit","10")); } catch(NumberFormatException invalid) { throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED"); }
        if(!Set.of(10,20,50,100).contains(pageSize)) throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
        if(!admin) {
            where.append(" and d.active=true and exists(select 1 from report_template_revisions rv where rv.definition_code=d.code and rv.status='EFFECTIVE') and exists(select 1 from report_template_role_scopes g join user_access_profiles u on u.access_profile_id=g.role_id join roles r on r.id=g.role_id where g.definition_code=d.code and u.user_id=? and r.is_active=true)");
            args.add(actor.getId());
        }
        for(var entry:filters.entrySet()) {
            String val=entry.getValue(); if(val==null||val.isBlank()||"limit".equals(entry.getKey()))continue;
            switch(entry.getKey()) {
                case "status" -> {
                    // Active / Disabled are states of a template with an effective revision; Draft / Pending Approval are the templates still being written.
                    switch (val) {
                        case "ACTIVE" -> where.append(" and d.active=true and exists(select 1 from report_template_revisions rv where rv.definition_code=d.code and rv.status='EFFECTIVE')");
                        case "DISABLED" -> where.append(" and d.active=false and exists(select 1 from report_template_revisions rv where rv.definition_code=d.code and rv.status='EFFECTIVE')");
                        case "DRAFT" -> where.append(" and not exists(select 1 from report_template_revisions rv where rv.definition_code=d.code and rv.status='EFFECTIVE') and d.approval_status<>'PENDING_APPROVAL'");
                        case "PENDING_APPROVAL" -> where.append(" and not exists(select 1 from report_template_revisions rv where rv.definition_code=d.code and rv.status='EFFECTIVE') and d.approval_status='PENDING_APPROVAL'");
                        default -> throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
                    }
                }
                case "sourceCode" -> {provider(val);where.append(" and d.source_code=?");args.add(val);}
                case "format" -> {if(!Set.of("PDF","XLSX","CSV").contains(val))throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");where.append(" and d.allowed_formats @> cast(? as jsonb)");args.add(write(List.of(val)));}
                case "orientation" -> {if(!Set.of("PORTRAIT","LANDSCAPE").contains(val))throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");where.append(" and coalesce(d.layout->>'orientation','LANDSCAPE')=?");args.add(val);}
                default -> throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
            }
        }
        long total=Objects.requireNonNullElse(jdbc.queryForObject("select count(*)"+where,Long.class,args.toArray()),0L);
        int safePage=Math.max(1,page);args.add(pageSize);args.add((safePage-1L)*pageSize);
        var rows=jdbc.queryForList("select d.code"+where+" order by "+order+" "+direction+",d.code asc limit ? offset ?",args.toArray());
        var data=rows.stream().map(row->admin?withRevisionInfo(definition(row.get("code").toString())):publicDefinition(row.get("code").toString())).toList();
        String sourceWhere=" from report_definitions d where d.source_code is not null and d.deleted_at is null";
        List<Object> sourceArgs=new ArrayList<>();
        if(!admin) {
            sourceWhere+=" and d.active=true and exists(select 1 from report_template_revisions rv where rv.definition_code=d.code and rv.status='EFFECTIVE') and exists(select 1 from report_template_role_scopes g join user_access_profiles u on u.access_profile_id=g.role_id join roles r on r.id=g.role_id where g.definition_code=d.code and u.user_id=? and r.is_active=true)";
            sourceArgs.add(actor.getId());
        }
        var sources=jdbc.queryForList("select distinct d.source_code"+sourceWhere+" order by d.source_code",sourceArgs.toArray()).stream()
            .map(row->{String code=row.get("source_code").toString();return Map.of("value",code,"label",provider(code).name());}).toList();
        return Map.of("data",data,"pagination",pagination(safePage,pageSize,total),"sources",sources);
    }

    private Map<String,Object> publicDefinition(String code) {
        var result = definition(code);
        result.remove("roleScopes");
        var source=provider(String.valueOf(result.get("sourceCode")));
        var allowed=allowedCodes(result);
        if (revisions != null) { Integer effective = revisions.effectiveNumber(code); result.put("revision", effective); result.put("effectiveRevision", effective); }
        result.put("filterFields", source.filters().stream().filter(field->!source.filterColumns().containsKey(field.get("code"))||allowed.contains(source.filterColumns().get(field.get("code")))).toList());
        return result;
    }

    public Map<String,Object> adminCatalog(UserAccount actor, String search, int page, String sortBy, String direction) {
        return adminCatalog(actor,search,page,sortBy,direction,Map.of());
    }
    public Map<String,Object> adminCatalog(UserAccount actor,String search,int page,String sortBy,String direction,Map<String,String> filters) {
        return filteredCatalog(actor,search,page,sortBy,direction,filters,true);
    }
    public List<Map<String,Object>> options(UserAccount actor, String code, String field, String search) {
        require(actor, "reports.run.create", "report.module.export");
        var definition = definition(code);
        if(definition.get("deletedAt")!=null)throw new SecurityException("REPORT_TEMPLATE_DELETED");
        if (!Boolean.TRUE.equals(definition.get("active"))) throw new SecurityException("REPORT_TEMPLATE_DISABLED");
        var provider = provider(String.valueOf(definition.get("sourceCode")));
        String identity = provider.lookupColumns().get(field);
        if (identity == null || search.length() > 200) throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
        if (!allowedCodes(definition).contains(field)) throw new SecurityException("REPORT_FIELD_NOT_ALLOWED");
        var query = provider.query(actor, scopes(actor,code), Map.of());
        var args = new ArrayList<>(query.arguments());
        args.add("%" + search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%");
        return jdbc.queryForList("select distinct cast(" + identity + " as text) as value," + provider.columns().get(field) + " as label "
                + query.fromWhere() + " and " + provider.columns().get(field) + " ilike ? order by label,value limit 100", args.toArray());
    }

    public Map<String, Object> definition(String code) {
        var rows = jdbc.queryForList("""
            select code, display_name as "displayName", description, category, classification, active,
            definition_version as "definitionVersion", source_code as "sourceCode", allowed_formats,
            retention_policy_id as "retentionPolicyId",layout,created_at as "createdAt",updated_at as "updatedAt",deleted_at as "deletedAt",
            gmp_use as "gmpUse", approval_status as "approvalStatus", approved_version as "approvedVersion", approved_by_user_id as "approvedByUserId",
            approved_at as "approvedAt", submitted_version as "submittedVersion", submitted_by_user_id as "submittedByUserId", submitted_at as "submittedAt",
            approval_comment as "approvalComment", name_format_id as "nameFormatId", name_values::text as "nameValues"
            from report_definitions where code=?
            """, code);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "REPORT_TEMPLATE_NOT_FOUND");
        var result = new LinkedHashMap<>(rows.getFirst());
        result.put("layout", read(String.valueOf(result.get("layout"))));
        result.put("nameValues", read(String.valueOf(result.get("nameValues"))));
        result.put("lifecycleStatus", lifecycleOf(result));
        result.put("allowedFormats", read(String.valueOf(result.remove("allowed_formats"))));
        result.put("fields", jdbc.queryForList("""
                select field_code as code, display_name as name, field_type as type, allowed,
                default_selected as "defaultSelected", required, display_order as "order"
                from report_definition_fields where definition_code=? order by display_order,field_code
                """, code));
        result.put("roleScopes", jdbc.queryForList("""
                select g.role_id as "roleId", r.name as "roleName", g.scope_code as scope
                from report_template_role_scopes g join roles r on r.id=g.role_id
                where g.definition_code=? order by r.name
                """, code));
        return result;
    }

    public List<String> scopes(UserAccount actor, String code) {
        require(actor, "reports.run.create", "report.module.export", "reports.artifact.download");
        var scopes = jdbc.queryForList("""
            select distinct g.scope_code from report_template_role_scopes g
            join user_access_profiles u on u.access_profile_id=g.role_id join roles r on r.id=g.role_id
            where u.user_id=? and g.definition_code=? and r.is_active=true
            """, String.class, actor.getId(), code);
        if (scopes.isEmpty()) throw new SecurityException("REPORT_SCOPE_DENIED");
        return scopes;
    }

    public Map<String, Object> adminDetail(UserAccount actor, String code) {
        require(actor, "reports.definition.view", "settings.configuration.view");
        var live = definition(code);
        return withRevisionInfo(overlay(live, revisions == null ? null : revisions.open(code)));
    }

    /** One revision of a template with its content; the revision of a template that was never approved is read from the live rows. */
    public Map<String, Object> revisionDetail(UserAccount actor, String code, int revision) {
        if (revisions == null) throw new IllegalStateException("REPORT_REVISIONS_UNAVAILABLE");
        require(actor, "reports.definition.view", "settings.configuration.view");
        return revisions.detail(actor, code, revision, definition(code));
    }

    public Map<String, Object> revisionList(UserAccount actor, String code, String status, String search, String sortBy, String sortDirection, int page, int limit) {
        if (revisions == null) throw new IllegalStateException("REPORT_REVISIONS_UNAVAILABLE");
        return revisions.list(actor, code, status, search, sortBy, sortDirection, page, limit);
    }

    public Map<String, Object> revisionCompare(UserAccount actor, String code, int revision, String with) {
        if (revisions == null) throw new IllegalStateException("REPORT_REVISIONS_UNAVAILABLE");
        return revisions.compare(actor, code, revision, with, definition(code));
    }

    /** What the Access & Scope tab asks for: the active Access Profiles, searched, filtered, sorted and paged here, with the scope the author has set for each. */
    public record RoleAssignment(UUID roleId, String scope) {}
    public record RoleSearch(String search, String assignment, String scope, String sortBy, String sortDirection, Integer page, Integer limit, List<RoleAssignment> assignments) {}

    /**
     * The Access Profiles of the Access & Scope tab. The scopes set so far travel with the request (they are not saved yet), so the server can filter and sort by
     * them: a profile is "assigned" when it has one of the scopes PERSONAL, DEPARTMENT, BUSINESS_UNIT or SYSTEM.
     */
    public Map<String, Object> searchRoles(UserAccount actor, RoleSearch request) {
        require(actor, "reports.definition.view", "reports.definition.manage", "settings.configuration.view", "settings.configuration.manage");
        RoleSearch query = request == null ? new RoleSearch(null, null, null, null, null, null, null, null) : request;
        List<RoleAssignment> assignments = query.assignments() == null ? List.of() : query.assignments();
        if (assignments.size() > 200) throw new IllegalArgumentException("REPORT_SCOPE_INVALID");
        Set<String> allowedScopes = Set.of("PERSONAL", "DEPARTMENT", "BUSINESS_UNIT", "SYSTEM");
        List<Map<String, String>> given = new ArrayList<>();
        for (var assignment : assignments) {
            if (assignment == null || assignment.roleId() == null || assignment.scope() == null || !allowedScopes.contains(assignment.scope())) throw new IllegalArgumentException("REPORT_SCOPE_INVALID");
            given.add(Map.of("role_id", assignment.roleId().toString(), "scope", assignment.scope()));
        }
        String term = query.search() == null ? "" : query.search().trim();
        if (term.length() > 200) throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
        String pattern = "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        String assignment = query.assignment() == null || query.assignment().isBlank() ? "ALL" : query.assignment();
        if (!Set.of("ALL", "ASSIGNED", "UNASSIGNED").contains(assignment)) throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
        String scope = query.scope() == null ? "" : query.scope();
        if (!scope.isBlank() && !allowedScopes.contains(scope)) throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
        String order = switch (query.sortBy() == null ? "name" : query.sortBy()) {
            case "name" -> "r.name";
            case "code" -> "r.code";
            case "scope" -> "a.scope";
            default -> throw new IllegalArgumentException("REPORT_SORT_NOT_ALLOWED");
        };
        String direction = "desc".equalsIgnoreCase(query.sortDirection()) ? "desc" : "asc";
        int limit = query.limit() == null ? 10 : query.limit();
        if (!Set.of(10, 20, 50, 100).contains(limit)) throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
        int page = Math.max(1, query.page() == null ? 1 : query.page());
        StringBuilder from = new StringBuilder(" from roles r left join jsonb_to_recordset(cast(? as jsonb)) as a(role_id uuid, scope text) on a.role_id = r.id where r.is_active=true and (r.name ilike ? or r.code ilike ?)");
        List<Object> args = new ArrayList<>(List.of(write(given), pattern, pattern));
        if ("ASSIGNED".equals(assignment)) from.append(" and a.scope is not null");
        if ("UNASSIGNED".equals(assignment)) from.append(" and a.scope is null");
        if (!scope.isBlank()) { from.append(" and a.scope=?"); args.add(scope); }
        long total = Objects.requireNonNullElse(jdbc.queryForObject("select count(*)" + from, Long.class, args.toArray()), 0L);
        args.add(limit);
        args.add((page - 1L) * limit);
        var rows = jdbc.queryForList("select r.id, r.name, r.code, a.scope" + from + " order by " + order + " " + direction + " nulls last, r.name asc limit ? offset ?", args.toArray());
        // A scope given to a profile that is not active any more cannot be saved; it is returned so that the author can remove it.
        var inactive = jdbc.queryForList("select r.id, r.name, a.scope from roles r join jsonb_to_recordset(cast(? as jsonb)) as a(role_id uuid, scope text) on a.role_id = r.id where r.is_active=false order by r.name", write(given));
        return Map.of("data", rows, "pagination", pagination(page, limit, total), "inactive", inactive);
    }

    public List<Map<String, Object>> roles(UserAccount actor) {
        require(actor, "reports.definition.manage", "settings.configuration.manage");
        return jdbc.queryForList("select id,name,code from roles where is_active=true order by name,id");
    }

    public List<Map<String, Object>> sources(UserAccount actor) {
        require(actor, "reports.definition.manage", "settings.configuration.manage");
        return providers.values().stream().filter(provider -> types == null || (types.isEnabled(provider.code()) && types.mayUse(actor, provider.code()))).map(provider -> Map.<String,Object>of("code", provider.code(), "name", provider.name(), "category", provider.category(), "description", provider.description(), "allowedScopes", provider.allowedScopes(), "fields", provider.labels(), "requiredFields", provider.requiredFields(),
            "dateFields",provider.filters().stream().filter(filter->"DATE".equals(filter.get("type"))).map(filter->provider.filterColumns().get(filter.get("code"))).filter(Objects::nonNull).filter(provider.columns()::containsKey).distinct().toList())).toList();
    }

    /** A new template. Its number is issued by the system from the numbering rule; the caller cannot choose it (REPORT-TEMPLATE-NUMBER-2026-10-14). */
    @Transactional
    public Map<String, Object> create(UserAccount actor, TemplateWrite request) {
        require(actor, "reports.definition.manage", "settings.configuration.manage");
        request = withDescriptionAsReason(request);
        // A new template is named by the one active Report Name Format; the author does not choose a rule (REPORT-NAME-FORMAT-ACTIVE-2026-10-15).
        request = withNameFormat(request, activeNameFormatId());
        if (numbers == null) throw new IllegalStateException("REPORT_NUMBERING_UNAVAILABLE");
        String code = numbers.allocate();
        var saved = save(actor, code, request, true);
        if (revisions == null) return saved;
        revisions.startFirst(code, actor.getId(), request.reason().trim());
        return withRevisionInfo(overlay(definition(code), revisions.open(code)));
    }

    @Transactional
    public Map<String, Object> save(UserAccount actor, String code, TemplateWrite request, boolean create) {
        require(actor, "reports.definition.manage", "settings.configuration.manage");
        request = withDescriptionAsReason(request);
        // An existing template keeps the format that named it; a request cannot move it to another rule.
        if (!create && request != null) request = withNameFormat(request, storedNameFormatId(code));
        if (request != null && blank(request.description())) throw new IllegalArgumentException("REPORT_DESCRIPTION_REQUIRED");
        if (request == null || request.reason() == null || request.reason().isBlank() || request.reason().length() > 1000) throw new IllegalArgumentException("REPORT_CHANGE_REASON_REQUIRED");
        if (code == null || !code.matches("[A-Z][A-Z0-9_.]{2,79}")) throw new IllegalArgumentException("REPORT_TEMPLATE_CODE_INVALID");
        String displayName = request.nameFormatId() == null ? request.displayName() : nameFor(code, create, request);
        if (displayName == null || displayName.isBlank() || displayName.length() > 255) throw new IllegalArgumentException("REPORT_TEMPLATE_NAME_REQUIRED");
        if (request.description() != null && request.description().length() > 2000) throw new IllegalArgumentException("REPORT_DESCRIPTION_TOO_LONG");
        if (request.description() == null || request.description().isBlank()) throw new IllegalArgumentException("REPORT_DESCRIPTION_REQUIRED");
        if(request.layout()!=null) { request.layout().validated();if(!request.layout().effectiveWordComponents().isEmpty()) {if(words==null)throw new IllegalStateException("REPORT_WORD_RENDERER_UNAVAILABLE");words.validate(request.layout());} }
        requireTypeUsable(actor, request.sourceCode());
        ReportMetadataProvider provider = provider(request.sourceCode());
        if (request.formats() == null || request.formats().isEmpty() || !Set.of("PDF", "XLSX", "CSV").containsAll(request.formats())) throw new IllegalArgumentException("REPORT_FORMAT_NOT_ALLOWED");
        if (request.fields() == null || request.fields().isEmpty() || request.fields().size() > provider.columns().size()) throw new IllegalArgumentException("REPORT_FIELD_NOT_ALLOWED");
        Set<String> seen = new HashSet<>();
        for (FieldWrite field : request.fields()) {
            if (field == null || field.code()==null || !provider.columns().containsKey(field.code()) || !seen.add(field.code()) || (field.required() && !field.allowed())) throw new IllegalArgumentException("REPORT_FIELD_NOT_ALLOWED");
        }
        if (!seen.containsAll(provider.requiredFields())) throw new IllegalArgumentException("REPORT_REQUIRED_FIELD_MISSING");
        for (var field : request.fields()) if (provider.requiredFields().contains(field.code()) && (!field.required() || !field.allowed())) throw new IllegalArgumentException("REPORT_REQUIRED_FIELD_MISSING");
        if(request.layout()!=null)for(var chart:request.layout().effectiveCharts()) {
            if(request.fields().stream().noneMatch(f->f.allowed()&&f.code().equals(chart.field())))throw new IllegalArgumentException("REPORT_CHART_FIELD_NOT_ALLOWED");
        }
        if (request.roleScopes() == null || request.roleScopes().size() > 200) throw new IllegalArgumentException("REPORT_SCOPE_INVALID");
        Set<UUID> seenRoles = new HashSet<>();
        for (var grant : request.roleScopes()) {
            if (grant == null || grant.roleId() == null || grant.scope()==null || !seenRoles.add(grant.roleId()) || !Set.of("PERSONAL", "DEPARTMENT", "BUSINESS_UNIT", "SYSTEM").contains(grant.scope())) throw new IllegalArgumentException("REPORT_SCOPE_INVALID");
            if (!provider.allowedScopes().contains(grant.scope())) throw new IllegalArgumentException("REPORT_SCOPE_NOT_ALLOWED_FOR_TYPE");
            Integer found = jdbc.queryForObject("select count(*) from roles where id=? and is_active=true", Integer.class, grant.roleId());
            if (!Integer.valueOf(1).equals(found)) throw new IllegalArgumentException("REPORT_ROLE_INACTIVE");
        }
        // REPORT-DEFINITION-SIGNATURE-2026-10-14: a change to what a report contains or who may see it needs an electronic signature,
        // checked before anything is written. A new definition always counts as such a change.
        boolean gmp = Boolean.TRUE.equals(request.gmpUse());
        // The enabled flag is not part of what a save writes (REPORT-TEMPLATE-REVISION-2026-10-14): it is on for a new template and is changed only by Disable / Enable.
        List<Map<String, Object>> activeRows = create ? List.of() : jdbc.queryForList("select active from report_definitions where code=?", code);
        boolean active = activeRows.isEmpty() || !Boolean.FALSE.equals(activeRows.getFirst().get("active"));
        String next = form(active, request.formats(), request.fields().stream().map(ReportTemplateService::fieldToken).toList(),
                request.roleScopes().stream().map(s -> s.roleId() + ":" + s.scope()).toList()) + ";gmp=" + gmp;
        boolean revised = !create && revisions != null && revisions.effective(code) != null;
        Map<String, Object> open = revised ? revisions.open(code) : null;
        Map<String, Object> basePayload = open == null ? null : revisions.payloadOf(open);
        // A revision that is effective is not edited: the next revision is started with Upgrade (REPORT-TEMPLATE-REVISION-2026-10-14).
        if (revised && open == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_UPGRADE_REQUIRED");
        String previous = create ? null : (basePayload != null ? formOfPayload(basePayload, active) : storedForm(code));
        boolean material = create || !next.equals(previous);
        if (material) requireSignedChange(actor, request.signatureToken());
        if (revised) return saveRevision(actor, code, request, provider, displayName.trim(), gmp, material, next, previous, open, basePayload);
        if (create) {
            jdbc.update("""
                insert into report_definitions(code,display_name,description,category,classification,active,source_code,allowed_formats,gmp_use,name_format_id,name_values,approval_status)
                values(?,?,?,'METADATA','REGULATED',?,?,cast(? as jsonb),?,?,cast(? as jsonb),'DRAFT')
                """, code, displayName.trim(), request.description(), true, provider.code(), write(request.formats()), gmp,
                    request.nameFormatId(), write(request.nameFormatId() == null ? Map.of() : nameValuesOf(request.nameValues())));
        } else {
            var before = jdbc.queryForList("select definition_version,source_code,deleted_at from report_definitions where code=? for update", code);
            if (before.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "REPORT_TEMPLATE_NOT_FOUND");
            if(before.getFirst().get("deleted_at")!=null)throw new ResponseStatusException(HttpStatus.CONFLICT,"REPORT_TEMPLATE_DELETED");
            if (!Objects.equals(((Number) before.getFirst().get("definition_version")).intValue(), request.version())) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TEMPLATE_VERSION_CHANGED");
            if (!Objects.equals(before.getFirst().get("source_code"), provider.code())) throw new IllegalArgumentException("REPORT_SOURCE_IMMUTABLE");
            jdbc.update("""
                update report_definitions set display_name=?,description=?,active=?,allowed_formats=cast(? as jsonb),gmp_use=?,
                name_format_id=?,name_values=cast(? as jsonb),approval_status='DRAFT',approval_comment=null,
                definition_version=definition_version+1,updated_at=now() where code=?
                """, displayName.trim(), request.description(), active, write(request.formats()), gmp,
                    request.nameFormatId(), write(request.nameFormatId() == null ? Map.of() : nameValuesOf(request.nameValues())), code);
        }
        if(request.layout()!=null) jdbc.update("update report_definitions set layout=cast(? as jsonb) where code=?",write(request.layout()),code);
        jdbc.update("delete from report_definition_fields where definition_code=?", code);
        int order = 0;
        for (var field : request.fields()) {
            jdbc.update("""
                insert into report_definition_fields(definition_code,field_code,display_name,field_type,allowed,default_selected,required,display_order)
                values(?,?,?,'TEXT',?,?,?,?)
                """, code, field.code(), provider.labels().get(field.code()), field.allowed(), field.allowed() && (field.defaultSelected() || field.required()), field.required(), order++);
        }
        jdbc.update("delete from report_template_role_scopes where definition_code=?", code);
        for (var grant : request.roleScopes()) jdbc.update("insert into report_template_role_scopes values(?,?,?)", code, grant.roleId(), grant.scope());
        ElectronicSignature signature = material ? signatures.record(actor, request.signatureToken(), MEANING_DEFINITION_CHANGE, "REPORT_DEFINITION",
                UUID.nameUUIDFromBytes(code.getBytes(StandardCharsets.UTF_8)), code, request.reason().trim(), previous, next) : null;
        Map<String, Object> after = definition(code);
        jdbc.update("insert into report_definition_versions(definition_code,version,snapshot,reason,changed_by_user_id) values(?,?,cast(? as jsonb),?,?)", code, after.get("definitionVersion"), write(after), request.reason().trim(), actor.getId());
        if (revisions != null && !create) revisions.touchLive(code, actor.getId(), request.reason().trim());
        String auditReason = request.reason().trim() + (signature == null ? "" : " [signature " + signature.getSignatureId() + "]");
        audit.logAs(actor, "REPORT_DEFINITION", code, UUID.nameUUIDFromBytes(code.getBytes(StandardCharsets.UTF_8)), create ? "REPORT_TEMPLATE_CREATED" : "REPORT_TEMPLATE_UPDATED", null, null, auditReason);
        return after;
    }

    /**
     * A change to a template that has an effective revision (REPORT-TEMPLATE-REVISION-2026-10-14). The live rows keep the effective revision, which
     * goes on running; what was written is kept in the open revision (the next revision, created by the first change) until it is approved.
     * Disabling a template takes effect at once; enabling it again is part of the revision and needs its approval.
     */
    private Map<String, Object> saveRevision(UserAccount actor, String code, TemplateWrite request, ReportMetadataProvider provider, String displayName, boolean gmp,
                                             boolean material, String next, String previous, Map<String, Object> open, Map<String, Object> basePayload) {
        var before = jdbc.queryForList("select definition_version,source_code,deleted_at,active from report_definitions where code=? for update", code);
        if (before.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "REPORT_TEMPLATE_NOT_FOUND");
        if (before.getFirst().get("deleted_at") != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TEMPLATE_DELETED");
        int liveVersion = ((Number) before.getFirst().get("definition_version")).intValue();
        int expected = open == null ? liveVersion : ReportTemplateRevisionService.versionOf(open);
        if (!Objects.equals(expected, request.version())) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TEMPLATE_VERSION_CHANGED");
        if (!Objects.equals(before.getFirst().get("source_code"), provider.code())) throw new IllegalArgumentException("REPORT_SOURCE_IMMUTABLE");
        Object layout = request.layout() != null ? json.valueToTree(request.layout())
                : basePayload != null ? basePayload.get("layout") : definition(code).get("layout");
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("displayName", displayName);
        payload.put("description", request.description());
        payload.put("sourceCode", provider.code());
        payload.put("gmpUse", gmp);
        payload.put("allowedFormats", request.formats());
        payload.put("nameFormatId", request.nameFormatId() == null ? null : request.nameFormatId().toString());
        payload.put("nameValues", request.nameFormatId() == null ? Map.of() : nameValuesOf(request.nameValues()));
        payload.put("layout", layout);
        List<Map<String, Object>> fields = new ArrayList<>();
        int order = 0;
        for (var field : request.fields()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("code", field.code());
            item.put("name", provider.labels().get(field.code()));
            item.put("type", "TEXT");
            item.put("allowed", field.allowed());
            item.put("defaultSelected", field.allowed() && (field.defaultSelected() || field.required()));
            item.put("required", field.required());
            item.put("order", order++);
            fields.add(item);
        }
        payload.put("fields", fields);
        List<Map<String, Object>> scopes = new ArrayList<>();
        for (var grant : request.roleScopes()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("roleId", grant.roleId().toString());
            item.put("roleName", jdbc.queryForObject("select name from roles where id=?", String.class, grant.roleId()));
            item.put("scope", grant.scope());
            scopes.add(item);
        }
        payload.put("roleScopes", scopes);
        String reason = request.reason().trim();
        if (open == null) revisions.startRevision(code, actor.getId(), liveVersion, payload, reason);
        else revisions.saveDraft(code, actor.getId(), payload, reason);
        ElectronicSignature signature = material ? signatures.record(actor, request.signatureToken(), MEANING_DEFINITION_CHANGE, "REPORT_DEFINITION",
                UUID.nameUUIDFromBytes(code.getBytes(StandardCharsets.UTF_8)), code, reason, previous, next) : null;
        var revision = revisions.open(code);
        audit.logAs(actor, "REPORT_DEFINITION", code, UUID.nameUUIDFromBytes(code.getBytes(StandardCharsets.UTF_8)),
                open == null ? "REPORT_TEMPLATE_REVISION_STARTED" : "REPORT_TEMPLATE_REVISION_UPDATED", null, "DRAFT",
                "Revision " + (revision == null ? "" : revision.get("revision")) + ": " + reason + (signature == null ? "" : " [signature " + signature.getSignatureId() + "]"));
        return withRevisionInfo(overlay(definition(code), revisions.open(code)));
    }

    /**
     * The description of a template is required (owner, 2026-10-14) and is what the author says about the template and the change, so it is kept as the
     * reason of the change when the request carries none. The record of a change always has a reason.
     */
    static TemplateWrite withDescriptionAsReason(TemplateWrite request) {
        if (request == null || !blank(request.reason()) || blank(request.description())) return request;
        return new TemplateWrite(request.version(), request.sourceCode(), request.displayName(), request.description(), request.active(), request.formats(), request.fields(),
                request.roleScopes(), request.description().trim().length() > 1000 ? request.description().trim().substring(0, 1000) : request.description().trim(), request.layout(),
                request.signatureToken(), request.gmpUse(), request.nameFormatId(), request.nameValues());
    }

    private static final Set<String> MANAGE = Set.of("reports.definition.manage", "settings.configuration.manage");

    /**
     * What the current user may do to this template now, one decision per action: the permission the action needs (ticked in a Permission Set), the state of the
     * template, and, for a decision on a revision, that the user is not its author or submitter. The screens only show what this says; every action is checked
     * again by the service that carries it out.
     */
    @Transactional(readOnly = true)
    public ResourceCapabilitiesResponse capabilities(UserAccount actor, String code) {
        if (actor == null || actor.getId() == null || actor.getStatus() != UserStatus.Active) throw new SecurityException("REPORT_SCOPE_DENIED");
        Set<String> held = permissions.getEffectivePermissionCodes(actor);
        if (Stream.of("reports.catalog.view", "report.module.view", "reports.definition.view", "settings.configuration.view").noneMatch(held::contains)) throw new SecurityException("REPORT_SCOPE_DENIED");
        var rows = jdbc.queryForList("select active, deleted_at, gmp_use, approval_status from report_definitions where code=?", code);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "REPORT_TEMPLATE_NOT_FOUND");
        var row = rows.getFirst();
        boolean deleted = row.get("deleted_at") != null;
        boolean active = Boolean.TRUE.equals(row.get("active"));
        boolean gmp = Boolean.TRUE.equals(row.get("gmp_use"));
        Map<String, Object> effective = revisions == null ? null : revisions.effective(code);
        Map<String, Object> open = revisions == null ? null : revisions.open(code);
        String openStatus = open == null ? null : String.valueOf(open.get("status"));
        boolean hasEffective = effective != null;
        String me = actor.getId().toString();
        boolean mine = open != null && (me.equals(String.valueOf(open.get("last_changed_by_user_id"))) || me.equals(String.valueOf(open.get("submitted_by_user_id"))));
        Map<String, ResourceActionCapabilityResponse> actions = new LinkedHashMap<>();
        actions.put("viewAuditTrail", decide(held, List.of("audit.view", "audittrail.module.view"), true, null, false));
        actions.put("viewRevisions", decide(held, List.of("reports.definition.view", "settings.configuration.view"), true, null, false));
        actions.put("edit", decide(held, MANAGE, !deleted && (!hasEffective || open != null), deleted ? "REPORT_TEMPLATE_DELETED" : "REPORT_UPGRADE_REQUIRED", false));
        actions.put("submitForApproval", decide(held, MANAGE, !deleted && open != null && "DRAFT".equals(openStatus) && active,
                deleted ? "REPORT_TEMPLATE_DELETED" : !active ? "REPORT_TEMPLATE_DISABLED" : "REPORT_TEMPLATE_NOT_DRAFT", false));
        boolean pending = open != null && "PENDING_APPROVAL".equals(openStatus);
        actions.put("approve", decide(held, List.of("reports.definition.approve"), pending && !mine, !pending ? "REPORT_TEMPLATE_NOT_PENDING" : "REPORT_APPROVER_IS_AUTHOR", true));
        actions.put("reject", decide(held, List.of("reports.definition.approve"), pending && !mine, !pending ? "REPORT_TEMPLATE_NOT_PENDING" : "REPORT_APPROVER_IS_AUTHOR", true));
        actions.put("upgrade", decide(held, List.of("reports.definition.upgrade"), !deleted && hasEffective && open == null,
                deleted ? "REPORT_TEMPLATE_DELETED" : !hasEffective ? "REPORT_NO_EFFECTIVE_REVISION" : "REPORT_REVISION_ALREADY_OPEN", false));
        actions.put("discardRevision", decide(held, List.of("reports.definition.discard_revision"), !deleted && hasEffective && open != null && open.get("snapshot") != null && "DRAFT".equals(openStatus),
                !hasEffective ? "REPORT_NO_EFFECTIVE_REVISION" : open == null ? "REPORT_NO_OPEN_REVISION" : "REPORT_TEMPLATE_NOT_DRAFT", false));
        actions.put("disable", decide(held, List.of("reports.definition.set_enabled"), !deleted && hasEffective && active, !hasEffective ? "REPORT_NO_EFFECTIVE_REVISION" : "REPORT_TEMPLATE_ALREADY_DISABLED", false));
        actions.put("enable", decide(held, List.of("reports.definition.set_enabled"), !deleted && hasEffective && !active, !hasEffective ? "REPORT_NO_EFFECTIVE_REVISION" : "REPORT_TEMPLATE_ALREADY_ENABLED", false));
        actions.put("delete", decide(held, MANAGE, !deleted && !gmp, deleted ? "REPORT_TEMPLATE_DELETED" : "REPORT_GMP_TEMPLATE_CANNOT_BE_DELETED", false));
        boolean hasScope = !deleted && hasEffective && active && !jdbc.queryForList("""
            select 1 from report_template_role_scopes g join user_access_profiles u on u.access_profile_id=g.role_id join roles r on r.id=g.role_id
            where g.definition_code=? and u.user_id=? and r.is_active=true limit 1
            """, code, actor.getId()).isEmpty();
        actions.put("createReport", decide(held, List.of("reports.run.create", "report.module.export"), hasScope,
                !hasEffective ? "REPORT_NOT_APPROVED" : !active ? "REPORT_TEMPLATE_DISABLED" : "REPORT_SCOPE_DENIED", false));
        return new ResourceCapabilitiesResponse("REPORT_TEMPLATE", code, lifecycleOf(Map.of("active", active, "approvalStatus", String.valueOf(row.get("approval_status")))),
                Instant.now().toString(), actions);
    }

    /** One decision: allowed only when the user holds one of the permissions and the state allows it; otherwise the stable reason code says why. */
    private static ResourceActionCapabilityResponse decide(Set<String> held, Collection<String> permissionCodes, boolean stateAllows, String stateReason, boolean signed) {
        String needed = permissionCodes.iterator().next();
        if (permissionCodes.stream().noneMatch(held::contains))
            return new ResourceActionCapabilityResponse(false, "REPORT_PERMISSION_REQUIRED", "The permission " + needed + " is required.", needed, signed);
        if (!stateAllows) return new ResourceActionCapabilityResponse(false, stateReason, stateReason, needed, signed);
        return new ResourceActionCapabilityResponse(true, null, null, needed, signed);
    }

    /**
     * Upgrade: starts the next revision of a template from its effective revision (REPORT-TEMPLATE-REVISION-2026-10-14). The effective revision goes
     * on running and is not changed; the new revision is a Draft with the same content, to be edited, submitted and approved. Only one revision can
     * be open at a time.
     */
    @Transactional
    public Map<String, Object> upgrade(UserAccount actor, String code, Integer version, String reason) {
        require(actor, "reports.definition.upgrade");
        if (reason == null || reason.isBlank() || reason.length() > 1000) throw new IllegalArgumentException("REPORT_CHANGE_REASON_REQUIRED");
        if (revisions == null) throw new IllegalStateException("REPORT_REVISIONS_UNAVAILABLE");
        var rows = jdbc.queryForList("select definition_version, deleted_at from report_definitions where code=? for update", code);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "REPORT_TEMPLATE_NOT_FOUND");
        if (rows.getFirst().get("deleted_at") != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TEMPLATE_DELETED");
        int liveVersion = ((Number) rows.getFirst().get("definition_version")).intValue();
        if (!Objects.equals(liveVersion, version)) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TEMPLATE_VERSION_CHANGED");
        var effective = revisions.effective(code);
        if (effective == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_NO_EFFECTIVE_REVISION");
        if (revisions.open(code) != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_REVISION_ALREADY_OPEN");
        var live = definition(code);
        Map<String, Object> payload = new LinkedHashMap<>();
        for (String key : List.of("displayName", "description", "sourceCode", "gmpUse", "allowedFormats", "nameValues", "layout", "fields", "roleScopes")) payload.put(key, live.get(key));
        payload.put("nameFormatId", live.get("nameFormatId") == null ? null : String.valueOf(live.get("nameFormatId")));
        revisions.startRevision(code, actor.getId(), liveVersion, payload, reason.trim());
        var started = revisions.open(code);
        audit.logAs(actor, "REPORT_DEFINITION", code, UUID.nameUUIDFromBytes(code.getBytes(StandardCharsets.UTF_8)), "REPORT_TEMPLATE_UPGRADED", "EFFECTIVE_REV" + effective.get("revision"),
                "DRAFT_REV" + started.get("revision"), reason.trim());
        return withRevisionInfo(overlay(definition(code), started));
    }

    /**
     * Disable or enable a template (owner, 2026-10-14: a confirmation and the audit trail are enough). It takes effect at once and does not change any
     * revision; a disabled template cannot run, and its schedules and library entry follow the enabled flag.
     */
    @Transactional
    public Map<String, Object> setEnabled(UserAccount actor, String code, boolean enabled, String reason) {
        require(actor, "reports.definition.set_enabled");
        if (reason != null && reason.length() > 1000) throw new IllegalArgumentException("REPORT_CHANGE_REASON_REQUIRED");
        var rows = jdbc.queryForList("select active, deleted_at from report_definitions where code=? for update", code);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "REPORT_TEMPLATE_NOT_FOUND");
        if (rows.getFirst().get("deleted_at") != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TEMPLATE_DELETED");
        // Enabled or disabled is a state of a template that can be used, that is, one with an effective revision; a template still being written is not offered for use.
        if (revisions != null && revisions.effective(code) == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_NO_EFFECTIVE_REVISION");
        if (Boolean.TRUE.equals(rows.getFirst().get("active")) == enabled) throw new ResponseStatusException(HttpStatus.CONFLICT, enabled ? "REPORT_TEMPLATE_ALREADY_ENABLED" : "REPORT_TEMPLATE_ALREADY_DISABLED");
        jdbc.update("update report_definitions set active=?,updated_at=now() where code=?", enabled, code);
        audit.logAs(actor, "REPORT_DEFINITION", code, UUID.nameUUIDFromBytes(code.getBytes(StandardCharsets.UTF_8)), enabled ? "REPORT_TEMPLATE_ENABLED" : "REPORT_TEMPLATE_DISABLED",
                enabled ? "INACTIVE" : "ACTIVE", enabled ? "ACTIVE" : "INACTIVE", blank(reason) ? (enabled ? "Enabled" : "Disabled") : reason.trim());
        return withRevisionInfo(overlay(definition(code), revisions == null ? null : revisions.open(code)));
    }

    /**
     * Discards the revision that is being written (a Draft started by Upgrade) so that the effective revision is the only one again. The revision stays
     * on record as Discarded. A revision that is pending approval is first returned to Draft by the reviewer; Rev 1 of a template is not discarded
     * (the template is deleted instead, when it may be).
     */
    @Transactional
    public Map<String, Object> discardRevision(UserAccount actor, String code, Integer version, String reason) {
        require(actor, "reports.definition.discard_revision");
        if (reason == null || reason.isBlank() || reason.length() > 1000) throw new IllegalArgumentException("REPORT_CHANGE_REASON_REQUIRED");
        if (revisions == null) throw new IllegalStateException("REPORT_REVISIONS_UNAVAILABLE");
        var rows = jdbc.queryForList("select deleted_at from report_definitions where code=? for update", code);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "REPORT_TEMPLATE_NOT_FOUND");
        if (rows.getFirst().get("deleted_at") != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TEMPLATE_DELETED");
        if (revisions.effective(code) == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_NO_EFFECTIVE_REVISION");
        var open = revisions.open(code);
        if (open == null || open.get("snapshot") == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_NO_OPEN_REVISION");
        if (!Objects.equals(ReportTemplateRevisionService.versionOf(open), version)) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TEMPLATE_VERSION_CHANGED");
        if (!"DRAFT".equals(open.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TEMPLATE_NOT_DRAFT");
        if (!revisions.discard(code, actor.getId(), reason.trim())) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_NO_OPEN_REVISION");
        audit.logAs(actor, "REPORT_DEFINITION", code, UUID.nameUUIDFromBytes(code.getBytes(StandardCharsets.UTF_8)), "REPORT_TEMPLATE_REVISION_DISCARDED",
                "DRAFT_REV" + open.get("revision"), "DISCARDED", reason.trim());
        return withRevisionInfo(overlay(definition(code), null));
    }

    /** Writes the content of an approved revision into the live rows; the live rows then hold the new effective revision. */
    private void applyToLive(String code, Map<String, Object> payload, UUID approverId, String signatureId) {
        Object layout = payload.get("layout");
        jdbc.update("""
            update report_definitions set display_name=?,description=?,allowed_formats=cast(? as jsonb),gmp_use=?,
            name_format_id=cast(? as uuid),name_values=cast(? as jsonb),layout=cast(? as jsonb),
            approval_status='APPROVED',approved_version=definition_version+1,approved_by_user_id=?,approved_at=now(),approval_signature_id=?,approval_comment=null,
            submitted_version=null,submitted_by_user_id=null,submitted_at=null,
            definition_version=definition_version+1,updated_at=now() where code=?
            """, payload.get("displayName"), payload.get("description"), write(payload.get("allowedFormats")),
                Boolean.TRUE.equals(payload.get("gmpUse")), payload.get("nameFormatId"), write(payload.get("nameValues") == null ? Map.of() : payload.get("nameValues")),
                layout == null ? null : write(layout), approverId, signatureId, code);
        jdbc.update("delete from report_definition_fields where definition_code=?", code);
        for (var field : fieldsOf(payload)) {
            jdbc.update("""
                insert into report_definition_fields(definition_code,field_code,display_name,field_type,allowed,default_selected,required,display_order)
                values(?,?,?,'TEXT',?,?,?,?)
                """, code, field.get("code"), field.get("name"), Boolean.TRUE.equals(field.get("allowed")), Boolean.TRUE.equals(field.get("defaultSelected")),
                    Boolean.TRUE.equals(field.get("required")), ((Number) field.getOrDefault("order", 0)).intValue());
        }
        jdbc.update("delete from report_template_role_scopes where definition_code=?", code);
        for (var grant : scopesOf(payload)) jdbc.update("insert into report_template_role_scopes values(?,?,?)", code, UUID.fromString(String.valueOf(grant.get("roleId"))), grant.get("scope"));
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> fieldsOf(Map<String, Object> payload) {
        return payload.get("fields") instanceof List<?> list ? (List<Map<String, Object>>) list : List.of();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> scopesOf(Map<String, Object> payload) {
        return payload.get("roleScopes") instanceof List<?> list ? (List<Map<String, Object>>) list : List.of();
    }

    /** The form (see form()) of the content of a revision that is kept as a payload. */
    @SuppressWarnings("unchecked")
    private static String formOfPayload(Map<String, Object> payload, boolean active) {
        List<String> formats = payload.get("allowedFormats") instanceof List<?> list ? list.stream().map(String::valueOf).toList() : List.of();
        List<String> fields = fieldsOf(payload).stream().map(f -> f.get("code") + ":" + f.get("allowed") + ":" + f.get("defaultSelected") + ":" + f.get("required")).toList();
        List<String> scopes = scopesOf(payload).stream().map(g -> g.get("roleId") + ":" + g.get("scope")).toList();
        return form(active, formats, fields, scopes) + ";gmp=" + Boolean.TRUE.equals(payload.get("gmpUse"));
    }

    /** The template as an administrator sees it: while a revision is being written, its content and approval state replace those of the effective revision. */
    private Map<String, Object> overlay(Map<String, Object> live, Map<String, Object> open) {
        if (revisions == null || open == null) return live;
        var result = new LinkedHashMap<>(live);
        var payload = revisions.payloadOf(open);
        if (payload != null) {
            for (String key : List.of("displayName", "description", "gmpUse", "allowedFormats", "nameFormatId", "nameValues", "layout", "fields", "roleScopes")) {
                if (payload.containsKey(key)) result.put(key, payload.get(key));
            }
            result.put("definitionVersion", ReportTemplateRevisionService.versionOf(open));
        }
        boolean pending = "PENDING_APPROVAL".equals(open.get("status"));
        if (payload != null) {
            result.put("approvalStatus", open.get("status"));
            result.put("submittedVersion", pending ? ReportTemplateRevisionService.versionOf(open) : null);
            result.put("submittedByUserId", open.get("submitted_by_user_id"));
            result.put("submittedAt", open.get("submitted_at"));
            result.put("approvalComment", open.get("approval_comment"));
            // The enabled state belongs to the effective revision, so a template that is disabled stays Inactive while the next revision is written.
            result.put("lifecycleStatus", Boolean.TRUE.equals(live.get("active")) ? lifecycleOf(result) : "INACTIVE");
        }
        return result;
    }

    /** Which revision is effective and which is being written, for the screens. */
    private Map<String, Object> withRevisionInfo(Map<String, Object> definition) {
        if (revisions == null) return definition;
        var result = definition instanceof LinkedHashMap ? definition : new LinkedHashMap<>(definition);
        String code = String.valueOf(result.get("code"));
        Integer effective = revisions.effectiveNumber(code);
        var open = revisions.open(code);
        result.put("effectiveRevision", effective);
        result.put("openRevision", open == null ? null : open.get("revision"));
        result.put("openRevisionStatus", open == null ? null : open.get("status"));
        result.put("revision", open != null ? open.get("revision") : effective);
        return result;
    }

    /**
     * Approval flow of a template version (REPORT-TEMPLATE-APPROVAL-2026-10-14): Draft -> Pending approval -> Approved, or back to Draft when
     * rejected. Every save returns the template to Draft, so only the version that was reviewed can run.
     */
    @Transactional
    public Map<String, Object> submitForApproval(UserAccount actor, String code, Integer version, String note) {
        require(actor, "reports.definition.manage");
        var row = lockedForReview(code, version);
        if (!"DRAFT".equals(row.get("approval_status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TEMPLATE_NOT_DRAFT");
        if (!Boolean.TRUE.equals(row.get("active"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TEMPLATE_DISABLED");
        if (row.containsKey("open_revision")) revisions.markSubmitted(code, actor.getId());
        else {
            jdbc.update("update report_definitions set approval_status='PENDING_APPROVAL', submitted_version=?, submitted_by_user_id=?, submitted_at=now(), approval_comment=? where code=?",
                    version, actor.getId(), blank(note) ? null : note.trim(), code);
            if (revisions != null) revisions.markSubmitted(code, actor.getId());
        }
        audit.logAs(actor, "REPORT_DEFINITION", code, UUID.nameUUIDFromBytes(code.getBytes(StandardCharsets.UTF_8)), "REPORT_TEMPLATE_SUBMITTED", "DRAFT", "PENDING_APPROVAL",
                "Submitted version " + version + (blank(note) ? "" : ": " + note.trim()));
        return withRevisionInfo(overlay(definition(code), revisions == null ? null : revisions.open(code)));
    }

    /** Approves the submitted version with an electronic signature. The approver must not be the author of that version or the submitter. */
    @Transactional
    public Map<String, Object> approve(UserAccount actor, String code, Integer version, String reason, String signatureToken) {
        require(actor, "reports.definition.approve");
        if (reason == null || reason.isBlank() || reason.length() > 1000) throw new IllegalArgumentException("REPORT_CHANGE_REASON_REQUIRED");
        var row = lockedForReview(code, version);
        requireIndependentReviewer(actor, code, version, row);
        if (signatures == null) throw new IllegalStateException("REPORT_SIGNATURE_UNAVAILABLE");
        signatures.requireValidToken(actor, signatureToken);
        String approved = "APPROVED_V" + version;
        ElectronicSignature signature = signatures.record(actor, signatureToken, MEANING_TEMPLATE_APPROVAL, "REPORT_DEFINITION",
                UUID.nameUUIDFromBytes(code.getBytes(StandardCharsets.UTF_8)), code, reason.trim(), "PENDING_APPROVAL", approved);
        if (row.containsKey("open_revision")) {
            // The revision that was reviewed becomes the effective one: its content replaces the live rows, the earlier revision is superseded.
            @SuppressWarnings("unchecked") Map<String, Object> openRevision = (Map<String, Object>) row.get("open_revision");
            var payload = revisions.payloadOf(openRevision);
            if (payload == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TEMPLATE_NOT_PENDING");
            applyToLive(code, payload, actor.getId(), signature.getSignatureId());
            var released = definition(code);
            jdbc.update("insert into report_definition_versions(definition_code,version,snapshot,reason,changed_by_user_id) values(?,?,cast(? as jsonb),?,?)",
                    code, released.get("definitionVersion"), write(released), reason.trim(), actor.getId());
            int number = revisions.release(code, ((Number) released.get("definitionVersion")).intValue(), actor.getId(), signature.getSignatureId(), released);
            approved = "APPROVED_REV" + number;
        } else {
            jdbc.update("update report_definitions set approval_status='APPROVED', approved_version=?, approved_by_user_id=?, approved_at=now(), approval_signature_id=?, approval_comment=null where code=?",
                    version, actor.getId(), signature.getSignatureId(), code);
            if (revisions != null && revisions.open(code) != null) {
                int number = revisions.release(code, version, actor.getId(), signature.getSignatureId(), definition(code));
                approved = "APPROVED_REV" + number;
            }
        }
        audit.logAs(actor, "REPORT_DEFINITION", code, UUID.nameUUIDFromBytes(code.getBytes(StandardCharsets.UTF_8)), "REPORT_TEMPLATE_APPROVED", "PENDING_APPROVAL", approved,
                reason.trim() + " [signature " + signature.getSignatureId() + "]");
        return withRevisionInfo(overlay(definition(code), revisions == null ? null : revisions.open(code)));
    }

    /** Returns the submitted version to Draft with the reason kept. Signed electronically (REPORT-TEMPLATE-APPROVAL-2026-10-14). */
    @Transactional
    public Map<String, Object> reject(UserAccount actor, String code, Integer version, String reason, String signatureToken) {
        require(actor, "reports.definition.approve");
        if (reason == null || reason.isBlank() || reason.length() > 1000) throw new IllegalArgumentException("REPORT_CHANGE_REASON_REQUIRED");
        var row = lockedForReview(code, version);
        requireIndependentReviewer(actor, code, version, row);
        if (signatures == null) throw new IllegalStateException("REPORT_SIGNATURE_UNAVAILABLE");
        signatures.requireValidToken(actor, signatureToken);
        ElectronicSignature signature = signatures.record(actor, signatureToken, MEANING_TEMPLATE_REJECTION, "REPORT_DEFINITION",
                UUID.nameUUIDFromBytes(code.getBytes(StandardCharsets.UTF_8)), code, reason.trim(), "PENDING_APPROVAL", "DRAFT_V" + version);
        if (row.containsKey("open_revision")) revisions.markReturned(code, reason.trim());
        else {
            jdbc.update("update report_definitions set approval_status='DRAFT', approval_comment=?, submitted_version=null, submitted_by_user_id=null, submitted_at=null where code=?",
                    reason.trim(), code);
            if (revisions != null) revisions.markReturned(code, reason.trim());
        }
        audit.logAs(actor, "REPORT_DEFINITION", code, UUID.nameUUIDFromBytes(code.getBytes(StandardCharsets.UTF_8)), "REPORT_TEMPLATE_REJECTED", "PENDING_APPROVAL", "DRAFT",
                reason.trim() + " [signature " + signature.getSignatureId() + "]");
        return withRevisionInfo(overlay(definition(code), revisions == null ? null : revisions.open(code)));
    }

    /** Locks the template and checks that the version named by the caller is the current one. */
    private Map<String, Object> lockedForReview(String code, Integer version) {
        var rows = jdbc.queryForList("select definition_version, active, deleted_at, approval_status, submitted_version, submitted_by_user_id from report_definitions where code=? for update", code);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "REPORT_TEMPLATE_NOT_FOUND");
        var row = rows.getFirst();
        if (row.get("deleted_at") != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TEMPLATE_DELETED");
        // A template with an effective revision is reviewed through its open revision (REPORT-TEMPLATE-REVISION-2026-10-14).
        if (revisions != null && revisions.effective(code) != null) {
            var open = revisions.open(code);
            if (open != null && open.get("snapshot") != null) {
                int openVersion = ReportTemplateRevisionService.versionOf(open);
                if (!Objects.equals(openVersion, version)) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TEMPLATE_VERSION_CHANGED");
                var view = new LinkedHashMap<String, Object>(row);
                boolean pending = "PENDING_APPROVAL".equals(open.get("status"));
                view.put("approval_status", open.get("status"));
                view.put("definition_version", openVersion);
                view.put("submitted_version", pending ? openVersion : null);
                view.put("submitted_by_user_id", open.get("submitted_by_user_id"));
                view.put("open_revision", open);
                return view;
            }
        }
        if (!Objects.equals(((Number) row.get("definition_version")).intValue(), version)) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TEMPLATE_VERSION_CHANGED");
        return row;
    }

    /** Only a submitted version can be decided, and never by the person who wrote it or who submitted it. */
    private void requireIndependentReviewer(UserAccount actor, String code, Integer version, Map<String, Object> row) {
        if (!"PENDING_APPROVAL".equals(row.get("approval_status")) || !Objects.equals(row.get("submitted_version") == null ? null : ((Number) row.get("submitted_version")).intValue(), version))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TEMPLATE_NOT_PENDING");
        List<String> authors = row.containsKey("open_revision")
                ? (((Map<?, ?>) row.get("open_revision")).get("last_changed_by_user_id") == null ? List.of() : List.of(String.valueOf(((Map<?, ?>) row.get("open_revision")).get("last_changed_by_user_id"))))
                : jdbc.queryForList("select changed_by_user_id::text from report_definition_versions where definition_code=? and version=? order by created_at desc limit 1", String.class, code, version);
        if (authors.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_AUTHOR_UNKNOWN");
        String me = actor.getId().toString();
        if (me.equals(authors.getFirst()) || me.equals(String.valueOf(row.get("submitted_by_user_id"))))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_APPROVER_IS_AUTHOR");
    }

    /**
     * The lifecycle the owner set (2026-10-14): Draft -> Pending approval -> Active -> Inactive. Disabling is a change, so a template that is
     * enabled again goes back through Draft and approval. Inactive is shown whatever the approval state.
     */
    static String lifecycleOf(Map<String, Object> definition) {
        // Active and Inactive are states of a template that has been approved; a template still being written is Draft or Pending Approval.
        if (!Boolean.TRUE.equals(definition.get("active")) && "APPROVED".equals(String.valueOf(definition.get("approvalStatus")))) return "INACTIVE";
        return switch (String.valueOf(definition.get("approvalStatus"))) {
            case "APPROVED" -> "ACTIVE";
            case "PENDING_APPROVAL" -> "PENDING_APPROVAL";
            default -> "DRAFT";
        };
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    public JsonNode snapshot(UserAccount actor, String code, Criteria criteria) {
        if (criteria == null) throw new IllegalArgumentException("REPORT_CRITERIA_REQUIRED");
        require(actor, "reports.run.create", "report.module.export");
        var definition = publicDefinition(code);
        if(definition.get("deletedAt")!=null)throw new SecurityException("REPORT_TEMPLATE_DELETED");
        if (!Boolean.TRUE.equals(definition.get("active"))) throw new IllegalArgumentException("REPORT_TEMPLATE_DISABLED");
        // REPORT-TEMPLATE-APPROVAL-2026-10-14: only the approved current version of a template runs.
        if (!"APPROVED".equals(definition.get("approvalStatus")) || definition.get("approvedVersion") == null
                || !Objects.equals(((Number) definition.get("approvedVersion")).intValue(), ((Number) definition.get("definitionVersion")).intValue()))
            throw new IllegalArgumentException("REPORT_NOT_APPROVED");
        if (criteria.version() != null && criteria.version() != ((Number) definition.get("definitionVersion")).intValue()) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TEMPLATE_VERSION_CHANGED");
        requireTypeUsable(actor, String.valueOf(definition.get("sourceCode")));
        var provider = provider(String.valueOf(definition.get("sourceCode")));
        var fields = fields(definition, criteria.fields());
        provider.query(actor, scopes(actor, code), criteria.filters() == null ? Map.of() : criteria.filters());
        validateFilters(definition,provider,criteria.filters()==null?Map.of():criteria.filters());
        sort(provider, criteria.sortBy(), criteria.direction());
        validateSortField(definition,criteria.sortBy()==null?provider.defaultSort():criteria.sortBy());
        validateCharts(definition,fields);
        // Every report has the company appearance of Report Properties, pinned into the run with the charts of this template.
        definition = new LinkedHashMap<>(definition);
        definition.put("layout", composedLayout(definition.get("layout")));
        return json.valueToTree(Map.of("protocol", "METADATA_V1", "definition", definition, "fields", fields,
                "filters", criteria.filters() == null ? Map.of() : criteria.filters(),
                "sortBy", criteria.sortBy() == null ? provider.defaultSort() : criteria.sortBy(),
                "direction", criteria.direction() == null ? "asc" : criteria.direction()));
    }

    @Transactional
    public void delete(UserAccount actor,String code,Integer version,String reason) {
        require(actor,"reports.definition.manage","settings.configuration.manage");
        if(reason==null||reason.isBlank()||reason.length()>1000)throw new IllegalArgumentException("REPORT_CHANGE_REASON_REQUIRED");
        var before=jdbc.queryForList("select definition_version,deleted_at,gmp_use from report_definitions where code=? and source_code is not null for update",code);
        if(before.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"REPORT_TEMPLATE_NOT_FOUND");
        // A GMP template is disabled, never deleted (owner decision 2026-10-14): the record of what was used must stay.
        if(Boolean.TRUE.equals(before.getFirst().get("gmp_use")))throw new ResponseStatusException(HttpStatus.CONFLICT,"REPORT_GMP_TEMPLATE_CANNOT_BE_DELETED");
        if(before.getFirst().get("deleted_at")!=null||!Objects.equals(((Number)before.getFirst().get("definition_version")).intValue(),version))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"REPORT_TEMPLATE_VERSION_CHANGED");
        jdbc.update("update report_definitions set deleted_at=now(),deleted_by_user_id=?,definition_version=definition_version+1,updated_at=now() where code=?",actor.getId(),code);
        var after=definition(code);
        jdbc.update("insert into report_definition_versions(definition_code,version,snapshot,reason,changed_by_user_id) values(?,?,cast(? as jsonb),?,?)",code,after.get("definitionVersion"),write(after),reason.trim(),actor.getId());
        audit.logAs(actor,"REPORT_DEFINITION",code,UUID.nameUUIDFromBytes(code.getBytes(StandardCharsets.UTF_8)),"REPORT_TEMPLATE_DELETED",null,null,reason.trim());
    }

    @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public Map<String, Object> preview(UserAccount actor, String code, Criteria criteria, int page) {
        var result = render(actor, code, snapshot(actor, code, criteria), Math.max(1, page), 10, false);
        return Map.of("definitionCode", code, "rows", result.rows(), "asOfAt", Instant.now().toString(), "pagination", pagination(Math.max(1, page), 10, result.total()));
    }

    @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public MetadataRows render(UserAccount actor, String code, JsonNode snapshot, int page, int limit, boolean export) {
        require(actor, "reports.run.create", "report.module.export");
        var definition = snapshot.path("definition");
        if (!code.equals(definition.path("code").asText())) throw new SecurityException("REPORT_SNAPSHOT_INVALID");
        var current = definition(code);
        if(current.get("deletedAt")!=null)throw new SecurityException("REPORT_TEMPLATE_DELETED");
        if (!Boolean.TRUE.equals(current.get("active"))) throw new SecurityException("REPORT_TEMPLATE_DISABLED");
        ReportMetadataProvider provider = provider(definition.path("sourceCode").asText());
        if (types != null && !types.mayUse(actor, provider.code())) throw new SecurityException("REPORT_SCOPE_DENIED");
        List<String> selected = json.convertValue(snapshot.path("fields"), json.getTypeFactory().constructCollectionType(List.class, String.class));
        // Current column restrictions also apply to old template versions.
        fields(current, selected);
        validateCharts(json.convertValue(definition,json.getTypeFactory().constructMapType(Map.class,String.class,Object.class)),selected);
        Map<String,Object> filters = json.convertValue(snapshot.path("filters"), json.getTypeFactory().constructMapType(Map.class, String.class, Object.class));
        validateFilters(current,provider,filters);
        var query = provider.query(actor, scopes(actor, code), filters);
        long total = Objects.requireNonNullElse(jdbc.queryForObject("select count(*) " + query.fromWhere(), Long.class, query.arguments().toArray()), 0L);
        String asOfAt = jdbc.queryForObject("select transaction_timestamp()::text",String.class);
        if (export && total > maxRows()) throw new IllegalArgumentException("REPORT_ROW_LIMIT_EXCEEDED");
        String projection = provider.identityColumn() + "," + String.join(",", selected.stream().map(provider.columns()::get).toList());
        String order = sort(provider, snapshot.path("sortBy").asText(), snapshot.path("direction").asText());
        validateSortField(current,snapshot.path("sortBy").asText());
        var args = new ArrayList<>(query.arguments()); args.add(limit); args.add((page - 1L) * limit);
        List<String> ids = new ArrayList<>(); List<List<String>> rows = new ArrayList<>();
        rows.add(selected.stream().map(provider.labels()::get).toList());
        jdbc.query("select " + projection + " " + query.fromWhere() + " order by " + order + "," + provider.identityColumn() + " asc limit ? offset ?", rs -> {
            ids.add(rs.getString(1)); List<String> row = new ArrayList<>();
            for (int i = 0; i < selected.size(); i++) row.add(Objects.toString(rs.getObject(i + 2), ""));
            rows.add(row);
        }, args.toArray());
        return new MetadataRows(rows, ids, total, asOfAt);
    }

    public void reauthorize(UserAccount actor, String code, JsonNode snapshot) {
        var definition = definition(code);
        if (!Boolean.TRUE.equals(definition.get("active"))) throw new SecurityException("REPORT_TEMPLATE_DISABLED");
        List<String> selected = json.convertValue(snapshot.path("fields"), json.getTypeFactory().constructCollectionType(List.class, String.class));
        fields(definition, selected);
        var provider = provider(snapshot.path("definition").path("sourceCode").asText());
        if (types != null && !types.mayUse(actor, provider.code())) throw new SecurityException("REPORT_SCOPE_DENIED");
        var query = provider.query(actor, scopes(actor, code), Map.of());
        JsonNode ids = snapshot.path("sourceDocumentIds");
        if (!ids.isArray()) throw new SecurityException("REPORT_SNAPSHOT_INVALID");
        Set<UUID> manifest = new HashSet<>();
        ids.forEach(id -> manifest.add(UUID.fromString(id.asText())));
        if (manifest.size() != ids.size() || manifest.size() > ROW_CEILING) throw new SecurityException("REPORT_SNAPSHOT_INVALID");
        if (!manifest.isEmpty()) {
            var args = new ArrayList<>(query.arguments()); args.addAll(manifest);
            Long found = jdbc.queryForObject("select count(*) " + query.fromWhere() + " and " + provider.identityColumn() + " in ("
                    + String.join(",", Collections.nCopies(manifest.size(), "?")) + ")", Long.class, args.toArray());
            if (!Long.valueOf(manifest.size()).equals(found)) throw new SecurityException("REPORT_AUTHORIZATION_CHANGED");
        }
    }

    private List<String> fields(Map<String,Object> definition, List<String> requested) {
        List<Map<String,Object>> fields = json.convertValue(definition.get("fields"), json.getTypeFactory().constructCollectionType(List.class, Map.class));
        var allowed = fields.stream().filter(f -> Boolean.TRUE.equals(f.get("allowed"))).map(f -> String.valueOf(f.get("code"))).toList();
        List<String> selected = requested == null || requested.isEmpty()
                ? fields.stream().filter(f -> Boolean.TRUE.equals(f.get("allowed")) && (Boolean.TRUE.equals(f.get("defaultSelected")) || Boolean.TRUE.equals(f.get("required")))).map(f -> String.valueOf(f.get("code"))).toList() : requested;
        if (selected.isEmpty() || selected.size() != new HashSet<>(selected).size() || !allowed.containsAll(selected)) throw new IllegalArgumentException("REPORT_FIELD_NOT_ALLOWED");
        var required = fields.stream().filter(f -> Boolean.TRUE.equals(f.get("required"))).map(f -> String.valueOf(f.get("code"))).toList();
        if (!selected.containsAll(required)) throw new IllegalArgumentException("REPORT_REQUIRED_FIELD_MISSING");
        return List.copyOf(selected);
    }
    /** The company appearance with the charts that the layout of a template holds. */
    private Object composedLayout(Object templateLayout) {
        if (properties == null) return templateLayout;
        try {
            var node = json.valueToTree(templateLayout);
            List<ReportLayout.Chart> charts = node == null || node.isNull() ? List.of() : json.treeToValue(node, ReportLayout.class).effectiveCharts();
            return json.convertValue(properties.appearance().withCharts(charts), Object.class);
        } catch (com.fasterxml.jackson.core.JsonProcessingException invalid) {
            throw new IllegalArgumentException("REPORT_LAYOUT_INVALID");
        }
    }
    private void validateCharts(Map<String,Object> definition,List<String> selected) {
        var node=json.valueToTree(definition.get("layout"));
        if(node==null||node.isNull())return;
        try {
            var layout=json.treeToValue(node,ReportLayout.class).validated();
            for(var chart:layout.effectiveCharts())if(!selected.contains(chart.field())||!allowedCodes(definition).contains(chart.field()))throw new IllegalArgumentException("REPORT_CHART_FIELD_NOT_SELECTED");
        } catch(com.fasterxml.jackson.core.JsonProcessingException invalid){throw new IllegalArgumentException("REPORT_LAYOUT_INVALID");}
    }
    @Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public byte[] previewPdf(UserAccount actor,String code,Criteria criteria,String title) throws Exception {
        var snapshot=snapshot(actor,code,criteria);var metadata=render(actor,code,snapshot,1,maxRows(),true);
        var layout=json.treeToValue(snapshot.path("definition").path("layout"),ReportLayout.class);
        var name=validatedTitle(title,snapshot.path("definition").path("displayName").asText());
        var values=Map.of("report.title",name,"report.code",code,"template.version",snapshot.path("definition").hasNonNull("revision")?snapshot.path("definition").path("revision").asText():snapshot.path("definition").path("definitionVersion").asText(),
            "report.executor",Objects.toString(actor.getFullName(),Objects.toString(actor.getUsername(),actor.getId().toString())),"report.generatedAt",Instant.now().toString(),"report.asOfAt",metadata.asOfAt(),
            "template.name",snapshot.path("definition").path("displayName").asText(),"report.runId","PREVIEW");
        var charts=ReportCharts.calculate(layout.effectiveCharts(),json.convertValue(snapshot.path("fields"),json.getTypeFactory().constructCollectionType(List.class,String.class)),metadata.rows());
        return words==null?ReportPresentationRenderer.render("PDF",metadata.rows(),layout,values,charts):words.render("PDF",metadata.rows(),layout,values,charts);
    }
    public static String validatedTitle(Object value,String fallback) {
        String title=value==null?fallback:String.valueOf(value).trim();
        if(title==null||title.isBlank()||title.length()>255||title.codePoints().anyMatch(Character::isISOControl))throw new IllegalArgumentException("REPORT_TITLE_INVALID");
        return title;
    }
    private void validateSortField(Map<String,Object> definition,String code) {
        List<Map<String,Object>> configured = json.convertValue(definition.get("fields"),json.getTypeFactory().constructCollectionType(List.class,Map.class));
        if (configured.stream().noneMatch(field->code.equals(field.get("code"))&&Boolean.TRUE.equals(field.get("allowed")))) throw new IllegalArgumentException("REPORT_SORT_NOT_ALLOWED");
    }
    private Set<String> allowedCodes(Map<String,Object> definition) {
        List<Map<String,Object>> configured=json.convertValue(definition.get("fields"),json.getTypeFactory().constructCollectionType(List.class,Map.class));
        return configured.stream().filter(field->Boolean.TRUE.equals(field.get("allowed"))).map(field->String.valueOf(field.get("code"))).collect(java.util.stream.Collectors.toSet());
    }
    private void validateFilters(Map<String,Object> definition,ReportMetadataProvider provider,Map<String,Object> filters) {
        provider.validateRun(filters);
        var allowed=allowedCodes(definition);
        for(var entry:filters.entrySet()) {
            String column=provider.filterColumns().get(entry.getKey());
            if (column!=null&&entry.getValue()!=null&&!entry.getValue().toString().isBlank()&&!allowed.contains(column)) throw new SecurityException("REPORT_FIELD_NOT_ALLOWED");
        }
    }
    private String sort(ReportMetadataProvider provider, String field, String direction) {
        String column = provider.columns().get(field == null ? provider.defaultSort() : field);
        if (column == null || (direction != null && !Set.of("asc", "desc").contains(direction))) throw new IllegalArgumentException("REPORT_SORT_NOT_ALLOWED");
        return column + ("desc".equals(direction) ? " desc nulls last" : " asc nulls last");
    }
    private ReportMetadataProvider provider(String code) {
        var provider = providers.get(code);
        if (provider == null) throw new IllegalArgumentException("REPORT_SOURCE_NOT_SUPPORTED");
        return provider;
    }
    private Map<String, Object> pagination(int page, int limit, long total) { return Map.of("page", page, "limit", limit, "total", total, "totalPages", (total + limit - 1) / limit); }
    private JsonNode read(String value) { try { return json.readTree(value); } catch (Exception invalid) { throw new IllegalStateException("REPORT_CONFIG_INVALID"); } }
    private String write(Object value) { try { return json.writeValueAsString(value); } catch (Exception invalid) { throw new IllegalArgumentException("REPORT_CONFIG_INVALID"); } }
    public record Criteria(Integer version, List<String> fields, Map<String,Object> filters, String sortBy, String direction) {}
    public record MetadataRows(List<List<String>> rows, List<String> sourceIds, long total, String asOfAt) {}
    public record FieldWrite(String code, boolean allowed, boolean defaultSelected, boolean required) {}
    public record RoleScope(UUID roleId, String scope) {}
    /** gmpUse: the template is for GMP decisions; it runs only after QA approval of its current version (REPORT-GMP-USE-APPROVAL-2026-10-14). */
    /**
     * nameFormatId: when set, the display name is built from that name format and nameValues (part order to typed value); displayName is then ignored.
     * Earlier constructors remain for callers that do not use these.
     */
    public record TemplateWrite(Integer version, String sourceCode, String displayName, String description, boolean active, List<String> formats, List<FieldWrite> fields, List<RoleScope> roleScopes, String reason, ReportLayout layout, String signatureToken, Boolean gmpUse, UUID nameFormatId, Map<String, String> nameValues) {
        /** A template keeps only its charts; the rest of a layout is the company appearance of Report Properties. */
        public TemplateWrite { layout = layout == null ? null : layout.chartsOnly(); }
        public TemplateWrite(Integer version,String sourceCode,String displayName,String description,boolean active,List<String> formats,List<FieldWrite> fields,List<RoleScope> roleScopes,String reason,ReportLayout layout,String signatureToken,Boolean gmpUse) {
            this(version,sourceCode,displayName,description,active,formats,fields,roleScopes,reason,layout,signatureToken,gmpUse,null,null);
        }
        public TemplateWrite(Integer version,String sourceCode,String displayName,String description,boolean active,List<String> formats,List<FieldWrite> fields,List<RoleScope> roleScopes,String reason,ReportLayout layout,String signatureToken) {
            this(version,sourceCode,displayName,description,active,formats,fields,roleScopes,reason,layout,signatureToken,null,null,null);
        }
        public TemplateWrite(Integer version,String sourceCode,String displayName,String description,boolean active,List<String> formats,List<FieldWrite> fields,List<RoleScope> roleScopes,String reason,ReportLayout layout) {
            this(version,sourceCode,displayName,description,active,formats,fields,roleScopes,reason,layout,null,null,null,null);
        }
        public TemplateWrite(Integer version,String sourceCode,String displayName,String description,boolean active,List<String> formats,List<FieldWrite> fields,List<RoleScope> roleScopes,String reason) {
            this(version,sourceCode,displayName,description,active,formats,fields,roleScopes,reason,null,null,null,null,null);
        }
    }

    /** The parts of a definition that decide what a report contains and who may see it. Name, description and layout are not in it. */
    static String fieldToken(FieldWrite field) {
        return field.code() + ":" + field.allowed() + ":" + (field.allowed() && (field.defaultSelected() || field.required())) + ":" + field.required();
    }

    static String form(boolean active, List<String> formats, List<String> fieldTokens, List<String> scopeTokens) {
        return "active=" + active + ";formats=" + formats.stream().sorted().toList() + ";fields=" + fieldTokens.stream().sorted().toList()
                + ";scopes=" + scopeTokens.stream().sorted().toList();
    }

    /** The stored form of a definition, written in the same shape as the form of a request; null when the definition does not exist. */
    private String storedForm(String code) {
        List<Map<String, Object>> rows = jdbc.queryForList("select active from report_definitions where code=?", code);
        if (rows.isEmpty()) return null;
        List<String> formats = jdbc.queryForList("select jsonb_array_elements_text(allowed_formats) from report_definitions where code=?", String.class, code);
        List<String> fields = jdbc.queryForList("select field_code||':'||allowed||':'||default_selected||':'||required from report_definition_fields where definition_code=?", String.class, code);
        List<String> scopes = jdbc.queryForList("select role_id::text||':'||scope_code from report_template_role_scopes where definition_code=?", String.class, code);
        boolean gmp = Boolean.TRUE.equals(jdbc.queryForObject("select gmp_use from report_definitions where code=?", Boolean.class, code));
        return form(Boolean.TRUE.equals(rows.getFirst().get("active")), formats, fields, scopes) + ";gmp=" + gmp;
    }

    /**
     * The display name of a template that uses a name format. Decision A (owner, 2026-10-14): a template keeps the name it has. A change of
     * the rule does not rename it; the name is built again from the rule only when the rule or the typed values of this template change.
     */
    /** The format that is active now, or null when none is (then a new template is named by typing). */
    private UUID activeNameFormatId() {
        List<String> ids = jdbc.queryForList("select id::text from report_name_formats where active=true", String.class);
        return ids.isEmpty() ? null : UUID.fromString(ids.getFirst());
    }

    /** The format that named a template: that of its open revision when it has one, else that of the template. */
    private UUID storedNameFormatId(String code) {
        if (revisions != null) {
            Map<String, Object> payload = revisions.payloadOf(revisions.open(code));
            if (payload != null) return payload.get("nameFormatId") == null ? null : UUID.fromString(String.valueOf(payload.get("nameFormatId")));
        }
        List<String> ids = jdbc.queryForList("select name_format_id::text from report_definitions where code=?", String.class, code);
        return ids.isEmpty() || ids.getFirst() == null ? null : UUID.fromString(ids.getFirst());
    }

    private static TemplateWrite withNameFormat(TemplateWrite request, UUID formatId) {
        if (request == null) return null;
        return new TemplateWrite(request.version(), request.sourceCode(), request.displayName(), request.description(), request.active(), request.formats(), request.fields(),
                request.roleScopes(), request.reason(), request.layout(), request.signatureToken(), request.gmpUse(), formatId, formatId == null ? Map.of() : request.nameValues());
    }

    private String nameFor(String code, boolean create, TemplateWrite request) {
        if (!create) {
            var stored = jdbc.queryForList("select display_name, name_format_id::text as format_id, name_values::text as values_json from report_definitions where code=?", code);
            if (!stored.isEmpty() && request.nameFormatId().toString().equals(stored.getFirst().get("format_id"))) {
                Map<?, ?> previous = json.convertValue(read(String.valueOf(stored.getFirst().get("values_json"))), Map.class);
                if (nameValuesOf(request.nameValues()).equals(previous)) return String.valueOf(stored.getFirst().get("display_name"));
            }
        }
        return resolveDisplayName(request.nameFormatId(), request.nameValues(), create);
    }

    /** The display name of a template that uses a name format (REPORT-NAME-FORMAT-2026-10-14). Refuses an inactive or unknown format. */
    private String resolveDisplayName(UUID formatId, Map<String, String> values, boolean requireActive) {
        var format = jdbc.queryForList("select separator, active from report_name_formats where id=?", formatId);
        if (format.isEmpty()) throw new IllegalArgumentException("REPORT_NAME_FORMAT_NOT_FOUND");
        // A new template needs the active format; a template that was named by a format that is no longer active may still have its name values changed.
        if (requireActive && !Boolean.TRUE.equals(format.getFirst().get("active"))) throw new IllegalArgumentException("REPORT_NAME_FORMAT_INACTIVE");
        var parts = jdbc.queryForList("select display_order, part_type, fixed_text, input_label, input_rule, max_length from report_name_format_parts where format_id=? order by display_order", formatId);
        return ReportNameFormatService.compose(parts, String.valueOf(format.getFirst().get("separator")), values);
    }

    private static Map<String, String> nameValuesOf(Map<String, String> values) {
        return values == null ? Map.of() : values;
    }

    private void requireSignedChange(UserAccount actor, String signatureToken) {
        if (signatures == null) throw new IllegalStateException("REPORT_SIGNATURE_UNAVAILABLE");
        signatures.requireValidToken(actor, signatureToken);
    }
}
