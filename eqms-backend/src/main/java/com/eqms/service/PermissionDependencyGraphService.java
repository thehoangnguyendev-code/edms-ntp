package com.eqms.service;

import com.eqms.entity.PermissionDependency;
import com.eqms.repository.PermissionDependencyRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Phase 1 (Permission Catalog only) read-side validation over {@code permission_dependencies} --
 * see PERMISSION_DEPENDENCY_MATRIX_REVIEW_DRAFT.md Section 4 "Giai đoạn 1" item 3 ("Dependency
 * graph không được có vòng lặp; migration/test phải chặn"). Not consulted by any Access
 * Profile/Permission Set save path -- that enforcement is Phase 2, explicitly deferred.
 */
@Service
public class PermissionDependencyGraphService {

    private final PermissionDependencyRepository repository;

    public PermissionDependencyGraphService(PermissionDependencyRepository repository) {
        this.repository = repository;
    }

    /**
     * Returns the first cycle found among REQUIRES/IMPLIES edges (as an ordered list of permission
     * codes, first code repeated at the end), or an empty list if the graph is acyclic.
     * NO_DEPENDENCY_JUSTIFIED rows have no {@code dependsOnCode} and are not edges.
     */
    public List<String> findFirstCycle() {
        Map<String, List<String>> adjacency = buildAdjacency(repository.findAll());

        Set<String> visited = new HashSet<>();
        Set<String> inStack = new HashSet<>();
        Map<String, String> parent = new HashMap<>();

        for (String node : adjacency.keySet()) {
            if (visited.contains(node)) {
                continue;
            }
            List<String> cycle = dfs(node, adjacency, visited, inStack, parent);
            if (!cycle.isEmpty()) {
                return cycle;
            }
        }
        return List.of();
    }

    public boolean hasCycle() {
        return !findFirstCycle().isEmpty();
    }

    private Map<String, List<String>> buildAdjacency(List<PermissionDependency> rows) {
        Map<String, List<String>> adjacency = new HashMap<>();
        for (PermissionDependency row : rows) {
            if (row.getDependsOnCode() == null) {
                continue;
            }
            adjacency.computeIfAbsent(row.getPermissionCode(), k -> new ArrayList<>()).add(row.getDependsOnCode());
            adjacency.putIfAbsent(row.getDependsOnCode(), new ArrayList<>());
        }
        return adjacency;
    }

    /** Iterative DFS (3-color) so a large/pathological graph cannot blow the call stack. */
    private List<String> dfs(
            String start,
            Map<String, List<String>> adjacency,
            Set<String> visited,
            Set<String> inStack,
            Map<String, String> parent
    ) {
        Deque<String> stack = new ArrayDeque<>();
        stack.push(start);

        while (!stack.isEmpty()) {
            String node = stack.peek();
            if (!visited.contains(node)) {
                visited.add(node);
                inStack.add(node);
            }

            boolean advanced = false;
            for (String neighbor : adjacency.getOrDefault(node, List.of())) {
                if (inStack.contains(neighbor)) {
                    return buildCyclePath(parent, node, neighbor);
                }
                if (!visited.contains(neighbor)) {
                    parent.put(neighbor, node);
                    stack.push(neighbor);
                    advanced = true;
                    break;
                }
            }
            if (!advanced) {
                inStack.remove(node);
                stack.pop();
            }
        }
        return List.of();
    }

    private List<String> buildCyclePath(Map<String, String> parent, String fromNode, String toNode) {
        List<String> path = new ArrayList<>();
        path.add(toNode);
        String current = fromNode;
        while (current != null && !current.equals(toNode)) {
            path.add(current);
            current = parent.get(current);
        }
        path.add(toNode);
        java.util.Collections.reverse(path);
        return path;
    }
}
