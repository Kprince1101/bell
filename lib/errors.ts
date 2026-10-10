export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const getErrorMessage = (
  err: unknown,
  fallback = 'Unknown error',
): string => {
  if (err instanceof Error) return err.message;
  return fallback;
};
