package com.eqms.backup.agent;

import org.flywaydb.core.Flyway;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.UUID;

/**
 * Gives each test its own throw-away control database on the PostgreSQL server of the DEV stack, and drops it afterwards.
 * Nothing here touches the eQMS database or any bucket. Connection settings come from the environment so the test can be
 * pointed at any PostgreSQL server the developer controls:
 * TEST_PG_URL (default jdbc:postgresql://localhost:5432/postgres), TEST_PG_USER, TEST_PG_PASSWORD.
 */
public final class ControlDbTestSupport implements AutoCloseable {

    private final String adminUrl = System.getenv().getOrDefault("TEST_PG_URL", "jdbc:postgresql://localhost:5432/postgres");
    private final String user = System.getenv().getOrDefault("TEST_PG_USER", "eqms");
    private final String password = System.getenv().getOrDefault("TEST_PG_PASSWORD", "eqms");
    private final String dbName = "eqms_ctl_test_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);

    public final DataSource dataSource;
    public final JdbcTemplate jdbc;
    public final TransactionTemplate tx;
    private final java.util.List<String> extraDatabases = new java.util.ArrayList<>();

    public ControlDbTestSupport() throws Exception {
        try (Connection c = DriverManager.getConnection(adminUrl, user, password); Statement s = c.createStatement()) {
            s.execute("create database \"" + dbName + "\"");
        }
        String url = adminUrl.substring(0, adminUrl.lastIndexOf('/') + 1) + dbName;
        DriverManagerDataSource ds = new DriverManagerDataSource(url, user, password);
        Flyway.configure().dataSource(ds).locations("classpath:db/control").load().migrate();
        this.dataSource = ds;
        this.jdbc = new JdbcTemplate(ds);
        this.tx = new TransactionTemplate(new DataSourceTransactionManager(ds));
    }

    /** A small throw-away stand-in for the eQMS database: a few tables with known row counts and a Flyway history. */
    public String createSourceDb() throws Exception {
        String name = "eqms_src_test_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try (Connection c = DriverManager.getConnection(adminUrl, user, password); Statement s = c.createStatement()) {
            s.execute("create database \"" + name + "\"");
        }
        extraDatabases.add(name);
        String url = adminUrl.substring(0, adminUrl.lastIndexOf('/') + 1) + name;
        try (Connection c = DriverManager.getConnection(url, user, password); Statement s = c.createStatement()) {
            s.execute("create table documents(id serial primary key, title text)");
            s.execute("insert into documents(title) select 'doc ' || g from generate_series(1, 25) g");
            s.execute("create table audit_logs(id serial primary key, what text)");
            s.execute("insert into audit_logs(what) select 'event ' || g from generate_series(1, 40) g");
            s.execute("create table flyway_schema_history(version text)");
            s.execute("insert into flyway_schema_history values ('1'), ('559'), ('560')");
        }
        return name;
    }

    public String host() {
        String rest = adminUrl.substring("jdbc:postgresql://".length());
        return rest.substring(0, rest.indexOf(':'));
    }

    public int port() {
        String rest = adminUrl.substring("jdbc:postgresql://".length());
        return Integer.parseInt(rest.substring(rest.indexOf(':') + 1, rest.indexOf('/')));
    }

    public String user() {
        return user;
    }

    public String password() {
        return password;
    }

    @Override
    public void close() throws Exception {
        try (Connection c = DriverManager.getConnection(adminUrl, user, password); Statement s = c.createStatement()) {
            s.execute("drop database if exists \"" + dbName + "\" with (force)");
            for (String name : extraDatabases) {
                s.execute("drop database if exists \"" + name + "\" with (force)");
            }
        }
    }
}
