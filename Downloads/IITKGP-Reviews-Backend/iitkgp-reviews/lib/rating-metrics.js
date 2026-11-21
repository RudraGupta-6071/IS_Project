const projectCommon = {
  topicFreedom: 'Freedom to choose a topic',
  guidance: 'Professor guidance',
  involvement: 'Professor involvement',
  evaluation: 'Project evaluation experience',
};

export const metrics = {
  teaching: {
    teachingQuality: 'Teaching quality',
    subjectKnowledge: 'Subject knowledge',
    grading: 'Course grading',
    regularity: 'Attendance and class regularity',
    approachability: 'Approachability',
    workload: 'Course workload',
  },
  project: { ...projectCommon, workload: 'Project workload', grading: 'Project grading experience' },
  projectCourse: {
    ...projectCommon,
    projectWorkload: 'Project workload',
    projectGrading: 'Project grading experience',
  },
};

export const contextNames = { teaching: 'Teaching', project: 'Project supervision' };
export const courseTypes = { regular: 'Regular', project_based: 'Project-based' };

export const minimumReviewCount = 3;
