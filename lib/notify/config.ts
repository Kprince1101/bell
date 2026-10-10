import { z } from 'zod';

type Env = Record<string, string | undefined>;

const slackEnv = z.object({
  SLACK_CLIENT_ID: z.string().min(1),
  SLACK_CLIENT_SECRET: z.string().min(1),
  SLACK_SIGNING_SECRET: z.string().min(1),
  BELL_APP_URL: z.url(),
});

const pushoverEnv = z.object({
  PUSHOVER_APP_TOKEN: z.string().min(1),
});

const twilioEnv = z.object({
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_FROM_NUMBER: z.string().regex(/^\+[1-9]\d{7,14}$/),
});

const linksEnv = z.object({
  BELL_APP_URL: z.url(),
  BELL_WEBHOOK_SECRET: z.string().min(32),
});

export const SLACK_CALLBACK_PATH = '/api/slack/callback';
export const PUSHOVER_CALLBACK_PATH = '/api/webhooks/pushover';
export const TWILIO_VOICE_PATH = '/api/webhooks/twilio/voice';

export interface SlackConfig {
  clientId: string;
  clientSecret: string;
  signingSecret: string;
  redirectUri: string;
}

export interface PushoverConfig {
  appToken: string;
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export interface LinksConfig {
  appUrl: string;
  webhookSecret: string;
}

const readEnv = <Schema extends z.ZodObject>(
  name: string,
  schema: Schema,
  env: Env,
): z.infer<Schema> => {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      `${name} is not configured: set ${Object.keys(schema.shape).join(', ')}`,
    );
  }
  return parsed.data;
};

export const getSlackConfig = (env: Env = process.env): SlackConfig => {
  const parsed = readEnv('Slack', slackEnv, env);
  return {
    clientId: parsed.SLACK_CLIENT_ID,
    clientSecret: parsed.SLACK_CLIENT_SECRET,
    signingSecret: parsed.SLACK_SIGNING_SECRET,
    redirectUri: new URL(SLACK_CALLBACK_PATH, parsed.BELL_APP_URL).toString(),
  };
};

export const getPushoverConfig = (env: Env = process.env): PushoverConfig => ({
  appToken: readEnv('Pushover', pushoverEnv, env).PUSHOVER_APP_TOKEN,
});

export const getTwilioConfig = (env: Env = process.env): TwilioConfig => {
  const parsed = readEnv('Twilio', twilioEnv, env);
  return {
    accountSid: parsed.TWILIO_ACCOUNT_SID,
    authToken: parsed.TWILIO_AUTH_TOKEN,
    fromNumber: parsed.TWILIO_FROM_NUMBER,
  };
};

export const getLinksConfig = (env: Env = process.env): LinksConfig => {
  const parsed = readEnv('Bell links', linksEnv, env);
  return {
    appUrl: parsed.BELL_APP_URL,
    webhookSecret: parsed.BELL_WEBHOOK_SECRET,
  };
};
