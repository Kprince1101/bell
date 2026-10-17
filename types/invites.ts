export type InviteStatus = 'idle' | 'invited' | 'error';

export interface InviteFormState {
  status: InviteStatus;
  message: string | null;
}

export interface Invite {
  email: string;
  role: string;
  added_at: string;
}

export interface InvitesClientProps {
  invites: Invite[];
}
