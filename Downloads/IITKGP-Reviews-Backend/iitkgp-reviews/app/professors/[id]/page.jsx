import { Details } from '../../../components/details.jsx';

export const metadata = { title: 'Professor details' };

export default async function ProfessorPage({ params, searchParams }) {
  const { id } = await params;
  const { offset, termId } = await searchParams;
  return <Details key={id} id={id} resource="professors" offset={offset} termId={typeof termId === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(termId) ? termId : undefined} />;
}
