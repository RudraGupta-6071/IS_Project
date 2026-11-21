import { ReviewEditor } from '../../../../components/review-composer.jsx';

export const metadata = { title: 'Edit review' };

export default async function EditReviewPage({ params }) {
  const { id } = await params;
  return <ReviewEditor key={id} id={id} />;
}
