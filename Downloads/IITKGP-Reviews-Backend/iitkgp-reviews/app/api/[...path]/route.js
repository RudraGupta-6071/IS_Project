import { requireSameOrigin, requireStudent, signOut, startSignIn, verifySignIn } from '../../../lib/auth.js';
import { catalogDetail, catalogOptions, listCatalog } from '../../../lib/catalog.js';
import { ApiError, json, respond } from '../../../lib/http.js';
import { createReview, deleteReview, listReviews, ownedReview, updateReview } from '../../../lib/reviews.js';

import { canModerate, moderateReview, moderationQueue, reportReview } from '../../../lib/moderation.js';

export const runtime = 'nodejs';

function handler(request, context) {
  return respond(async () => {
    const { path } = await context.params;
    const [resource, id] = path;
    const method = request.method;

    if (method !== 'GET' && method !== 'HEAD') requireSameOrigin(request);

    if (path.length === 2 && resource === 'auth' && method === 'POST') {
      if (id === 'otp') return startSignIn(request);
      if (id === 'verify') return verifySignIn(request);
      if (id === 'logout') return signOut(request);
    }

    const studentId = await requireStudent(request);
    if (resource === 'auth' && id === 'session' && path.length === 2 && method === 'GET') {
      return json({ authenticated: true, canModerate: await canModerate(studentId) });
    }
    if (resource === 'catalog' && path.length === 1 && method === 'GET') return catalogOptions();
    if ((resource === 'courses' || resource === 'professors') && method === 'GET') {
      if (path.length === 1) return listCatalog(request, resource);
      if (path.length === 2) return catalogDetail(resource, id, request);
    }
    if (resource === 'moderation') {
      if (path.length === 1 && method === 'GET') return moderationQueue(request, studentId);
      if (path.length === 2 && method === 'PATCH') return moderateReview(request, studentId, id);
    }
    if (resource === 'reviews') {
      if (path.length === 3 && path[2] === 'report' && method === 'POST') return reportReview(request, studentId, id);
      if (path.length === 3 && id === 'mine' && method === 'GET') return json(await ownedReview(studentId, path[2]));
      if (path.length === 1 && method === 'GET') return listReviews(request);
      if (path.length === 1 && method === 'POST') return createReview(request, studentId);
      if (path.length === 2 && id === 'mine' && method === 'GET') return listReviews(request, studentId);
      if (path.length === 2 && method === 'PATCH') return updateReview(request, studentId, id);
      if (path.length === 2 && method === 'DELETE') return deleteReview(studentId, id);
    }
    throw new ApiError(404, 'Endpoint not found.');
  });
}

export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
