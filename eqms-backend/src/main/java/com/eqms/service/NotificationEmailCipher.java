package com.eqms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.*;

/** Dedicated persistent server key, never derived from a JWT or included in an outbox row. */
@Component
public final class NotificationEmailCipher {
    public static final String VERSION="AES_GCM_V1";
    private final SecretKeySpec key;
    private final SecureRandom random=new SecureRandom();
    private final ObjectMapper mapper;
    public record Content(String subject,String body,Map<String,String> payload) { }

    public NotificationEmailCipher(@Value("${app.notifications.outbox-encryption-key:}") String encoded,ObjectMapper mapper) {
        byte[] bytes;
        try {bytes=Base64.getDecoder().decode(encoded);}catch(IllegalArgumentException invalid){throw new IllegalStateException("Notification outbox encryption key must be a Base64 encoded 32-byte key");}
        if(bytes.length!=32)throw new IllegalStateException("Notification outbox encryption key must be configured as a Base64 encoded 32-byte key");
        this.key=new SecretKeySpec(bytes,"AES");this.mapper=mapper;Arrays.fill(bytes,(byte)0);
    }

    public String seal(UUID id,String recipient,String event,String domain,Content content) {
        try {
            byte[] nonce=new byte[12];random.nextBytes(nonce);
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key,new GCMParameterSpec(128,nonce));
            cipher.updateAAD(binding(id,recipient,event,domain));
            byte[] encrypted=cipher.doFinal(mapper.writeValueAsBytes(content));
            return mapper.writeValueAsString(Map.of("nonce",Base64.getEncoder().encodeToString(nonce),"ciphertext",Base64.getEncoder().encodeToString(encrypted)));
        }catch(Exception failure){throw new IllegalStateException("NOTIFICATION_OUTBOX_ENCRYPTION_FAILED");}
    }

    public Content open(UUID id,String recipient,String event,String domain,String envelope) {
        try {
            var json=mapper.readTree(envelope);
            byte[] nonce=Base64.getDecoder().decode(json.path("nonce").asText());if(nonce.length!=12)throw new IllegalArgumentException();
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key,new GCMParameterSpec(128,nonce));
            cipher.updateAAD(binding(id,recipient,event,domain));
            return mapper.readValue(cipher.doFinal(Base64.getDecoder().decode(json.path("ciphertext").asText())),Content.class);
        }catch(Exception failure){throw new IllegalStateException("NOTIFICATION_OUTBOX_DECRYPTION_FAILED");}
    }
    private byte[] binding(UUID id,String recipient,String event,String domain)throws Exception {
        return mapper.writeValueAsString(Arrays.asList(VERSION,id.toString(),recipient,event,domain)).getBytes(StandardCharsets.UTF_8);
    }
}
