import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { saveTimeZone } from '@/lib/accountApi';
import { getErrorMessage } from '@/lib/errors';

const resolveSaveLabel = (isSaving: boolean): string => {
  if (isSaving) return 'Saving...';
  return 'Save';
};

export const useTimeZoneSetting = (initialTimeZone: string) => {
  const [timeZone, setTimeZone] = useState(initialTimeZone);
  const [savedTimeZone, setSavedTimeZone] = useState(initialTimeZone);
  const [isSaving, setIsSaving] = useState(false);
  const [timeZoneError, setTimeZoneError] = useState<string | null>(null);

  const handleTimeZoneChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setTimeZone(event.target.value);
  };

  const handleSaveTimeZone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setTimeZoneError(null);
    try {
      setSavedTimeZone(await saveTimeZone(timeZone));
    } catch (err) {
      setTimeZoneError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return {
    timeZone,
    savedTimeZone,
    timeZoneError,
    saveLabel: resolveSaveLabel(isSaving),
    canSaveTimeZone: timeZone !== savedTimeZone && !isSaving,
    showTimeZoneError: Boolean(timeZoneError),
    handleTimeZoneChange,
    handleSaveTimeZone,
  };
};
