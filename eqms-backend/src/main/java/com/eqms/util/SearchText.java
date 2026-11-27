package com.eqms.util;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;

import java.text.Normalizer;
import java.util.Locale;

/**
 * How the words of a search are compared with a value: without case and without Vietnamese marks, so "nguyen" finds "Nguyễn". A list read from the database
 * is compared by the database (function eqms_fold, V867), a list already in memory by {@link #containsFolded}.
 */
public final class SearchText {
    private SearchText() {
    }

    /** {@code value like pattern}, both folded by the database. The pattern is sent as a parameter. */
    public static Predicate like(CriteriaBuilder cb, Expression<String> value, String pattern) {
        return cb.like(cb.function("eqms_fold", String.class, value), cb.function("eqms_fold", String.class, cb.literal(pattern)));
    }

    /** The same with the character that escapes % and _ in the pattern. */
    public static Predicate like(CriteriaBuilder cb, Expression<String> value, String pattern, char escape) {
        return cb.like(cb.function("eqms_fold", String.class, value), cb.function("eqms_fold", String.class, cb.literal(pattern)), escape);
    }

    public static String fold(String value) {
        if (value == null) return "";
        return Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}+", "").replace('đ', 'd').replace('Đ', 'D').toLowerCase(Locale.ROOT);
    }

    public static boolean containsFolded(String value, String words) {
        return value != null && fold(value).contains(fold(words));
    }
}
