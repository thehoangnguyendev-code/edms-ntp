package com.eqms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

/** The username suggested for the New User form: worked out by the server (the screen no longer loads the list of users to find a free one). */
class UsernameSuggestionTest {
    @Test
    void theLastWordAndTheInitialsOfTheOthersWithoutAccents() {
        assertEquals("hoangnt", UserManagementService.usernameBase("Nguyễn Thế Hoàng"));
        assertEquals("dungd", UserManagementService.usernameBase("Đỗ Dũng"));
        assertEquals("anna", UserManagementService.usernameBase("  Anna "));
    }

    @Test
    void anythingThatIsNotALetterOrADigitIsDropped() {
        assertEquals("obriensmithj", UserManagementService.usernameBase("John O'Brien-Smith"));
        assertEquals("", UserManagementService.usernameBase("---"));
        assertEquals("", UserManagementService.usernameBase("   "));
        assertEquals("", UserManagementService.usernameBase(null));
    }

    @Test
    void aVeryLongNameGivesNothingInsteadOfAnError() {
        assertEquals("", UserManagementService.usernameBase("a".repeat(201)));
    }
}
