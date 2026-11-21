import { z } from 'zod';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function body(request, schema) {
  let data;
  try {
    data = await request.json();
  } catch {
    throw new ApiError(400, 'Expected a JSON body.');
  }
  return schema.parse(data);
}

export async function respond(action) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError) {
      return json({ error: 'Invalid input.', fields: error.issues.map(({ path, message }) => ({ path, message })) }, 400);
    }
    if (error.code === '23505') return json({ error: 'A review already exists for this target.' }, 409);
    if (error.code === '23503' || error.code === '23514' || error.code === '22021') {
      return json({ error: 'Review data does not match the catalog or rating rules.' }, 400);
    }
    console.error('API request failed', { code: error.code ?? error.name });
    return json({ error: 'Request failed.' }, 500);
  }
}
