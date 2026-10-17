import { useChannelSwitches } from '@/hooks/useChannelSwitches';
import { useQuietCalendars } from '@/hooks/useQuietCalendars';
import { useRingingEvents } from '@/hooks/useRingingEvents';
import { useSecretField } from '@/hooks/useSecretField';
import { SLACK_CONNECT_PATH } from '@/lib/constants';
import { savePhoneNumber, savePushoverKey } from '@/lib/notificationsApi';
import type { NotificationsClientProps } from '@/types/notifications';

const resolveSlackLabel = (connected: boolean): string => {
  if (connected) return 'Reconnect Slack';
  return 'Add to Slack';
};

export const useNotificationsClient = ({
  channels,
  calendars,
  ringing,
  error,
  notice,
}: NotificationsClientProps) => {
  const { switches, request: channelRequest } = useChannelSwitches(channels);
  const pushover = useSecretField(savePushoverKey);
  const phone = useSecretField(savePhoneNumber);
  const quiet = useQuietCalendars(calendars);
  const events = useRingingEvents(ringing);
  const slackConnected = channels.some(
    (channel) => channel.kind === 'slack' && channel.configured,
  );

  return {
    switches,
    channelRequest,
    pushover,
    phone,
    quiet,
    events,
    slackConnectHref: SLACK_CONNECT_PATH,
    slackConnectLabel: resolveSlackLabel(slackConnected),
    error,
    notice,
    showError: Boolean(error),
    showNotice: Boolean(notice),
  };
};
