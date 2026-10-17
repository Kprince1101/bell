import { Message } from '@/components/ui/Message';
import type { SecretFieldModel } from '@/hooks/useSecretField';

interface SecretFormProps {
  field: SecretFieldModel;
  label: string;
  placeholder: string;
  type: 'text' | 'tel';
}

export const SecretForm = ({
  field,
  label,
  placeholder,
  type,
}: SecretFormProps) => (
  <form onSubmit={field.handleSubmit} className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <input
        type={type}
        value={field.value}
        onChange={field.handleChange}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5"
      />
      <button
        type="submit"
        disabled={!field.canSave}
        className="rounded-lg bg-accent px-4 py-1.5 font-semibold text-accent-foreground disabled:opacity-50"
      >
        {field.saveLabel}
      </button>
    </div>
    {field.showError && <Message tone="error" text={field.error} />}
  </form>
);
