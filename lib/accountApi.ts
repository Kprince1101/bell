import { DELETE_CONFIRMATION, GENERIC_ERROR_MESSAGE } from '@/lib/constants';

interface AccountApiResponse {
  error?: string;
  timeZone?: string;
  deleted?: boolean;
}

const sendAccountRequest = async (
  method: 'PATCH' | 'DELETE',
  body: Record<string, string>,
): Promise<AccountApiResponse> => {
  const response = await fetch('/api/account', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload: AccountApiResponse = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? GENERIC_ERROR_MESSAGE);
  return payload;
};

export const saveTimeZone = async (timeZone: string): Promise<string> => {
  const payload = await sendAccountRequest('PATCH', { timeZone });
  return payload.timeZone ?? timeZone;
};

export const requestAccountDeletion = async (): Promise<void> => {
  await sendAccountRequest('DELETE', { confirm: DELETE_CONFIRMATION });
};
