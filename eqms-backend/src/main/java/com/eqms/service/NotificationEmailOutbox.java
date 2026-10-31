package com.eqms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

/** Enqueue joins the dispatcher's DB transaction. SMTP delivery deliberately runs outside it. */
@Service
public class NotificationEmailOutbox {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final EmailNotificationService email;
    private NotificationEmailCipher cipher;
    @org.springframework.beans.factory.annotation.Autowired
    public void configureCipher(NotificationEmailCipher cipher) {this.cipher=cipher;}

    public NotificationEmailOutbox(JdbcTemplate jdbc,ObjectMapper mapper,EmailNotificationService email) {
        this.jdbc=jdbc; this.mapper=mapper; this.email=email;
    }

    public void enqueue(String recipient,String subject,String body,String event,String domain,Map<String,String> payload) {
        enqueue(recipient,subject,body,event,domain,payload,false);
    }

    public void enqueue(String recipient,String subject,String body,String event,String domain,Map<String,String> payload,boolean mandatory) {
        UUID id=UUID.randomUUID();
        String envelope=cipher.seal(id,recipient,event,domain,new NotificationEmailCipher.Content(subject,body,payload==null?Map.of():payload));
        jdbc.update("""
                insert into notification_email_outbox(id,recipient_email,subject,body,event_code,event_domain,payload,priority,encryption_version)
                values(?,?,?,?,?,?,?::jsonb,?,?)
                """,id,recipient,"[encrypted]","[encrypted]",event,domain,envelope,mandatory?100:0,NotificationEmailCipher.VERSION);
    }

    public boolean deliverOne() {
        if (org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("Email outbox delivery must run outside the business transaction");
        }
        UUID claim=UUID.randomUUID();
        var rows=jdbc.queryForList("""
                with candidate as (select id from notification_email_outbox where status='PENDING' order by priority desc,created_at
                  for update skip locked limit 1)
                update notification_email_outbox o set status='SENDING',claim_id=?,claimed_at=now()
                from candidate where o.id=candidate.id returning o.*
                """,claim);
        if(rows.isEmpty())return false;
        var row=rows.getFirst();
        boolean sent;
        try {
            var content=content(row);
            sent=email.sendRenderedEmailWithTracking(row.get("recipient_email").toString(),content.subject(),
                    content.body(),row.get("event_code").toString(),(String)row.get("event_domain"),content.payload());
        } catch(Exception failure) {
            // The existing tracked sender handles known SMTP failures. Unexpected exceptions may
            // happen after an external send; retain uncertainty instead of blindly resending.
            if(jdbc.update("update notification_email_outbox set status='UNKNOWN',error_code='DELIVERY_OUTCOME_UNKNOWN',completed_at=now() where id=? and claim_id=? and status='SENDING'",row.get("id"),claim)==1) flagForReview(row);
            return true;
        }
        jdbc.update("update notification_email_outbox set status=?,error_code=?,completed_at=now() where id=? and claim_id=? and status='SENDING'",
                sent?"SENT":"FAILED",sent?null:"DELIVERY_FAILED",row.get("id"),claim);
        return true;
    }

    public int flagInterruptedDeliveries() {
        // No automatic SMTP replay: a crash can occur after the recipient already received it.
        var rows=jdbc.queryForList("""
                with candidate as (select id from notification_email_outbox where status='SENDING'
                  and claimed_at<now()-interval '15 minutes' order by claimed_at for update skip locked limit 50)
                update notification_email_outbox o set status='UNKNOWN',error_code='WORKER_INTERRUPTED',completed_at=now()
                from candidate where o.id=candidate.id returning o.*
                """);
        for(var row:rows)flagForReview(row);
        return rows.size();
    }

    private void flagForReview(Map<String,Object> row) {
        try {
            email.recordUncertainDelivery(row.get("recipient_email").toString(),row.get("event_code").toString(),(String)row.get("event_domain"),content(row).payload());
        } catch(Exception invalidPayload) {
            email.recordUncertainDelivery(row.get("recipient_email").toString(),row.get("event_code").toString(),(String)row.get("event_domain"),Map.of());
        }
    }

    private NotificationEmailCipher.Content content(Map<String,Object> row)throws Exception {
        Object version=row.get("encryption_version");
        if(version!=null) {
            if(!NotificationEmailCipher.VERSION.equals(version))throw new IllegalStateException("NOTIFICATION_OUTBOX_ENCRYPTION_UNSUPPORTED");
            return cipher.open((UUID)row.get("id"),row.get("recipient_email").toString(),row.get("event_code").toString(),(String)row.get("event_domain"),row.get("payload").toString());
        }
        Map<String,String> payload=mapper.readValue(row.get("payload").toString(),mapper.getTypeFactory().constructMapType(Map.class,String.class,String.class));
        return new NotificationEmailCipher.Content(row.get("subject").toString(),row.get("body").toString(),payload);
    }
}
