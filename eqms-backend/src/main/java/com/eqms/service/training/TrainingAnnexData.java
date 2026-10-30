package com.eqms.service.training;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTP;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * What a form of Training (an APD) is filled with, as plain values: the facts of the object (scalars), the lists (groups, each item with its own fields, sub-lists and signature blocks), the cases
 * that apply (the blocks of the file that stay), the boxes that are ticked, the signature blocks drawn from the electronic signature records, and the blocks that the system draws itself. It holds
 * no template and no Word object, so a provider of data and the engine ({@link TrainingAnnexEngine}) stay apart. What is not filled yet because its stage was not reached is simply left out
 * (the value is empty), so one data model serves every stage of the form.
 */
public final class TrainingAnnexData {
    /** Draws a block of the form that is not made of tokens (for example the table of the matrix, whose columns follow the positions of the department) after the marker paragraph. */
    @FunctionalInterface
    public interface BlockWriter {
        void write(XWPFDocument doc, CTP marker);
    }

    /** One item of a list: its fields, its own sub-lists and its signature blocks. */
    public static final class Item {
        private final Map<String, String> fields = new LinkedHashMap<>();
        private final Map<String, List<Item>> children = new LinkedHashMap<>();
        private final Map<String, List<String>> signatures = new LinkedHashMap<>();

        public Item field(String name, String value) {
            fields.put(name, value == null ? "" : value);
            return this;
        }

        public Item children(String group, List<Item> items) {
            children.put(group, items);
            return this;
        }

        public Item signature(String slot, List<String> lines) {
            signatures.put(slot, lines == null ? List.of() : lines);
            return this;
        }

        Map<String, String> fields() { return fields; }
        Map<String, List<Item>> children() { return children; }
        Map<String, List<String>> signatures() { return signatures; }
    }

    private final Map<String, String> scalars = new LinkedHashMap<>();
    private final Map<String, List<Item>> groups = new LinkedHashMap<>();
    private final Map<String, Boolean> cases = new LinkedHashMap<>();
    private final Map<String, Boolean> checks = new LinkedHashMap<>();
    private final Map<String, List<String>> signatures = new LinkedHashMap<>();
    private final Map<String, String> pendingTexts = new LinkedHashMap<>();
    private final Map<String, BlockWriter> blocks = new LinkedHashMap<>();

    /** The facts every form carries: its code, the revision label of the template that made it, and the time it was made. */
    public static TrainingAnnexData forForm(String code, String revision) {
        return new TrainingAnnexData().scalar("FORM_CODE", TrainingAnnexContract.fullCode(code, revision)).scalar("FORM_REVISION", revision)
                .scalar("GENERATED_AT", com.eqms.util.DateTimeFormatUtils.formatDateTime(java.time.Instant.now()));
    }

    public TrainingAnnexData scalar(String name, String value) {
        scalars.put(name, value == null ? "" : value);
        return this;
    }

    public TrainingAnnexData group(String name, List<Item> items) {
        groups.put(name, items == null ? new ArrayList<>() : items);
        return this;
    }

    public TrainingAnnexData caseOn(String name, boolean on) {
        cases.put(name, on);
        return this;
    }

    public TrainingAnnexData check(String name, boolean ticked) {
        checks.put(name, ticked);
        return this;
    }

    /** The lines of the block of an electronic signature (empty while the signature is not given). */
    public TrainingAnnexData signature(String slot, List<String> lines) {
        signatures.put(slot, lines == null ? List.of() : lines);
        return this;
    }

    /** What a preview writes in a signature slot that is not signed yet (for example "Waiting for: the list preparer"). A record leaves the slot empty. */
    public TrainingAnnexData pending(String slot, String text) {
        pendingTexts.put(slot, text);
        return this;
    }

    public TrainingAnnexData block(String name, BlockWriter writer) {
        blocks.put(name, writer);
        return this;
    }

    Map<String, String> scalars() { return scalars; }
    Map<String, List<Item>> groups() { return groups; }
    Map<String, Boolean> cases() { return cases; }
    Map<String, Boolean> checks() { return checks; }
    Map<String, List<String>> signatures() { return signatures; }
    Map<String, String> pendingTexts() { return pendingTexts; }
    Map<String, BlockWriter> blocks() { return blocks; }
}
