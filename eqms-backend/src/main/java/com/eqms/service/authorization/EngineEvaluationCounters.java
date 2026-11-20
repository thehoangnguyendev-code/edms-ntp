package com.eqms.service.authorization;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.LongAdder;

/**
 * How many times the engine decided a real step (not a simulation, not a button) for each resource type and action, since this backend started: the evidence that a type has been observed, which the
 * table of disagreements cannot give (it only holds the cases where the engine and the old check differed). In memory: it starts again at zero when the backend restarts, and the screen says since when.
 */
@Component
public class EngineEvaluationCounters {
    private final Instant since = Instant.now();
    private final Map<String, LongAdder[]> counts = new ConcurrentHashMap<>();

    public void record(String resourceType, String action, boolean allowed) {
        if (resourceType == null || action == null) return;
        LongAdder[] c = counts.computeIfAbsent(resourceType + "|" + action, k -> new LongAdder[] {new LongAdder(), new LongAdder()});
        c[allowed ? 0 : 1].increment();
    }

    public Instant since() {
        return since;
    }

    public record Row(String resourceType, String actionCode, long allowed, long refused) {}

    public List<Row> rows() {
        List<Row> out = new ArrayList<>();
        counts.forEach((key, c) -> {
            int i = key.indexOf('|');
            out.add(new Row(key.substring(0, i), key.substring(i + 1), c[0].sum(), c[1].sum()));
        });
        out.sort(Comparator.comparing(Row::resourceType).thenComparing(Row::actionCode));
        return out;
    }
}
