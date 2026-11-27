\set ON_ERROR_STOP on
begin;
-- one document with revisions 1.0.0 (requires training) -> 2.0.0 editorial (not) -> later 3.0.0 pending training (requires); a record decides what the person must still do
create temp table t as
select d.id as doc_id, d.document_number as num, (select id from app_users where status='Active' limit 1) as person
  from documents d
 where (select count(*) from document_revisions r where r.document_id=d.id and r.status_code='EFFECTIVE')=1
   and (select count(*) from document_revisions r where r.document_id=d.id and r.status_code='OBSOLETED')=1
   and not exists (select 1 from training_records tr where tr.document_number=d.document_number)
 limit 1;
update document_revisions r set requires_training = true,  revision_number='1.0.0' from t where r.document_id=t.doc_id and r.status_code='OBSOLETED';
update document_revisions r set requires_training = false, revision_number='2.0.0' from t where r.document_id=t.doc_id and r.status_code='EFFECTIVE';
update documents d set periodic_review_cycle = 24 from t where d.id = t.doc_id;

create temp table out(case_name text, expected text, got text);
create function pg_temp.st(p_annual boolean) returns text language sql as
$$ select s.status from t, training_requirement_state(t.person, t.num, null, p_annual) s $$;
create function pg_temp.rec(p_rev text, p_date date) returns void language sql as
$$ insert into training_records(id, person_user_id, activity_id, training_number, topic_text, document_number, document_revision, completed_on, method, result, source, employee_code, full_name, department, position, content_sha256)
   select gen_random_uuid(), t.person, a.activity_id, 'TRN/T/00-1', 'check ' || p_rev, t.num, p_rev, p_date, a.method, a.result, a.source, 'X', 'X', 'X', 'X', 'x'
     from t, (select activity_id, method, result, source from training_records where source='ACTIVITY' limit 1) a $$;

insert into out select 'never trained, latest revision editorial', 'MISSING', pg_temp.st(false);
select pg_temp.rec('1.0.0', current_date - 30);
insert into out select 'trained on 1.0.0, 2.0.0 editorial', 'OK', pg_temp.st(true);
update document_revisions r set requires_training = true from t where r.document_id=t.doc_id and r.status_code='EFFECTIVE';
insert into out select 'trained on 1.0.0, 2.0.0 requires training', 'UPDATE_NEEDED', pg_temp.st(false);
select pg_temp.rec('2.0.0', current_date - 20);
insert into out select 'trained on 2.0.0', 'OK', pg_temp.st(true);
update document_revisions r set revision_number='1.5.0' from t where r.document_id=t.doc_id and r.status_code='EFFECTIVE';
insert into out select 'trained on a later revision than the required one', 'OK', pg_temp.st(false);
-- records cannot be changed (immutable), so other people carry the older dates
create temp table p as select id, row_number() over (order by id) as n from (select id from app_users where status='Active' and id <> (select person from t) order by id limit 2) x;
create function pg_temp.old(p_n int, p_months int) returns void language sql as
$$ insert into training_records(id, person_user_id, activity_id, training_number, topic_text, document_number, document_revision, completed_on, method, result, source, employee_code, full_name, department, position, content_sha256)
   select gen_random_uuid(), p.id, a.activity_id, 'TRN/T/00-1', 'check old ' || p_n, t.num, '2.0.0', (current_date - make_interval(months => p_months))::date, a.method, a.result, a.source, 'X', 'X', 'X', 'X', 'x'
     from t, p, (select activity_id, method, result, source from training_records where source='ACTIVITY' limit 1) a where p.n = p_n $$;
create function pg_temp.st_of(p_n int, p_annual boolean) returns text language sql as
$$ select s.status from t, p, training_requirement_state(p.id, t.num, null, p_annual) s where p.n = p_n $$;
select pg_temp.old(1, 25);
select pg_temp.old(2, 13);
insert into out select 'older than the 24 month review cycle', 'DUE', pg_temp.st_of(1, true);
insert into out select 'not an annual row: no periodic due', 'OK', pg_temp.st_of(1, false);
insert into out select '13 months inside a 24 month cycle', 'OK', pg_temp.st_of(2, true);
update documents d set periodic_review_cycle = null from t where d.id = t.doc_id;
insert into out select '13 months, no cycle -> 12 months', 'DUE', pg_temp.st_of(2, true);
update document_revisions r set requires_training = false from t where r.document_id=t.doc_id;
insert into out select 'no revision ever required, has a record', 'OK', pg_temp.st(false);
insert into training_record_voids(id, record_id, reason, voided_by) select gen_random_uuid(), tr.id, 'check', t.person from training_records tr, t where tr.person_user_id=t.person and tr.document_number=t.num;
insert into out select 'records voided', 'MISSING', pg_temp.st(false);

select case when expected = got then 'ok  ' else 'FAIL' end || ' ' || case_name || ' -> ' || got from out;
rollback;
