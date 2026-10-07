package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.AuditTrailService;
import com.eqms.service.EffectivePermissionService;
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
            case "active"->"d.active"; case "updatedAt"->"d.updated_at"; case "createdAt"->"d.created_at";
            default->throw new IllegalArgumentException("REPORT_SORT_NOT_ALLOWED");
        };
        String term=search==null?"":search.trim();
        if(term.length()>200||!Set.of("asc","desc").contains(direction))throw new IllegalArgumentException("REPORT_SORT_NOT_ALLOWED");
        String pattern="%"+term.replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%";
        StringBuilder where=new StringBuilder(" from report_definitions d where d.source_code is not null and d.deleted_at is null and (d.display_name ilike ? or d.code ilike ? or d.description ilike ?)");
        List<Object> args=new ArrayList<>(List.of(pattern,pattern,pattern));
        if(!admin) {
            where.append(" and d.active=true and exists(select 1 from report_template_role_scopes g join user_access_profiles u on u.access_profile_id=g.role_id join roles r on r.id=g.role_id where g.definition_code=d.code and u.user_id=? and r.is_active=true)");
            args.add(actor.getId());
        }
        for(var entry:filters.entrySet()) {
            String val=entry.getValue(); if(val==null||val.isBlank())continue;
            switch(entry.getKey()) {
                case "status" -> { if(!Set.of("ACTIVE","DISABLED").contains(val))throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");where.append(" and d.active=?");args.add("ACTIVE".equals(val)); }
                case "sourceCode" -> {provider(val);where.append(" and d.source_code=?");args.add(val);}
                case "format" -> {if(!Set.of("PDF","XLSX","CSV").contains(val))throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");where.append(" and d.allowed_formats @> cast(? as jsonb)");args.add(write(List.of(val)));}
                case "orientation" -> {if(!Set.of("PORTRAIT","LANDSCAPE").contains(val))throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");where.append(" and coalesce(d.layout->>'orientation','LANDSCAPE')=?");args.add(val);}
                default -> throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
            }
        }
        long total=Objects.requireNonNullElse(jdbc.queryForObject("select count(*)"+where,Long.class,args.toArray()),0L);
        int safePage=Math.max(1,page);args.add(10);args.add((safePage-1L)*10);
        var rows=jdbc.queryForList("select d.code"+where+" order by "+order+" "+direction+",d.code asc limit ? offset ?",args.toArray());
        var data=rows.stream().map(row->admin?definition(row.get("code").toString()):publicDefinition(row.get("code").toString())).toList();
        String sourceWhere=" from report_definitions d where d.source_code is not null and d.deleted_at is null";
        List<Object> sourceArgs=new ArrayList<>();
        if(!admin) {
            sourceWhere+=" and d.active=true and exists(select 1 from report_template_role_scopes g join user_access_profiles u on u.access_profile_id=g.role_id join roles r on r.id=g.role_id where g.definition_code=d.code and u.user_id=? and r.is_active=true)";
            sourceArgs.add(actor.getId());
        }
        var sources=jdbc.queryForList("select distinct d.source_code"+sourceWhere+" order by d.source_code",sourceArgs.toArray()).stream()
            .map(row->{String code=row.get("source_code").toString();return Map.of("value",code,"label",provider(code).name());}).toList();
        return Map.of("data",data,"pagination",pagination(safePage,10,total),"sources",sources);
    }

    private Map<String,Object> publicDefinition(String code) {
        var result = definition(code);
        result.remove("roleScopes");
        var source=provider(String.valueOf(result.get("sourceCode")));
        var allowed=allowedCodes(result);
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
            retention_policy_id as "retentionPolicyId",layout,created_at as "createdAt",updated_at as "updatedAt",deleted_at as "deletedAt" from report_definitions where code=?
            """, code);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "REPORT_TEMPLATE_NOT_FOUND");
        var result = new LinkedHashMap<>(rows.getFirst());
        result.put("layout", read(String.valueOf(result.get("layout"))));
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
        return definition(code);
    }

    public List<Map<String, Object>> roles(UserAccount actor) {
        require(actor, "reports.definition.manage", "settings.configuration.manage");
        return jdbc.queryForList("select id,name,code from roles where is_active=true order by name,id");
    }

    public List<Map<String, Object>> sources(UserAccount actor) {
        require(actor, "reports.definition.manage", "settings.configuration.manage");
        return providers.values().stream().map(provider -> Map.<String,Object>of("code", provider.code(), "name", provider.name(), "fields", provider.labels(), "requiredFields", provider.requiredFields(),
            "dateFields",provider.filters().stream().filter(filter->"DATE".equals(filter.get("type"))).map(filter->provider.filterColumns().get(filter.get("code"))).filter(Objects::nonNull).filter(provider.columns()::containsKey).distinct().toList())).toList();
    }

    @Transactional
    public Map<String, Object> save(UserAccount actor, String code, TemplateWrite request, boolean create) {
        require(actor, "reports.definition.manage", "settings.configuration.manage");
        if (request == null || request.reason() == null || request.reason().isBlank() || request.reason().length() > 1000) throw new IllegalArgumentException("REPORT_CHANGE_REASON_REQUIRED");
        if (code == null || !code.matches("[A-Z][A-Z0-9_]{2,79}")) throw new IllegalArgumentException("REPORT_TEMPLATE_CODE_INVALID");
        if (request.displayName() == null || request.displayName().isBlank() || request.displayName().length() > 255) throw new IllegalArgumentException("REPORT_TEMPLATE_NAME_REQUIRED");
        if (request.description() != null && request.description().length() > 2000) throw new IllegalArgumentException("REPORT_DESCRIPTION_TOO_LONG");
        if(request.layout()!=null) { request.layout().validated();if(!request.layout().effectiveWordComponents().isEmpty()) {if(words==null)throw new IllegalStateException("REPORT_WORD_RENDERER_UNAVAILABLE");words.validate(request.layout());} }
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
            Integer found = jdbc.queryForObject("select count(*) from roles where id=? and is_active=true", Integer.class, grant.roleId());
            if (!Integer.valueOf(1).equals(found)) throw new IllegalArgumentException("REPORT_ROLE_INACTIVE");
        }
        if (create) {
            jdbc.update("""
                insert into report_definitions(code,display_name,description,category,classification,active,source_code,allowed_formats)
                values(?,?,?,'METADATA','REGULATED',?,?,cast(? as jsonb))
                """, code, request.displayName().trim(), request.description(), request.active(), provider.code(), write(request.formats()));
        } else {
            var before = jdbc.queryForList("select definition_version,source_code,deleted_at from report_definitions where code=? for update", code);
            if (before.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "REPORT_TEMPLATE_NOT_FOUND");
            if(before.getFirst().get("deleted_at")!=null)throw new ResponseStatusException(HttpStatus.CONFLICT,"REPORT_TEMPLATE_DELETED");
            if (!Objects.equals(((Number) before.getFirst().get("definition_version")).intValue(), request.version())) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TEMPLATE_VERSION_CHANGED");
            if (!Objects.equals(before.getFirst().get("source_code"), provider.code())) throw new IllegalArgumentException("REPORT_SOURCE_IMMUTABLE");
            jdbc.update("""
                update report_definitions set display_name=?,description=?,active=?,allowed_formats=cast(? as jsonb),
                definition_version=definition_version+1,updated_at=now() where code=?
                """, request.displayName().trim(), request.description(), request.active(), write(request.formats()), code);
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
        Map<String, Object> after = definition(code);
        jdbc.update("insert into report_definition_versions(definition_code,version,snapshot,reason,changed_by_user_id) values(?,?,cast(? as jsonb),?,?)", code, after.get("definitionVersion"), write(after), request.reason().trim(), actor.getId());
        audit.logAs(actor, "REPORT_DEFINITION", code, UUID.nameUUIDFromBytes(code.getBytes(StandardCharsets.UTF_8)), create ? "REPORT_TEMPLATE_CREATED" : "REPORT_TEMPLATE_UPDATED", null, null, request.reason().trim());
        return after;
    }

    public JsonNode snapshot(UserAccount actor, String code, Criteria criteria) {
        if (criteria == null) throw new IllegalArgumentException("REPORT_CRITERIA_REQUIRED");
        require(actor, "reports.run.create", "report.module.export");
        var definition = publicDefinition(code);
        if(definition.get("deletedAt")!=null)throw new SecurityException("REPORT_TEMPLATE_DELETED");
        if (!Boolean.TRUE.equals(definition.get("active"))) throw new IllegalArgumentException("REPORT_TEMPLATE_DISABLED");
        if (criteria.version() != null && criteria.version() != ((Number) definition.get("definitionVersion")).intValue()) throw new ResponseStatusException(HttpStatus.CONFLICT, "REPORT_TEMPLATE_VERSION_CHANGED");
        var provider = provider(String.valueOf(definition.get("sourceCode")));
        var fields = fields(definition, criteria.fields());
        provider.query(actor, scopes(actor, code), criteria.filters() == null ? Map.of() : criteria.filters());
        validateFilters(definition,provider,criteria.filters()==null?Map.of():criteria.filters());
        sort(provider, criteria.sortBy(), criteria.direction());
        validateSortField(definition,criteria.sortBy()==null?provider.defaultSort():criteria.sortBy());
        validateCharts(definition,fields);
        return json.valueToTree(Map.of("protocol", "METADATA_V1", "definition", definition, "fields", fields,
                "filters", criteria.filters() == null ? Map.of() : criteria.filters(),
                "sortBy", criteria.sortBy() == null ? provider.defaultSort() : criteria.sortBy(),
                "direction", criteria.direction() == null ? "asc" : criteria.direction()));
    }

    @Transactional
    public void delete(UserAccount actor,String code,Integer version,String reason) {
        require(actor,"reports.definition.manage","settings.configuration.manage");
        if(reason==null||reason.isBlank()||reason.length()>1000)throw new IllegalArgumentException("REPORT_CHANGE_REASON_REQUIRED");
        var before=jdbc.queryForList("select definition_version,deleted_at from report_definitions where code=? and source_code is not null for update",code);
        if(before.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"REPORT_TEMPLATE_NOT_FOUND");
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
        List<String> selected = json.convertValue(snapshot.path("fields"), json.getTypeFactory().constructCollectionType(List.class, String.class));
        // Current column restrictions also apply to old template versions.
        fields(current, selected);
        validateCharts(json.convertValue(definition,json.getTypeFactory().constructMapType(Map.class,String.class,Object.class)),selected);
        Map<String,Object> filters = json.convertValue(snapshot.path("filters"), json.getTypeFactory().constructMapType(Map.class, String.class, Object.class));
        validateFilters(current,provider,filters);
        var query = provider.query(actor, scopes(actor, code), filters);
        long total = Objects.requireNonNullElse(jdbc.queryForObject("select count(*) " + query.fromWhere(), Long.class, query.arguments().toArray()), 0L);
        String asOfAt = jdbc.queryForObject("select transaction_timestamp()::text",String.class);
        if (export && total > 10000) throw new IllegalArgumentException("REPORT_ROW_LIMIT_EXCEEDED");
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
        var query = provider.query(actor, scopes(actor, code), Map.of());
        JsonNode ids = snapshot.path("sourceDocumentIds");
        if (!ids.isArray()) throw new SecurityException("REPORT_SNAPSHOT_INVALID");
        Set<UUID> manifest = new HashSet<>();
        ids.forEach(id -> manifest.add(UUID.fromString(id.asText())));
        if (manifest.size() != ids.size() || manifest.size() > 10000) throw new SecurityException("REPORT_SNAPSHOT_INVALID");
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
        var snapshot=snapshot(actor,code,criteria);var metadata=render(actor,code,snapshot,1,10000,true);
        var layout=json.treeToValue(snapshot.path("definition").path("layout"),ReportLayout.class);
        var name=validatedTitle(title,snapshot.path("definition").path("displayName").asText());
        var values=Map.of("report.title",name,"report.code",code,"template.version",snapshot.path("definition").path("definitionVersion").asText(),
            "report.executor",Objects.toString(actor.getFullName(),Objects.toString(actor.getUsername(),actor.getId().toString())),"report.generatedAt",Instant.now().toString(),"report.asOfAt",metadata.asOfAt());
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
    public record TemplateWrite(Integer version, String sourceCode, String displayName, String description, boolean active, List<String> formats, List<FieldWrite> fields, List<RoleScope> roleScopes, String reason, ReportLayout layout) {
        public TemplateWrite(Integer version,String sourceCode,String displayName,String description,boolean active,List<String> formats,List<FieldWrite> fields,List<RoleScope> roleScopes,String reason) {
            this(version,sourceCode,displayName,description,active,formats,fields,roleScopes,reason,null);
        }
    }
}
