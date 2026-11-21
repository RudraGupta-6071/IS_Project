import { MyReviews } from '../../../components/my-reviews.jsx';

export const metadata = { title: 'My reviews' };

export default async function MyReviewsPage({ searchParams }) {
  const { offset } = await searchParams;
  return <MyReviews offset={offset} />;
}
