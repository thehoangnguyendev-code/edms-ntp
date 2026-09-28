package com.eqms.dto.auth;

public record PasswordPolicyResponse(
        int passwordMinLength,
        boolean requireUppercase,
        boolean requireLowercase,
        boolean requireNumbers,
        boolean requireSpecialChars,
        /** Minimum number of distinct characters (0 = not enforced). */
        int minUniqueChars,
        /** Longest run of the same character allowed, e.g. 2 rejects "aaa" (0 = not enforced). */
        int maxRepeatedChars,
        /** Reject ascending/descending runs of 3+ such as "abc", "321". */
        boolean disallowSequentialChars,
        /** Reject passwords found in the built-in list of commonly used passwords. */
        boolean disallowCommonPasswords,
        /** Reject passwords containing the user's username, e-mail name or name parts. */
        boolean disallowUserInfo,
        boolean disallowWhitespace
) {
}
