type MessageTone = 'error' | 'notice';

const TONE_CLASSES: Record<MessageTone, string> = {
  error: 'border-danger/40 text-danger',
  notice: 'border-accent/40 text-accent',
};

interface MessageProps {
  tone: MessageTone;
  text: string | null;
}

export const Message = ({ tone, text }: MessageProps) => (
  <p
    role="status"
    className={`rounded-lg border px-3 py-2 text-center text-sm ${TONE_CLASSES[tone]}`}
  >
    {text}
  </p>
);
