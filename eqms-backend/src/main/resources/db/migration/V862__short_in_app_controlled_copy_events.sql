-- CONTROLLED-COPY-NOTICE-WORDING-2026-11-26: the in-app notice of these events repeated the whole audit comment ("Report lost: ... Type: ... | Method: ... | Reason: ... | Witness: ...").
-- The owner asked for one short sentence in the application and the detail in the e-mail, which has its own text and is not changed. Only wording nobody edited is replaced.
update notification_template_versions t set summary = case p.event_code
    when 'controlled_copy.lost_or_damaged' then '{{entityName}} was reported lost or damaged by {{actorName}}.'
    when 'controlled_copy.requested' then '{{actorName}} requested {{entityName}}.'
    when 'controlled_copy.request_decided' then 'The request for {{entityName}} was decided by {{actorName}}.'
    when 'controlled_copy.reissue_requested' then '{{actorName}} requested a re-issue of {{entityName}}.'
    when 'controlled_copy.recall_evidence_uploaded' then '{{actorName}} uploaded evidence for {{entityName}}.'
    when 'controlled_copy.distribution_failed' then 'The distribution of {{entityName}} failed.'
    else t.summary end,
    change_summary = 'Short in-app wording (the detail is in the e-mail)'
  from notification_policies p
 where t.policy_id = p.id and t.channel = 'IN_APP' and t.status = 'ACTIVE' and t.created_by is null
   and t.summary = '{{actionName}}: {{entityName}} by {{actorName}}. {{actionComment}}'
   and p.event_code in ('controlled_copy.lost_or_damaged', 'controlled_copy.requested', 'controlled_copy.request_decided', 'controlled_copy.reissue_requested', 'controlled_copy.recall_evidence_uploaded', 'controlled_copy.distribution_failed');
