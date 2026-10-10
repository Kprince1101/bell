import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { requestAccountDeletion } from '@/lib/accountApi';
import { DELETE_CONFIRMATION } from '@/lib/constants';
import { getErrorMessage } from '@/lib/errors';
import { redirectTo } from '@/lib/navigation';

const resolveDeleteLabel = (isDeleting: boolean): string => {
  if (isDeleting) return 'Deleting...';
  return 'Delete my account';
};

export const useDeleteAccount = () => {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const canDelete = confirmText === DELETE_CONFIRMATION && !isDeleting;

  const handleConfirmChange = (event: ChangeEvent<HTMLInputElement>) => {
    setConfirmText(event.target.value);
  };

  const handleDelete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await requestAccountDeletion();
      redirectTo('/login?notice=deleted');
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    confirmText,
    canDelete,
    deleteError,
    confirmWord: DELETE_CONFIRMATION,
    deleteLabel: resolveDeleteLabel(isDeleting),
    showDeleteError: Boolean(deleteError),
    handleConfirmChange,
    handleDelete,
  };
};
