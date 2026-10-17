interface ColorDotProps {
  color: string;
}

export const ColorDot = ({ color }: ColorDotProps) => (
  <span
    aria-hidden="true"
    className="h-3 w-3 shrink-0 rounded-full"
    style={{ backgroundColor: color }}
  />
);
