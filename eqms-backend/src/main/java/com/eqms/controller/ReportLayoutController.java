package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.report.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/reports/templates/layout")
public class ReportLayoutController {
    private final ReportTemplateService templates;
    private final CurrentUserService users;
    private ReportWordService words;
    @org.springframework.beans.factory.annotation.Autowired
    public void configureWords(ReportWordService words) { this.words=words; }
    public ReportLayoutController(ReportTemplateService templates,CurrentUserService users) {this.templates=templates;this.users=users;}
    @PostMapping("/preview")
    public ResponseEntity<byte[]> preview(@RequestBody Preview request) throws Exception {
        var actor=users.requireCurrentUser();templates.require(actor,"reports.definition.manage","reports.appearance.manage");
        if(request==null||request.layout()==null||request.title()==null||request.title().length()>255)throw new IllegalArgumentException("REPORT_LAYOUT_INVALID");
        byte[] pdf=ReportLayoutPreview.render(actor,request.title(),request.layout(),words);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).cacheControl(CacheControl.noStore()).body(pdf);
    }
    public record Preview(String title,ReportLayout layout) {}
    /**
     * A sample of one chart of a template, drawn by the chart renderer (Chart.js) from made-up groups, as a PNG: the editor of a template shows it as the author changes the type,
     * the grouping, the metric and the number of groups. It is the same picture a report carries; the browser draws no chart (REPORT-CHARTJS-2026-11-15).
     */
    @PostMapping("/chart-preview")
    public ResponseEntity<byte[]> chartPreview(@RequestBody ChartPreview request) throws Exception {
        var actor=users.requireCurrentUser();templates.require(actor,"reports.definition.manage","reports.appearance.manage");
        if(request==null||request.chart()==null||(request.fieldName()!=null&&request.fieldName().length()>255)||(request.font()!=null&&!ReportFonts.KEYS.contains(request.font())))throw new IllegalArgumentException("REPORT_CHART_INVALID");
        byte[] png=ReportCharts.png(ReportChartSamples.of(request.chart(),request.fieldName()),request.font());
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).cacheControl(CacheControl.noStore()).body(png);
    }
    public record ChartPreview(ReportLayout.Chart chart,String fieldName,String font) {}
    @PostMapping(value="/components/{type}",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ReportLayout.WordComponent upload(@PathVariable String type,@RequestParam("file") org.springframework.web.multipart.MultipartFile file) throws Exception {
        var actor=users.requireCurrentUser();templates.require(actor,"reports.definition.manage","reports.appearance.manage");
        if(file.getSize()>2097152)throw new IllegalArgumentException("REPORT_WORD_SIZE_LIMIT");
        return words.upload(actor,type,file.getOriginalFilename(),file.getBytes());
    }
}
