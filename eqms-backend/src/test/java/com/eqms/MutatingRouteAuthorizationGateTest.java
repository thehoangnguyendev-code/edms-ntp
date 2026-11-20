package com.eqms;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Architecture guard (WP0 of the authorization plan, owner agreed 2026-11-20): every route that changes data (POST, PUT, PATCH, DELETE) of a controller
 * must reach an authorization gate -- a permission check, the authorization engine / shadow guard, an electronic-signature token check, or a
 * {@code PreAuthorize} -- in its own body or in the service methods it calls (two levels deep). A new route without one fails this test, so that
 * "whoever holds the permission may enter" cannot silently become "anybody may enter" when a function is added.
 *
 * It reads the source text (no Spring context, no database). A route that is safe for a reason the scan cannot see is listed in {@link #EXCEPTIONS}
 * with the reason; adding to that list is a decision to be reviewed, not a way to silence the test.
 */
class MutatingRouteAuthorizationGateTest {

    /** What counts as a gate. */
    static final Pattern GATE = Pattern.compile(
            "(hasPermission|hasAnyPermission|hasPermissionAlias|requirePermission|ShadowGuard|shadow\\.around|shadow\\.run|engine\\.authorize|authorize\\(|"
                    + "checkAccess|canAccess|isAllowed|assertCan|ensureCan|verify\\w*Access|AccessDeniedException|ForbiddenException|requireValidToken|"
                    + "requireCurrentUser\\(\\)\\.get|currentUserService\\.require|require\\w*\\()",
            Pattern.CASE_INSENSITIVE);

    /** Routes with a reason the scan cannot see. Key: Controller#method. */
    static final Map<String, String> EXCEPTIONS = Map.of(
            "RevisionController#saveWorkspaceBatch", "delegates every item to RevisionService, which gates each revision action (one item = one gate)",
            "RevisionController#submitWorkspaceBatch", "delegates every item to RevisionService, which gates each revision action (one item = one gate)",
            "ReportPlatformController#ScheduleOwnerChange", "the change runs inside the shadow guard of ReportPlatformService (the engine checks the actor)");

    private static final Pattern MAPPING = Pattern.compile(
            "@(Post|Put|Delete|Patch)Mapping[^\\n]*\\n((?:\\s*@[^\\n]*\\n)*)\\s*public\\s+[^\\(]*?\\s(\\w+)\\s*\\(");
    private static final Pattern METHOD = Pattern.compile(
            "\\n\\s+(?:public|protected|private|static|final|\\s)+[\\w<>\\[\\],.? ]+\\s+(\\w+)\\s*\\([^;{]*\\)\\s*(?:throws [\\w, .]+)?\\s*\\{");
    private static final Pattern CALL = Pattern.compile("\\b\\w+\\.(\\w+)\\(");

    record Route(String controller, String verb, String method, String body, boolean preAuthorized) {
        String key() {
            return controller + "#" + method;
        }
    }

    /** The text of the block that starts at the first '{' at or after {@code from}, braces matched. */
    private static String block(String src, int from) {
        int i = src.indexOf('{', from);
        if (i < 0) return "";
        int depth = 0;
        for (int j = i; j < src.length(); j++) {
            char c = src.charAt(j);
            if (c == '{') depth++;
            else if (c == '}' && --depth == 0) return src.substring(i, j + 1);
        }
        return src.substring(i);
    }

    static List<Route> routesOf(String controller, String src) {
        List<Route> routes = new ArrayList<>();
        Matcher m = MAPPING.matcher(src);
        while (m.find()) {
            routes.add(new Route(controller, m.group(1).toUpperCase(), m.group(3), block(src, m.end()),
                    m.group(0).contains("PreAuthorize") || m.group(2).contains("PreAuthorize")));
        }
        return routes;
    }

    static Map<String, List<String>> methodBodies(String src, Map<String, List<String>> into) {
        Matcher m = METHOD.matcher(src);
        while (m.find()) {
            into.computeIfAbsent(m.group(1), k -> new ArrayList<>()).add(block(src, m.end() - 1));
        }
        return into;
    }

    /** True when the route reaches a gate in its own body, in a method it calls, or in a method that one calls. */
    static boolean guarded(Route route, Map<String, List<String>> services) {
        if (route.preAuthorized() || GATE.matcher(route.body()).find()) return true;
        Set<String> firstLevel = calls(route.body());
        for (String call : firstLevel) {
            for (String body : services.getOrDefault(call, List.of())) {
                if (GATE.matcher(body).find()) return true;
            }
        }
        for (String call : firstLevel) {
            for (String body : services.getOrDefault(call, List.of())) {
                for (String second : calls(body)) {
                    for (String deeper : services.getOrDefault(second, List.of())) {
                        if (GATE.matcher(deeper).find()) return true;
                    }
                }
            }
        }
        return false;
    }

    private static Set<String> calls(String body) {
        Set<String> out = new java.util.LinkedHashSet<>();
        Matcher m = CALL.matcher(body);
        while (m.find()) out.add(m.group(1));
        return out;
    }

    private static String read(Path p) {
        try {
            return Files.readString(p, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException(p.toString(), e);
        }
    }

    private static Path sourceRoot() {
        Path p = Paths.get("src", "main", "java", "com", "eqms");
        assertThat(p).as("run from eqms-backend").isDirectory();
        return p;
    }

    private static List<Path> javaFiles(Path dir) throws IOException {
        try (Stream<Path> s = Files.walk(dir)) {
            return s.filter(f -> f.toString().endsWith(".java")).toList();
        }
    }

    @Test
    void everyRouteThatChangesDataReachesAnAuthorizationGate() throws IOException {
        Path root = sourceRoot();
        Map<String, List<String>> services = new HashMap<>();
        for (Path f : javaFiles(root)) {
            String rel = root.relativize(f).toString().replace('\\', '/');
            if (rel.startsWith("controller/") || rel.startsWith("dto/") || rel.startsWith("entity/")) continue;
            methodBodies(read(f), services);
        }
        List<Route> routes = new ArrayList<>();
        for (Path f : javaFiles(root.resolve("controller"))) {
            routes.addAll(routesOf(f.getFileName().toString().replace(".java", "").replace("Controller", ""), read(f)));
        }
        assertThat(routes.size()).as("the scan found the mutating routes").isGreaterThan(300);

        List<String> open = routes.stream().filter(r -> !guarded(r, services)).map(r -> r.controller() + "Controller#" + r.method()).toList();
        List<String> unexplained = open.stream().filter(k -> !EXCEPTIONS.containsKey(k)).toList();
        assertThat(unexplained)
                .as("mutating routes with no authorization gate in sight; add the gate, or list the route in EXCEPTIONS with the reason")
                .isEmpty();

        // an exception that is no longer needed (the route now has a gate, or is gone) must leave the list
        List<String> stale = EXCEPTIONS.keySet().stream().filter(k -> !open.contains(k)).toList();
        assertThat(stale).as("exceptions that are no longer exceptions").isEmpty();
    }

    @Test
    void theScanSeesAnOpenRouteAndAGuardedOne() {
        String controller = """
                @RestController
                class DemoController {
                    @PostMapping("/open")
                    public void open(@RequestBody String body) {
                        service.save(body);
                    }
                    @PostMapping("/guarded")
                    public void guarded(@RequestBody String body) {
                        service.saveGuarded(body);
                    }
                    @DeleteMapping("/direct")
                    public void direct() {
                        permissionEvaluationService.hasPermission(user, "x.y");
                    }
                    @PutMapping("/pre")
                    @PreAuthorize("hasAuthority('x')")
                    public void pre() {
                        service.save("x");
                    }
                    @GetMapping("/read")
                    public String read() { return ""; }
                }
                """;
        String service = """
                class DemoService {
                    void save(String body) {
                        repository.store(body);
                    }
                    void saveGuarded(String body) {
                        requirePermission(actor, "demo.change");
                        repository.store(body);
                    }
                }
                """;
        Map<String, List<String>> services = methodBodies(service, new HashMap<>());
        List<Route> routes = routesOf("Demo", controller);
        assertThat(routes).extracting(Route::method).containsExactlyInAnyOrder("open", "guarded", "direct", "pre");
        Map<String, Boolean> result = new HashMap<>();
        routes.forEach(r -> result.put(r.method(), guarded(r, services)));
        assertThat(result).containsEntry("open", false).containsEntry("guarded", true).containsEntry("direct", true).containsEntry("pre", true);
    }
}
