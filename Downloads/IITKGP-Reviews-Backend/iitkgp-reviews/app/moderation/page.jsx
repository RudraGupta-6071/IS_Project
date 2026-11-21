import { Moderation } from '../../components/moderation.jsx';

export const metadata = { title: 'Review moderation' };

export default async function ModerationPage({ searchParams }) {
  const filters = await searchParams;
  const queue = filters.queue === 'hidden' ? 'hidden' : 'reported';
  const offset = typeof filters.offset === 'string' && /^\d+$/.test(filters.offset) ? Math.min(Number(filters.offset), 1000000) : 0;
  return <Moderation key={queue + ':' + offset} queue={queue} offset={offset} />;
}
