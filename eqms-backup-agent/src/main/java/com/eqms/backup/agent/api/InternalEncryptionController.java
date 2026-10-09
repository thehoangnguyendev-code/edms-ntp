package com.eqms.backup.agent.api;

import com.eqms.backup.agent.backup.GpgKeyring;
import com.eqms.backup.agent.manifest.SigningKeys;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/** What protects the backups, as facts the Storage & Encryption screen can show. Never a key, only identifiers. */
@RestController
@RequestMapping("/internal/encryption")
public class InternalEncryptionController {

    private final GpgKeyring keyring;
    private final SigningKeys signing;

    public InternalEncryptionController(GpgKeyring keyring, SigningKeys signing) {
        this.keyring = keyring;
        this.signing = signing;
    }

    @GetMapping
    public Map<String, Object> get() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("scheme", "OpenPGP");
        out.put("cipher", "AES256");
        out.put("signingAlgorithm", "Ed25519");
        out.put("signingKeyId", signing.keyId());
        try {
            out.put("available", true);
            out.put("recipientKeyId", keyring.keyId());
            out.put("fingerprint", keyring.fingerprint());
            out.put("encryptionKeyIds", keyring.encryptionKeyIds());
        } catch (IllegalStateException e) {
            out.put("available", false);
            out.put("problem", e.getMessage());
        }
        out.put("agentCanDecrypt", false);
        return out;
    }
}
