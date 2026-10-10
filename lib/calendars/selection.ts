import type { BellServices } from '@/lib/calendars/services';
import { startWatch, stopWatch } from '@/lib/calendars/watch';
import { ApiError, getErrorMessage } from '@/lib/errors';
import { syncCalendar } from '@/lib/sync/syncCalendar';
import type { CalendarChoice, CalendarRow } from '@/types/calendar';

export const activateCalendar = async (
  services: BellServices,
  calendar: CalendarRow,
): Promise<void> => {
  const outcome = await syncCalendar(services, calendar, 'connect');
  if (!outcome.ok) return;
  try {
    await startWatch(services, calendar);
  } catch (err) {
    await services.repo.recordFailure(
      calendar.id,
      `Watch registration failed: ${getErrorMessage(err)}`,
    );
  }
};

export const deactivateCalendar = async (
  services: BellServices,
  calendar: CalendarRow,
): Promise<void> => {
  await stopWatch(services, calendar);
  await services.repo.clearCalendar(calendar.id);
};

const applyChoice = async (
  services: BellServices,
  calendar: CalendarRow,
  choice: CalendarChoice,
): Promise<void> => {
  if (!choice.active && calendar.active) {
    await deactivateCalendar(services, calendar);
  }
  await services.repo.saveChoice(choice);
  if (choice.active && !calendar.active) {
    await activateCalendar(services, { ...calendar, active: true });
  }
};

export const applyCalendarChoices = async (
  services: BellServices,
  userId: string,
  choices: CalendarChoice[],
): Promise<void> => {
  const owned = new Map(
    (await services.repo.calendarsForUser(userId)).map((calendar) => [
      calendar.id,
      calendar,
    ]),
  );
  if (choices.some((choice) => !owned.has(choice.id))) {
    throw new ApiError('Unknown calendar', 404);
  }
  for (const choice of choices) {
    const calendar = owned.get(choice.id);
    if (calendar) await applyChoice(services, calendar, choice);
  }
};
