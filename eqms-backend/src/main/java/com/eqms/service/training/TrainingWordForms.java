package com.eqms.service.training;

import org.apache.poi.wp.usermodel.HeaderFooterType;
import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFHeader;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFPictureData;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.apache.xmlbeans.XmlCursor;
import org.apache.xmlbeans.XmlObject;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTHdrFtr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTP;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTPPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTc;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTText;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTR;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTRPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTRow;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTSimpleField;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTbl;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import javax.xml.namespace.QName;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Predicate;

/**
 * What the Word forms of Training (APD.0009, APD.0011, APD.0014, APD.0024, APD.0108, APD.0117, APD.0118, FRM.0007, FRM.0044) have in common: finding a table by a word of its heading, writing
 * the lines of a table from the model line of the template, the header with the logo and the page numbers, and the note of the footer. The templates describe their own header and footer in the
 * body ("Header:", "Footer:"); the file made from a template has a real header and a real footer instead, and none of the notes that describe the form.
 */
final class TrainingWordForms {
    static final String STRUCTURE = "TRAINING_FORM_TEMPLATE_STRUCTURE";
    private static final String R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

    private TrainingWordForms() {
    }

    static ResponseStatusException structure() {
        return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, STRUCTURE);
    }

    // ------------------------------------------------------------------------------------------------------------------------------ finding

    /** The text of a table, read from its XML: rows that were taken out or added after the library made its list of rows do not matter. */
    static String cellsText(XWPFTable table) {
        StringBuilder all = new StringBuilder();
        String ns = "declare namespace w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'; ";
        for (XmlObject paragraph : table.getCTTbl().selectPath(ns + ".//w:p")) {
            for (XmlObject t : paragraph.selectPath(ns + ".//w:t")) all.append(((org.apache.xmlbeans.XmlAnySimpleType) t).getStringValue());
            all.append('\n');
        }
        return all.toString();
    }

    static XWPFTable find(XWPFDocument doc, String token) {
        for (XWPFTable table : doc.getTables()) if (cellsText(table).contains(token)) return table;
        throw structure();
    }

    /** The first table that holds one of the words (a form whose printed word was corrected keeps working). */
    static XWPFTable findAny(XWPFDocument doc, String... tokens) {
        for (String token : tokens) {
            for (XWPFTable table : doc.getTables()) if (cellsText(table).contains(token)) return table;
        }
        throw structure();
    }

    static List<XWPFTable> findAll(XWPFDocument doc, String token) {
        List<XWPFTable> out = new ArrayList<>();
        for (XWPFTable table : doc.getTables()) if (cellsText(table).contains(token)) out.add(table);
        return out;
    }

    static XWPFParagraph findParagraph(XWPFDocument doc, String token) {
        for (XWPFParagraph p : doc.getParagraphs()) if (p.getText().contains(token)) return p;
        throw structure();
    }

    static int indexOf(XWPFDocument doc, XWPFTable table) {
        List<IBodyElement> elements = doc.getBodyElements();
        for (int i = 0; i < elements.size(); i++) if (elements.get(i) instanceof XWPFTable t && t.getCTTbl() == table.getCTTbl()) return i;
        throw structure();
    }

    // ------------------------------------------------------------------------------------------------------------------------------ writing

    /** Writes a value in a paragraph: the first run keeps its look and carries all of it. */
    static void setParagraph(XWPFParagraph paragraph, String value) {
        List<XWPFRun> runs = paragraph.getRuns();
        XWPFRun run = runs.isEmpty() ? paragraph.createRun() : runs.get(0);
        run.setText(value, 0);
        filled(run);
        for (int i = runs.size() - 1; i >= 1; i--) paragraph.removeRun(i);
    }

    /** What is written in a form is in Times New Roman, 12 pt, whatever the look of the dots or the label that it replaces. */
    static void filled(XWPFRun run) {
        run.setFontFamily("Times New Roman");
        run.setFontSize(12);
        run.setItalic(false);
    }

    /** Writes a value in a cell: one paragraph, the look of its first run. */
    static void setText(XWPFTableCell cell, String value) {
        for (int i = cell.getParagraphs().size() - 1; i > 0; i--) cell.removeParagraph(i);
        XWPFParagraph paragraph = cell.getParagraphs().isEmpty() ? cell.addParagraph() : cell.getParagraphs().get(0);
        setParagraph(paragraph, value);
    }

    /** The lines of a text typed in a box: one line, one paragraph; empty lines are left out. */
    static List<String> linesOf(String text) {
        List<String> out = new ArrayList<>();
        if (text == null) return out;
        for (String line : text.split("\\R")) if (!line.isBlank()) out.add(line.strip());
        return out;
    }

    /**
     * A cell with the text in two languages (APD.0024, part 4): the lines of the first text as they are, then the lines of the second one in italic, each line a paragraph of its own with the
     * look (spacing, alignment) of the first paragraph of the cell.
     */
    static void setBilingual(XWPFTableCell cell, String normal, String italic) {
        for (int i = cell.getParagraphs().size() - 1; i > 0; i--) cell.removeParagraph(i);
        XWPFParagraph first = cell.getParagraphs().isEmpty() ? cell.addParagraph() : cell.getParagraphs().get(0);
        List<String> main = linesOf(normal), second = linesOf(italic);
        boolean used = false;
        for (int k = 0; k < main.size() + second.size(); k++) {
            boolean slanted = k >= main.size();
            String line = slanted ? second.get(k - main.size()) : main.get(k);
            XWPFParagraph p = used ? cell.addParagraph() : first;
            if (used && first.getCTP().isSetPPr()) p.getCTP().setPPr((CTPPr) first.getCTP().getPPr().copy());
            if (used) {
                XWPFRun run = p.createRun();
                run.setText(line, 0);
                filled(run);
            } else {
                setParagraph(p, line);
            }
            p.getRuns().get(p.getRuns().size() - 1).setItalic(slanted);
            used = true;
        }
        if (!used) setParagraph(first, "");
    }

    /** The rows of a two-column table with the text of each cell in two languages: {first column, its second language, second column, its second language}. */
    static void fillRowsBilingual(XWPFTable table, int headingRows, List<String[]> lines) {
        CTTbl ct = table.getCTTbl();
        if (ct.sizeOfTrArray() <= headingRows) throw structure();
        CTRow model = (CTRow) ct.getTrArray(headingRows).copy();
        int original = ct.sizeOfTrArray();
        for (String[] line : lines) {
            ct.addNewTr().set(model.copy());
            XWPFTableRow row = new XWPFTableRow(ct.getTrArray(ct.sizeOfTrArray() - 1), table);
            setBilingual(row.getCell(0), line[0], line[1]);
            setBilingual(row.getCell(1), line[2], line[3]);
        }
        for (int i = original - 1; i >= headingRows; i--) ct.removeTr(i);
    }

    /** The rows of a table are not split over two pages (a block of signatures stays in one piece) and stay with the row that follows. */
    static void keepTogether(XWPFTable table) {
        for (int i = 0; i < table.getCTTbl().sizeOfTrArray(); i++) {
            var row = table.getCTTbl().getTrArray(i);
            var props = row.isSetTrPr() ? row.getTrPr() : row.addNewTrPr();
            props.addNewCantSplit();
        }
    }

    /** A row of a table read from its XML: the list of rows of the library is not kept up to date when rows were added or taken out. */
    static XWPFTableRow row(XWPFTable table, int index) {
        return new XWPFTableRow(table.getCTTbl().getTrArray(index), table);
    }

    /** Several lines in a cell, one paragraph for each, in the look of the first paragraph. Written in the XML of the cell: the list of paragraphs of the library is not kept up to date. */
    static void setLines(XWPFTableCell cell, List<String> lines) {
        CTTc tc = cell.getCTTc();
        if (tc.sizeOfPArray() == 0) tc.addNewP();
        for (int i = tc.sizeOfPArray() - 1; i > 0; i--) tc.removeP(i);
        CTP model = (CTP) tc.getPArray(0).copy();
        setCtText(tc.getPArray(0), lines.isEmpty() ? "" : lines.get(0));
        for (int i = 1; i < lines.size(); i++) {
            tc.addNewP().set(model.copy());
            setCtText(tc.getPArray(tc.sizeOfPArray() - 1), lines.get(i));
        }
    }

    /** One more line at the end of a cell, in the look of its last paragraph. */
    static void appendLine(XWPFTableCell cell, String value) {
        if (value == null || value.isBlank()) return;
        CTTc tc = cell.getCTTc();
        if (tc.sizeOfPArray() == 0) tc.addNewP();
        CTP model = (CTP) tc.getPArray(tc.sizeOfPArray() - 1).copy();
        tc.addNewP().set(model);
        setCtText(tc.getPArray(tc.sizeOfPArray() - 1), value);
    }

    /** The block of an electronic signature at the end of a cell: one paragraph for each line, Times New Roman, in the size that the configuration of the signature gives (in points). */
    static void appendBlock(XWPFTableCell cell, List<String> lines, double pt) {
        CTTc tc = cell.getCTTc();
        if (tc.sizeOfPArray() == 0) tc.addNewP();
        // the template centres the cells: blocks of different lengths would start at different heights, so the block starts at the top of the cell
        var props = tc.isSetTcPr() ? tc.getTcPr() : tc.addNewTcPr();
        var align = props.isSetVAlign() ? props.getVAlign() : props.addNewVAlign();
        align.setVal(org.openxmlformats.schemas.wordprocessingml.x2006.main.STVerticalJc.TOP);
        // the empty lines that the template leaves for a signature by hand are taken by the block
        while (tc.sizeOfPArray() > 1 && tc.getPArray(tc.sizeOfPArray() - 1).sizeOfRArray() == 0) tc.removeP(tc.sizeOfPArray() - 1);
        for (String line : lines) {
            CTP model = (CTP) tc.getPArray(tc.sizeOfPArray() - 1).copy();
            tc.addNewP().set(model);
            CTP p = tc.getPArray(tc.sizeOfPArray() - 1);
            setCtText(p, line);
            CTRPr look = p.getRArray(0).getRPr();
            look.getSzArray(0).setVal(java.math.BigInteger.valueOf(Math.round(pt * 2)));
            look.getSzCsArray(0).setVal(java.math.BigInteger.valueOf(Math.round(pt * 2)));
            if (p.getPPr() == null) p.addNewPPr();
            var spacing = p.getPPr().isSetSpacing() ? p.getPPr().getSpacing() : p.getPPr().addNewSpacing();
            spacing.setBefore(java.math.BigInteger.ZERO);
            spacing.setAfter(java.math.BigInteger.ZERO);
            spacing.setLine(java.math.BigInteger.valueOf(240));
            spacing.setLineRule(org.openxmlformats.schemas.wordprocessingml.x2006.main.STLineSpacingRule.AUTO);
            var jc = p.getPPr().isSetJc() ? p.getPPr().getJc() : p.getPPr().addNewJc();
            jc.setVal(org.openxmlformats.schemas.wordprocessingml.x2006.main.STJc.CENTER);
        }
    }

    /** The text of a paragraph, written in its XML: one run with the look of the first run. */
    static void setCtText(CTP p, String value) {
        for (int i = p.sizeOfRArray() - 1; i >= 0; i--) p.removeR(i);
        CTR r = p.addNewR();
        CTRPr look = r.addNewRPr();
        var fonts = look.addNewRFonts();
        fonts.setAscii("Times New Roman");
        fonts.setHAnsi("Times New Roman");
        fonts.setCs("Times New Roman");
        look.addNewSz().setVal(java.math.BigInteger.valueOf(24));
        look.addNewSzCs().setVal(java.math.BigInteger.valueOf(24));
        CTText t = r.addNewT();
        t.setStringValue(value);
        t.setSpace(org.apache.xmlbeans.impl.xb.xmlschema.SpaceAttribute.Space.PRESERVE);
    }

    /** The text after a label in a cell of a two-column table is the value: the row whose first cell contains the label gets the value in its second cell. */
    static boolean setValueOf(XWPFTable table, String label, String value) {
        for (XWPFTableRow row : table.getRows()) {
            if (row.getTableCells().size() >= 2 && row.getCell(0).getText().contains(label)) {
                setText(row.getCell(1), value);
                return true;
            }
        }
        return false;
    }

    /** Lines of a table from the line that follows the heading rows: the model line is the one right after `headingRows`; the model lines of the template are removed. */
    static void fillRows(XWPFTable table, int headingRows, List<List<String>> lines) {
        CTTbl ct = table.getCTTbl();
        if (ct.sizeOfTrArray() <= headingRows) throw structure();
        CTRow model = (CTRow) ct.getTrArray(headingRows).copy();
        int original = ct.sizeOfTrArray();
        for (List<String> line : lines) {
            ct.addNewTr().set(model.copy());
            XWPFTableRow row = new XWPFTableRow(ct.getTrArray(ct.sizeOfTrArray() - 1), table);
            for (int c = 0; c < line.size() && c < row.getTableCells().size(); c++) setText(row.getCell(c), line.get(c));
        }
        for (int i = original - 1; i >= headingRows; i--) ct.removeTr(i);
    }

    static void fillRows(XWPFTable table, List<List<String>> lines) {
        fillRows(table, 1, lines);
    }

    /** Copies an element after another element of the same body and returns the copy. */
    static XmlObject copyAfter(XmlObject element, XmlObject after) {
        try (XmlCursor target = after.newCursor(); XmlCursor source = element.newCursor()) {
            target.toEndToken();
            target.toNextToken();
            source.copyXml(target);
        }
        try (XmlCursor next = after.newCursor()) {
            next.toEndToken();
            next.toNextToken();
            return next.getObject();
        }
    }

    /** The look (run properties) of the first run of a paragraph that has one. */
    static CTRPr lookOf(XWPFParagraph p) {
        for (XWPFRun r : p.getRuns()) if (r.getCTR().getRPr() != null) return (CTRPr) r.getCTR().getRPr().copy();
        return null;
    }

    // ------------------------------------------------------------------------------------------------------------------------------ what is not part of the form

    /** Removes the paragraphs of the body that the test accepts (the notes that describe the form). */
    static void removeParagraphs(XWPFDocument doc, Predicate<String> accepts) {
        List<XWPFParagraph> remove = new ArrayList<>();
        for (XWPFParagraph p : doc.getParagraphs()) if (accepts.test(p.getText().trim())) remove.add(p);
        for (XWPFParagraph p : remove) doc.removeBodyElement(doc.getPosOfParagraph(p));
    }

    /** Removes a table of the body, for example the history of revisions. */
    static void removeTable(XWPFDocument doc, XWPFTable table) {
        doc.removeBodyElement(doc.getPosOfTable(table));
    }

    /** The empty lines at the end of a template would make a page of their own: one is kept (a table cannot be the last thing of a Word file) and made very small. */
    static void trimEnd(XWPFDocument doc) {
        List<IBodyElement> body = doc.getBodyElements();
        int last = body.size() - 1;
        while (last > 0 && body.get(last) instanceof XWPFParagraph p && p.getText().isBlank() && body.get(last - 1) instanceof XWPFParagraph q && q.getText().isBlank()) {
            doc.removeBodyElement(last);
            body = doc.getBodyElements();
            last = body.size() - 1;
        }
        if (body.get(last) instanceof XWPFParagraph tail && tail.getText().isBlank()) tail.setSpacingBetween(1, org.apache.poi.xwpf.usermodel.LineSpacingRule.EXACT);
    }

    // ------------------------------------------------------------------------------------------------------------------------------ header and footer

    /** "Page:.../..." becomes the page number and the number of pages, as fields. */
    static void pageNumbers(XWPFTable header) {
        for (XWPFTableRow r : header.getRows()) for (XWPFTableCell cell : r.getTableCells()) for (XWPFParagraph p : cell.getParagraphs()) {
            if (!p.getText().contains("Page:")) continue;
            CTRPr look = lookOf(p);
            for (int i = p.getRuns().size() - 1; i >= 0; i--) p.removeRun(i);
            run(p, "Page: ", look);
            field(p, " PAGE ", look);
            run(p, " / ", look);
            field(p, " NUMPAGES ", look);
        }
    }

    static void run(XWPFParagraph p, String value, CTRPr look) {
        XWPFRun r = p.createRun();
        r.setText(value);
        if (look != null) r.getCTR().setRPr((CTRPr) look.copy());
    }

    static void field(XWPFParagraph p, String instruction, CTRPr look) {
        CTSimpleField f = p.getCTP().addNewFldSimple();
        f.setInstr(instruction);
        CTR r = f.addNewR();
        r.addNewT().setStringValue("1");
        if (look != null) r.setRPr((CTRPr) look.copy());
    }

    /** The table of the header (the logo, the title, the page) goes to the header of the file, so that it is on every page; the page numbers are fields. */
    static void moveToHeader(XWPFDocument doc, XWPFTable table) {
        pageNumbers(table);
        XWPFHeader header = doc.createHeader(HeaderFooterType.DEFAULT);
        CTTbl copy = (CTTbl) table.getCTTbl().copy();
        // the logo is a picture of the document: the header needs its own copy of it
        for (XmlObject blip : copy.selectPath("declare namespace a='http://schemas.openxmlformats.org/drawingml/2006/main' .//a:blip")) {
            try (XmlCursor cursor = blip.newCursor()) {
                QName embed = new QName(R_NS, "embed");
                String old = cursor.getAttributeText(embed);
                if (old != null && doc.getRelationById(old) instanceof XWPFPictureData picture) {
                    try {
                        cursor.setAttributeText(embed, header.addPictureData(picture.getData(), picture.getPictureType()));
                    } catch (org.apache.poi.openxml4j.exceptions.InvalidFormatException e) {
                        throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
                    }
                }
            }
        }
        CTHdrFtr ct = header._getHdrFtr();
        while (ct.sizeOfPArray() > 0) ct.removeP(0);
        ct.addNewTbl().set(copy);
        ct.addNewP();
        doc.removeBodyElement(doc.getPosOfTable(table));
    }

    /** The note "Document template complies with requirement of ..." of the template becomes the footer of the file. */
    static void noteToFooter(XWPFDocument doc) {
        clearHeadersAndFooters(doc);
        XWPFParagraph note = null;
        for (XWPFParagraph p : doc.getParagraphs()) if (p.getText().contains("Document template complies")) note = p;
        var footer = doc.createFooter(HeaderFooterType.DEFAULT);
        CTHdrFtr ct = footer._getHdrFtr();
        while (ct.sizeOfTblArray() > 0) ct.removeTbl(0);
        while (ct.sizeOfPArray() > 0) ct.removeP(0);
        if (note == null) {
            ct.addNewP();
            return;
        }
        ct.addNewP().set(note.getCTP().copy());
        doc.removeBodyElement(doc.getPosOfParagraph(note));
    }

    /** A template with several sections (a landscape page, a portrait page) gets the header and the footer of the last section in every section that has none. */
    static void shareHeaderFooter(XWPFDocument doc) {
        var body = doc.getDocument().getBody().getSectPr();
        if (body == null) return;
        String ns = "declare namespace w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'; ";
        for (XmlObject o : doc.getDocument().getBody().selectPath(ns + "./w:p/w:pPr/w:sectPr")) {
            var section = (org.openxmlformats.schemas.wordprocessingml.x2006.main.CTSectPr) o;
            if (section.sizeOfHeaderReferenceArray() == 0) for (var ref : body.getHeaderReferenceArray()) section.addNewHeaderReference().set(ref.copy());
            if (section.sizeOfFooterReferenceArray() == 0) for (var ref : body.getFooterReferenceArray()) section.addNewFooterReference().set(ref.copy());
        }
    }

    /**
     * The header and the footer that the template carries itself (the table of the document control of the company: Prepared by, Checked by, Approved by, Copy no) are filled when the
     * document is published in the EDMS; they are not part of the form and are taken out, together with the "different first page" that would leave the first page without a header.
     */
    static void clearHeadersAndFooters(XWPFDocument doc) {
        String ns = "declare namespace w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'; ";
        List<org.openxmlformats.schemas.wordprocessingml.x2006.main.CTSectPr> sections = new ArrayList<>();
        if (doc.getDocument().getBody().getSectPr() != null) sections.add(doc.getDocument().getBody().getSectPr());
        for (XmlObject o : doc.getDocument().getBody().selectPath(ns + "./w:p/w:pPr/w:sectPr")) sections.add((org.openxmlformats.schemas.wordprocessingml.x2006.main.CTSectPr) o);
        for (var section : sections) {
            while (section.sizeOfHeaderReferenceArray() > 0) section.removeHeaderReference(0);
            // the default footer stays: the footer of the file is written in it
            for (int i = section.sizeOfFooterReferenceArray() - 1; i >= 0; i--) {
                if (section.getFooterReferenceArray(i).getType() != org.openxmlformats.schemas.wordprocessingml.x2006.main.STHdrFtr.DEFAULT) section.removeFooterReference(i);
            }
            if (section.isSetTitlePg()) section.unsetTitlePg();
        }
    }

    /** The template names its header and its footer in the body ("Header:", "Footer:", "Nội dung"): those lines describe the form and are not written. */
    static boolean describesTheForm(String text) {
        String t = text.replace(" ", " ").trim().toLowerCase(java.util.Locale.ROOT);
        t = t.replaceFirst("^[-\\d.\\s]+", "");
        return t.startsWith("đầu trang") || t.startsWith("chân trang") || t.startsWith("nội dung") || t.startsWith("lịch sử sửa đổi") || t.startsWith("danh mục này được tạo lập");
    }
}
