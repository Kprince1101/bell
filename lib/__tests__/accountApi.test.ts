import { requestAccountDeletion, saveTimeZone } from '@/lib/accountApi';

const respond = (status: number, body: unknown) =>
  vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('accountApi', () => {
  it('sends the DELETE confirmation word', async () => {
    const fetchSpy = respond(200, { deleted: true });

    await requestAccountDeletion();

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/account',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ confirm: 'DELETE' }),
      }),
    );
  });

  it('returns the saved time zone', async () => {
    respond(200, { timeZone: 'Asia/Tokyo' });

    expect(await saveTimeZone('Asia/Tokyo')).toBe('Asia/Tokyo');
  });

  it('throws the server error message', async () => {
    respond(400, { error: 'Invalid request' });

    await expect(saveTimeZone('nope')).rejects.toThrow('Invalid request');
  });

  it('throws a generic message when the body is not json', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('oops', { status: 502 }),
    );

    await expect(requestAccountDeletion()).rejects.toThrow(
      'Something went wrong. Please try again.',
    );
  });
});
