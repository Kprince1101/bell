import type { ChangeEvent, FormEvent } from 'react';

interface MagicLinkFormProps {
  email: string;
  isSending: boolean;
  submitLabel: string;
  onEmailChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export const MagicLinkForm = ({
  email,
  isSending,
  submitLabel,
  onEmailChange,
  onSubmit,
}: MagicLinkFormProps) => (
  <form onSubmit={onSubmit} className="space-y-3">
    <input
      type="email"
      required
      aria-label="Email address"
      placeholder="you@example.com"
      autoComplete="email"
      value={email}
      onChange={onEmailChange}
      className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-text-muted focus:border-accent focus:outline-none"
    />
    <button
      type="submit"
      disabled={isSending}
      className="w-full rounded-lg bg-accent py-3 font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {submitLabel}
    </button>
  </form>
);
