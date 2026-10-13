package com.eqms.backup.agent.maintenance;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * The Super Administrator account (SDS 11.6, BR-17). It lives in the control database, outside the eQMS user table, so a restore
 * of the eQMS database cannot remove it. Only a bcrypt hash is stored. Every login attempt is recorded.
 */
@Service
public class SuperAdminService {

    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder(12);
    /** A hash that matches nothing, checked when the user does not exist, so a wrong user and a wrong password take the same time. */
    private static final String DUMMY_HASH = ENCODER.encode("not-a-real-password-" + System.nanoTime());
    private static final Pattern LETTER = Pattern.compile("[A-Za-z]");
    private static final Pattern DIGIT = Pattern.compile("\\d");
    private static final Pattern SYMBOL = Pattern.compile("[^A-Za-z0-9]");

    private final JdbcTemplate jdbc;

    public SuperAdminService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public static String checkPasswordStrength(String password) {
        if (password == null || password.length() < 8) return "The password must be at least 8 characters";
        if (!LETTER.matcher(password).find() || !DIGIT.matcher(password).find() || !SYMBOL.matcher(password).find()) {
            return "The password must contain a letter, a digit and a symbol";
        }
        return null;
    }

    /** Failed sign-ins that count towards the lock, and how long the lock lasts (DEV defaults, see SDS 11.6). */
    public static final int MAX_FAILED_SIGN_INS = 5;
    public static final String LOCK_WINDOW_SQL = "15 minutes";

    /** Thrown while the account is locked. The password is not checked then. */
    public static class LockedOutException extends RuntimeException {
        public LockedOutException() {
            super("Too many failed sign-in attempts. Wait 15 minutes and try again.");
        }
    }

    public boolean verify(String username, String password) {
        String name = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
        if (failedSignInsInWindow(name) >= MAX_FAILED_SIGN_INS) {
            record(name, "LOGIN_THROTTLED", "locked after " + MAX_FAILED_SIGN_INS + " failed sign-ins");
            throw new LockedOutException();
        }
        String hash;
        boolean active;
        try {
            var row = jdbc.queryForMap("select password_hash, active from super_admin where username = ?", name);
            hash = (String) row.get("password_hash");
            active = (Boolean) row.get("active");
        } catch (EmptyResultDataAccessException e) {
            ENCODER.matches(password == null ? "" : password, DUMMY_HASH);
            record(name, "LOGIN_FAILED", "unknown account");
            return false;
        }
        boolean ok = active && password != null && ENCODER.matches(password, hash);
        record(name, ok ? "LOGIN_OK" : "LOGIN_FAILED", active ? null : "account inactive");
        return ok;
    }

    /** Operator use only (see SuperAdminProvisioner): the account is created once, never through the web. */
    public void create(String username, String password, String by) {
        String name = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
        if (!name.matches("[a-z][a-z0-9._-]{2,79}")) throw new IllegalArgumentException("The username must be 3-80 characters: letters, digits, dot, dash, underscore");
        String weak = checkPasswordStrength(password);
        if (weak != null) throw new IllegalArgumentException(weak);
        jdbc.update("insert into super_admin(username, password_hash, created_by) values (?, ?, ?)", name, ENCODER.encode(password), by);
        record(name, "ACCOUNT_CREATED", "created by " + by);
    }

    public boolean exists() {
        Integer n = jdbc.queryForObject("select count(*) from super_admin where active", Integer.class);
        return n != null && n > 0;
    }

    /** Failed sign-ins for this name since its last success, inside the lock window. */
    private int failedSignInsInWindow(String name) {
        Integer n = jdbc.queryForObject("""
                select count(*) from super_admin_event
                 where username = ? and event = 'LOGIN_FAILED'
                   and at > now() - interval '%s'
                   and at > coalesce((select max(at) from super_admin_event where username = ? and event = 'LOGIN_OK'), '-infinity'::timestamptz)
                """.formatted(LOCK_WINDOW_SQL), Integer.class, name, name);
        return n == null ? 0 : n;
    }

    private void record(String username, String event, String detail) {
        jdbc.update("insert into super_admin_event(username, event, detail) values (?, ?, ?)", username, event, detail);
    }
}
