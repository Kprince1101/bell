interface CalendarsHeaderProps {
  connectHref: string;
}

export const CalendarsHeader = ({ connectHref }: CalendarsHeaderProps) => (
  <section className="flex flex-wrap items-end justify-between gap-4">
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold">Calendars</h1>
      <p className="text-text-muted">
        Bell reads the Google calendars you include and never polls them: Google
        tells Bell when something changes.
      </p>
    </div>
    <a
      href={connectHref}
      className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-foreground"
    >
      Connect a Google account
    </a>
  </section>
);
