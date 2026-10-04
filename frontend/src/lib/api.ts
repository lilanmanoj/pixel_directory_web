/**
 * Thin fetch wrapper. All calls go to same-origin /api, which Next rewrites to
 * the backend, so the httpOnly auth cookie is sent automatically.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

function withQuery(path: string, query?: Query) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const res = await fetch(`/api${withQuery(path, query)}`, {
    method,
    credentials: 'same-origin',
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body, e.g. a proxy error page while the API is unreachable.
    if (res.ok) throw new ApiError('Unexpected response from server', res.status);
  }
  if (!res.ok) {
    if (res.status >= 500 && !data?.message) throw new ApiError('The service is unavailable — please try again shortly', res.status);
    const msg = data?.message;
    throw new ApiError(Array.isArray(msg) ? msg.join(' · ') : msg || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
  upload: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ url: string }>('POST', '/uploads', form);
  },
};

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
