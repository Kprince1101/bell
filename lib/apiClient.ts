import { GENERIC_ERROR_MESSAGE } from '@/lib/constants';

interface ApiResponse {
  error?: string;
}

export const sendJson = async (
  url: string,
  init: RequestInit,
): Promise<ApiResponse> => {
  const response = await fetch(url, init);
  const payload: ApiResponse = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? GENERIC_ERROR_MESSAGE);
  return payload;
};

export const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
