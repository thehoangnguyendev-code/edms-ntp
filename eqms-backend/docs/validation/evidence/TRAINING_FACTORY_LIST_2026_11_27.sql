\set ON_ERROR_STOP on
begin;
create temp table out(case_name text, expected text, got text);
create temp table x as
select (select id from departments where name = 'Quality Assurance' limit 1) as qa,
       (select m.department_id from training_matrices m join training_matrix_versions v on v.matrix_id = m.id and v.status = 'EFFECTIVE' where m.scope = 'DEPARTMENT' limit 1) as other,
       (select d.id from departments d where not exists (select 1 from training_matrices m where m.department_id = d.id) limit 1) as no_matrix,
       gen_random_uuid() as fm, gen_random_uuid() as fv;
create temp table before as select (select count(*) from training_effective_requirements r, x where r.department_id = x.other) as other_rows;
insert into training_matrices(id, department_id, code, scope) select fm, qa, 'TM-FACTORY-CHECK', 'FACTORY' from x;
insert into training_matrix_versions(id, matrix_id, version_no) select fv, fm, 1 from x;
insert into training_matrix_rows(id, version_id, row_no, row_group, topic_text, all_employees) select gen_random_uuid(), fv, 1, 'FACTORY_GENERAL', 'Factory safety check topic', true from x;
-- the second row of the factory list repeats a topic the department already has; it is added while the version is a draft (an approved version cannot change)
insert into training_matrix_rows(id, version_id, row_no, row_group, topic_text, all_employees)
select gen_random_uuid(), x.fv, 2, 'FACTORY_GENERAL', d.topic_text, true from x, (select r.topic_text from training_effective_requirements r, x where r.department_id = x.other and r.topic_text is not null limit 1) d;
create temp table dup as select count(*) as n from training_matrix_rows r, x where r.version_id = x.fv and r.row_no = 2;
insert into out select 'a draft factory list requires nothing', '0', (select count(*) from training_effective_requirements r where r.factory)::text;
update training_matrix_versions set status = 'EFFECTIVE' from x where id = x.fv;
insert into out select 'every department has the factory row', ((select count(*) from departments) * (1 + (select n from dup)))::text, (select count(*) from training_effective_requirements r where r.factory)::text;
insert into out select 'a department without a matrix has it', (1 + (select n from dup))::text, (select count(*) from training_effective_requirements r, x where r.department_id = x.no_matrix)::text;
insert into out select 'the rows of a department are kept', ((select other_rows from before) + 1)::text, (select count(*) from training_effective_requirements r, x where r.department_id = x.other)::text;
insert into out select 'the same topic is not required twice', '0', (select count(*) from (select 1 from training_effective_requirements r, x where r.department_id = x.other and r.topic_text is not null group by training_topic_key(r.topic_text) having count(*) > 1) d)::text;
do $$ begin
  insert into training_matrices(id, department_id, code, scope) select gen_random_uuid(), no_matrix, 'TM-FACTORY-CHECK-2', 'FACTORY' from x;
  insert into out values ('a second factory list is refused', 'refused', 'accepted');
exception when unique_violation then
  insert into out values ('a second factory list is refused', 'refused', 'refused');
end $$;
select case when expected = got then 'ok  ' else 'FAIL' end || ' ' || case_name || ' -> ' || got from out;
rollback;
