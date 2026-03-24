/**
 * Shared fetch helpers for client-side API calls.
 *
 * Browser-only — auth token comes from localStorage via getStoredSession().
 * Do not import in Server Components or route handlers.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
  ) {
    super(`${status} ${statusText}${body ? `: ${body}` : ''}`);
    this.name = 'ApiError';
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session available — proceed without auth
  }
  return headers;
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, res.statusText, body);
  }
}

function parseJson<T>(res: Response): Promise<T> {
  if (res.status === 204) return Promise.resolve(null as T);
  return res.json();
}

export async function fetchJson<T>(url: string): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(url, { headers });
  await throwIfNotOk(res);
  return parseJson<T>(res);
}

export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  await throwIfNotOk(res);
  return parseJson<T>(res);
}

export async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  await throwIfNotOk(res);
  return parseJson<T>(res);
}

export async function deleteJson<T>(url: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method: 'DELETE',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  await throwIfNotOk(res);
  return parseJson<T>(res);
}
