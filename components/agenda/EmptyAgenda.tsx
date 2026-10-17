interface EmptyAgendaProps {
  timeZone: string;
}

export const EmptyAgenda = ({ timeZone }: EmptyAgendaProps) => (
  <section className="rounded-xl border border-border bg-card p-8 text-center">
    <h1 className="text-2xl font-semibold">Your agenda is empty</h1>
    <p className="mt-2 text-text-muted">
      Nothing scheduled yet. Connected calendars will show up here.
    </p>
    <p className="mt-4 text-xs text-text-muted">Times shown in {timeZone}</p>
  </section>
);
