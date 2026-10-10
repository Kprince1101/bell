export const NowLine = () => (
  <div
    role="separator"
    aria-label="Now"
    className="flex items-center gap-2 text-xs font-semibold text-danger"
  >
    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-danger" />
    Now
    <span aria-hidden="true" className="h-px flex-1 bg-danger" />
  </div>
);
