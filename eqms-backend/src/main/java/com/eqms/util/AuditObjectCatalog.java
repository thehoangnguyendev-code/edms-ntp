package com.eqms.util;

import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * What an audit record is about, in words a reviewer can read and search (REPORT-AUDIT-DISPLAY-2026-11-17): the Object Type ("Report File") and the Object Code
 * (the number, name or event that tells this object from the others of its type).
 *
 * The code is taken from what the record holds, in a fixed order, and cleaned by fixed rules: the business number first (document number, entity code), then the name,
 * then, for the few types whose only identity is in the text of the record, that text. A value is never shown when it is an identifier (a UUID is cut out; a
 * path or address is cut to the name of the file), when it only repeats the type ("System Configuration" for a System Configuration), or when it is a generic word
 * ("Authentication Session"). An object left with no identity shows nothing here ("-" on the screen): its type, its action, its user and its date still find it, and
 * the writer of that record is to give it a name (the Decision Log lists them). Nothing is ever guessed.
 */
public final class AuditObjectCatalog {
    private AuditObjectCatalog() {
    }

    /** The canonical key of an entity type: upper case without spaces and underscores, so every spelling written in the past reads alike. */
    public static String key(String entityType) {
        return entityType == null ? "" : entityType.trim().toUpperCase(Locale.ROOT).replace(" ", "").replace("_", "");
    }

    /** One name for the kinds that were written under several spellings (documents / DOCUMENT / DocumentRecord), the others in their own words. */
    private static final Map<String, String> TYPE_LABEL = Map.ofEntries(
            Map.entry("DOCUMENT", "Document"), Map.entry("DOCUMENTS", "Document"), Map.entry("DOCUMENTRECORD", "Document"),
            Map.entry("REVISION", "Revision"), Map.entry("DOCUMENTREVISION", "Revision"), Map.entry("DOCUMENTREVISIONRECORD", "Revision"),
            Map.entry("CONTROLLEDCOPY", "Controlled Copy"), Map.entry("CONTROLLEDCOPYRECORD", "Controlled Copy"),
            Map.entry("CONTROLLEDCOPYDISTRIBUTIONBATCH", "Controlled Copy Batch"),
            Map.entry("CONTROLLEDCOPYRECALLBATCH", "Controlled Copy Recall Batch"),
            Map.entry("UNCONTROLLEDCOPY", "Uncontrolled Copy"), Map.entry("UNCONTROLLEDCOPYRECORD", "Uncontrolled Copy"),
            Map.entry("USER", "User"), Map.entry("USERACCOUNT", "User"),
            Map.entry("SESSION", "Login Session"), Map.entry("AUTH", "Authentication"), Map.entry("AUTHENTICATION", "Authentication"),
            Map.entry("NOTIFICATION", "Notification"),
            Map.entry("EXECUTEDRECORD", "Executed Record"),
            Map.entry("AUDITTRAIL", "Audit Trail"),
            Map.entry("EMAILTEMPLATE", "E-mail Template"),
            Map.entry("REPORTARTIFACT", "Report File"),
            Map.entry("REPORTDEFINITION", "Report Template"), Map.entry("REPORTTEMPLATE", "Report Template"),
            Map.entry("SODCONSTRAINT", "SoD Constraint"),
            Map.entry("PUBLISHEDPDF", "Published PDF"),
            Map.entry("EFORMEDITSESSION", "E-form Edit Session"),
            Map.entry("EMAILDESIGN", "E-mail Design"), Map.entry("INAPPDESIGN", "In-app Notification Design"),
            Map.entry("BACKUPRESTORE", "Restore Request"),
            Map.entry("SETTINGS", "Setting")
    );

    public static String typeLabel(String entityType) {
        if (entityType == null || entityType.isBlank()) return "-";
        String known = TYPE_LABEL.get(key(entityType));
        if (known != null) return known;
        // CamelCase and underscores split into words, Title Case ("TRAINING_ACTIVITY" and "TrainingActivity" read "Training Activity")
        String spaced = entityType.trim().replaceAll("([a-z])([A-Z])", "$1 $2").replaceAll("[_\\s]+", " ");
        StringBuilder out = new StringBuilder();
        for (String word : spaced.toLowerCase(Locale.ROOT).split(" ")) {
            if (word.isEmpty()) continue;
            if (out.length() > 0) out.append(' ');
            out.append(switch (word) {
                case "pdf" -> "PDF";
                case "sop" -> "SOP";
                case "id" -> "ID";
                case "sod" -> "SoD";
                case "mfa" -> "MFA";
                case "api" -> "API";
                case "ip" -> "IP";
                case "minio" -> "MinIO";
                default -> Character.toUpperCase(word.charAt(0)) + word.substring(1);
            });
        }
        return out.toString();
    }

