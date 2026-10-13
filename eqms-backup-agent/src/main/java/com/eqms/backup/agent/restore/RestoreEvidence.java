package com.eqms.backup.agent.restore;

import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.manifest.ManifestService;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The evidence pack of one restore request (SDS 16, WP3.6): the request and its decisions, the schedule and the window events, the
 * outcome of its test restore with every check, and the ledger events that refer to the request or its backup, with the result of
 * verifying the whole hash chain. The pack is signed with the agent's manifest key, so a changed pack does not verify.
 */
@Component
public class RestoreEvidence {

    private final RestoreRequestService requests;
    private final RestoreExecutionService execution;
    private final RestoreRehearsalService rehearsals;
    private final ManifestService manifests;
    private final LedgerService ledger;

    public RestoreEvidence(RestoreRequestService requests, RestoreExecutionService execution, RestoreRehearsalService rehearsals,
                           ManifestService manifests, LedgerService ledger) {
        this.requests = requests;
        this.execution = execution;
        this.rehearsals = rehearsals;
        this.manifests = manifests;
        this.ledger = ledger;
    }

    /** The signed pack: the canonical text, its SHA-256, the signature and the key id. */
    public Map<String, Object> pack(String requestId) {
        Map<String, Object> request = requests.get(requestId);
        Map<String, Object> checks = execution.preflight(requestId);
        Map<String, Object> rehearsal = null;
        Object test = checks.get("testRestore");
        if (test instanceof Map<?, ?> t && t.get("rehearsalId") != null) {
            rehearsal = rehearsals.get(String.valueOf(t.get("rehearsalId")));
        }
        String backupId = String.valueOf(request.get("backupId"));
        List<Map<String, Object>> events = new ArrayList<>();
        for (LedgerService.Event e : ledger.all()) {
            if (requestId.equals(e.ref()) || backupId.equals(e.ref()) || requestId.equals(detailRef(e))) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("seq", e.seq());
                row.put("at", e.at() == null ? null : e.at().toString());
                row.put("actor", e.actor());
                row.put("event", e.event());
                row.put("ref", e.ref());
                row.put("hash", e.hash());
                events.add(row);
            }
        }
        LedgerService.Verification chain = ledger.verify();
        Map<String, Object> chainMap = new LinkedHashMap<>();
        chainMap.put("ok", chain.ok());
        chainMap.put("checked", chain.checked());
        chainMap.put("firstBrokenSeq", chain.firstBrokenSeq());
        chainMap.put("reason", chain.reason());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", "RESTORE_EVIDENCE");
        body.put("requestId", requestId);
        body.put("generatedAt", Instant.now().toString());
        body.put("request", request);
        body.put("checks", checks);
        body.put("testRestore", rehearsal);
        body.put("ledgerEvents", events);
        body.put("ledgerChain", chainMap);
        ManifestService.SignedManifest signed = manifests.sign(body);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("pack", signed.text());
        out.put("sha256", signed.sha256());
        out.put("signature", signed.signatureBase64());
        out.put("keyId", signed.keyId());
        return out;
    }

    /** Ledger events of a rehearsal or a window carry the request id inside their data. */
    private static String detailRef(LedgerService.Event e) {
        String data = e.dataJson();
        if (data == null) return null;
        int at = data.indexOf("\"requestId\":\"");
        if (at < 0) return null;
        int start = at + 13;
        int end = data.indexOf('"', start);
        return end < 0 ? null : data.substring(start, end);
    }
}
