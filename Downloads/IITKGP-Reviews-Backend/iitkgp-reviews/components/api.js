export async function api(path, options = {}) {
  const headers = options.body ? { 'Content-Type': 'application/json' } : undefined;
  const response = await fetch('/api/' + path, { cache: 'no-store', ...options, headers });
  if (response.status === 204) return null;
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = new Error(response.status >= 500 ? 'The service is temporarily unavailable.' :
      data?.error ?? 'The request could not be completed.');
    error.status = response.status;
    throw error;
  }
  if (!data) throw new Error('The server returned an unreadable response.');
  return data;
}

export function queryString(values) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  return params.size ? '?' + params : '';
}
