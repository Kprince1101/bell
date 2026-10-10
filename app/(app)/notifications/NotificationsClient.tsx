'use client';

import { ChannelSection } from '@/components/notifications/ChannelSection';
import { ChannelSwitch } from '@/components/notifications/ChannelSwitch';
import { QuietCalendars } from '@/components/notifications/QuietCalendars';
import { RingingEvents } from '@/components/notifications/RingingEvents';
import { SecretForm } from '@/components/notifications/SecretForm';
import { Message } from '@/components/ui/Message';
import { useNotificationsClient } from '@/hooks/useNotificationsClient';
import type { NotificationsClientProps } from '@/types/notifications';

export const NotificationsClient = (props: NotificationsClientProps) => {
  const view = useNotificationsClient(props);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-text-muted">
          Bell escalates until you acknowledge: Slack and a push 30 minutes out,
          a louder push at 10, an emergency push and a text at 2, and a phone
          call when the meeting starts.
        </p>
      </header>
      {view.showNotice && <Message tone="notice" text={view.notice} />}
      {view.showError && <Message tone="error" text={view.error} />}
      {view.events.hasRinging && <RingingEvents events={view.events} />}
      <ChannelSection
        title="Slack"
        description="A DM from the Bell app with Join and Acknowledge buttons, in any workspace you add it to."
      >
        <a
          href={view.slackConnectHref}
          className="inline-block rounded-lg bg-accent px-4 py-2 font-semibold text-accent-foreground"
        >
          {view.slackConnectLabel}
        </a>
        <ChannelSwitch channel={view.switches.slack} />
      </ChannelSection>
      <ChannelSection
        title="Pushover"
        description="Push notifications on your phone. The 2-minute one is an emergency push that repeats every 30 seconds and breaks through quiet modes."
      >
        <SecretForm
          field={view.pushover}
          label="Pushover user key"
          placeholder="Your 30-character user key"
          type="text"
        />
        <ChannelSwitch channel={view.switches.pushover} />
      </ChannelSection>
      <ChannelSection
        title="Phone"
        description="A text 2 minutes out and a call at the start. Reply to the text or press any key on the call to acknowledge."
      >
        <SecretForm
          field={view.phone}
          label="Phone number"
          placeholder="+15125550100"
          type="tel"
        />
        <ChannelSwitch channel={view.switches.sms} />
        <ChannelSwitch channel={view.switches.voice} />
      </ChannelSection>
      {view.channelRequest.showNotice && (
        <Message tone="notice" text={view.channelRequest.notice} />
      )}
      {view.channelRequest.showError && (
        <Message tone="error" text={view.channelRequest.error} />
      )}
      <QuietCalendars quiet={view.quiet} />
    </div>
  );
};
