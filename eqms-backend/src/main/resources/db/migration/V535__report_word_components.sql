-- Immutable administrator-uploaded report presentation components. No source/signature access.
create table report_word_components (
 id uuid primary key, component_type varchar(10) not null check(component_type in ('cover','header','footer')),
 file_name varchar(255) not null, content bytea not null check(octet_length(content) between 1 and 2097152),
 sha256 char(64) not null, placeholders jsonb not null,
 created_by_user_id uuid not null references app_users(id), created_at timestamptz not null default now()
);
create function guard_report_word_component_immutable() returns trigger language plpgsql as $$
begin raise exception 'REPORT_WORD_COMPONENT_IMMUTABLE'; end $$;
create trigger report_word_component_immutable before update or delete on report_word_components
for each row execute function guard_report_word_component_immutable();
