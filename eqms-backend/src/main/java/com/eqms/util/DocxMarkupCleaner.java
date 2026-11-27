package com.eqms.util;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.transform.TransformerException;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

/**
 * Produces the final text of a Word file (DEC-DOC-2026-11-27-04): every tracked change is accepted, as Word's "Accept All" does, and every comment is removed.
 * Markup belongs to drafting, review and approval only, so this is applied to the file copied into the next revision, to the files turned into a published or
 * controlled-copy PDF, and to both sides of a comparison. It never changes a stored file in place: it returns new bytes (the very same array when there was nothing
 * to remove). A file it cannot read is an error, never passed through with its markup.
 */
public final class DocxMarkupCleaner {
    private static final String W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    private static final Pattern TEXT_PART = Pattern.compile("word/(document|header\\d*|footer\\d*|footnotes|endnotes|styles|numbering|glossary/document)\\.xml");
    private static final Pattern COMMENT_PART = Pattern.compile("word/(comments|commentsExtended|commentsIds|commentsExtensible)\\.xml");
    private static final String[] CHANGE_RECORDS = {
            "rPrChange", "pPrChange", "sectPrChange", "tblPrChange", "tblPrExChange", "trPrChange", "tcPrChange", "tblGridChange", "numberingChange",
            "cellIns", "cellMerge", "cellDel", "moveFromRangeStart", "moveFromRangeEnd", "moveToRangeStart", "moveToRangeEnd",
            "customXmlInsRangeStart", "customXmlInsRangeEnd", "customXmlDelRangeStart", "customXmlDelRangeEnd",
            "customXmlMoveFromRangeStart", "customXmlMoveFromRangeEnd", "customXmlMoveToRangeStart", "customXmlMoveToRangeEnd"};

    private DocxMarkupCleaner() {
    }

