import {
  CHANNEL_NOT_SET_UP,
  CHANNEL_TEST_FAILED,
  NOTIFICATIONS_PATH,
} from '@/lib/constants';
import { ApiError, getErrorMessage } from '@/lib/errors';
import { sendTest } from '@/lib/notify/deliver';
import type { NotifyServices } from '@/lib/notify/services';
import { completeOAuthCallback } from '@/lib/oauthCallback';
import type { ConnectOutcome, OAuthCallback } from '@/lib/oauthCallback';
import type { ChannelKind, ChannelTarget } from '@/types/notifications';

export const SLACK_STATE_COOKIE = 'bell_slack_state';

export const SLACK_CONNECT_REDIRECTS: Record<ConnectOutcome, string> = {
  connected: `${NOTIFICATIONS_PATH}?notice=slack-connected`,
  denied: `${NOTIFICATIONS_PATH}?error=slack-denied`,
  failed: `${NOTIFICATIONS_PATH}?error=slack-failed`,
};

const endingIn = (value: string): string => `ending ${value.slice(-4)}`;

export const savePushoverKey = (
  services: NotifyServices,
  userId: string,
  key: string,
): Promise<void> =>
  services.repo.saveChannelSecret({
    userId,
    kinds: ['pushover'],
    value: key,
    hint: `User key ${endingIn(key)}`,
  });

export const savePhoneNumber = (
  services: NotifyServices,
  userId: string,
  number: string,
): Promise<void> =>
  services.repo.saveChannelSecret({
    userId,
    kinds: ['sms', 'voice'],
    value: number,
    hint: `Number ${endingIn(number)}`,
  });

export const setChannelActive = async (
  services: NotifyServices,
  userId: string,
  kind: ChannelKind,
  active: boolean,
): Promise<void> => {
  const changed = await services.repo.setChannelActive(userId, kind, active);
  if (!changed) throw new ApiError(CHANNEL_NOT_SET_UP, 409);
};

const attemptTest = async (
  services: NotifyServices,
  kind: ChannelKind,
  target: ChannelTarget,
): Promise<string | null> => {
  try {
    await sendTest(services, kind, target);
    return null;
  } catch (err) {
    return getErrorMessage(err);
  }
};

export const testChannel = async (
  services: NotifyServices,
  userId: string,
  kind: ChannelKind,
): Promise<void> => {
  const target = await services.repo.channelTarget(userId, kind);
  if (!target) throw new ApiError(CHANNEL_NOT_SET_UP, 409);
  const error = await attemptTest(services, kind, target);
  await services.repo.recordChannelTest({
    userId,
    kind,
    ok: error === null,
    error,
    at: services.now().toISOString(),
  });
  if (error !== null) {
    services.log(
      `[bell] channel-test user=${userId} channel=${kind} result=failed error=${error}`,
    );
    throw new ApiError(CHANNEL_TEST_FAILED, 502);
  }
  services.log(
    `[bell] channel-test user=${userId} channel=${kind} result=sent`,
  );
};

export const setCalendarQuiet = async (
  services: NotifyServices,
  userId: string,
  calendarId: string,
  quiet: boolean,
): Promise<void> => {
  const changed = await services.repo.setCalendarQuiet(
    userId,
    calendarId,
    quiet,
  );
  if (!changed) throw new ApiError('Unknown calendar', 404);
};

export const connectSlack = async (
  services: NotifyServices,
  userId: string,
  code: string,
): Promise<void> => {
  const install = await services.slack.exchangeCode(code);
  await services.repo.saveSlackInstall(
    install,
    services.encrypt(install.botToken),
    userId,
  );
  await services.repo.saveChannelSecret({
    userId,
    kinds: ['slack'],
    value: install.authedUserId,
    hint: install.teamName,
    slackTeamId: install.teamId,
  });
  await testChannel(services, userId, 'slack');
  services.log(`[bell] slack-connect user=${userId} team=${install.teamId}`);
};

export const completeSlackConnect = (
  services: NotifyServices,
  userId: string,
  callback: OAuthCallback,
): Promise<ConnectOutcome> =>
  completeOAuthCallback(callback, (code) =>
    connectSlack(services, userId, code),
  );
