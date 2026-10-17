import { ChangeBadge } from '@/components/agenda/ChangeBadge';
import { SourceBadges } from '@/components/agenda/SourceBadges';
import { ZoneFlag } from '@/components/agenda/ZoneFlag';
import { cn } from '@/lib/cn';
import type { AgendaCardView } from '@/types/agenda';

interface EventCardProps {
  card: AgendaCardView;
}

export const EventCard = ({ card }: EventCardProps) => (
  <article
    aria-label={card.title}
    className={cn(
      'space-y-2 rounded-xl border border-l-4 border-border bg-card p-4',
      card.isPast && 'opacity-60',
      card.isNow && 'ring-2 ring-danger/60',
    )}
    style={{ borderLeftColor: card.accentColor }}
  >
    <header className="flex items-start justify-between gap-3">
      <h3
        className={cn(
          'min-w-0 font-semibold break-words',
          card.isCancelled && 'text-text-muted line-through',
        )}
      >
        {card.title}
      </h3>
      {card.showMarker && <ChangeBadge label={card.markerLabel} />}
    </header>
    <p
      className={cn(
        'text-sm text-text-muted',
        card.isCancelled && 'line-through',
      )}
    >
      {card.timeLabel}
    </p>
    {card.showPreviousTime && (
      <p className="text-xs text-text-muted line-through">
        {card.previousTime}
      </p>
    )}
    {card.showZoneFlag && <ZoneFlag text={card.zoneFlag} />}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <SourceBadges badges={card.badges} />
      {card.showJoin && (
        <a
          href={card.joinUrl ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-accent hover:underline"
        >
          Join
        </a>
      )}
    </div>
  </article>
);
