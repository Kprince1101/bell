export class GoogleApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'GoogleApiError';
    this.status = status;
  }
}

export const SYNC_TOKEN_GONE_STATUS = 410;
const ALREADY_GONE_STATUSES = new Set([400, 401, 404, 410]);

export const hasGoogleStatus = (err: unknown, status: number): boolean =>
  err instanceof GoogleApiError && err.status === status;

export const isAlreadyGone = (err: unknown): boolean =>
  err instanceof GoogleApiError && ALREADY_GONE_STATUSES.has(err.status);
