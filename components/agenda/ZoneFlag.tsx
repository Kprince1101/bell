interface ZoneFlagProps {
  text: string | null;
}

export const ZoneFlag = ({ text }: ZoneFlagProps) => (
  <p
    role="note"
    aria-label="Time zone differs"
    className="flex items-start gap-1.5 rounded-lg border border-danger/50 bg-danger/10 px-2 py-1 text-sm font-semibold text-danger"
  >
    <span aria-hidden="true">⚑</span>
    <span>{text}</span>
  </p>
);
