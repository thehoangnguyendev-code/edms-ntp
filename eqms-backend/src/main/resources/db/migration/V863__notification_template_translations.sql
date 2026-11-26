-- NOTIFICATION-LANGUAGE-2026-11-26: the Vietnamese wording of a notification. It is a table of its own on purpose: everything that reads notification_template_versions keeps
-- reading the English wording and cannot pick a translation by mistake. A translation names the English version it translates; once that version is replaced the
-- translation is no longer used until somebody saves it again. Rows are never changed in their wording: a save archives the previous one and adds the next number.
create table notification_template_translations (
    id                    uuid primary key default gen_random_uuid(),
    policy_id             uuid         not null references notification_policies(id) on delete cascade,
    channel               varchar(20)  not null check (channel in ('IN_APP', 'EMAIL')),
    language              varchar(5)   not null check (language in ('vi')),
    version_number        integer      not null,
    status                varchar(20)  not null check (status in ('ACTIVE', 'ARCHIVED')),
    base_version_id       uuid         not null references notification_template_versions(id) on delete cascade,
    title                 varchar(255),
    summary               varchar(500),
    subject               varchar(255),
    body                  text,
    action_label          varchar(80),
    change_summary        varchar(500),
    created_by            uuid references app_users(id),
    created_at            timestamptz  not null default now(),
    constraint uq_notification_translation_version unique (policy_id, channel, language, version_number)
);

create unique index uq_notification_translation_active on notification_template_translations (policy_id, channel, language) where status = 'ACTIVE';
