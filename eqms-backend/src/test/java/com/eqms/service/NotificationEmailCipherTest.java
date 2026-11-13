package com.eqms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class NotificationEmailCipherTest {
    String key=Base64.getEncoder().encodeToString(new byte[32]);
    @Test void encryptsWithFreshNonceAndBindsCiphertextToItsExactDelivery(){
        var cipher=new NotificationEmailCipher(key,new ObjectMapper());var id=UUID.randomUUID();
        var original=new NotificationEmailCipher.Content("Secret subject","Password: fixture-password",Map.of("previewPassword","fixture-password"));
        String first=cipher.seal(id,"recipient","event","domain",original),second=cipher.seal(id,"recipient","event","domain",original);
        assertNotEquals(first,second);assertFalse(first.contains("fixture-password"));assertFalse(first.contains("Secret subject"));
        assertEquals(original,cipher.open(id,"recipient","event","domain",first));
        assertThrows(IllegalStateException.class,()->cipher.open(UUID.randomUUID(),"recipient","event","domain",first));
        assertThrows(IllegalStateException.class,()->cipher.open(id,"other-recipient","event","domain",first));
        assertThrows(IllegalStateException.class,()->cipher.open(id,"recipient","other-event","domain",first));
        byte[] otherKey=new byte[32];otherKey[0]=1;
        assertThrows(IllegalStateException.class,()->new NotificationEmailCipher(Base64.getEncoder().encodeToString(otherKey),new ObjectMapper()).open(id,"recipient","event","domain",first));
    }
    @Test void aFileThatGoesWithTheMessageIsSealedWithItAndComesBackUnchanged(){
        var cipher=new NotificationEmailCipher(key,new ObjectMapper());var id=UUID.randomUUID();
        byte[] pdf="%PDF-1.7 attendance list of Nguyen Van A".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String envelope=cipher.seal(id,"recipient","event","domain",new NotificationEmailCipher.Content("Subject","Body",Map.of(),"list.pdf",pdf));
        assertFalse(envelope.contains(Base64.getEncoder().encodeToString(pdf)));   // the file is not in the clear in the row
        var opened=cipher.open(id,"recipient","event","domain",envelope);
        assertEquals("list.pdf",opened.attachmentName());
        assertArrayEquals(pdf,opened.attachment());
        // a row written before files existed opens with no file
        var plain=cipher.open(id,"recipient","event","domain",cipher.seal(id,"recipient","event","domain",new NotificationEmailCipher.Content("S","B",Map.of())));
        assertNull(plain.attachment());assertNull(plain.attachmentName());
    }
    @Test void missingOrInvalidKeyFailsClosedWithoutEchoingTheKey(){
        for(String value:List.of("","secret-not-base64","AA==")){
            var error=assertThrows(IllegalStateException.class,()->new NotificationEmailCipher(value,new ObjectMapper()));
            if(!value.isEmpty())assertFalse(error.getMessage().contains(value));
        }
    }
}
