package com.eqms.backup.agent.ledger;

import com.fasterxml.jackson.core.io.JsonStringEncoder;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * One and only one text form for a JSON value: keys sorted, no whitespace, numbers without exponent. A hash computed over this
 * form can be recomputed years later, by any tool, from the same data.
 */
public final class CanonicalJson {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private CanonicalJson() {
    }

    public static String of(Object value) {
        StringBuilder out = new StringBuilder();
        write(out, value instanceof JsonNode node ? toPlain(node) : value);
        return out.toString();
    }

    public static String ofText(String json) {
        try {
            return of(MAPPER.readTree(json));
        } catch (Exception e) {
            throw new IllegalArgumentException("Not valid JSON", e);
        }
    }

    private static Object toPlain(JsonNode node) {
        if (node.isObject()) {
            Map<String, Object> map = new TreeMap<>();
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> entry = fields.next();
                map.put(entry.getKey(), toPlain(entry.getValue()));
            }
            return map;
        }
        if (node.isArray()) {
            List<Object> list = new ArrayList<>();
            node.forEach(item -> list.add(toPlain(item)));
            return list;
        }
        if (node.isNull() || node.isMissingNode()) return null;
        if (node.isBoolean()) return node.booleanValue();
        if (node.isIntegralNumber()) return node.bigIntegerValue();
        if (node.isNumber()) return node.decimalValue();
        return node.asText();
    }

    @SuppressWarnings("unchecked")
    private static void write(StringBuilder out, Object value) {
        if (value == null) {
            out.append("null");
        } else if (value instanceof String text) {
            out.append('"').append(JsonStringEncoder.getInstance().quoteAsString(text)).append('"');
        } else if (value instanceof Boolean || value instanceof Integer || value instanceof Long || value instanceof java.math.BigInteger) {
            out.append(value);
        } else if (value instanceof BigDecimal decimal) {
            out.append(decimal.stripTrailingZeros().toPlainString());
        } else if (value instanceof Number number) {
            out.append(new BigDecimal(number.toString()).stripTrailingZeros().toPlainString());
        } else if (value instanceof Map<?, ?> map) {
            Map<String, Object> sorted = new TreeMap<>();
            ((Map<Object, Object>) map).forEach((k, v) -> sorted.put(String.valueOf(k), v));
            out.append('{');
            boolean first = true;
            for (Map.Entry<String, Object> entry : sorted.entrySet()) {
                if (!first) out.append(',');
                first = false;
                out.append('"').append(JsonStringEncoder.getInstance().quoteAsString(entry.getKey())).append("\":");
                write(out, entry.getValue());
            }
            out.append('}');
        } else if (value instanceof Iterable<?> items) {
            out.append('[');
            boolean first = true;
            for (Object item : items) {
                if (!first) out.append(',');
                first = false;
                write(out, item);
            }
            out.append(']');
        } else {
            write(out, value.toString());
        }
    }
}
