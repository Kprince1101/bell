import { Message } from '@/components/ui/Message';
import type { TimeZoneSetting } from '@/hooks/useAccountClient';

interface TimeZoneFormProps {
  timeZones: string[];
  setting: TimeZoneSetting;
}

export const TimeZoneForm = ({ timeZones, setting }: TimeZoneFormProps) => (
  <form onSubmit={setting.handleSaveTimeZone} className="space-y-3">
    <label htmlFor="time-zone" className="block text-sm font-medium">
      Time zone
    </label>
    <div className="flex gap-3">
      <select
        id="time-zone"
        value={setting.timeZone}
        onChange={setting.handleTimeZoneChange}
        className="flex-1 rounded-lg border border-border bg-background px-3 py-2"
      >
        {timeZones.map((zone) => (
          <option key={zone} value={zone}>
            {zone}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!setting.canSaveTimeZone}
        className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-foreground disabled:opacity-50"
      >
        {setting.saveLabel}
      </button>
    </div>
    {setting.showTimeZoneError && (
      <Message tone="error" text={setting.timeZoneError} />
    )}
  </form>
);
