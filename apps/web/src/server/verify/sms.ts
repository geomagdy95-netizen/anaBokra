/**
 * SMS delivery for the parent phone check. The provider is not chosen yet (an Egyptian SMS
 * provider, so the number is handled in Egypt); until then only the dev console sender exists,
 * and production refuses to send rather than fall back to a provider abroad.
 */
export interface SmsSender {
  readonly name: string;
  send(phone: string, text: string): Promise<void>;
}

export class SmsUnavailableError extends Error {
  constructor() {
    super('sms_unavailable');
  }
}

/** Development only: prints the message instead of sending it. */
export class ConsoleSmsSender implements SmsSender {
  readonly name = 'console';
  readonly sent: { phone: string; text: string }[] = [];
  async send(phone: string, text: string) {
    this.sent.push({ phone, text });
    console.info(`[sms:console] to ${phone.slice(0, -3).replace(/\d/g, '•')}${phone.slice(-3)}: ${text}`);
  }
}

export function smsSenderFromEnv(env: NodeJS.ProcessEnv = process.env): SmsSender | null {
  const provider = env.SMS_PROVIDER ?? (env.NODE_ENV === 'production' ? '' : 'console');
  if (provider === 'console' && env.NODE_ENV !== 'production') return new ConsoleSmsSender();
  // [Add the Egyptian SMS provider adapter here once chosen.]
  return null;
}
