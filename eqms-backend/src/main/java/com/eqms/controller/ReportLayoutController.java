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
        var actor=users.requireCurrentUser();templates.require(actor,"reports.definition.manage","settings.configuration.manage");
        if(request==null||request.layout()==null||request.title()==null||request.title().length()>255)throw new IllegalArgumentException("REPORT_LAYOUT_INVALID");
        var now=Instant.now().toString();
        var context=Map.of("report.title",request.title(),"report.code","LAYOUT_PREVIEW","template.version","draft",
                "report.executor",Objects.toString(actor.getFullName(),Objects.toString(actor.getUsername(),actor.getId().toString())),"report.generatedAt",now,"report.asOfAt",now);
        request.layout().validated();
        var charts=request.layout().effectiveCharts().stream().map(c->new ReportCharts.Result(c.title()+" (demonstration)",c.type(),c.metric(),10,
            List.of(new ReportCharts.Point("LINE".equals(c.type())?"2026-01":"Category A",5,"PERCENT".equals(c.metric())?50:5),
                new ReportCharts.Point("LINE".equals(c.type())?"2026-02":"Category B",3,"PERCENT".equals(c.metric())?30:3),
                new ReportCharts.Point("LINE".equals(c.type())?"2026-03":"Category C",2,"PERCENT".equals(c.metric())?20:2)))).toList();
        var rows=List.of(List.of("Preview","Description"),List.of("Layout preview only","No business data or report run is created."));
        byte[] pdf=words==null?ReportPresentationRenderer.render("PDF",rows,request.layout(),context,charts):words.render("PDF",rows,request.layout(),context,charts);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).cacheControl(CacheControl.noStore()).body(pdf);
    }
    /** Read-only raster of a server-rendered draft page for the existing Konva editor library. */
    @PostMapping("/preview-page")
    public ResponseEntity<byte[]> previewPage(@RequestBody PreviewPage request) throws Exception {
        if(request==null||request.page()<1||request.page()>8)throw new IllegalArgumentException("REPORT_PREVIEW_PAGE_INVALID");
        byte[] bytes=preview(new Preview(request.title(),request.layout())).getBody();
        try(var document=org.apache.pdfbox.Loader.loadPDF(bytes);var output=new java.io.ByteArrayOutputStream()) {
            if(request.page()>document.getNumberOfPages())throw new IllegalArgumentException("REPORT_PREVIEW_PAGE_INVALID");
            var image=new org.apache.pdfbox.rendering.PDFRenderer(document).renderImageWithDPI(request.page()-1,96);
            javax.imageio.ImageIO.write(image,"png",output);
            return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).cacheControl(CacheControl.noStore()).body(output.toByteArray());
        }
    }
    public record Preview(String title,ReportLayout layout) {}
    @PostMapping(value="/components/{type}",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ReportLayout.WordComponent upload(@PathVariable String type,@RequestParam("file") org.springframework.web.multipart.MultipartFile file) throws Exception {
        var actor=users.requireCurrentUser();templates.require(actor,"reports.definition.manage","settings.configuration.manage");
        if(file.getSize()>2097152)throw new IllegalArgumentException("REPORT_WORD_SIZE_LIMIT");
        return words.upload(actor,type,file.getOriginalFilename(),file.getBytes());
    }
    public record PreviewPage(String title,ReportLayout layout,int page) {}
}
