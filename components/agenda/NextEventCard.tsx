import { EventCard } from '@/components/agenda/EventCard';
import type { AgendaCardView } from '@/types/agenda';

interface NextEventCardProps {
  card: AgendaCardView | null;
  countdown: string;
}

export const NextEventCard = ({ card, countdown }: NextEventCardProps) => {
  if (!card) return null;

  return (
    <section
      aria-label="Next event"
      className="sticky top-0 z-10 space-y-2 rounded-xl border border-accent/40 bg-background p-3 shadow-lg"
    >
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold tracking-wide text-accent uppercase">
          Next
        </span>
        <span role="timer" className="text-2xl font-bold tabular-nums">
          {countdown}
        </span>
      </p>
      <EventCard card={card} />
    </section>
  );
};
