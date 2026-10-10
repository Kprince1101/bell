interface InviteFormProps {
  formAction: (formData: FormData) => void;
  isPending: boolean;
  submitLabel: string;
}

export const InviteForm = ({
  formAction,
  isPending,
  submitLabel,
}: InviteFormProps) => (
  <form action={formAction} className="flex gap-3">
    <input
      type="email"
      name="email"
      required
      aria-label="Email to invite"
      placeholder="teammate@example.com"
      className="flex-1 rounded-lg border border-border bg-background px-3 py-2"
    />
    <button
      type="submit"
      disabled={isPending}
      className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-foreground disabled:opacity-50"
    >
      {submitLabel}
    </button>
  </form>
);
