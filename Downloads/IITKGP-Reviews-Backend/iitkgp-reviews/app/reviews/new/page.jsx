import { ReviewComposer } from '../../../components/review-composer.jsx';

export const metadata = { title: 'Write a review' };

export default async function ReviewPage({ searchParams }) {
  const { courseId, professorId } = await searchParams;
  const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  const course = typeof courseId === 'string' && uuid.test(courseId) ? courseId : '';
  const professor = typeof professorId === 'string' && uuid.test(professorId) ? professorId : '';
  return <ReviewComposer key={course || professor} courseId={course} professorId={course ? '' : professor} />;
}
