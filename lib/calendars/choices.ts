import type { AccountView, CalendarChoice } from '@/types/calendar';

export type ChoiceMap = Record<string, CalendarChoice>;

export const choicesFrom = (accounts: AccountView[]): ChoiceMap =>
  Object.fromEntries(
    accounts.flatMap((account) =>
      account.calendars.map((calendar) => [
        calendar.choice.id,
        calendar.choice,
      ]),
    ),
  );

const sameChoice = (left: CalendarChoice, right: CalendarChoice): boolean =>
  left.active === right.active &&
  left.label === right.label &&
  left.color === right.color;

export const changedChoices = (
  current: ChoiceMap,
  saved: ChoiceMap,
): CalendarChoice[] =>
  Object.values(current).filter((choice) => {
    const before = saved[choice.id];
    return !before || !sameChoice(choice, before);
  });

export const hasBlankLabel = (choices: CalendarChoice[]): boolean =>
  choices.some((choice) => !choice.label.trim());
