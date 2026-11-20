-- V820: "a different person" rules for the campaigns of Access Review and of Audit Trail Review (owner decisions 2026-11-19: the rules are OFF until an administrator switches them on; the administrator
-- may switch any of them on or off, with a reason and a signature, in Workflow Authorization).
--
-- Until now nothing kept a reviewer apart from what they review: the person who created a campaign also decided every item and completed it, and could decide the item about their own account (or about an
-- audit entry they made themselves). The engine already knows a FORBIDDEN relation on a policy (V807); the adapters of the two campaigns now resolve the relations below (ReportAndReviewAdapters).
-- No policy row is changed: a rule is ON only while a policy carries an active forbidden relation, which an administrator sets in Workflow Authorization (PUT .../forbidden-relations). Nothing changes
-- in who may do what until then.

-- 1. The relations (resolved by the adapter of the campaign; the id given to it is the campaign or one of its items).
INSERT INTO authorization_relation_definitions (id, code, display_name, resource_type, resolver_code, resolver_config, description, active, version, created_at, updated_at)
SELECT gen_random_uuid(), v.code, v.display_name, v.resource_type, v.resolver, v.config::jsonb, v.description, TRUE, 0, now(), now()
FROM (VALUES
    ('CAMPAIGN_CREATOR', 'Creator of the campaign',       'ACCESS_REVIEW_CAMPAIGN', 'RESOURCE_OWNER',       '{}',
        'The person who created the campaign.'),
    ('ITEM_SUBJECT',     'Person the item is about',      'ACCESS_REVIEW_CAMPAIGN', 'WORKFLOW_PARTICIPANT', '{"participantType": "ITEM_SUBJECT"}',
        'The person whose account the item under review is about.'),
    ('CAMPAIGN_CREATOR', 'Creator of the campaign',       'AUDIT_REVIEW_CAMPAIGN',  'RESOURCE_OWNER',       '{}',
        'The person who created the campaign.'),
    ('ENTRY_PERFORMER',  'Person who made the audit entry', 'AUDIT_REVIEW_CAMPAIGN', 'WORKFLOW_PARTICIPANT', '{"participantType": "ENTRY_PERFORMER"}',
        'The person who performed the action recorded in the audit entry under review.')
) AS v(code, display_name, resource_type, resolver, config, description)
WHERE NOT EXISTS (SELECT 1 FROM authorization_relation_definitions d WHERE d.code = v.code AND d.resource_type = v.resource_type);
