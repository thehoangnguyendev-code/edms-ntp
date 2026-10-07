package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.OnlyOfficeDocumentEditService;
import com.eqms.service.PublishingOpenXmlTemplateRenderService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.regex.Pattern;
import java.util.zip.ZipInputStream;

/** Reuses the publishing renderer/converter with no Revision and no electronic-signature values. */
@Service
public class ReportWordService {
    private final JdbcTemplate jdbc; private final ObjectMapper json; private final AuditTrailService audit;
    private final PublishingOpenXmlTemplateRenderService renderer; private final OnlyOfficeDocumentEditService converter;
    private final java.util.concurrent.Semaphore conversions=new java.util.concurrent.Semaphore(2);
    public ReportWordService(JdbcTemplate jdbc,ObjectMapper json,AuditTrailService audit,
            PublishingOpenXmlTemplateRenderService renderer,OnlyOfficeDocumentEditService converter) {
        this.jdbc=jdbc;this.json=json;this.audit=audit;this.renderer=renderer;this.converter=converter;
    }
    public static List<String> inspect(byte[] bytes) throws Exception {
        if(bytes.length==0||bytes.length>2097152)throw new IllegalArgumentException("REPORT_WORD_SIZE_LIMIT");
        boolean main=false;long expanded=0;int entries=0;
        var names=new HashSet<String>();var found=new LinkedHashSet<String>();
        try(var zip=new ZipInputStream(new ByteArrayInputStream(bytes))) {
            java.util.zip.ZipEntry entry;
            while((entry=zip.getNextEntry())!=null) {
                if(++entries>1000)throw new IllegalArgumentException("REPORT_WORD_PACKAGE_INVALID");
                String name=entry.getName().toLowerCase(Locale.ROOT);
                if(!names.add(name)||name.startsWith("/")||name.contains("\\"))throw new IllegalArgumentException("REPORT_WORD_PACKAGE_INVALID");
                if(name.contains("vbaproject")||name.contains("embeddings/")||name.contains("activex/")||name.contains("../")||name.endsWith(".svg")||name.endsWith(".html")||name.endsWith(".js"))throw new IllegalArgumentException("REPORT_WORD_ACTIVE_CONTENT_DENIED");
                var data=new ByteArrayOutputStream();byte[] chunk=new byte[8192];int n;
                while((n=zip.read(chunk))!=-1){expanded+=n;if(expanded>20*1024*1024)throw new IllegalArgumentException("REPORT_WORD_EXPANSION_LIMIT");data.write(chunk,0,n);}
                String xml=data.toString(java.nio.charset.StandardCharsets.UTF_8);
                if((name.endsWith(".xml")||name.endsWith(".rels"))&&(xml.contains("<!DOCTYPE")||xml.contains("<!ENTITY")))throw new IllegalArgumentException("REPORT_WORD_ACTIVE_CONTENT_DENIED");
                if(name.endsWith(".rels"))inspectRelationships(data.toByteArray());
                if(name.equals("word/document.xml"))main=true;
                if(xml.contains("macroEnabled"))throw new IllegalArgumentException("REPORT_WORD_ACTIVE_CONTENT_DENIED");
                if(name.startsWith("word/")&&name.endsWith(".xml"))inspectXml(data.toByteArray(),found,name.equals("word/document.xml"));
            }
        } catch(java.util.zip.ZipException e){throw new IllegalArgumentException("REPORT_WORD_PACKAGE_INVALID",e);}
        if(!main)throw new IllegalArgumentException("REPORT_WORD_PACKAGE_INVALID");
        return List.copyOf(found);
    }
    private static org.w3c.dom.Document parseXml(byte[] bytes) throws Exception {
        var factory=javax.xml.parsers.DocumentBuilderFactory.newInstance();factory.setNamespaceAware(true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl",true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities",false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities",false);
        factory.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_DTD,"");factory.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_SCHEMA,"");
        try {return factory.newDocumentBuilder().parse(new ByteArrayInputStream(bytes));}
        catch(org.xml.sax.SAXException e){throw new IllegalArgumentException("REPORT_WORD_PACKAGE_INVALID",e);}
    }
    private static void inspectRelationships(byte[] bytes) throws Exception {
        var all=parseXml(bytes).getElementsByTagNameNS("*","Relationship");
        for(int i=0;i<all.getLength();i++){
            var element=(org.w3c.dom.Element)all.item(i);
            if("External".equalsIgnoreCase(element.getAttribute("TargetMode")))throw new IllegalArgumentException("REPORT_WORD_EXTERNAL_RESOURCE_DENIED");
            String type=element.getAttribute("Type").toLowerCase(Locale.ROOT);
            if(type.contains("vbaproject")||type.contains("oleobject")||type.contains("attachedtemplate"))throw new IllegalArgumentException("REPORT_WORD_ACTIVE_CONTENT_DENIED");
        }
    }
    private static void inspectXml(byte[] bytes,Set<String> found,boolean main) throws Exception {
        var xml=parseXml(bytes);
        String ns="http://schemas.openxmlformats.org/wordprocessingml/2006/main";
        if(main&&(!ns.equals(xml.getDocumentElement().getNamespaceURI())||!"document".equals(xml.getDocumentElement().getLocalName())))throw new IllegalArgumentException("REPORT_WORD_PACKAGE_INVALID");
        for(String element:List.of("altChunk","object","oleObject"))if(xml.getElementsByTagNameNS("*",element).getLength()>0)throw new IllegalArgumentException("REPORT_WORD_ACTIVE_CONTENT_DENIED");
        StringBuilder instructions=new StringBuilder();var all=xml.getElementsByTagNameNS(ns,"instrText");
        for(int i=0;i<all.getLength();i++)instructions.append(all.item(i).getTextContent());
        var simple=xml.getElementsByTagNameNS(ns,"fldSimple");
        for(int i=0;i<simple.getLength();i++)instructions.append(((org.w3c.dom.Element)simple.item(i)).getAttributeNS(ns,"instr"));
        if(Pattern.compile("(?i)\\b(DDE|DDEAUTO|INCLUDETEXT|INCLUDEPICTURE|LINK|DATABASE)\\b").matcher(instructions).find())throw new IllegalArgumentException("REPORT_WORD_ACTIVE_CONTENT_DENIED");
        var paragraphs=xml.getElementsByTagNameNS(ns,"p");
        for(int i=0;i<paragraphs.getLength();i++) {
            var texts=((org.w3c.dom.Element)paragraphs.item(i)).getElementsByTagNameNS(ns,"t");var text=new StringBuilder();
            for(int j=0;j<texts.getLength();j++)text.append(texts.item(j).getTextContent());
            inspectText(text.toString(),found);
        }
    }
    private static void inspectText(String text,Set<String> found) {
        var matcher=Pattern.compile("\\{\\{([^{}]+)}}").matcher(text);
        while(matcher.find()) {
            String key=matcher.group(1);
            if(!ReportLayout.TOKENS.contains(key)||key.startsWith("page."))throw new IllegalArgumentException("REPORT_WORD_TOKEN_NOT_SUPPORTED: "+key);
            found.add(key);
        }
        if(matcher.replaceAll("").contains("{{")||matcher.replaceAll("").contains("}}"))throw new IllegalArgumentException("REPORT_WORD_TOKEN_INVALID");
    }
    @Transactional
    public ReportLayout.WordComponent upload(UserAccount actor,String type,String name,byte[] bytes) throws Exception {
        if(!Set.of("cover","header","footer").contains(type)||name==null||name.length()>255||name.contains("/")||name.contains("\\")||!name.toLowerCase(Locale.ROOT).endsWith(".docx"))throw new IllegalArgumentException("REPORT_WORD_COMPONENT_INVALID");
        var placeholders=inspect(bytes);var id=UUID.randomUUID();String hash=hash(bytes);
        jdbc.update("insert into report_word_components(id,component_type,file_name,content,sha256,placeholders,created_by_user_id) values(?,?,?,?,?,cast(? as jsonb),?)",id,type,name,bytes,hash,json.writeValueAsString(placeholders),actor.getId());
        audit.logAs(actor,"REPORT_TEMPLATE",id.toString(),id,"REPORT_WORD_COMPONENT_UPLOADED",null,null,type+" DOCX uploaded; SHA-256 "+hash);
        return new ReportLayout.WordComponent(id,hash,name,placeholders);
    }
    public void validate(ReportLayout layout) { for(var part:layout.effectiveWordComponents().entrySet())load(part.getKey(),part.getValue()); }
    private byte[] load(String type,ReportLayout.WordComponent ref) {
        var rows=jdbc.queryForList("select content,sha256,file_name from report_word_components where id=? and component_type=?",ref.id(),type);
        if(rows.size()!=1)throw new IllegalArgumentException("REPORT_WORD_COMPONENT_NOT_FOUND");
        byte[] bytes=(byte[])rows.getFirst().get("content");
        if(!ref.sha256().equals(rows.getFirst().get("sha256"))||!ref.sha256().equals(hash(bytes)))throw new IllegalStateException("REPORT_WORD_CHECKSUM_MISMATCH");
        if(!Objects.equals(ref.fileName(),rows.getFirst().get("file_name")))throw new IllegalArgumentException("REPORT_WORD_COMPONENT_METADATA_MISMATCH");
        return bytes;
    }
    public byte[] render(String format,List<List<String>> rows,ReportLayout layout,Map<String,String> context,List<ReportCharts.Result> charts) throws Exception {
        if(!"PDF".equals(format)||layout.effectiveWordComponents().isEmpty())return ReportPresentationRenderer.render(format,rows,layout,context,charts);
        if(!conversions.tryAcquire())throw new IllegalStateException("REPORT_WORD_CONVERSION_BUSY");
        try {
        var parts=new HashMap<String,byte[]>();
        for(var part:layout.effectiveWordComponents().entrySet()) {
            if("cover".equals(part.getKey())&&!layout.cover())continue;
            Path source=Files.createTempFile("report-component-",".docx"),filled=null;
            try {
                Files.write(source,load(part.getKey(),part.getValue()));
                filled=renderer.renderDocxTemplate(source,part.getValue().fileName(),null,context,true);
                byte[] pdf=converter.convertLocalFileToPdf(filled,part.getValue().fileName());
                try(var document=org.apache.pdfbox.Loader.loadPDF(pdf)){
                    if(document.getNumberOfPages()!=1)throw new IllegalArgumentException("REPORT_WORD_COMPONENT_MUST_BE_ONE_PAGE");
                    var box=document.getPage(0).getMediaBox();
                    if(box.getWidth()<100||box.getHeight()<100||box.getWidth()>2000||box.getHeight()>2000)throw new IllegalArgumentException("REPORT_WORD_PAGE_SIZE_INVALID");
                }
                parts.put(part.getKey(),pdf);
            } finally { if(filled!=null&&!filled.equals(source))Files.deleteIfExists(filled);Files.deleteIfExists(source); }
        }
        return ReportPresentationRenderer.render(format,rows,layout,context,charts,parts);
        } finally {conversions.release();}
    }
    private static String hash(byte[] bytes) { try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}catch(Exception e){throw new IllegalStateException(e);} }
}
