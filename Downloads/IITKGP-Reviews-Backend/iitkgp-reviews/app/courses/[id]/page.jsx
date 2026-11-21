import { Details } from '../../../components/details.jsx';

export const metadata = { title: 'Course details' };

export default async function CoursePage({ params, searchParams }) {
  const { id } = await params;
  const { offset, termId } = await searchParams;
  return <Details key={id} id={id} resource="courses" offset={offset} termId={typeof termId === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(termId) ? termId : undefined} />;
}
