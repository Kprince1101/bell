import { EventCard } from '@/components/agenda/EventCard';
import { NowLine } from '@/components/agenda/NowLine';
import type { AgendaDayView } from '@/types/agenda';

interface AgendaDayProps {
  day: AgendaDayView;
}

export const AgendaDay = ({ day }: AgendaDayProps) => (
  <section aria-label={day.label} className="space-y-3">
    <h2 className="text-sm font-semibold tracking-wide text-text-muted uppercase">
      {day.label}
    </h2>
    {day.hasNoEvents && (
      <p className="text-sm text-text-muted">Nothing scheduled.</p>
    )}
    <ol className="space-y-3">
      {day.cards.map((card) => (
        <li key={card.key} className="space-y-3">
          {card.showNowLineBefore && <NowLine />}
          <EventCard card={card} />
        </li>
      ))}
    </ol>
    {day.showNowLineAtEnd && <NowLine />}
  </section>
);
