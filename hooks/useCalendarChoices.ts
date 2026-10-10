import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { saveCalendarChoices } from '@/lib/calendarsApi';
import {
  changedChoices,
  choicesFrom,
  hasBlankLabel,
} from '@/lib/calendars/choices';
import type { ChoiceMap } from '@/lib/calendars/choices';
import { CALENDARS_PATH } from '@/lib/constants';
import { getErrorMessage } from '@/lib/errors';
import { redirectTo } from '@/lib/navigation';
import type { AccountView, CalendarChoice } from '@/types/calendar';

const resolveSaveLabel = (isSaving: boolean): string => {
  if (isSaving) return 'Saving and syncing...';
  return 'Save calendars';
};

export const useCalendarChoices = (accounts: AccountView[]) => {
  const [saved] = useState<ChoiceMap>(() => choicesFrom(accounts));
  const [choices, setChoices] = useState<ChoiceMap>(saved);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const changed = changedChoices(choices, saved);

  const updateChoice = (id: string, patch: Partial<CalendarChoice>) => {
    setChoices((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  };

  const handleToggle =
    (id: string) => (event: ChangeEvent<HTMLInputElement>) => {
      updateChoice(id, { active: event.target.checked });
    };

  const handleLabelChange =
    (id: string) => (event: ChangeEvent<HTMLInputElement>) => {
      updateChoice(id, { label: event.target.value });
    };

  const handleColorChange =
    (id: string) => (event: ChangeEvent<HTMLInputElement>) => {
      updateChoice(id, { color: event.target.value });
    };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!changed.length) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveCalendarChoices(changed);
      redirectTo(`${CALENDARS_PATH}?notice=saved`);
    } catch (err) {
      setSaveError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return {
    choices,
    saveError,
    saveLabel: resolveSaveLabel(isSaving),
    canSave: changed.length > 0 && !hasBlankLabel(changed) && !isSaving,
    showSaveError: Boolean(saveError),
    handleToggle,
    handleLabelChange,
    handleColorChange,
    handleSave,
  };
};
