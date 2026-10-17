import Link from 'next/link';
import { CALENDARS_PATH } from '@/lib/constants';

interface UnhealthyCalendarsNoticeProps {
  message: string;
}

export const UnhealthyCalendarsNotice = ({
  message,
}: UnhealthyCalendarsNoticeProps) => (
  <p
    role="alert"
    className="mb-6 rounded-lg border border-danger/40 px-4 py-3 text-sm text-danger"
  >
    {message}{' '}
    <Link href={CALENDARS_PATH} className="font-semibold underline">
      See calendars
    </Link>
  </p>
);
