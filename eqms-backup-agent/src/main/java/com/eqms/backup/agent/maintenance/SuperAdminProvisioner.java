package com.eqms.backup.agent.maintenance;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Locale;

/**
 * Operator tool, never reachable over HTTP: creates the one Super Administrator account in the control database. The password is
 * read from the environment (SUPER_ADMIN_PASSWORD), never from the command line, so it does not appear in the process list.
 * Run through scripts/backup/provision-super-admin.sh.
 */
public final class SuperAdminProvisioner {

    private SuperAdminProvisioner() {
    }

    public static void main(String[] args) throws Exception {
        String username = System.getenv("SUPER_ADMIN_USERNAME");
        String password = System.getenv("SUPER_ADMIN_PASSWORD");
        String url = System.getenv("CONTROL_DB_URL");
        String user = System.getenv("CONTROL_DB_USER");
        String dbPassword = System.getenv("CONTROL_DB_PASSWORD");
        if (username == null || password == null || url == null || user == null || dbPassword == null) {
            System.err.println("set SUPER_ADMIN_USERNAME, SUPER_ADMIN_PASSWORD, CONTROL_DB_URL, CONTROL_DB_USER, CONTROL_DB_PASSWORD");
            System.exit(2);
        }
        String name = username.trim().toLowerCase(Locale.ROOT);
        if (!name.matches("[a-z][a-z0-9._-]{2,79}")) {
            System.err.println("The username must be 3-80 characters: letters, digits, dot, dash, underscore");
            System.exit(2);
        }
        String weak = SuperAdminService.checkPasswordStrength(password);
        if (weak != null) {
            System.err.println(weak);
            System.exit(2);
        }
        try (Connection c = DriverManager.getConnection(url, user, dbPassword)) {
            try (PreparedStatement count = c.prepareStatement("select count(*) from super_admin"); ResultSet rs = count.executeQuery()) {
                rs.next();
                if (rs.getLong(1) > 0) {
                    System.err.println("A Super Administrator already exists. This tool creates only the first one; a second account is a decision, not a script.");
                    System.exit(3);
                }
            }
            try (PreparedStatement ins = c.prepareStatement("insert into super_admin(username, password_hash, created_by) values (?, ?, ?)")) {
                ins.setString(1, name);
                ins.setString(2, new BCryptPasswordEncoder(12).encode(password));
                ins.setString(3, "operator (provisioner)");
                ins.executeUpdate();
            }
            try (PreparedStatement ev = c.prepareStatement("insert into super_admin_event(username, event, detail) values (?, 'ACCOUNT_CREATED', 'created by operator (provisioner)')")) {
                ev.setString(1, name);
                ev.executeUpdate();
            }
        }
        System.out.println("Created the Super Administrator account " + name + " (password not shown)");
    }
}
