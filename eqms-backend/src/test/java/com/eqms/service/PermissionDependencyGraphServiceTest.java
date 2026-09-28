package com.eqms.service;

import com.eqms.entity.PermissionDependency;
import com.eqms.repository.PermissionDependencyRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

/**
 * Validates the cycle-detection algorithm itself (independent of what's actually seeded in the
 * DB -- see {@code PermissionDependencyGraphSeedDataTest} for that) against synthetic graphs:
 * a real cycle must be caught, an acyclic graph (including a diamond shape, which a naive
 * "visited-once" DFS could mistake for a cycle) must not be flagged, and
 * NO_DEPENDENCY_JUSTIFIED rows (no depends_on_code) must never be treated as edges.
 */
@ExtendWith(MockitoExtension.class)
class PermissionDependencyGraphServiceTest {

    @Mock
    private PermissionDependencyRepository repository;

    private PermissionDependencyGraphService service;

    private PermissionDependency edge(String from, String to, String relationType) {
        PermissionDependency d = new PermissionDependency();
        d.setPermissionCode(from);
        d.setDependsOnCode(to);
        d.setRelationType(relationType);
        d.setStatus("PROPOSED");
        d.setRuleId("TEST");
        return d;
    }

    private PermissionDependency noDependency(String code) {
        PermissionDependency d = new PermissionDependency();
        d.setPermissionCode(code);
        d.setDependsOnCode(null);
        d.setRelationType("NO_DEPENDENCY_JUSTIFIED");
        d.setStatus("PROPOSED");
        d.setRuleId("TEST");
        return d;
    }

    @Test
    void acyclicGraph_hasNoCycle() {
        service = new PermissionDependencyGraphService(repository);
        when(repository.findAll()).thenReturn(List.of(
                edge("a", "b", "REQUIRES"),
                edge("b", "c", "REQUIRES")
        ));

        assertFalse(service.hasCycle());
        assertTrue(service.findFirstCycle().isEmpty());
    }

    @Test
    void diamondShapedGraph_isNotFalselyFlaggedAsCycle() {
        // a -> b -> d, a -> c -> d: d is reached twice (once via b, once via c) but there is no
        // actual cycle. A DFS that only tracks "globally visited" without a proper in-stack set
        // would wrongly report this as a cycle.
        service = new PermissionDependencyGraphService(repository);
        when(repository.findAll()).thenReturn(List.of(
                edge("a", "b", "REQUIRES"),
                edge("a", "c", "REQUIRES"),
                edge("b", "d", "REQUIRES"),
                edge("c", "d", "REQUIRES")
        ));

        assertFalse(service.hasCycle());
    }

    @Test
    void directCycle_isDetected() {
        service = new PermissionDependencyGraphService(repository);
        when(repository.findAll()).thenReturn(List.of(
                edge("a", "b", "REQUIRES"),
                edge("b", "a", "REQUIRES")
        ));

        assertTrue(service.hasCycle());
        List<String> cycle = service.findFirstCycle();
        assertEquals(cycle.get(0), cycle.get(cycle.size() - 1), "cycle path must start and end on the same node");
    }

    @Test
    void selfLoopAcrossThreeNodes_isDetected() {
        service = new PermissionDependencyGraphService(repository);
        when(repository.findAll()).thenReturn(List.of(
                edge("a", "b", "REQUIRES"),
                edge("b", "c", "IMPLIES"),
                edge("c", "a", "REQUIRES")
        ));

        assertTrue(service.hasCycle());
    }

    @Test
    void noDependencyJustifiedRows_areNeverTreatedAsEdges() {
        service = new PermissionDependencyGraphService(repository);
        when(repository.findAll()).thenReturn(List.of(
                noDependency("standalone.permission")
        ));

        assertFalse(service.hasCycle());
        assertTrue(service.findFirstCycle().isEmpty());
    }

    @Test
    void emptyGraph_hasNoCycle() {
        service = new PermissionDependencyGraphService(repository);
        when(repository.findAll()).thenReturn(List.of());

        assertFalse(service.hasCycle());
    }
}
