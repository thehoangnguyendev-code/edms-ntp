package com.eqms.service;

import com.eqms.dto.publishing.PublishingWorkspaceRequest;
import com.eqms.entity.PublishingWorkspaceJob;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.persistence.EntityManager;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

/** Serialization shared by signed Publish and unsigned preview commands. Contains no signature authority. */
@Service
public class PublishingCommandStore {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final EntityManager entities;

    public PublishingCommandStore(JdbcTemplate jdbc, ObjectMapper mapper, EntityManager entities) {
        this.jdbc=jdbc; this.mapper=mapper; this.entities=entities;
    }

    void savePreview(PublishingWorkspaceJob job, PublishingWorkspaceRequest request) {
        entities.flush();
        jdbc.update("""
                insert into publishing_job_commands(job_id,command_type,payload,bundle,content_binding)
                values(?,'PREVIEW',?::jsonb,?::jsonb,?)
                """,job.getId(),json(sanitized(request)),json(previewBundle(job.getRevisionId())),contentBinding(job.getRevisionId()));
    }

    Map<String,Object> previewBundle(UUID revisionId) {
        // Lock the same source row used by replacement/publishing before reading its generation.
        return jdbc.queryForMap("select source_file_checksum,source_storage_version_id from document_revisions where id=? for update",revisionId);
    }

    Map<UUID,String> publishBundle(Map<UUID,String> authorizedBundle) {
        Map<UUID,String> content=new java.util.TreeMap<>();
        for(var entry:authorizedBundle.entrySet()) {
            jdbc.queryForList("select d.id from documents d join document_revisions r on r.document_id=d.id where r.id=? for share of d",entry.getKey());
            String snapshot=jdbc.queryForObject("""
                    select jsonb_build_object(
                      'revision',to_jsonb(r)-array['lock_version','opened_by_user_id','updated_at'],
                      'document',to_jsonb(d)-array['lock_version','opened_by_user_id','updated_at'],
                      'participants',(select jsonb_agg(to_jsonb(p) order by p.id) from revision_workflow_participants p where p.revision_id=r.id),
                      'relations',(select jsonb_agg(jsonb_build_object('link',to_jsonb(l),'target',
                          to_jsonb(target)-array['lock_version','opened_by_user_id','updated_at']) order by l.id)
                          from document_relations l join documents target on target.id=l.target_document_id where l.source_document_id=r.document_id)
                    )::text from document_revisions r join documents d on d.id=r.document_id where r.id=?
                    """,String.class,entry.getKey());
            content.put(entry.getKey(),entry.getValue()+"|"+snapshot);
        }
        return content;
    }

    ObjectNode sanitized(PublishingWorkspaceRequest request) {
        ObjectNode payload=request==null?mapper.createObjectNode():mapper.valueToTree(request);
        payload.remove("signatureToken");
        return payload;
    }

    /** Locks template and metadata so their content cannot change during confirmed execution. */
    String contentBinding(UUID revisionId) {
        jdbc.queryForList("select id from revision_publishing_metadata where revision_id=? for update", revisionId);
        jdbc.queryForList("select id from publishing_templates where id in (select publishing_template_id from revision_publishing_metadata where revision_id=?) for share", revisionId);
        jdbc.queryForList("select id from publishing_template_components where template_id in (select publishing_template_id from revision_publishing_metadata where revision_id=?) for share", revisionId);
        jdbc.queryForList("select id from publishing_template_placeholder_styles where template_id in (select publishing_template_id from revision_publishing_metadata where revision_id=?) for share",revisionId);
        jdbc.queryForList("select id from electronic_signature_settings for share");
        var metadata=jdbc.queryForList("""
                select to_jsonb(m)::text as metadata, to_jsonb(t)::text as template,
                  (select jsonb_agg(to_jsonb(c) order by c.id)::text from publishing_template_components c where c.template_id=t.id) as components,
                  (select jsonb_agg(to_jsonb(s) order by s.id)::text from publishing_template_placeholder_styles s where s.template_id=t.id) as styles,
                  (select jsonb_agg(to_jsonb(e) order by e.id)::text from electronic_signature_settings e) as signature_settings
                from revision_publishing_metadata m left join publishing_templates t on t.id=m.publishing_template_id
                where m.revision_id=?
                """,revisionId);
        if(metadata.isEmpty())throw new IllegalStateException("Publishing preview is required before confirming Publish");
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json(metadata).getBytes(StandardCharsets.UTF_8)));
        } catch(java.security.NoSuchAlgorithmException impossible) {throw new IllegalStateException(impossible);}
    }

    String json(Object value) {
        try{return mapper.writeValueAsString(value);}
        catch(com.fasterxml.jackson.core.JsonProcessingException invalid){throw new IllegalStateException("Cannot serialize publishing command",invalid);}
    }
}
