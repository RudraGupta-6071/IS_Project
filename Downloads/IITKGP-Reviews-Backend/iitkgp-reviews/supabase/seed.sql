-- Fictional records for local development.
insert into review_app.student_domains values ('students.example.test', true);
insert into review_app.approved_emails values ('reviewer1@students.example.test'), ('reviewer2@students.example.test');

with department as (
  insert into review_app.departments (code, name) values ('DEMO', 'Demo Department') returning id
), courses as (
  insert into review_app.courses (code, title, department_id, course_type)
  select sample.code, sample.title, department.id, sample.kind from department cross join
    (values ('DEMO101','Introduction to Modelling','regular'),
            ('DEMO201','Applied Modelling Project','project_based')) sample(code,title,kind)
  returning id
), professor as (
  insert into review_app.professors (catalog_key,name,department_id)
  select 'demo-avery','Avery Example',id from department returning id
), term as (
  insert into review_app.academic_terms (start_year,semester) values (2026,'autumn') returning id
), offerings as (
  insert into review_app.course_offerings (course_id,term_id)
  select courses.id,term.id from courses cross join term returning id,term_id
)
insert into review_app.teaching_assignments (offering_id,professor_id,term_id)
select offerings.id,professor.id,offerings.term_id from offerings cross join professor;
