interface GoogleButtonProps {
  disabled: boolean;
  onClick: () => void;
}

export const GoogleButton = ({ disabled, onClick }: GoogleButtonProps) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="w-full rounded-lg bg-foreground py-3 font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
  >
    Continue with Google
  </button>
);
