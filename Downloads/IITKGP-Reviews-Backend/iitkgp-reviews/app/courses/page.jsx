import { Directory } from '../../components/directory.jsx';

export const metadata = { title: 'Courses' };

export default async function CoursesPage({ searchParams }) {
  const params = await searchParams;
  return <Directory key={JSON.stringify(params)} resource="courses" params={params} />;
}