    public static byte[] clean(byte[] docx) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream(docx.length);
        boolean changed = false;
        boolean any = false;
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(docx)); ZipOutputStream out = new ZipOutputStream(output)) {
            ZipEntry entry;
            while ((entry = in.getNextEntry()) != null) {
                any = true;
                String name = entry.getName();
                byte[] content = in.readAllBytes();
                byte[] cleaned = cleanPart(name, content);
                changed |= cleaned != content;
                out.putNextEntry(new ZipEntry(name));
                out.write(cleaned);
                out.closeEntry();
            }
        }
        if (!any) {
            throw new IOException("The Word file could not be read");
        }
        return changed ? output.toByteArray() : docx;
    }

    /** The same path when the file holds no markup, otherwise a new temporary file the caller deletes. */
    public static Path cleanedCopy(Path docx) throws IOException {
        byte[] content = Files.readAllBytes(docx);
        byte[] cleaned = clean(content);
        if (cleaned == content) {
            return docx;
        }
        Path target = Files.createTempFile("final-text-", ".docx");
        Files.write(target, cleaned);
        target.toFile().deleteOnExit();
        return target;
    }

    private static byte[] cleanPart(String name, byte[] content) throws IOException {
        boolean text = TEXT_PART.matcher(name).matches();
        boolean comments = COMMENT_PART.matcher(name).matches();
        boolean settings = "word/settings.xml".equals(name);
        if (!text && !comments && !settings) {
            return content;
        }
        Document xml = parse(content);
        boolean changed;
        if (comments) {
            changed = false;
            Element root = xml.getDocumentElement();
            while (root.getFirstChild() != null) {
                changed |= root.getFirstChild() instanceof Element;
                root.removeChild(root.getFirstChild());
            }
        } else if (settings) {
            changed = removeAll(xml, "trackRevisions");
        } else {
            changed = acceptChanges(xml);
            changed |= removeCommentAnchors(xml);
        }
        return changed ? write(xml) : content;
    }

    private static boolean acceptChanges(Document xml) {
        boolean changed = false;
        // A deleted table row or cell goes with its content.
        for (Element row : elements(xml, "tr")) {
            if (hasChild(child(row, "trPr"), "del")) {
                Element table = (Element) row.getParentNode();
                table.removeChild(row);
                if (child(table, "tr") == null) {
                    removeBlock(table);
                }
                changed = true;
            }
        }
        for (Element cell : elements(xml, "tc")) {
            if (hasChild(child(cell, "tcPr"), "cellDel")) {
                cell.getParentNode().removeChild(cell);
                changed = true;
            }
        }
        // Remember which paragraphs lose their paragraph mark before the markers are removed.
        List<Element> joined = new ArrayList<>();
        for (Element paragraph : elements(xml, "p")) {
            Element mark = child(child(paragraph, "pPr"), "rPr");
            if (hasChild(mark, "del") || hasChild(mark, "moveFrom")) {
                joined.add(paragraph);
            }
        }
        changed |= removeAll(xml, "del");
        changed |= removeAll(xml, "moveFrom");
        for (String wrapper : new String[]{"ins", "moveTo"}) {
            for (Element element : elements(xml, wrapper)) {
                Node parent = element.getParentNode();
                while (element.getFirstChild() != null) {
                    parent.insertBefore(element.getFirstChild(), element);
                }
                parent.removeChild(element);
                changed = true;
            }
        }
        for (int i = joined.size() - 1; i >= 0; i--) {
            joinWithNext(joined.get(i));
        }
        for (String record : CHANGE_RECORDS) {
            changed |= removeAll(xml, record);
        }
        return changed;
    }

    private static void joinWithNext(Element paragraph) {
        Node parent = paragraph.getParentNode();
        if (parent == null) {
            return;
        }
        Element next = nextElement(paragraph);
        List<Node> content = new ArrayList<>();
        for (Node node = paragraph.getFirstChild(); node != null; node = node.getNextSibling()) {
            if (node instanceof Element element && !is(element, "pPr")) {
                content.add(node);
            }
        }
        if (next != null && is(next, "p")) {
            Element properties = child(next, "pPr");
            Node before = properties == null ? next.getFirstChild() : properties.getNextSibling();
            for (Node node : content) {
                next.insertBefore(node, before);
            }
            parent.removeChild(paragraph);
        } else if (content.isEmpty()) {
            removeBlock(paragraph);
        }
    }

    /** Removes a paragraph or table, leaving a table cell with the one paragraph Word requires. */
    private static void removeBlock(Element block) {
        Element parent = (Element) block.getParentNode();
        parent.removeChild(block);
        if (is(parent, "tc") && child(parent, "p") == null) {
            parent.appendChild(parent.getOwnerDocument().createElementNS(W, parent.getPrefix() == null ? "p" : parent.getPrefix() + ":p"));
        }
    }

    private static boolean removeCommentAnchors(Document xml) {
        boolean changed = removeAll(xml, "commentRangeStart");
        changed |= removeAll(xml, "commentRangeEnd");
        for (Element reference : elements(xml, "commentReference")) {
            Element run = (Element) reference.getParentNode();
            run.removeChild(reference);
            Element remaining = null;
            for (Node node = run.getFirstChild(); node != null; node = node.getNextSibling()) {
                if (node instanceof Element element && !is(element, "rPr")) {
                    remaining = element;
                }
            }
            if (remaining == null && is(run, "r")) {
                run.getParentNode().removeChild(run);
            }
            changed = true;
        }
        return changed;
    }

    private static boolean removeAll(Document xml, String localName) {
        boolean changed = false;
        for (Element element : elements(xml, localName)) {
            if (element.getParentNode() != null) {
                element.getParentNode().removeChild(element);
                changed = true;
            }
        }
        return changed;
    }

    private static List<Element> elements(Document xml, String localName) {
        NodeList nodes = xml.getElementsByTagNameNS(W, localName);
        List<Element> list = new ArrayList<>(nodes.getLength());
        for (int i = 0; i < nodes.getLength(); i++) {
            list.add((Element) nodes.item(i));
        }
        return list;
    }

    private static boolean is(Element element, String localName) {
        return W.equals(element.getNamespaceURI()) && localName.equals(element.getLocalName());
    }

    private static Element child(Element parent, String localName) {
        if (parent == null) {
            return null;
        }
        for (Node node = parent.getFirstChild(); node != null; node = node.getNextSibling()) {
            if (node instanceof Element element && is(element, localName)) {
                return element;
            }
        }
        return null;
    }

    private static boolean hasChild(Element parent, String localName) {
        return child(parent, localName) != null;
    }

    /** The next block after a paragraph, skipping bookmarks and other markers that sit between blocks. */
    private static Element nextElement(Element element) {
        for (Node node = element.getNextSibling(); node != null; node = node.getNextSibling()) {
            if (node instanceof Element next && (is(next, "p") || is(next, "tbl") || is(next, "sdt") || is(next, "sectPr"))) {
                return next;
            }
        }
        return null;
    }

    private static Document parse(byte[] content) throws IOException {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            return factory.newDocumentBuilder().parse(new ByteArrayInputStream(content));
        } catch (ParserConfigurationException | SAXException ex) {
            throw new IOException("The Word file could not be read", ex);
        }
    }

    private static byte[] write(Document xml) throws IOException {
        try {
            xml.setXmlStandalone(true);
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            TransformerFactory.newInstance().newTransformer().transform(new DOMSource(xml), new StreamResult(output));
            return output.toByteArray();
        } catch (TransformerException ex) {
            throw new IOException("The Word file could not be written", ex);
        }
    }
}
