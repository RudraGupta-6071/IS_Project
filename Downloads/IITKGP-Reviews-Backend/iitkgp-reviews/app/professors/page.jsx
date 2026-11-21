import { Directory } from '../../components/directory.jsx';

export const metadata = { title: 'Professors' };

export default async function ProfessorsPage({ searchParams }) {
  const params = await searchParams;
  return <Directory key={JSON.stringify(params)} resource="professors" params={params} />;
}
