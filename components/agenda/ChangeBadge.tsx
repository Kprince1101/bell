interface ChangeBadgeProps {
  label: string;
}

export const ChangeBadge = ({ label }: ChangeBadgeProps) => (
  <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-accent">
    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
    {label}
  </span>
);
