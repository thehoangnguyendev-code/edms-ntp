\set ON_ERROR_STOP on
begin;
create temp table out(case_name text, expected text, got text);
create temp table x as
select (select u.id from app_users u where u.status = 'Active' and not exists (select 1 from training_person_positions t where t.person_user_id = u.id and t.valid_to is null) and not exists (select 1 from training_job_assignments j where j.person_user_id = u.id and j.status in ('DRAFT','PENDING_RECEIVER')) order by u.id limit 1) as person,
       (select id from app_users where status = 'Active' order by id offset 1 limit 1) as other,
       (select id from training_job_roles where is_active limit 1) as role,
       gen_random_uuid() as r_new, gen_random_uuid() as r_back, (current_date - 10) as event_day;
insert into training_personnel_reviews(id, person_user_id, kind, event_date, created_by) select r_new, person, 'NEW_HIRE', event_day, other from x;
insert into training_personnel_reviews(id, person_user_id, kind, event_date, absence_from, absence_to, created_by) select r_back, other, 'ABSENCE_RETURN', event_day, current_date - 400, current_date - 20, person from x;
insert into training_personnel_review_items(review_id, item_code, check_type, title, topic_text) select r_new, 'T1', 'TRAINING', 'Check topic', 'Review check topic one' from x;
insert into training_personnel_review_items(review_id, item_code, check_type, title) select r_new, 'SPEC', 'SPECIMEN', 'Specimen' from x;
insert into training_personnel_review_items(review_id, item_code, check_type, title) select r_new, 'JA', 'JOB_ASSIGNMENT', 'Job assignment' from x;
insert into training_personnel_review_items(review_id, item_code, check_type, title) select r_new, 'ROLE', 'JOB_ROLE', 'Job role' from x;
insert into training_personnel_review_items(review_id, item_code, check_type, title) select r_new, 'MAN', 'MANUAL', 'By hand' from x;
insert into training_personnel_review_items(review_id, item_code, check_type, title, topic_text) select r_back, 'T1', 'TRAINING', 'Check topic', 'Review check topic two' from x;

create function pg_temp.st(p_review uuid, p_item varchar) returns text language sql as $$ select training_review_item_state(p_review, p_item) $$;
create function pg_temp.rec(p_person uuid, p_topic text, p_date date) returns void language sql as
$$ insert into training_records(id, person_user_id, activity_id, training_number, topic_text, completed_on, method, result, source, employee_code, full_name, department, position, content_sha256)
   select gen_random_uuid(), p_person, a.activity_id, 'TRN/T/00-1', p_topic, p_date, a.method, a.result, a.source, 'X', 'X', 'X', 'X', 'x'
     from (select activity_id, method, result, source from training_records where source = 'ACTIVITY' limit 1) a $$;

insert into out select 'a topic nobody trained is pending', 'PENDING', pg_temp.st(r_new, 'T1') from x;
insert into out select 'a manual line stays as it was set', 'PENDING', pg_temp.st(r_new, 'MAN') from x;
insert into out select 'a Job Role is missing: pending', 'PENDING', pg_temp.st(r_new, 'ROLE') from x;
update training_personnel_reviews set job_role_ids = array[x.role] from x where id = x.r_new;
insert into out select 'a Job Role is chosen: done', 'DONE', pg_temp.st(r_new, 'ROLE') from x;
select pg_temp.rec(person, 'Review check topic one', current_date - 400) from x;
insert into out select 'a new employee with an earlier record counts it', 'DONE', pg_temp.st(r_new, 'T1') from x;
select pg_temp.rec(other, 'Review check topic two', current_date - 400) from x;
insert into out select 'after an absence a record from before the return does not count', 'PENDING', pg_temp.st(r_back, 'T1') from x;
select pg_temp.rec(other, 'Review check topic two', current_date - 2) from x;
insert into out select 'after an absence a record after the return counts', 'DONE', pg_temp.st(r_back, 'T1') from x;

insert into out select 'no specimen signature: pending', case when exists (select 1 from training_specimen_signatures s, x where s.person_user_id = x.person and s.status = 'APPROVED') then 'DONE' else 'PENDING' end, pg_temp.st(r_new, 'SPEC') from x;
insert into out select 'a job assignment from before the event does not count', case when exists (select 1 from training_job_assignments j, x where j.person_user_id = x.person and j.status = 'EFFECTIVE' and j.effective_at::date >= x.event_day) then 'DONE' else 'PENDING' end, pg_temp.st(r_new, 'JA') from x;

update training_personnel_review_items set status = 'NOT_NEEDED', note = 'check' from x where review_id = x.r_new and item_code = 'T1';
insert into out select 'a line set aside with a reason stays set aside', 'NOT_NEEDED', pg_temp.st(r_new, 'T1') from x;

select case when expected = got then 'ok  ' else 'FAIL' end || ' ' || case_name || ' -> ' || got from out;
rollback;
