begin;

alter table review_app.reviews
  add column project_topics text
    check (project_topics is null or (context = 'project' and assignment_id is not null
      and char_length(btrim(project_topics)) between 1 and 600)),
  drop constraint reviews_check,
  add constraint review_rating_fields check (
    (context = 'teaching' and assignment_id is not null and cardinality(project_types) = 0
      and review_app.valid_ratings(ratings, array['teachingQuality','subjectKnowledge','grading','regularity','approachability','workload']))
    or
    (context = 'project' and review_app.valid_project_types(project_types) and (
      (project_topics is null and review_app.valid_ratings(ratings,
        array['topicFreedom','guidance','involvement','workload','evaluation','grading']))
      or
      (project_topics is not null and review_app.valid_ratings(ratings,
        array['teachingQuality','subjectKnowledge','grading','regularity','approachability','workload',
          'topicFreedom','guidance','involvement','projectWorkload','evaluation','projectGrading']))
    ))
  );

create or replace view review_app.student_reviews as
select r.id, a.offering_id, o.course_id, r.professor_id, r.term_id, r.context,
  r.ratings, r.feedback, r.project_types, r.created_at, r.updated_at, r.project_topics
from review_app.reviews r
left join review_app.teaching_assignments a on a.id = r.assignment_id
left join review_app.course_offerings o on o.id = a.offering_id;

grant insert (project_topics), update (project_topics) on review_app.reviews to review_app_api;

commit;

