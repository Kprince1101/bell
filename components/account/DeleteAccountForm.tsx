import { Message } from '@/components/ui/Message';
import type { AccountDeletion } from '@/hooks/useAccountClient';

interface DeleteAccountFormProps {
  deletion: AccountDeletion;
}

export const DeleteAccountForm = ({ deletion }: DeleteAccountFormProps) => (
  <form
    onSubmit={deletion.handleDelete}
    className="space-y-3 rounded-xl border border-danger/40 p-6"
  >
    <h2 className="text-lg font-semibold text-danger">Delete my account</h2>
    <p className="text-sm text-text-muted">
      This removes your account and everything Bell holds for you, right now.
      Nothing is kept and it cannot be undone.
    </p>
    <label htmlFor="delete-confirm" className="block text-sm">
      Type {deletion.confirmWord} to confirm
    </label>
    <input
      id="delete-confirm"
      value={deletion.confirmText}
      onChange={deletion.handleConfirmChange}
      autoComplete="off"
      className="w-full rounded-lg border border-border bg-background px-3 py-2"
    />
    <button
      type="submit"
      disabled={!deletion.canDelete}
      className="w-full rounded-lg bg-danger py-2 font-semibold text-foreground disabled:opacity-50"
    >
      {deletion.deleteLabel}
    </button>
    {deletion.showDeleteError && (
      <Message tone="error" text={deletion.deleteError} />
    )}
  </form>
);
