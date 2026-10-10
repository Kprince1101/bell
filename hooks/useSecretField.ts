import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRequest } from '@/hooks/useRequest';
import { NOTIFICATIONS_PATH } from '@/lib/constants';
import { redirectTo } from '@/lib/navigation';

const resolveSaveLabel = (isSaving: boolean): string => {
  if (isSaving) return 'Saving...';
  return 'Save';
};

export const useSecretField = (save: (value: string) => Promise<void>) => {
  const request = useRequest();
  const [value, setValue] = useState('');

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const saved = await request.run('save', () => save(value.trim()));
    if (saved) redirectTo(`${NOTIFICATIONS_PATH}?notice=channel-saved`);
  };

  return {
    value,
    error: request.error,
    showError: request.showError,
    canSave: value.trim().length > 0 && !request.isBusy,
    saveLabel: resolveSaveLabel(request.isBusy),
    handleChange,
    handleSubmit,
  };
};

export type SecretFieldModel = ReturnType<typeof useSecretField>;
