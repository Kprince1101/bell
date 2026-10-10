import { Message } from '@/components/ui/Message';
import type { RingingEventsModel } from '@/hooks/useRingingEvents';

interface RingingEventsProps {
  events: RingingEventsModel;
}

export const RingingEvents = ({ events }: RingingEventsProps) => (
  <section className="space-y-3 rounded-xl border border-accent/40 bg-card p-6">
    <h2 className="text-lg font-semibold">Ringing now</h2>
    <ul className="space-y-3">
      {events.rows.map((event) => (
        <li key={event.eventId} className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{event.title}</p>
            <p className="text-sm text-text-muted">
              {event.when} · {event.status}
            </p>
          </div>
          {event.showJoin && (
            <a
              href={event.joinUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent"
            >
              Join
            </a>
          )}
          {event.showAcknowledge && (
            <button
              type="button"
              onClick={event.onAcknowledge}
              disabled={!event.canAcknowledge}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground disabled:opacity-50"
            >
              {event.acknowledgeLabel}
            </button>
          )}
          {event.isAcknowledged && (
            <span className="text-sm text-accent">Acknowledged</span>
          )}
        </li>
      ))}
    </ul>
    {events.showError && <Message tone="error" text={events.error} />}
  </section>
);
