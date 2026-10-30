package com.eqms.service.training;

import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFFooter;
import org.apache.poi.xwpf.usermodel.XWPFHeader;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.xmlbeans.XmlCursor;
import org.apache.xmlbeans.XmlObject;
import org.apache.xmlbeans.impl.xb.xmlschema.SpaceAttribute;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTFonts;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTP;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTR;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTRPr;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTRow;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTbl;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTc;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTText;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Fills a form of Training (an APD) that was written with tokens (V698, owner decisions 2026-10-28). The Word file says where each thing goes with a token written in it; the engine never guesses
 * from the printed words. The tokens:
 * <ul>
 *   <li>{@code {{NAME}}}: a fact of the object. {@code {{GROUP.FIELD}}}: a field of an item of a list; a table row that holds tokens of one list is repeated for each item of it.</li>
 *   <li>{@code {{#EACH:GROUP}}} ... {@code {{/EACH:GROUP}}}: paragraphs and tables (each on its own line) that are repeated for each item of the list.</li>
 *   <li>{@code {{#CASE:NAME}}} ... {@code {{/CASE:NAME}}}: kept when the case applies, taken out otherwise. {@code {{#OMIT}}} ... {@code {{/OMIT}}}: never written (the notes that describe the form, its history).</li>
 *   <li>{@code {{CHECK:NAME}}}: a box, ticked or not. {@code {{SIGNATURE:SLOT}}}: the block of an electronic signature. {@code {{BLOCK:NAME}}}: a block that the system draws itself.</li>
 * </ul>
 * A token may be split over several runs by Word; the engine joins the runs of a token first. The look of what is written is the look of the token in the file. The result is read again and
 * compared with what was written ({@link #verify}), so a form that does not carry the data of the system is never given.
 */
public final class TrainingAnnexEngine {
    static final Pattern TOKEN = Pattern.compile("\\{\\{\\s*([^{}]+?)\\s*\\}\\}");
    private static final Pattern MARKER = Pattern.compile("^\\{\\{\\s*([#/])(EACH|CASE|OMIT|ITEM)(?::([A-Za-z0-9_.]+))?(?::(\\d+))?\\s*\\}\\}$");
    private static final Pattern BLOCK = Pattern.compile("^\\{\\{\\s*BLOCK:([A-Za-z0-9_]+)\\s*\\}\\}$");
    private static final String CHECKED = "☒";
    private static final String UNCHECKED = "☐";

    private TrainingAnnexEngine() {}

    /** What a file holds: the tokens by kind, and the errors of the markers (an opening without its closing). */
    public record Scan(Set<String> scalars, Map<String, Set<String>> groupFields, Set<String> eachGroups, Set<String> cases, Set<String> checks, Set<String> signatures,
                       Set<String> blocks, int omitBlocks, List<String> errors) {
        public boolean hasTokens() {
            return !scalars.isEmpty() || !groupFields.isEmpty() || !eachGroups.isEmpty() || !cases.isEmpty() || !checks.isEmpty() || !signatures.isEmpty() || !blocks.isEmpty() || omitBlocks > 0;
        }
    }

    /** The result of a fill: the file, what was written for each token (for the check that reads it again) and the tokens that the data does not know. */
    public record Filled(byte[] bytes, List<String[]> written, List<String> unresolved) {}

    // ------------------------------------------------------------------------------------------------------------------------------ scan

    public static Scan scan(byte[] docx) throws IOException {
        Set<String> scalars = new LinkedHashSet<>(), eachGroups = new LinkedHashSet<>(), cases = new LinkedHashSet<>(), checks = new LinkedHashSet<>(), signatures = new LinkedHashSet<>(), blocks = new LinkedHashSet<>();
        Map<String, Set<String>> groupFields = new LinkedHashMap<>();
        List<String> errors = new ArrayList<>();
        int[] omit = {0, 0};
        Map<String, Integer> open = new LinkedHashMap<>();
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx))) {
            List<CTP> paragraphs = new ArrayList<>();
            collectBody(doc, paragraphs);
            for (XWPFHeader h : doc.getHeaderList()) collectPart(h._getHdrFtr().getPList(), h._getHdrFtr().getTblList(), paragraphs);
            for (XWPFFooter f : doc.getFooterList()) collectPart(f._getHdrFtr().getPList(), f._getHdrFtr().getTblList(), paragraphs);
            for (CTP p : paragraphs) {
                String text = text(p);
                if (!text.contains("{{")) continue;
                String whole = text.trim();
                Matcher marker = MARKER.matcher(whole);
                if (marker.matches()) {
                    String kind = marker.group(2), name = marker.group(3) == null ? "" : marker.group(3);
                    boolean opening = "#".equals(marker.group(1));
                    String key = kind + ":" + name;
                    if ("EACH".equals(kind) && opening) eachGroups.add(name);
                    if ("CASE".equals(kind) && opening) cases.add(name);
                    if ("OMIT".equals(kind) && opening) omit[0]++;
                    open.merge(key, opening ? 1 : -1, Integer::sum);
                    continue;
                }
                Matcher m = TOKEN.matcher(text);
                while (m.find()) {
                    String name = m.group(1).trim();
                    if (name.startsWith("#") || name.startsWith("/")) { errors.add("a marker must be alone in its paragraph: {{" + name + "}}"); continue; }
                    if (name.startsWith("SIGNATURE:")) signatures.add(name.substring("SIGNATURE:".length()));
                    else if (name.startsWith("CHECK:")) checks.add(name.substring("CHECK:".length()));
                    else if (name.startsWith("BLOCK:")) blocks.add(name.substring("BLOCK:".length()));
                    else if (name.contains(".")) groupFields.computeIfAbsent(name.substring(0, name.indexOf('.')), k -> new LinkedHashSet<>()).add(name.substring(name.indexOf('.') + 1));
                    else scalars.add(name);
                }
            }
        }
        for (Map.Entry<String, Integer> e : open.entrySet()) if (e.getValue() != 0) errors.add("the marker " + e.getKey() + " is not closed (or closed without being opened)");
        return new Scan(scalars, groupFields, eachGroups, cases, checks, signatures, blocks, omit[0], errors);
    }

    // ------------------------------------------------------------------------------------------------------------------------------ fill

    public static Filled fill(byte[] docx, TrainingAnnexData data) throws IOException {
        List<String[]> written = new ArrayList<>();
        List<String> unresolved = new ArrayList<>();
        byte[] bytes = docx;

        // pass A, the structure: the notes go, the cases are decided, the lists of blocks are repeated
        try (XWPFDocument doc = open(bytes)) {
            normalizeAll(doc);
            removeBlocks(doc, "OMIT", null, null);
            bytes = write(doc);
        }
        while (true) {
            String name;
            try (XWPFDocument doc = open(bytes)) {
                int[] at = firstOpening(doc, "CASE");
                if (at == null) break;
                name = markerName(doc.getBodyElements().get(at[0]));
                Boolean on = data.cases().get(name);
                if (on == null) unresolved.add("CASE:" + name);
                removeBlocks(doc, "CASE", name, Boolean.TRUE.equals(on));
                bytes = write(doc);
            }
        }
        while (true) {
            String name;
            try (XWPFDocument doc = open(bytes)) {
                int[] at = firstOpening(doc, "EACH");
                if (at == null) break;
                name = markerName(doc.getBodyElements().get(at[0]));
                List<TrainingAnnexData.Item> items = data.groups().get(name);
                if (items == null) { unresolved.add("EACH:" + name); items = List.of(); }
                insertCopies(doc, at[0], at[1], name, items.size());
                bytes = write(doc);
            }
            try (XWPFDocument doc = open(bytes)) {
                int[] at = firstOpening(doc, "EACH");
                removeRange(doc, at[0], at[1]);
                bytes = write(doc);
            }
        }

        // pass B, the values: the body with the item that each repeated block stands for, then the headers and the footers
        try (XWPFDocument doc = open(bytes)) {
            Ctx root = new Ctx(data, null, null, null, written, unresolved);
            List<IBodyElement> elements = doc.getBodyElements();
            Ctx current = root;
            List<Integer> markers = new ArrayList<>();
            List<Object[]> blockCalls = new ArrayList<>();
            for (int i = 0; i < elements.size(); i++) {
                IBodyElement e = elements.get(i);
                if (e instanceof XWPFParagraph p) {
                    String whole = text(p.getCTP()).trim();
                    Matcher marker = MARKER.matcher(whole);
                    if (marker.matches() && "ITEM".equals(marker.group(2))) {
                        markers.add(i);
                        if ("#".equals(marker.group(1))) {
                            String group = marker.group(3);
                            int index = Integer.parseInt(marker.group(4));
                            List<TrainingAnnexData.Item> items = data.groups().get(group);
                            current = new Ctx(data, items == null || index >= items.size() ? new TrainingAnnexData.Item() : items.get(index), group, root, written, unresolved);
                        } else {
                            current = root;
                        }
                        continue;
                    }
                    Matcher block = BLOCK.matcher(whole);
                    if (block.matches()) {
                        blockCalls.add(new Object[] {block.group(1), p.getCTP()});
                        continue;
                    }
                    bindParagraph(p.getCTP(), current);
                } else if (e instanceof XWPFTable t) {
                    bindTable(t.getCTTbl(), current);
                }
            }
            for (Object[] call : blockCalls) {
                String name = (String) call[0];
                CTP marker = (CTP) call[1];
                TrainingAnnexData.BlockWriter writer = data.blocks().get(name);
                if (writer == null) unresolved.add("BLOCK:" + name);
                else writer.write(doc, marker);
                try (XmlCursor cursor = marker.newCursor()) {
                    cursor.removeXml();
                }
            }
            for (int k = markers.size() - 1; k >= 0; k--) {
                IBodyElement e = elements.get(markers.get(k));
                if (e instanceof XWPFParagraph p) {
                    try (XmlCursor cursor = p.getCTP().newCursor()) {
                        cursor.removeXml();
                    }
                }
            }
            for (XWPFHeader h : doc.getHeaderList()) bindPart(h._getHdrFtr().getPList(), h._getHdrFtr().getTblList(), root);
            for (XWPFFooter f : doc.getFooterList()) bindPart(f._getHdrFtr().getPList(), f._getHdrFtr().getTblList(), root);
            applyFont(doc);
            bytes = write(doc);
        }
        // the empty lines at the end of a form would make a page of their own: they are taken out (one stays, very small, because a table cannot be the last thing of a Word file);
        // done on the file read again, so that the lists of the library are those of the file as it is now
        try (XWPFDocument doc = open(bytes)) {
            dropEmptyLastSection(doc);
            bytes = write(doc);
        }
        try (XWPFDocument doc = open(bytes)) {
            TrainingWordForms.trimEnd(doc);
            hideLastMark(doc);
            bytes = write(doc);
        }
        return new Filled(bytes, written, unresolved);
    }

    /**
     * Reads the file again and compares it with what was written: no token left, and every value that was written is in the text of the file. The problems found; empty when the file carries the
     * data. A value that is only a signature block is not compared (the block is drawn from the signature record).
     */
    public static List<String> verify(Filled filled) throws IOException {
        List<String> problems = new ArrayList<>();
        try (XWPFDocument doc = open(filled.bytes()); XWPFWordExtractor extractor = new XWPFWordExtractor(doc)) {
            String all = squash(extractor.getText());
            if (all.contains("{{") || all.contains("}}")) problems.add("a token was left in the file");
            for (String[] w : filled.written()) {
                String value = squash(w[1]);
                if (!value.isEmpty() && !all.contains(value)) problems.add("the value of " + w[0] + " is not in the file");
            }
        }
        for (String u : filled.unresolved()) problems.add("the data holds nothing for " + u);
        return problems;
    }

    private static String squash(String text) {
        return text == null ? "" : text.replaceAll("\\s+", " ").trim();
    }

    /** True when the file is written with tokens; a file without any is a template of the earlier kind, which the old fillers still find by its printed words. */
    public static boolean isTokenized(byte[] docx) {
        try {
            return scan(docx).hasTokens();
        } catch (IOException e) {
            return false;
        }
    }

    /** Fills the file and reads it again; a form that does not carry the data of the system is refused and never given. */
    public static byte[] render(byte[] docx, TrainingAnnexData data) throws IOException {
        Filled filled = fill(docx, data);
        List<String> problems = verify(filled);
        if (!problems.isEmpty()) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY, "TRAINING_ANNEX_VERIFY_FAILED: " + String.join("; ", problems));
        }
        return filled.bytes();
    }

    // ------------------------------------------------------------------------------------------------------------------------------ the values

    /** The values that a paragraph or a row sees: the item it stands for, then the facts of the object. */
    private static final class Ctx {
        final TrainingAnnexData data;
        final TrainingAnnexData.Item item;
        final String group;
        final Ctx parent;
        final List<String[]> written;
        final List<String> unresolved;

        Ctx(TrainingAnnexData data, TrainingAnnexData.Item item, String group, Ctx parent, List<String[]> written, List<String> unresolved) {
            this.data = data;
            this.item = item;
            this.group = group;
            this.parent = parent;
            this.written = written;
            this.unresolved = unresolved;
        }

        /** The items of a list that is visible here: a sub-list of the item first, then a list of the object. */
        List<TrainingAnnexData.Item> items(String name) {
            if (item != null && item.children().containsKey(name)) return item.children().get(name);
            return data.groups().get(name);
        }

        String scalar(String name) {
            if (name.contains(".")) {
                String g = name.substring(0, name.indexOf('.')), f = name.substring(name.indexOf('.') + 1);
                if (item != null && g.equals(group) && item.fields().containsKey(f)) return item.fields().get(f);
                return null;
            }
            return data.scalars().get(name);
        }

        Boolean check(String name) {
            return data.checks().get(name);
        }

        List<String> signature(String slot) {
            if (slot.contains(".")) {
                String g = slot.substring(0, slot.indexOf('.')), s = slot.substring(slot.indexOf('.') + 1);
                if (item != null && g.equals(group) && item.signatures().containsKey(s)) return item.signatures().get(s);
                return null;
            }
            return data.signatures().get(slot);
        }

        String pending(String slot) {
            return data.pendingTexts().get(slot.contains(".") ? slot.substring(slot.indexOf('.') + 1) : slot);
        }
    }

    private static void bindPart(List<CTP> paragraphs, List<CTTbl> tables, Ctx ctx) {
        for (CTP p : paragraphs) bindParagraph(p, ctx);
        for (CTTbl t : tables) bindTable(t, ctx);
    }

    private static void bindTable(CTTbl table, Ctx ctx) {
        for (int i = 0; i < table.sizeOfTrArray(); i++) {
            CTRow row = table.getTrArray(i);
            Set<String> groups = groupsIn(rowText(row));
            if (!groups.isEmpty()) {
                if (groups.size() > 1) {
                    ctx.unresolved.add("a row holds tokens of several lists: " + groups);
                    continue;
                }
                String g = groups.iterator().next();
                List<TrainingAnnexData.Item> items = ctx.items(g);
                if (items == null) {
                    ctx.unresolved.add("GROUP:" + g);
                    table.removeTr(i);
                    i--;
                    continue;
                }
                CTRow model = (CTRow) row.copy();
                for (int k = 0; k < items.size(); k++) {
                    table.insertNewTr(i + 1 + k).set(model.copy());
                    bindRow(table.getTrArray(i + 1 + k), new Ctx(ctx.data, items.get(k), g, ctx, ctx.written, ctx.unresolved));
                }
                table.removeTr(i);
                i += items.size() - 1;
                continue;
            }
            bindRow(row, ctx);
        }
    }

    private static void bindRow(CTRow row, Ctx ctx) {
        for (CTTc tc : row.getTcList()) {
            for (CTP p : tc.getPList()) bindParagraph(p, ctx);
            for (CTTbl nested : tc.getTblList()) bindTable(nested, ctx);
        }
    }

    private static Set<String> groupsIn(String text) {
        Set<String> out = new LinkedHashSet<>();
        Matcher m = TOKEN.matcher(text);
        while (m.find()) {
            String name = m.group(1).trim();
            if (name.startsWith("#") || name.startsWith("/") || name.startsWith("BLOCK:")) continue;
            if (name.startsWith("SIGNATURE:") || name.startsWith("CHECK:")) name = name.substring(name.indexOf(':') + 1);
            if (name.contains(".")) out.add(name.substring(0, name.indexOf('.')));
        }
        return out;
    }

    private static void bindParagraph(CTP p, Ctx ctx) {
        normalize(p);
        for (CTR run : new ArrayList<>(p.getRList())) {
            if (run.sizeOfTArray() == 0) continue;
            String value = run.getTArray(0).getStringValue();
            if (value == null || !value.contains("{{")) continue;
            Matcher m = TOKEN.matcher(value);
            StringBuilder out = new StringBuilder();
            int last = 0;
            List<String> signatureSlots = new ArrayList<>();
            while (m.find()) {
                String name = m.group(1).trim();
                out.append(value, last, m.start());
                last = m.end();
                if (name.startsWith("SIGNATURE:")) {
                    signatureSlots.add(name.substring("SIGNATURE:".length()));
                } else if (name.startsWith("CHECK:")) {
                    Boolean ticked = ctx.check(name.substring("CHECK:".length()));
                    if (ticked == null) ctx.unresolved.add(name);
                    out.append(Boolean.TRUE.equals(ticked) ? CHECKED : UNCHECKED);
                } else {
                    String v = ctx.scalar(name);
                    if (v == null) {
                        ctx.unresolved.add(name);
                        v = "";
                    }
                    out.append(v);
                    ctx.written.add(new String[] {name, v});
                }
            }
            out.append(value.substring(last));
            setRunText(run, out.toString());
            if (!signatureSlots.isEmpty()) writeSignatures(p, run, signatureSlots, ctx);
        }
    }

    /** A signature slot: the lines of the block, one under another, in the look of the token; a preview with nothing signed writes what the slot is waiting for. */
    private static void writeSignatures(CTP p, CTR after, List<String> slots, Ctx ctx) {
        List<String> lines = new ArrayList<>();
        for (String slot : slots) {
            List<String> block = ctx.signature(slot);
            if (block == null) {
                ctx.unresolved.add("SIGNATURE:" + slot);
                continue;
            }
            if (block.isEmpty() && ctx.pending(slot) != null) lines.add(ctx.pending(slot));
            else lines.addAll(block);
        }
        if (lines.isEmpty()) return;
        CTR target = after;
        int index = p.getRList().indexOf(after);
        CTRPr look = after.isSetRPr() ? (CTRPr) after.getRPr().copy() : null;
        for (int i = 0; i < lines.size(); i++) {
            CTR r = p.insertNewR(index + 1 + i);
            if (look != null) r.setRPr((CTRPr) look.copy());
            if (i > 0 || hasText(after)) r.addNewBr();
            CTText t = r.addNewT();
            t.setStringValue(lines.get(i));
            t.setSpace(SpaceAttribute.Space.PRESERVE);
            target = r;
        }
    }

    private static boolean hasText(CTR run) {
        return run.sizeOfTArray() > 0 && run.getTArray(0).getStringValue() != null && !run.getTArray(0).getStringValue().isEmpty();
    }

    // ------------------------------------------------------------------------------------------------------------------------------ the structure

    private static XWPFDocument open(byte[] bytes) throws IOException {
        return new XWPFDocument(new ByteArrayInputStream(bytes));
    }

    private static byte[] write(XWPFDocument doc) throws IOException {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            doc.write(out);
            return out.toByteArray();
        }
    }

    private static void normalizeAll(XWPFDocument doc) {
        List<CTP> paragraphs = new ArrayList<>();
        collectBody(doc, paragraphs);
        for (XWPFHeader h : doc.getHeaderList()) collectPart(h._getHdrFtr().getPList(), h._getHdrFtr().getTblList(), paragraphs);
        for (XWPFFooter f : doc.getFooterList()) collectPart(f._getHdrFtr().getPList(), f._getHdrFtr().getTblList(), paragraphs);
        for (CTP p : paragraphs) normalize(p);
    }

    private static void collectBody(XWPFDocument doc, List<CTP> out) {
        for (IBodyElement e : doc.getBodyElements()) {
            if (e instanceof XWPFParagraph p) out.add(p.getCTP());
            else if (e instanceof XWPFTable t) collectTable(t.getCTTbl(), out);
        }
    }

    private static void collectPart(List<CTP> paragraphs, List<CTTbl> tables, List<CTP> out) {
        out.addAll(paragraphs);
        for (CTTbl t : tables) collectTable(t, out);
    }

    private static void collectTable(CTTbl table, List<CTP> out) {
        for (CTRow row : table.getTrList()) {
            for (CTTc tc : row.getTcList()) {
                out.addAll(tc.getPList());
                for (CTTbl nested : tc.getTblList()) collectTable(nested, out);
            }
        }
    }

    private static String markerName(IBodyElement e) {
        Matcher m = MARKER.matcher(((XWPFParagraph) e).getText().trim());
        m.matches();
        return m.group(3) == null ? "" : m.group(3);
    }

    /** The positions of the first opening marker of the kind and of its closing marker; null when there is none. */
    private static int[] firstOpening(XWPFDocument doc, String kind) {
        List<IBodyElement> elements = doc.getBodyElements();
        for (int i = 0; i < elements.size(); i++) {
            Matcher m = markerAt(elements.get(i));
            if (m == null || !kind.equals(m.group(2)) || !"#".equals(m.group(1))) continue;
            String name = m.group(3) == null ? "" : m.group(3);
            for (int j = i + 1; j < elements.size(); j++) {
                Matcher c = markerAt(elements.get(j));
                if (c != null && kind.equals(c.group(2)) && "/".equals(c.group(1)) && name.equals(c.group(3) == null ? "" : c.group(3))) return new int[] {i, j};
            }
            throw TrainingWordForms.structure();
        }
        return null;
    }

    private static Matcher markerAt(IBodyElement e) {
        if (!(e instanceof XWPFParagraph p)) return null;
        String text = p.getText().trim();
        if (!text.startsWith("{{")) return null;
        Matcher m = MARKER.matcher(text);
        return m.matches() ? m : null;
    }

    /** Takes out every block of the kind (named, when a name is given); with {@code keepInside} the markers go and the inside stays. */
    private static void removeBlocks(XWPFDocument doc, String kind, String name, Boolean keepInside) {
        while (true) {
            int[] at = null;
            List<IBodyElement> elements = doc.getBodyElements();
            for (int i = 0; i < elements.size() && at == null; i++) {
                Matcher m = markerAt(elements.get(i));
                if (m == null || !kind.equals(m.group(2)) || !"#".equals(m.group(1))) continue;
                String n = m.group(3) == null ? "" : m.group(3);
                if (name != null && !name.equals(n)) continue;
                for (int j = i + 1; j < elements.size(); j++) {
                    Matcher c = markerAt(elements.get(j));
                    if (c != null && kind.equals(c.group(2)) && "/".equals(c.group(1)) && n.equals(c.group(3) == null ? "" : c.group(3))) {
                        at = new int[] {i, j};
                        break;
                    }
                }
                if (at == null) throw TrainingWordForms.structure();
            }
            if (at == null) return;
            if (Boolean.TRUE.equals(keepInside)) {
                doc.removeBodyElement(at[1]);
                doc.removeBodyElement(at[0]);
            } else {
                removeRange(doc, at[0], at[1]);
            }
            if (name != null) return;
        }
    }

    private static void removeRange(XWPFDocument doc, int from, int to) {
        for (int i = to; i >= from; i--) doc.removeBodyElement(i);
    }

    /** After the closing marker: for each item a marker, a copy of the block and a closing marker (the original block is taken out in the next step, on the file read again). */
    private static void insertCopies(XWPFDocument doc, int opening, int closing, String group, int count) {
        List<IBodyElement> elements = doc.getBodyElements();
        XWPFParagraph start = (XWPFParagraph) elements.get(opening);
        XmlObject last = ((XWPFParagraph) elements.get(closing)).getCTP();
        for (int index = 0; index < count; index++) {
            last = TrainingWordForms.copyAfter(start.getCTP(), last);
            TrainingWordForms.setCtText((CTP) last, "{{#ITEM:" + group + ":" + index + "}}");
            for (int k = opening + 1; k < closing; k++) {
                IBodyElement e = elements.get(k);
                XmlObject source = e instanceof XWPFParagraph p ? p.getCTP() : ((XWPFTable) e).getCTTbl();
                last = TrainingWordForms.copyAfter(source, last);
            }
            last = TrainingWordForms.copyAfter(start.getCTP(), last);
            TrainingWordForms.setCtText((CTP) last, "{{/ITEM}}");
        }
    }

    /**
     * A template that ends with a section of its own (the history of revisions, which is not written) would leave that section empty, and an empty section is a blank page at the end. The
     * section before it then becomes the last one, with its page size and its header.
     */
    static void dropEmptyLastSection(XWPFDocument doc) {
        org.openxmlformats.schemas.wordprocessingml.x2006.main.CTBody body = doc.getDocument().getBody();
        List<CTP> paragraphs = body.getPList();
        for (int i = paragraphs.size() - 1; i >= 0; i--) {
            CTP p = paragraphs.get(i);
            if (!p.isSetPPr() || !p.getPPr().isSetSectPr()) continue;
            // what follows the end of that section: only empty lines (no table, no text, no picture) means that the last section is empty
            List<CTP> after = new ArrayList<>();
            boolean empty = true;
            try (XmlCursor c = p.newCursor()) {
                while (empty && c.toNextSibling() && !"sectPr".equals(c.getName().getLocalPart())) {
                    XmlObject o = c.getObject();
                    if (o instanceof CTP next && text(next).isBlank() && !next.xmlText().contains("<w:drawing") && !next.xmlText().contains("w:pict")) after.add(next);
                    else empty = false;
                }
            }
            if (empty) {
                for (CTP e : after) {
                    int at = body.getPList().indexOf(e);
                    if (at >= 0) body.removeP(at);
                }
                body.setSectPr((org.openxmlformats.schemas.wordprocessingml.x2006.main.CTSectPr) p.getPPr().getSectPr().copy());
                p.getPPr().unsetSectPr();
            }
            return;
        }
    }

    /**
     * The last paragraph of a form that ends with a table is only there because Word wants one. When the table fills the page the paragraph would move to a page of its own, so its mark
     * is hidden: it takes no room.
     */
    static void hideLastMark(XWPFDocument doc) {
        List<CTP> paragraphs = doc.getDocument().getBody().getPList();
        if (paragraphs.isEmpty()) return;
        CTP last = paragraphs.get(paragraphs.size() - 1);
        if (!text(last).isBlank()) return;
        var ppr = last.isSetPPr() ? last.getPPr() : last.addNewPPr();
        var rpr = ppr.isSetRPr() ? ppr.getRPr() : ppr.addNewRPr();
        if (rpr.sizeOfVanishArray() == 0) rpr.addNewVanish();
    }

    // ------------------------------------------------------------------------------------------------------------------------------ the font

    /** Everything written in a form of the Training Annex is in this font (owner decision 2026-10-28): the text of the file, the tokens' values, the signatures, the header and the footer. */
    public static final String FONT = "Times New Roman";
    private static final String W_NS = "declare namespace w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'; ";

    /** The same file with every run, the defaults and the styles in the font of the forms. A file that cannot be read as Word is returned as it is. */
    public static byte[] withFont(byte[] docx) {
        try (XWPFDocument doc = open(docx)) {
            applyFont(doc);
            return write(doc);
        } catch (IOException | RuntimeException e) {
            return docx;
        }
    }

    /** Sets the font of every run of the body, the headers and the footers, and of the styles, so that what has no font of its own does not fall back to another one. */
    static void applyFont(XWPFDocument doc) {
        fontOfRuns(doc.getDocument().getBody());
        for (XWPFHeader h : doc.getHeaderList()) fontOfRuns(h._getHdrFtr());
        for (XWPFFooter f : doc.getFooterList()) fontOfRuns(f._getHdrFtr());
        org.apache.poi.xwpf.usermodel.XWPFStyles part = doc.getStyles();
        if (part == null) return;
        try {
            org.openxmlformats.schemas.wordprocessingml.x2006.main.CTStyles styles = doc.getStyle();
            if (styles.isSetDocDefaults()) {
                var defaults = styles.getDocDefaults();
                if (!defaults.isSetRPrDefault()) defaults.addNewRPrDefault();
                if (!defaults.getRPrDefault().isSetRPr()) defaults.getRPrDefault().addNewRPr();
                setFont(defaults.getRPrDefault().getRPr());
            }
            for (var style : styles.getStyleList()) if (style.isSetRPr()) setFont(style.getRPr());
            part.setStyles(styles);
        } catch (Exception e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        }
    }

    private static void fontOfRuns(XmlObject part) {
        for (XmlObject o : part.selectPath(W_NS + ".//w:r")) {
            CTR run = (CTR) o;
            setFont(run.isSetRPr() ? run.getRPr() : run.addNewRPr());
        }
    }

    private static void setFont(CTRPr rpr) {
        CTFonts f = rpr.sizeOfRFontsArray() > 0 ? rpr.getRFontsArray(0) : rpr.addNewRFonts();
        f.setAscii(FONT);
        f.setHAnsi(FONT);
        f.setCs(FONT);
        f.setEastAsia(FONT);
        if (f.isSetAsciiTheme()) f.unsetAsciiTheme();
        if (f.isSetHAnsiTheme()) f.unsetHAnsiTheme();
        if (f.isSetCstheme()) f.unsetCstheme();
        if (f.isSetEastAsiaTheme()) f.unsetEastAsiaTheme();
    }

    // ------------------------------------------------------------------------------------------------------------------------------ the runs of a paragraph

    static String text(CTP p) {
        StringBuilder sb = new StringBuilder();
        for (CTR r : p.getRList()) for (CTText t : r.getTList()) sb.append(t.getStringValue() == null ? "" : t.getStringValue());
        return sb.toString();
    }

    private static String rowText(CTRow row) {
        StringBuilder sb = new StringBuilder();
        for (CTTc tc : row.getTcList()) {
            for (CTP p : tc.getPList()) sb.append(text(p)).append('\n');
            for (CTTbl nested : tc.getTblList()) for (CTRow r : nested.getTrList()) sb.append(rowText(r));
        }
        return sb.toString();
    }

    /** The value goes into the run; a new line of the value is a line break of the paragraph. */
    private static void setRunText(CTR run, String value) {
        while (run.sizeOfTArray() > 1) run.removeT(run.sizeOfTArray() - 1);
        while (run.sizeOfBrArray() > 0) run.removeBr(0);
        String[] lines = value.split("\\R", -1);
        CTText t = run.sizeOfTArray() == 0 ? run.addNewT() : run.getTArray(0);
        t.setStringValue(lines[0]);
        t.setSpace(SpaceAttribute.Space.PRESERVE);
        for (int i = 1; i < lines.length; i++) {
            run.addNewBr();
            CTText next = run.addNewT();
            next.setStringValue(lines[i]);
            next.setSpace(SpaceAttribute.Space.PRESERVE);
        }
    }

    /** Word may split one token over several runs (a typed word that was corrected, a change of font): the runs of a token are joined, so that the token is in one run. */
    static void normalize(CTP p) {
        boolean changed = true;
        while (changed) {
            changed = false;
            List<CTR> runs = p.getRList();
            StringBuilder all = new StringBuilder();
            int[] starts = new int[runs.size() + 1];
            for (int i = 0; i < runs.size(); i++) {
                starts[i] = all.length();
                CTR r = runs.get(i);
                StringBuilder one = new StringBuilder();
                for (CTText t : r.getTList()) one.append(t.getStringValue() == null ? "" : t.getStringValue());
                all.append(one);
            }
            starts[runs.size()] = all.length();
            Matcher m = Pattern.compile("\\{\\{[^{}]*?\\}\\}").matcher(all);
            while (m.find()) {
                int first = runAt(starts, m.start()), lastRun = runAt(starts, m.end() - 1);
                if (first == lastRun) continue;
                String token = m.group();
                for (int i = first; i <= lastRun; i++) {
                    String run = runText(runs.get(i));
                    int from = Math.max(m.start(), starts[i]) - starts[i], to = Math.min(m.end(), starts[i + 1]) - starts[i];
                    if (i == first) setRunText(runs.get(i), run.substring(0, from) + token + run.substring(to));
                    else setRunText(runs.get(i), run.substring(0, from) + run.substring(to));
                }
                changed = true;
                break;
            }
        }
    }

    private static String runText(CTR r) {
        StringBuilder one = new StringBuilder();
        for (CTText t : r.getTList()) one.append(t.getStringValue() == null ? "" : t.getStringValue());
        return one.toString();
    }

    private static int runAt(int[] starts, int position) {
        for (int i = 0; i < starts.length - 1; i++) if (position >= starts[i] && position < starts[i + 1]) return i;
        return starts.length - 2;
    }
}
