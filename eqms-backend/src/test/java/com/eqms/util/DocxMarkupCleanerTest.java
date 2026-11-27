package com.eqms.util;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DocxMarkupCleanerTest {
    private static final String NS = "xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"";

    private static String xml(String root, String body) {
        return "<w:" + root + " " + NS + ">" + body + "</w:" + root + ">";
    }

    private static String p(String content) {
        return "<w:p>" + content + "</w:p>";
    }

    private static String r(String text) {
        return "<w:r><w:t>" + text + "</w:t></w:r>";
    }

    private static byte[] docx(Map<String, String> parts) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            for (Map.Entry<String, String> part : parts.entrySet()) {
                zip.putNextEntry(new ZipEntry(part.getKey()));
                zip.write(part.getValue().getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return bytes.toByteArray();
    }

    private static Map<String, String> unzip(byte[] docx) throws IOException {
        Map<String, String> parts = new LinkedHashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(docx))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                parts.put(entry.getName(), new String(zip.readAllBytes(), StandardCharsets.UTF_8));
            }
        }
        return parts;
    }

    private static String body(String documentBody) throws IOException {
        byte[] cleaned = DocxMarkupCleaner.clean(docx(Map.of("word/document.xml", xml("document", "<w:body>" + documentBody + "</w:body>"))));
        String result = unzip(cleaned).get("word/document.xml");
        assertFalse(result.matches("(?s).*<w:(ins|del|moveFrom|moveTo|cellIns|cellDel|\\w+Change)[ />].*"), result);
        return result;
    }

    private static String text(String xml) {
        return xml.replaceAll("<[^>]+>", "");
    }

    @Test
    void fileWithoutMarkupIsReturnedUntouched() throws IOException {
        byte[] clean = docx(Map.of("word/document.xml", xml("document", p(r("final"))), "word/media/image1.png", "binary"));
        assertSame(clean, DocxMarkupCleaner.clean(clean));
    }

    @Test
    void insertionsStayAndDeletionsGo() throws IOException {
        String result = body(p(r("keep ") + "<w:ins w:id=\"1\">" + r("added ") + "</w:ins><w:del w:id=\"2\"><w:r><w:delText>removed</w:delText></w:r></w:del>"
                + "<w:moveTo>" + r("moved") + "</w:moveTo><w:moveFrom>" + r("old place") + "</w:moveFrom>"));
        assertEquals("keep added moved", text(result));
        assertFalse(result.contains("w:ins"));
    }

    @Test
    void formattingChangeRecordsAreDropped() throws IOException {
        String result = body(p("<w:pPr><w:jc w:val=\"center\"/><w:pPrChange w:id=\"1\"><w:pPr/></w:pPrChange></w:pPr><w:r><w:rPr><w:b/><w:rPrChange w:id=\"2\"><w:rPr/></w:rPrChange></w:rPr><w:t>a</w:t></w:r>"));
        assertTrue(result.contains("w:jc") && result.contains("<w:b/>"));
        assertFalse(result.contains("Change"));
    }

    @Test
    void deletedParagraphMarkJoinsTheNextParagraph() throws IOException {
        String result = body(p("<w:pPr><w:rPr><w:del w:id=\"1\"/></w:rPr></w:pPr>" + r("one ")) + p(r("two")) + p(r("three")));
        assertEquals(2, result.split("<w:p>", -1).length - 1);
        assertEquals("one twothree", text(result));
    }

    @Test
    void wholeDeletedParagraphDisappears() throws IOException {
        String result = body(p(r("a")) + p("<w:pPr><w:rPr><w:del w:id=\"1\"/></w:rPr></w:pPr><w:del w:id=\"2\"><w:r><w:delText>gone</w:delText></w:r></w:del>") + p(r("b")));
        assertEquals(2, result.split("<w:p>", -1).length - 1);
        assertEquals("ab", text(result));
    }

    @Test
    void deletedTableRowsCellsAndWholeTablesGo() throws IOException {
        String gone = "<w:trPr><w:del w:id=\"1\"/></w:trPr><w:tc>" + p(r("deleted row")) + "</w:tc>";
        String result = body("<w:tbl><w:tr><w:tc>" + p(r("kept")) + "</w:tc><w:tc><w:tcPr><w:cellDel w:id=\"3\"/></w:tcPr>" + p(r("deleted cell")) + "</w:tc></w:tr><w:tr>" + gone + "</w:tr></w:tbl>"
                + "<w:tbl><w:tr>" + gone + "</w:tr></w:tbl>" + p(r("end")));
        assertEquals("keptend", text(result));
        assertEquals(1, result.split("<w:tbl>", -1).length - 1);
    }

    @Test
    void commentsAndTheirTextAreRemovedAndTrackingIsSwitchedOff() throws IOException {
        Map<String, String> parts = new LinkedHashMap<>();
        parts.put("word/document.xml", xml("document", p("<w:commentRangeStart w:id=\"0\"/>" + r("kept") + "<w:commentRangeEnd w:id=\"0\"/><w:r><w:rPr/><w:commentReference w:id=\"0\"/></w:r>")));
        parts.put("word/comments.xml", xml("comments", "<w:comment w:id=\"0\">" + p(r("secret remark")) + "</w:comment>"));
        parts.put("word/settings.xml", xml("settings", "<w:trackRevisions/><w:zoom/>"));
        parts.put("word/header1.xml", xml("hdr", p("<w:del w:id=\"4\"><w:r><w:delText>old header</w:delText></w:r></w:del>" + r("new header"))));
        byte[] cleaned = DocxMarkupCleaner.clean(docx(parts));
        Map<String, String> result = unzip(cleaned);
        assertEquals("kept", text(result.get("word/document.xml")));
        assertFalse(result.get("word/document.xml").contains("comment"));
        assertFalse(result.get("word/comments.xml").contains("secret"));
        assertFalse(result.get("word/settings.xml").contains("trackRevisions"));
        assertEquals("new header", text(result.get("word/header1.xml")));
        assertArrayEquals(cleaned, DocxMarkupCleaner.clean(cleaned));
    }

    @Test
    void unreadableFileIsAnErrorNotAPassThrough() throws IOException {
        assertThrows(IOException.class, () -> DocxMarkupCleaner.clean("not a zip".getBytes(StandardCharsets.UTF_8)));
        byte[] broken = docx(Map.of("word/document.xml", "<w:document>"));
        assertThrows(IOException.class, () -> DocxMarkupCleaner.clean(broken));
    }
}
