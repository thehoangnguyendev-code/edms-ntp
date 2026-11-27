package com.eqms.service;

import com.eqms.dto.navigation.NavigationItemResponse;
import com.eqms.util.SearchText;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class MenuSearchTest {
    private final List<NavigationItemResponse> menu = List.of(
            new NavigationItemResponse("security", "Security", null, null, false, List.of(
                    new NavigationItemResponse("sec-user-management", "User Management", null, "/settings/users", false, null))),
            new NavigationItemResponse("doc-all", "All Documents", null, "/documents/all", false, null));

    private List<String> ids(String query) {
        return MenuSearch.search(menu, query).stream().map(NavigationService.FlatMenuItem::id).toList();
    }

    @Test
    void aPageIsFoundWithoutCaseAndWithoutMarksInBothLanguages() {
        assertThat(ids("user MANAGEMENT")).containsExactly("sec-user-management");
        assertThat(ids("quản lý người dùng")).contains("sec-user-management");
        assertThat(ids("QUAN LY NGUOI DUNG")).contains("sec-user-management");
    }

    @Test
    void onlyTheMenuGivenIsSearched() {
        assertThat(ids("backup")).isEmpty();
        assertThat(ids("   ")).isEmpty();
    }

    @Test
    void textIsFoldedTheSameWayEverywhere() {
        assertThat(SearchText.fold("Đặng Thị NGUYỄN")).isEqualTo("dang thi nguyen");
        assertThat(SearchText.containsFolded("Nguyễn Văn Đức", "duc")).isTrue();
        assertThat(SearchText.containsFolded(null, "a")).isFalse();
    }
}
