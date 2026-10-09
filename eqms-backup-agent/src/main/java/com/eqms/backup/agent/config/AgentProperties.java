package com.eqms.backup.agent.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;

/**
 * Settings of the agent. The environment (DEV, TEST or PROD) is explicit: the agent refuses to start with an unknown value and
 * never shares a target, key or control database between environments.
 */
@ConfigurationProperties(prefix = "agent")
public class AgentProperties {

    private String environment = "DEV";
    /** Shared secret the eQMS backend presents on /internal calls. */
    private String apiToken = "";
    private final Source source = new Source();
    private final Targets targets = new Targets();
    private final Crypto crypto = new Crypto();
    private final Tools tools = new Tools();
    private final Objects objects = new Objects();
    private final Exports exports = new Exports();
    private Path ledgerDir = Path.of("/backup/ledger");
    private long minFreeBytes = 1_073_741_824L;
    /** Time zone used to read the schedule of the policy (stored times are UTC). */
    private String zone = "Asia/Ho_Chi_Minh";
    private int pollSeconds = 5;

    public static class Source {
        private String host = "postgres";
        private int port = 5432;
        private String database = "eqms-database";
        private String user = "eqms_backup_ro";
        private String password = "";

        public String getHost() { return host; }
        public void setHost(String host) { this.host = host; }
        public int getPort() { return port; }
        public void setPort(int port) { this.port = port; }
        public String getDatabase() { return database; }
        public void setDatabase(String database) { this.database = database; }
        public String getUser() { return user; }
        public void setUser(String user) { this.user = user; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }

    public static class Targets {
        /** T1: a folder on the server, on a different disk from the database when possible. */
        private Path t1 = Path.of("/backup/t1");

        public Path getT1() { return t1; }
        public void setT1(Path t1) { this.t1 = t1; }

        /** Further copies (T2, T3, ...). Each is a folder or an S3-compatible bucket; none may point at the live eQMS buckets. */
        private java.util.Map<String, Extra> extra = new java.util.LinkedHashMap<>();

        /** Keyed by target code, so each one can be configured on its own: {@code agent.targets.extra.t2.kind=FOLDER}. */
        public java.util.Map<String, Extra> getExtra() { return extra; }
        public void setExtra(java.util.Map<String, Extra> extra) { this.extra = extra; }
    }

    public static class Extra {
        private String code;
        /** FOLDER or S3. */
        private String kind = "FOLDER";
        private Path path;
        private String endpoint;
        private String bucket;
        private String accessKey;
        private String secretKey;
        /** True when the bucket must refuse deletes (Object Lock); the target test then proves it. */
        private boolean immutable;

        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        public String getKind() { return kind; }
        public void setKind(String kind) { this.kind = kind; }
        public Path getPath() { return path; }
        public void setPath(Path path) { this.path = path; }
        public String getEndpoint() { return endpoint; }
        public void setEndpoint(String endpoint) { this.endpoint = endpoint; }
        public String getBucket() { return bucket; }
        public void setBucket(String bucket) { this.bucket = bucket; }
        public String getAccessKey() { return accessKey; }
        public void setAccessKey(String accessKey) { this.accessKey = accessKey; }
        public String getSecretKey() { return secretKey; }
        public void setSecretKey(String secretKey) { this.secretKey = secretKey; }
        public boolean isImmutable() { return immutable; }
        public void setImmutable(boolean immutable) { this.immutable = immutable; }
    }

    /** The eQMS document store the agent reads (read only: it lists versions and reads them, nothing else). */
    public static class Objects {
        private boolean enabled;
        private String endpoint = "http://minio:9000";
        private String accessKey = "";
        private String secretKey = "";
        private java.util.List<String> buckets = new java.util.ArrayList<>();

        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public String getEndpoint() { return endpoint; }
        public void setEndpoint(String endpoint) { this.endpoint = endpoint; }
        public String getAccessKey() { return accessKey; }
        public void setAccessKey(String accessKey) { this.accessKey = accessKey; }
        public String getSecretKey() { return secretKey; }
        public void setSecretKey(String secretKey) { this.secretKey = secretKey; }
        public java.util.List<String> getBuckets() { return buckets; }
        public void setBuckets(java.util.List<String> buckets) { this.buckets = buckets; }
    }

    /** Where packages for registered offline media are written; each medium has one folder under this root. */
    public static class Exports {
        private Path root = Path.of("/backup/export");

        public Path getRoot() { return root; }
        public void setRoot(Path root) { this.root = root; }
    }

    public static class Crypto {
        /** Public OpenPGP key (ASCII armour). The agent can encrypt with it but never decrypt: the private half is not here. */
        private Path publicKeyFile = Path.of("/run/secrets/backup_gpg_public.asc");
        /** Ed25519 key that signs manifests. Created on first start in DEV; must be provisioned in TEST and PROD. */
        private Path signingKeyFile = Path.of("/backup/agent/signing.key");
        private String gpgHome = "/tmp/agent-gnupg";

        public Path getPublicKeyFile() { return publicKeyFile; }
        public void setPublicKeyFile(Path publicKeyFile) { this.publicKeyFile = publicKeyFile; }
        public Path getSigningKeyFile() { return signingKeyFile; }
        public void setSigningKeyFile(Path signingKeyFile) { this.signingKeyFile = signingKeyFile; }
        public String getGpgHome() { return gpgHome; }
        public void setGpgHome(String gpgHome) { this.gpgHome = gpgHome; }
    }

    public static class Tools {
        private String pgDump = "pg_dump";
        private String gpg = "gpg";

        public String getPgDump() { return pgDump; }
        public void setPgDump(String pgDump) { this.pgDump = pgDump; }
        public String getGpg() { return gpg; }
        public void setGpg(String gpg) { this.gpg = gpg; }
    }

    public String getEnvironment() { return environment; }
    public void setEnvironment(String environment) { this.environment = environment; }
    public String getApiToken() { return apiToken; }
    public void setApiToken(String apiToken) { this.apiToken = apiToken; }
    public Source getSource() { return source; }
    public Targets getTargets() { return targets; }
    public Crypto getCrypto() { return crypto; }
    public Tools getTools() { return tools; }
    public Objects getObjects() { return objects; }
    public Exports getExports() { return exports; }
    public Path getLedgerDir() { return ledgerDir; }
    public void setLedgerDir(Path ledgerDir) { this.ledgerDir = ledgerDir; }
    public long getMinFreeBytes() { return minFreeBytes; }
    public void setMinFreeBytes(long minFreeBytes) { this.minFreeBytes = minFreeBytes; }
    public String getZone() { return zone; }
    public void setZone(String zone) { this.zone = zone; }
    public int getPollSeconds() { return pollSeconds; }
    public void setPollSeconds(int pollSeconds) { this.pollSeconds = pollSeconds; }
}
