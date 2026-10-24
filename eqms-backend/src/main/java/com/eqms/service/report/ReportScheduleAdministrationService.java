package com.eqms.service.report;

import com.eqms.util.DateTimeFormatUtils;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

@Service
public class ReportScheduleAdministrationService {
    private final JdbcTemplate jdbc;private final ReportTemplateService templates;private final PermissionEvaluationService permissions;
    private final UserAccountRepository users;private final AuditTrailService audit;private final ObjectMapper json;
    public ReportScheduleAdministrationService(JdbcTemplate jdbc,ReportTemplateService templates,PermissionEvaluationService permissions,UserAccountRepository users,AuditTrailService audit,ObjectMapper json){this.jdbc=jdbc;this.templates=templates;this.permissions=permissions;this.users=users;this.audit=audit;this.json=json;}
    public Map<String,Object> list(UserAccount actor,String search,String status,int page,String sort,String direction) {
        templates.require(actor,"reports.schedule.view","report.module.view");
        if(search.length()>200||!Set.of("","ACTIVE","PAUSED","SUSPENDED_AUTHORIZATION_CHANGED","SUSPENDED_INVALID_SCHEDULE","SUSPENDED_TEMPLATE_NOT_APPROVED","SUSPENDED_TEMPLATE_DISABLED").contains(status)||!Set.of("asc","desc").contains(direction))throw new IllegalArgumentException("REPORT_SCHEDULE_FILTER_INVALID");
        String order=switch(sort){case "name"->"s.name";case "nextRunAt"->"s.next_run_at";case "status"->"s.status";default->throw new IllegalArgumentException("REPORT_SORT_NOT_ALLOWED");};
        boolean all=permissions.hasPermission(actor,"reports.schedule.manage");
        String where=" from report_schedules s where s.name ilike ? and (?='' or s.status=?)"+(all?"":" and s.creator_user_id=?");
        var args=new ArrayList<Object>(List.of("%"+search.replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%",status,status));if(!all)args.add(actor.getId());
        long total=Objects.requireNonNullElse(jdbc.queryForObject("select count(*)"+where,Long.class,args.toArray()),0L);
        int safePage=Math.max(1,page);args.add((safePage-1L)*10);
        var rows=jdbc.queryForList("select s.id,s.name,s.definition_code as \"definitionCode\",s.cron_expression as \"cronExpression\",s.requested_format as format,s.status,s.active,s.version,s.next_run_at as \"nextRunAt\",s.last_run_at as \"lastRunAt\""+where+" order by "+order+" "+direction+" nulls last,s.id limit 10 offset ?",args.toArray());
        return Map.of("data",rows,"pagination",Map.of("page",safePage,"limit",10,"total",total,"totalPages",(total+9)/10));
    }
    private Map<String,Object> scoped(UserAccount actor,UUID id,boolean edit) {
        templates.require(actor,edit?"reports.schedule.manage":"reports.schedule.view",edit?"report.module.export":"report.module.view");
        var rows=jdbc.queryForList("select * from report_schedules where id=?"+(edit?" for update":""),id);if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"REPORT_SCHEDULE_NOT_FOUND");
        var row=rows.getFirst();if(!permissions.hasPermission(actor,"reports.schedule.manage")&&!actor.getId().toString().equals(row.get("creator_user_id").toString()))throw new SecurityException("REPORT_SCOPE_DENIED");return row;
    }
    public Map<String,Object> detail(UserAccount actor,UUID id) throws Exception {
        var row=scoped(actor,id,false);var result=new LinkedHashMap<String,Object>();
        result.put("id",id);result.put("version",row.get("version"));result.put("name",row.get("name"));result.put("definitionCode",row.get("definition_code"));result.put("cronExpression",row.get("cron_expression"));result.put("format",row.get("requested_format"));
        result.put("parameters",json.readTree(row.get("parameters").toString()));result.put("fields",json.readTree(row.get("selected_fields").toString()));
        var recipients=jdbc.queryForList("select user_id from report_schedule_recipients where schedule_id=?",UUID.class,id);
        result.put("recipientUserIds",recipients);
        result.put("recipients",recipients.stream().map(uid->users.findById(uid).map(user->Map.of("id",uid.toString(),"fullName",Objects.toString(user.getFullName(),uid.toString()))).orElse(Map.of("id",uid.toString(),"fullName","Unavailable user"))).toList());return result;
    }
    @Transactional
    public void update(UserAccount actor,UUID id,Update request) throws Exception {
        if(request==null)throw new IllegalArgumentException("REPORT_SCHEDULE_INVALID");
        var row=scoped(actor,id,true);if(request.version()!=((Number)row.get("version")).intValue())throw new ResponseStatusException(HttpStatus.CONFLICT,"REPORT_SCHEDULE_VERSION_CHANGED");
        var value=request.value();if(value==null||value.name()==null||value.name().isBlank()||value.name().length()>255||!row.get("definition_code").equals(value.definitionCode())||request.reason()==null||request.reason().isBlank()||request.reason().length()>1000)throw new IllegalArgumentException("REPORT_SCHEDULE_INVALID");
        var owner=users.findById(UUID.fromString(row.get("creator_user_id").toString())).orElseThrow();
        var filters=new LinkedHashMap<>(value.parameters()==null?Map.of():value.parameters());filters.remove("definitionVersion");filters.remove("reportTitle");
        var snapshot=templates.snapshot(owner,value.definitionCode(),new ReportTemplateService.Criteria(null,value.fields(),filters,null,"asc"));
        ReportTemplateService.validatedTitle(value.parameters()==null?null:value.parameters().get("reportTitle"),snapshot.path("definition").path("displayName").asText());
        var formats=snapshot.path("definition").path("allowedFormats");if(!formats.toString().contains("\""+value.format()+"\""))throw new IllegalArgumentException("REPORT_FORMAT_NOT_ALLOWED");
        var next=CronExpression.parse(value.cronExpression()).next(java.time.ZonedDateTime.now(DateTimeFormatUtils.ZONE));if(next==null)throw new IllegalArgumentException("REPORT_SCHEDULE_INVALID");
        var recipients=value.recipientUserIds()==null?List.<UUID>of():value.recipientUserIds().stream().distinct().toList();if(recipients.size()>200)throw new IllegalArgumentException("REPORT_RECIPIENT_LIMIT");
        for(var recipient:recipients){if(recipient==null)throw new IllegalArgumentException("REPORT_RECIPIENT_INVALID");var user=users.findById(recipient).orElseThrow(()->new IllegalArgumentException("REPORT_RECIPIENT_INVALID"));if(user.getStatus()!=UserStatus.Active||(!permissions.hasPermission(user,"reports.artifact.download")&&!permissions.hasPermission(user,"report.module.export")))throw new SecurityException("REPORT_RECIPIENT_DENIED");}
        jdbc.update("update report_schedules set name=?,cron_expression=?,requested_format=?,parameters=cast(? as jsonb),selected_fields=cast(? as jsonb),next_run_at=?,version=version+1,updated_at=now() where id=?",value.name().trim(),value.cronExpression(),value.format(),json.writeValueAsString(value.parameters()==null?Map.of():value.parameters()),snapshot.path("fields").toString(),java.sql.Timestamp.from(next.toInstant()),id);
        jdbc.update("delete from report_schedule_recipients where schedule_id=?",id);for(var recipient:recipients)jdbc.update("insert into report_schedule_recipients values(?,?)",id,recipient);
        audit.logAs(actor,"REPORT_SCHEDULE",value.name(),id,"REPORT_SCHEDULE_UPDATED",null,null,request.reason().trim());
    }
    public record Update(int version,ReportPlatformService.ScheduleRequest value,String reason) {}
}