    private static final Pattern UUID = Pattern.compile("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
    /** Words that name no object: what a record is called when nobody gave it a name. */
    private static final Set<String> GENERIC = Set.of("authentication session", "session", "system", "unknown", "n/a", "none");

    /** Identity found in the text of the record, for the types that have no name of their own (the number and version before the colon of a training assessment). */
    private static final Pattern NUMBER_AND_VERSION = Pattern.compile("^([A-Za-z]{2,6}[-./]?\\d{2,6}(?:\\s+\\d+(?:\\.\\d+){1,3})?)\\b");
    private static final Pattern SENT_TO = Pattern.compile("^(?:E-?mail |In-app )?notification \"([^\"]+)\" sent to (.+?)(?: \\([^()]*@[^()]*\\))?$", Pattern.CASE_INSENSITIVE);

    /**
     * The code of the object. Every argument is what the record holds (any of them may be missing). Null when the record has no identity left after the rules.
     * A document or revision is known by its number (and revision), everything else by its code, then its name, then the text of the record where that is the identity.
     */
    public static String objectCode(String entityType, String documentNumber, String revisionNumber, String entityCode, String entityName, String comment) {
        String key = key(entityType);
        boolean isRevision = key.equals("REVISION") || key.startsWith("DOCUMENTREVISION");
        boolean isDocument = key.equals("DOCUMENT") || key.equals("DOCUMENTS") || key.equals("DOCUMENTRECORD");
        if (isDocument || isRevision) {
            String number = clean(documentNumber);
            if (usable(number, entityType)) {
                String revision = clean(revisionNumber);
                return isRevision && revision != null && !revision.isBlank() ? number + " Rev." + revision : number;
            }
        }
        // A notification is told from the others of its event by who it went to, not by the event (9,000 notifications share 50 event names).
        if (key.equals("NOTIFICATION")) {
            String sentTo = identityFromText(key, comment);
            if (usable(sentTo, entityType)) return sentTo;
        }
        for (String candidate : new String[] {entityCode, entityName}) {
            String value = clean(candidate);
            if (usable(value, entityType)) return value;
        }
        String fromText = identityFromText(key, comment);
        return usable(fromText, entityType) ? fromText : null;
    }

    static String identityFromText(String key, String comment) {
        if (comment == null || comment.isBlank()) return null;
        String text = comment.trim();
        if (key.equals("TRAININGASSESSMENT") || key.equals("TRAININGFORMTEMPLATE")) {
            Matcher m = NUMBER_AND_VERSION.matcher(text);
            return m.find() ? m.group(1).trim() : null;
        }
        if (key.equals("NOTIFICATION")) {
            Matcher m = SENT_TO.matcher(text);
            if (m.find()) return AuditObjectCatalog.typeLabel(m.group(1).replace('.', '_')) + " > " + m.group(2).trim();
        }
        return null;
    }

    /** An identifier or an address is not a name: a UUID is cut out, a path or an address keeps the name of its file; what is left is tidied. */
    static String clean(String value) {
        if (value == null) return null;
        String text = value.trim();
        if (text.isEmpty()) return null;
        int query = text.indexOf('?');
        if (text.contains("://") || (query > 0 && text.indexOf('/') >= 0)) {
            String path = query >= 0 ? text.substring(0, query) : text;
            text = path.substring(path.lastIndexOf('/') + 1);
        }
        text = UUID.matcher(text).replaceAll("");
        text = text.replaceAll("\\s{2,}", " ").replaceAll("^[\\s.:/\\-|]+|[\\s.:/\\-|]+$", "");
        return text.isEmpty() ? null : text;
    }

    private static boolean usable(String value, String entityType) {
        if (value == null || value.isBlank()) return false;
        String plain = value.replaceAll("[\\s_]+", "").toLowerCase(Locale.ROOT);
        if (plain.equals(key(entityType).toLowerCase(Locale.ROOT))) return false;
        if (plain.equals(typeLabel(entityType).replaceAll("[\\s_]+", "").toLowerCase(Locale.ROOT))) return false;
        return !GENERIC.contains(value.trim().toLowerCase(Locale.ROOT));
    }
}
