import { cn } from '@/lib/cn';

interface AgendaHeaderProps {
  timeZone: string;
  isLive: boolean;
  liveLabel: string;
}

export const AgendaHeader = ({
  timeZone,
  isLive,
  liveLabel,
}: AgendaHeaderProps) => (
  <header className="flex flex-wrap items-baseline justify-between gap-2">
    <div>
      <h1 className="text-2xl font-semibold">Agenda</h1>
      <p className="text-xs text-text-muted">Times shown in {timeZone}</p>
    </div>
    <p
      role="status"
      className="flex items-center gap-1.5 text-xs text-text-muted"
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-2 w-2 rounded-full bg-text-muted',
          isLive && 'bg-accent',
        )}
      />
      {liveLabel}
    </p>
  </header>
);
