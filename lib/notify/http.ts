import type { z } from 'zod';

export type Fetch = typeof fetch;

export class ProviderError extends Error {
  readonly provider: string;

  constructor(provider: string, message: string) {
    super(`${provider}: ${message}`);
    this.name = 'ProviderError';
    this.provider = provider;
  }
}

export const FORM_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
};

export const readJson = async (response: Response): Promise<unknown> =>
  response.json().catch(() => null);

export const parseProvider = <Schema extends z.ZodType>(
  provider: string,
  schema: Schema,
  body: unknown,
): z.infer<Schema> => {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ProviderError(provider, 'unexpected response');
  }
  return parsed.data;
};
