import type { ChannelSwitchModel } from '@/hooks/useChannelSwitches';

interface ChannelSwitchProps {
  channel: ChannelSwitchModel;
}

export const ChannelSwitch = ({ channel }: ChannelSwitchProps) => (
  <div className="flex flex-wrap items-center gap-3">
    <label className="flex flex-1 items-center gap-3">
      <input
        type="checkbox"
        checked={channel.active}
        disabled={!channel.canToggle}
        onChange={channel.onToggle}
        aria-label={`${channel.label} on`}
        className="h-4 w-4 accent-accent"
      />
      <span className="font-medium">{channel.label}</span>
      <span className="text-sm text-text-muted">{channel.hint}</span>
    </label>
    <button
      type="button"
      onClick={channel.onTest}
      disabled={!channel.canTest}
      aria-label={`Test ${channel.label}`}
      className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent disabled:opacity-50"
    >
      {channel.testLabel}
    </button>
  </div>
);
