import { z } from 'zod';

const googleEnv = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  BELL_APP_URL: z.url(),
  BELL_WEBHOOK_SECRET: z.string().min(32),
});

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  webhookUrl: string;
  webhookSecret: string;
}

export const GOOGLE_CALLBACK_PATH = '/api/google/callback';
export const GOOGLE_WEBHOOK_PATH = '/api/webhooks/google';

export const getGoogleConfig = (
  env: Record<string, string | undefined> = process.env,
): GoogleConfig => {
  const parsed = googleEnv.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      `Google is not configured: set ${Object.keys(googleEnv.shape).join(', ')}`,
    );
  }
  const appUrl = parsed.data.BELL_APP_URL;
  return {
    clientId: parsed.data.GOOGLE_CLIENT_ID,
    clientSecret: parsed.data.GOOGLE_CLIENT_SECRET,
    redirectUri: new URL(GOOGLE_CALLBACK_PATH, appUrl).toString(),
    webhookUrl: new URL(GOOGLE_WEBHOOK_PATH, appUrl).toString(),
    webhookSecret: parsed.data.BELL_WEBHOOK_SECRET,
  };
};
