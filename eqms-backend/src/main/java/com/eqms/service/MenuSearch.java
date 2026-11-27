package com.eqms.service;

import com.eqms.dto.navigation.NavigationItemResponse;
import com.eqms.util.SearchText;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Finds the pages of a menu by name: every word of the search, in English or in Vietnamese, without case and without Vietnamese marks. A name found as
 * typed comes first, then a match on the page's own name, then one that needs the name of the group above it. Which menu is searched (what the person may
 * open) is decided by the caller. The Vietnamese names come from navigation/menu-names.json, kept equal to the screens by a test of the frontend.
 */
final class MenuSearch {
    private static final int MAX_PAGES = 8;
    private static final Map<String, List<String>> NAMES = load();

    private MenuSearch() {
    }

    private record Match(int score, NavigationService.FlatMenuItem page) {
    }

    private static Map<String, List<String>> load() {
        try (InputStream file = MenuSearch.class.getResourceAsStream("/navigation/menu-names.json")) {
            if (file == null) throw new IllegalStateException("navigation/menu-names.json is missing");
            return new ObjectMapper().readValue(file, new TypeReference<Map<String, List<String>>>() {
            });
        } catch (IOException unreadable) {
            throw new UncheckedIOException(unreadable);
        }
    }

    static List<NavigationService.FlatMenuItem> search(List<NavigationItemResponse> menu, String query) {
        List<String> words = Arrays.stream(SearchText.fold(query).trim().split("\\s+")).filter(w -> !w.isEmpty()).toList();
        if (words.isEmpty()) return List.of();
        List<Match> found = new ArrayList<>();
        visit(menu, null, null, "", words, exact(query), found);
        return found.stream().sorted(Comparator.comparingInt(Match::score)).limit(MAX_PAGES).map(Match::page).toList();
    }

    /** As typed, marks kept: only the case and the form of the characters are ignored. */
    private static String exact(String value) {
        return Normalizer.normalize(value.trim(), Normalizer.Form.NFC).toLowerCase(Locale.ROOT);
    }

    private static void visit(List<NavigationItemResponse> items, String parentPath, String parentIcon, String parentNames,
                              List<String> words, String asTyped, List<Match> found) {
        if (items == null) return;
        for (NavigationItemResponse item : items) {
            // the label of the server first: an administrator may have renamed the entry
            Set<String> names = new LinkedHashSet<>();
            names.add(item.label());
            names.addAll(NAMES.getOrDefault(item.id(), List.of()));
            String path = parentPath == null ? item.label() : parentPath + " > " + item.label();
            String icon = parentIcon != null ? parentIcon : item.icon();
            String allNames = parentNames + " " + String.join(" ", names);
            if (item.path() != null) {
                String folded = SearchText.fold(allNames);
                if (words.stream().allMatch(folded::contains)) {
                    int score = names.stream().anyMatch(n -> exact(n).contains(asTyped)) ? 0
                            : names.stream().anyMatch(n -> words.stream().allMatch(SearchText.fold(n)::contains)) ? 1 : 2;
                    found.add(new Match(score, new NavigationService.FlatMenuItem(item.id(), item.label(), icon, item.path(), path)));
                }
            }
            visit(item.children(), path, icon, allNames, words, asTyped, found);
        }
    }
}
