-- Display name of the event "Object Access Rule Changed" (owner decision 2026-11-27): it is raised when a Knowledge Base share rule is created, changed or taken away, and
-- "object access rule" is the old technical name. The code of the event (security.object_access_rule_changed) is a machine value and does not change.
-- The wording of a template is replaced only while it is still the wording that was shipped; a wording that an administrator edited is left as it is.
UPDATE notification_event_definitions
   SET name = 'Knowledge Base Share Rule Changed',
       description = 'A rule that shares a folder or a document of the Knowledge Base was created, changed or taken away.'
 WHERE code = 'security.object_access_rule_changed';

UPDATE notification_template_versions v
   SET title = 'Knowledge Base Share Rule Changed'
  FROM notification_policies p
 WHERE p.id = v.policy_id AND p.event_code = 'security.object_access_rule_changed' AND v.title = 'Object Access Rule Changed';

UPDATE notification_template_versions v
   SET subject = '[EQMS] Knowledge Base share rule changed: {{entityName}}',
       body = replace(body, 'An <b>object access rule</b> was created, changed or deleted ({{actionName}}). It decides which records a person can see.',
                            'A <b>Knowledge Base share rule</b> was created, changed or taken away ({{actionName}}). It decides who can see a folder or a document of the Knowledge Base.')
  FROM notification_policies p
 WHERE p.id = v.policy_id AND p.event_code = 'security.object_access_rule_changed' AND v.channel = 'EMAIL'
   AND v.subject = '[EQMS] Object access rule changed: {{entityName}}';

UPDATE notification_template_translations t
   SET title = CASE WHEN t.title = 'Thay đổi quy tắc truy cập đối tượng' THEN 'Thay đổi quy tắc chia sẻ Knowledge Base' ELSE t.title END,
       subject = CASE WHEN t.subject = '[EQMS] Thay đổi quy tắc truy cập đối tượng: {{entityName}}' THEN '[EQMS] Thay đổi quy tắc chia sẻ Knowledge Base: {{entityName}}' ELSE t.subject END
  FROM notification_policies p
 WHERE p.id = t.policy_id AND p.event_code = 'security.object_access_rule_changed' AND t.language = 'vi';

UPDATE notification_template_translations t
   SET body = replace(t.body, 'Một <b>quy tắc truy cập đối tượng</b> đã được tạo, sửa hoặc xoá ({{actionName}}). Quy tắc này quyết định người dùng thấy được hồ sơ nào.',
                              'Một <b>quy tắc chia sẻ Knowledge Base</b> đã được tạo, sửa hoặc gỡ ({{actionName}}). Quy tắc này quyết định ai thấy được một thư mục hoặc tài liệu của Knowledge Base.')
  FROM notification_policies p
 WHERE p.id = t.policy_id AND p.event_code = 'security.object_access_rule_changed' AND t.language = 'vi' AND t.channel = 'EMAIL';
