import Link from 'next/link';

interface AppHeaderProps {
  email: string;
  showOwnerLinks: boolean;
}

export const AppHeader = ({ email, showOwnerLinks }: AppHeaderProps) => (
  <header className="flex items-center justify-between border-b border-border px-6 py-4">
    <Link href="/" className="text-xl font-bold text-accent">
      Bell
    </Link>
    <nav className="flex items-center gap-4 text-sm">
      <Link href="/" className="hover:text-accent">
        Agenda
      </Link>
      <Link href="/calendars" className="hover:text-accent">
        Calendars
      </Link>
      <Link href="/notifications" className="hover:text-accent">
        Notifications
      </Link>
      {showOwnerLinks && (
        <Link href="/invites" className="hover:text-accent">
          Invites
        </Link>
      )}
      <Link href="/account" className="hover:text-accent">
        Account
      </Link>
      {showOwnerLinks && (
        <Link href="/health" className="hover:text-accent">
          Health
        </Link>
      )}
      <span className="hidden text-text-muted sm:inline">{email}</span>
      <form action="/auth/signout" method="post">
        <button type="submit" className="text-text-muted hover:text-foreground">
          Sign out
        </button>
      </form>
    </nav>
  </header>
);
