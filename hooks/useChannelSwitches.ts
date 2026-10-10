import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useRequest } from '@/hooks/useRequest';
import { CHANNEL_LABELS } from '@/lib/constants';
import { setChannelActive, testChannel } from '@/lib/notificationsApi';
import type { ChannelKind, ChannelView } from '@/types/notifications';

export interface ChannelSwitchModel {
  kind: ChannelKind;
  label: string;
  hint: string | null;
  active: boolean;
  canToggle: boolean;
  canTest: boolean;
  testLabel: string;
  onToggle: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onTest: () => Promise<void>;
}

const resolveTestLabel = (isSending: boolean): string => {
  if (isSending) return 'Sending...';
  return 'Test';
};

const activeByKind = (channels: ChannelView[]): Record<string, boolean> =>
  Object.fromEntries(channels.map((channel) => [channel.kind, channel.active]));

export const useChannelSwitches = (channels: ChannelView[]) => {
  const request = useRequest();
  const [active, setActive] = useState(() => activeByKind(channels));

  const handleToggle =
    (kind: ChannelKind) => async (event: ChangeEvent<HTMLInputElement>) => {
      const next = event.target.checked;
      const saved = await request.run(`toggle:${kind}`, () =>
        setChannelActive(kind, next),
      );
      if (saved) setActive((current) => ({ ...current, [kind]: next }));
    };

  const handleTest = (kind: ChannelKind) => async () => {
    await request.run(
      `test:${kind}`,
      () => testChannel(kind),
      `Test sent by ${CHANNEL_LABELS[kind]}. Check that it reached you.`,
    );
  };

  const switches = Object.fromEntries(
    channels.map((channel): [ChannelKind, ChannelSwitchModel] => [
      channel.kind,
      {
        kind: channel.kind,
        label: CHANNEL_LABELS[channel.kind],
        hint: channel.hint,
        active: active[channel.kind] ?? false,
        canToggle: channel.configured && !request.isBusy,
        canTest: channel.configured && !request.isBusy,
        testLabel: resolveTestLabel(request.isPending(`test:${channel.kind}`)),
        onToggle: handleToggle(channel.kind),
        onTest: handleTest(channel.kind),
      },
    ]),
  ) as Record<ChannelKind, ChannelSwitchModel>;

  return { switches, request };
};
