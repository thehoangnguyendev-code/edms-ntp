-- NOTIFICATION-LANGUAGE-2026-11-26: the in-app wording of Access Profile Changed was the only
-- static template still without its Vietnamese version. Its e-mail sibling and all other static
-- templates already have one, so the list shows this channel as English only. The two training
-- reminders that remain are placeholder-only templates ({{title}} / {{message}}): their wording
-- is built by the sender and has no static sentence to translate.
insert into notification_template_translations
    (policy_id, channel, language, version_number, status, base_version_id, title, summary, subject, body, action_label, change_summary, created_by)
select p.id, 'IN_APP', 'vi',
       (select coalesce(max(version_number), 0) + 1 from notification_template_translations where policy_id = p.id and channel = 'IN_APP' and language = 'vi'),
       'ACTIVE', v.id,
       'Hồ sơ Truy cập đã thay đổi',
       '{{actionName}}: {{entityName}} bởi {{actorName}}. {{actionComment}}',
       null, null, null, 'Bản tiếng Việt bổ sung cho mẫu in-app còn thiếu', null
  from notification_policies p
  join notification_event_definitions e on e.code = p.event_code
  join notification_template_versions v on v.policy_id = p.id and v.channel = 'IN_APP' and v.status = 'ACTIVE'
 where e.code = 'security.access_profile_changed_audit'
   and not exists (
       select 1 from notification_template_translations t
        where t.policy_id = p.id and t.channel = 'IN_APP' and t.language = 'vi' and t.status = 'ACTIVE'
   );
