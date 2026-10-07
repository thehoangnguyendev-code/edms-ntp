package com.eqms.service.report;

import com.eqms.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.io.*;
import java.util.*;
import java.util.zip.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ReportWordServiceTest {
    static byte[] docx(String text) throws Exception {
        try(var doc=new XWPFDocument();var out=new ByteArrayOutputStream()) {
            var p=doc.createParagraph();int middle=text.length()/2;
            p.createRun().setText(text.substring(0,middle));p.createRun().setText(text.substring(middle));
            doc.createTable(1,1).getRow(0).getCell(0).setText("{{report.executor}}");
            doc.write(out);return out.toByteArray();
        }
    }
    byte[] packageXml(String xml,String relations) throws Exception {
        try(var out=new ByteArrayOutputStream();var zip=new ZipOutputStream(out)) {
            zip.putNextEntry(new ZipEntry("word/document.xml"));zip.write(xml.getBytes(java.nio.charset.StandardCharsets.UTF_8));zip.closeEntry();
            if(relations!=null){zip.putNextEntry(new ZipEntry("word/_rels/document.xml.rels"));zip.write(relations.getBytes(java.nio.charset.StandardCharsets.UTF_8));zip.closeEntry();}
            zip.finish();return out.toByteArray();
        }
    }
    @Test void detectsSplitRunsAndTableTokens() throws Exception {
        assertEquals(List.of("report.title","report.executor"),ReportWordService.inspect(docx("{{report.title}}")));
    }
    @Test void rejectsUnknownSignaturePageAndMalformedTokens() throws Exception {
        for(String text:List.of("{{user.password}}","{{esign1}}","{{page.number}}","{{report.title}")) {
            byte[] bytes=docx(text);assertThrows(IllegalArgumentException.class,()->ReportWordService.inspect(bytes));
        }
    }
    @Test void rejectsExternalLinksActiveFieldsAndXmlEntities() throws Exception {
        String base="<w:document xmlns:w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'><w:body>%s</w:body></w:document>";
        byte[] external=packageXml(base.formatted(""),"<Relationships><Relationship TargetMode='External' Target='http://internal'/></Relationships>");
        assertThrows(IllegalArgumentException.class,()->ReportWordService.inspect(external));
        byte[] encodedExternal=packageXml(base.formatted(""),"<Relationships><Relationship TargetMode='Exter&#110;al' Target='http://internal'/></Relationships>");
        assertThrows(IllegalArgumentException.class,()->ReportWordService.inspect(encodedExternal));
        for(String body:List.of("<w:p><w:instrText>INCLU</w:instrText><w:instrText>DETEXT http://internal</w:instrText></w:p>","<w:altChunk/>","<w:p><w:fldSimple w:instr='DDEAUTO application'/></w:p>")) {
            byte[] bytes=packageXml(base.formatted(body),null);assertThrows(IllegalArgumentException.class,()->ReportWordService.inspect(bytes));
        }
        byte[] entity=packageXml("<!DOCTYPE document [<!ENTITY x SYSTEM 'file:///secret'>]>"+base.formatted(""),null);
        assertThrows(IllegalArgumentException.class,()->ReportWordService.inspect(entity));
    }
    @Test void boundedFilesAndExpandedPackages() throws Exception {
        assertThrows(IllegalArgumentException.class,()->ReportWordService.inspect(new byte[2097153]));
        assertThrows(IllegalArgumentException.class,()->ReportWordService.inspect(new byte[0]));
        byte[] bomb=packageXml(" ".repeat(21*1024*1024),null);
        assertThrows(IllegalArgumentException.class,()->ReportWordService.inspect(bomb));
    }
    @Test void checksumFailureStopsBeforeConverter() throws Exception {
        var jdbc=mock(JdbcTemplate.class);var renderer=mock(PublishingOpenXmlTemplateRenderService.class);var converter=mock(OnlyOfficeDocumentEditService.class);
        var service=new ReportWordService(jdbc,new ObjectMapper(),mock(AuditTrailService.class),renderer,converter);
        var id=UUID.randomUUID();when(jdbc.queryForList(anyString(),eq(id),eq("header"))).thenReturn(List.of(Map.of("content",new byte[]{1},"sha256","a".repeat(64),"file_name","header.docx")));
        var layout=new ObjectMapper().convertValue(Map.of("header","","footer","","coverTitle","","subtitle","","watermark","","stamp","","wordComponents",Map.of("header",new ReportLayout.WordComponent(id,"a".repeat(64),"header.docx",List.of()))),ReportLayout.class);
        assertThrows(IllegalStateException.class,()->service.render("PDF",List.of(List.of("Name")),layout,Map.of(),List.of()));
        verifyNoInteractions(renderer,converter);
    }
    @Test void rejectsSilentMissingWordRenderer() throws Exception {
        var layout=new ObjectMapper().convertValue(Map.of("header","","footer","","coverTitle","","subtitle","","watermark","","stamp","","wordComponents",Map.of("header",new ReportLayout.WordComponent(UUID.randomUUID(),"a".repeat(64),"header.docx",List.of()))),ReportLayout.class);
        assertThrows(IllegalStateException.class,()->ReportPresentationRenderer.render("PDF",List.of(List.of("Name")),layout,Map.of()));
    }
    @Test void publishingRendererFillsReportContextWithoutElectronicSignatures() throws Exception {
        var mapper=mock(PublishingTemplatePlaceholderMapperService.class);when(mapper.mapPlaceholders(anyList(),isNull())).thenReturn(List.of());
        var signatures=mock(ElectronicSignatureService.class);var renderer=new PublishingOpenXmlTemplateRenderService(mapper,signatures);
        var source=java.nio.file.Files.createTempFile("report-word-test-",".docx");java.nio.file.Path filled=null;
        try {
            java.nio.file.Files.write(source,docx("{{report.title}}"));
            filled=renderer.renderDocxTemplate(source,"test.docx",null,Map.of("report.title","TEST REPORT","report.executor","Test operator"),true);
            try(var doc=new XWPFDocument(java.nio.file.Files.newInputStream(filled))) {
                assertEquals("TEST REPORT",doc.getParagraphs().getFirst().getText());
                assertTrue(doc.getTables().getFirst().getText().contains("Test operator"));
            }
            verifyNoInteractions(signatures);
            java.nio.file.Files.write(java.nio.file.Path.of("target/report-word-upload-fixture.docx"),docx("{{report.title}}"));
        } finally {if(filled!=null)java.nio.file.Files.deleteIfExists(filled);java.nio.file.Files.deleteIfExists(source);}
    }
    @Test void conversionUsesNullRevisionAndAlwaysRemovesTemporarySource() throws Exception {
        var jdbc=mock(JdbcTemplate.class);var renderer=mock(PublishingOpenXmlTemplateRenderService.class);var converter=mock(OnlyOfficeDocumentEditService.class);
        byte[] bytes=docx("{{report.title}}");String sha=HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes));var id=UUID.randomUUID();
        when(jdbc.queryForList(anyString(),eq(id),eq("header"))).thenReturn(List.of(Map.of("content",bytes,"sha256",sha,"file_name","header.docx")));
        var temporary=new ArrayList<java.nio.file.Path>();
        when(renderer.renderDocxTemplate(any(java.nio.file.Path.class),eq("header.docx"),isNull(),anyMap(),eq(true))).thenAnswer(call->{java.nio.file.Path path=call.getArgument(0);temporary.add(path);assertArrayEquals(bytes,java.nio.file.Files.readAllBytes(path));return path;});
        when(converter.convertLocalFileToPdf(any(java.nio.file.Path.class),eq("header.docx"))).thenReturn(ReportPdfRenderer.render(List.of(List.of("SERVER HEADER"))));
        var service=new ReportWordService(jdbc,new ObjectMapper(),mock(AuditTrailService.class),renderer,converter);
        var layout=new ObjectMapper().convertValue(Map.of("header","","footer","","coverTitle","","subtitle","","watermark","","stamp","","wordComponents",Map.of("header",new ReportLayout.WordComponent(id,sha,"header.docx",List.of("report.title")))),ReportLayout.class);
        byte[] output=service.render("PDF",List.of(List.of("Name"),List.of("Real row")),layout,Map.of("report.title","TEST"),List.of());
        try(var pdf=org.apache.pdfbox.Loader.loadPDF(output)){String text=new org.apache.pdfbox.text.PDFTextStripper().getText(pdf);assertTrue(text.contains("SERVER HEADER"));assertTrue(text.contains("Real row"));}
        assertTrue(temporary.stream().noneMatch(java.nio.file.Files::exists));
        var invalid=new org.apache.pdfbox.pdmodel.PDDocument();invalid.addPage(new org.apache.pdfbox.pdmodel.PDPage());invalid.addPage(new org.apache.pdfbox.pdmodel.PDPage());var out=new ByteArrayOutputStream();invalid.save(out);invalid.close();
        when(converter.convertLocalFileToPdf(any(java.nio.file.Path.class),eq("header.docx"))).thenReturn(out.toByteArray());
        assertThrows(IllegalArgumentException.class,()->service.render("PDF",List.of(List.of("Name")),layout,Map.of(),List.of()));
        assertTrue(temporary.stream().noneMatch(java.nio.file.Files::exists));
    }
}
